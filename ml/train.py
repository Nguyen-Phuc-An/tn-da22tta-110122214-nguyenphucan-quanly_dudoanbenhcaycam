"""
GIAI ĐOẠN 3: Huấn luyện model CNN phát hiện bệnh cây có múi
Dataset: Tự động lấy từ backend/uploads/training/
Giải pháp: Load dữ liệu theo batch từ disk (không chứa trong RAM)
Kết quả: model.h5 + disease_labels.json

╔════════════════════════════════════════════════════════════════════════════╗
║                     🎯 GIẢI THUẬT CHÍNH                                    ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║ 1. TRANSFER LEARNING (MobileNetV2)                                        ║
║    - Load model pretrained trên ImageNet                                  ║
║    - Freeze các layer cơ bản (giữ nguyên đặc trưng)                       ║
║    - Fine-tune layer cuối trên N loại bệnh (tự động phát hiện)           ║
║    - Kết quả: Model nhỏ, huấn luyện nhanh, độ chính xác cao              ║
║                                                                            ║
║ 2. DATA AUGMENTATION (ImageDataGenerator)                                 ║
║    - Rotation (±20°) → Mô phỏng lá ở góc khác                             ║
║    - Width/Height Shift (20%) → Mô phỏng vị trí khác                      ║
║    - Horizontal Flip → Lá được chụp hai bên                               ║
║    - Zoom (20%) → Khoảng cách chụp khác nhau                              ║
║    - Rescale [0-255] → [0-1] → Chuẩn hóa giá trị pixel                   ║
║    - Kết quả: Từ N ảnh → 100,000+ biến thể                               ║
║                                                                            ║
║ 3. BATCH LOADING (flow_from_directory)                                    ║
║    - Tải 32 ảnh/batch từ disk thay vì load toàn bộ vào RAM                ║
║    - Mỗi epoch, ảnh được augment khác nhau                                ║
║    - Cho phép huấn luyện trên máy yếu                                     ║
║                                                                            ║
║ 4. TRAIN/VALIDATION/TEST SPLIT (80/10/10)                                  ║
║    - 80% → Huấn luyện                                                     ║
║    - 10% → Validation (phát hiện overfitting)                             ║
║    - 10% → Test (đánh giá cuối cùng)                                       ║
║                                                                            ║
║ 5. SOFTMAX CLASSIFICATION + CLASS WEIGHTS                                  ║
║    - Chuyển logit thành xác suất: P(class) = exp(logit) / Σ(exp(logit))   ║
║    - Class weights để cân bằng dataset imbalance                          ║
║    - Output: N giá trị [0-100%] đại diện cho N loại bệnh                  ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import os
import json
import shutil
from pathlib import Path
import numpy as np
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from sklearn.metrics import classification_report, precision_score, recall_score, f1_score
from sklearn.model_selection import train_test_split

# ============================================================================
# 1. CẤU HÌNH
# ============================================================================

# Lấy dữ liệu từ backend uploads (tự động phát hiện bệnh mới)
BACKEND_PATH = os.path.join(os.path.dirname(__file__), "..", "backend")
DATASET_DIR = os.path.join(BACKEND_PATH, "uploads", "training")
MODEL_PATH = "model.h5"
LABEL_FILE = "disease_labels.json"
TRAINING_REPORT_FILE = "training_report.json"
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 10

# Map tiếng Việt (tự động cập nhật dựa trên bệnh có sẵn)
LABEL_VI = {
    "black_spot": "Bệnh đốm đen",
    "canker": "Bệnh loét",
    "greening": "Bệnh vàng lá gân xanh",
    "healthy": "Lá khỏe mạnh",
    "deficiency": "Thiếu dinh dưỡng",
    "greasy_spot": "Bệnh đốm dầu",
    "leafminer": "Sâu vẽ bùa",
    "multiple": "Nhiều bệnh",
    "citrus_leaf_curl": "Bệnh xoăn lá",
    "leaf_eating_worm": "Sâu ăn lá",
    "melanose": "Bệnh nấm melanose",
}

print("=" * 70)
print("🤖 HUẤN LUYỆN MODEL - PHÁT HIỆN BỆNH CÂY CÓ MÚI")
print("=" * 70)
print(f"📁 Dataset: {DATASET_DIR}")
print(f"🖼️  Kích thước ảnh: {IMG_SIZE}x{IMG_SIZE}")
print(f"📊 Batch size: {BATCH_SIZE}")
print(f"🚀 Epochs: {EPOCHS}")
print()


# ============================================================================
# 2. HỖ TRỢ CHỨC NĂNG
# ============================================================================

def normalize_disease_name(name):
    """Chuẩn hóa tên bệnh: chuyển thành slug (lowercase, no spaces, no accents)"""
    import unicodedata
    
    # Xóa diacritics (ế, á, etc)
    nfd = unicodedata.normalize('NFD', name)
    without_accents = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    
    # Chuyển thành lowercase, thay space bằng underscore
    slug = without_accents.lower().strip()
    slug = slug.replace(' ', '_')
    slug = slug.replace('-', '_')
    
    # Giữ chỉ alphanumeric + underscore
    slug = ''.join(c for c in slug if c.isalnum() or c == '_')
    
    return slug


# ============================================================================
# 3. CHUẨN HÓA DATASET (Gộp dữ liệu gốc + ảnh upload mới)
# ============================================================================

def organize_dataset():
    """Gộp dữ liệu gốc từ datasets/ + ảnh upload mới từ backend/uploads/training/"""
    
    print("📂 Đang sắp xếp dataset (gộp dữ liệu gốc + upload mới)...")
    
    organized_dir = "organized_dataset"
    
    # Xóa nếu đã tồn tại
    if os.path.exists(organized_dir):
        shutil.rmtree(organized_dir)
    
    os.makedirs(organized_dir, exist_ok=True)
    
    # Đếm ảnh
    image_count = {}
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.JPG', '.JPEG', '.PNG', '.BMP', '.WEBP'}
    
    # ========== BƯỚC 1: Copy dữ liệu gốc từ ml/datasets/ (8 class) ==========
    print("\n  📁 Source 1: Dataset gốc (ml/datasets/)")
    original_datasets_path = Path("datasets")
    
    LABEL_MAPPING = {
        "Black spot": "black_spot",
        "Canker": "canker",
        "Greening": "greening",
        "Healthy": "healthy",
        "Citrus_Canker_Diseases_Leaf_Orange": "canker",
        "Citrus_Nutrient_Deficiency_Yellow_Leaf_Orange": "deficiency",
        "Healthy_Leaf_Orange": "healthy",
        "Multiple_Diseases_Leaf_Orange": "multiple",
        "Young_Healthy_Leaf_Orange": "healthy",
        "deficiency": "deficiency",
        "greasy spot": "greasy_spot",
        "huanglongbing": "greening",
        "leafminer": "leafminer",
        "phytophthora": "multiple",
    }
    
    if original_datasets_path.exists():
        for dataset_dir in original_datasets_path.iterdir():
            if not dataset_dir.is_dir():
                continue
            
            for disease_dir in dataset_dir.iterdir():
                if not disease_dir.is_dir():
                    continue
                
                disease_name = disease_dir.name
                
                # Skip nếu chưa map
                if disease_name not in LABEL_MAPPING:
                    continue
                
                standardized_name = LABEL_MAPPING[disease_name]
                standardized_path = os.path.join(organized_dir, standardized_name)
                os.makedirs(standardized_path, exist_ok=True)
                
                # Copy ảnh
                image_files = [f for f in disease_dir.iterdir() 
                             if f.is_file() and f.suffix in image_extensions]
                
                for img_file in image_files:
                    try:
                        dst = os.path.join(standardized_path, img_file.name)
                        shutil.copy2(img_file, dst)
                        image_count[standardized_name] = image_count.get(standardized_name, 0) + 1
                    except Exception as e:
                        print(f"    ✗ Lỗi copy {img_file.name}: {e}")
        
        # In tổng từ source 1
        source1_total = sum(image_count.values())
        print(f"    ✓ Sao chép xong: {source1_total} ảnh")
    else:
        print(f"    ⚠️  Không tìm thấy datasets/ (OK nếu chỉ dùng upload mới)")
    
    # ========== BƯỚC 2: Copy ảnh upload mới từ backend/uploads/training/ ==========
    print("\n  📁 Source 2: Upload mới (backend/uploads/training/)")
    backend_training_path = Path(DATASET_DIR)
    
    source2_count = 0
    if backend_training_path.exists():
        for disease_dir in backend_training_path.iterdir():
            if not disease_dir.is_dir():
                continue
            
            disease_name = disease_dir.name
            
            # Chuẩn hóa tên: "Sâu ăn lá" → "sau_an_la"
            normalized_name = normalize_disease_name(disease_name)
            
            # Tạo thư mục chuẩn hóa
            standardized_path = os.path.join(organized_dir, normalized_name)
            os.makedirs(standardized_path, exist_ok=True)
            
            # Copy ảnh
            image_files = [f for f in disease_dir.iterdir() 
                         if f.is_file() and f.suffix in image_extensions]
            
            for img_file in image_files:
                try:
                    dst = os.path.join(standardized_path, img_file.name)
                    shutil.copy2(img_file, dst)
                    image_count[normalized_name] = image_count.get(normalized_name, 0) + 1
                    source2_count += 1
                except Exception as e:
                    print(f"    ✗ Lỗi copy {img_file.name}: {e}")
        
        print(f"    ✓ Sao chép xong: {source2_count} ảnh upload mới")
    else:
        print(f"    ⚠️  Không tìm thấy {DATASET_DIR}")
    
    # In kết quả gộp
    if not image_count:
        print(f"\n❌ Không tìm thấy ảnh nào từ cả 2 nguồn!")
        return None, {}
    
    print(f"\n✓ Sắp xếp xong ({organized_dir})")
    print(f"  Phân bố ảnh:")
    total_images = 0
    for disease, count in sorted(image_count.items()):
        print(f"    - {disease}: {count} ảnh")
        total_images += count
    print(f"  📊 Tổng: {total_images} ảnh (gốc: {sum(image_count.values()) - source2_count}, upload: {source2_count})\n")
    
    return organized_dir, image_count


def split_dataset(organized_dir):
    """Tách dataset thành train/val/test theo tỉ lệ 80/10/10."""

    print("📂 Đang tách dataset thành train/val/test (80/10/10)...")

    split_root = "split_dataset"
    if os.path.exists(split_root):
        shutil.rmtree(split_root)

    split_dirs = {
        'train': os.path.join(split_root, 'train'),
        'val': os.path.join(split_root, 'val'),
        'test': os.path.join(split_root, 'test'),
    }

    for path in split_dirs.values():
        os.makedirs(path, exist_ok=True)

    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.JPG', '.JPEG', '.PNG', '.BMP', '.WEBP'}

    for disease_dir in Path(organized_dir).iterdir():
        if not disease_dir.is_dir():
            continue

        class_name = disease_dir.name
        files = [p for p in disease_dir.iterdir() if p.is_file() and p.suffix in image_extensions]

        if len(files) == 0:
            continue

        train_files, temp_files = train_test_split(files, test_size=0.2, random_state=42, shuffle=True)
        val_files, test_files = train_test_split(temp_files, test_size=0.5, random_state=42, shuffle=True)

        for subset_name, subset_files in [('train', train_files), ('val', val_files), ('test', test_files)]:
            subset_class_dir = os.path.join(split_dirs[subset_name], class_name)
            os.makedirs(subset_class_dir, exist_ok=True)

            for img_file in subset_files:
                shutil.copy2(img_file, os.path.join(subset_class_dir, img_file.name))

        print(f"  ✓ {class_name}: train={len(train_files)}, val={len(val_files)}, test={len(test_files)}")

    print(f"✓ Tách xong dataset tại: {split_root}\n")
    return split_dirs


# ============================================================================
# 3. TẠO DATA GENERATORS (Load batch từ disk)
# ============================================================================

def create_data_generators(split_dirs):
    """Tạo ImageDataGenerator cho train/validation/test."""
    
    print("📊 Tạo data generators (train/val/test)...")
    
    # Augmentation cho training
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        zoom_range=0.2,
    )
    
    # Chỉ rescale cho validation/test
    eval_datagen = ImageDataGenerator(rescale=1./255)
    
    # Training generator
    train_generator = train_datagen.flow_from_directory(
        split_dirs['train'],
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=True
    )
    
    # Validation generator
    val_generator = eval_datagen.flow_from_directory(
        split_dirs['val'],
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False
    )

    # Test generator
    test_generator = eval_datagen.flow_from_directory(
        split_dirs['test'],
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False
    )
    
    return train_generator, val_generator, test_generator


# ============================================================================
# 4. XÂY DỰNG MODEL (Transfer Learning - MobileNetV2)
# ============================================================================

def build_model(num_classes):
    """Tạo model transfer learning với MobileNetV2"""
    
    print("🏗️  Xây dựng model (Transfer Learning - MobileNetV2)...")
    
    # Load MobileNetV2 pretrained (ImageNet)
    base_model = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights='imagenet'
    )
    
    # Freeze base model
    base_model.trainable = False
    
    # Tạo model
    model = keras.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(num_classes, activation='softmax')
    ])
    
    # Compile
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=1e-3),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model


# ============================================================================
# 5. HUẤN LUYỆN MODEL
# ============================================================================

def train_model(model, train_gen, val_gen, num_classes):
    """Huấn luyện model"""
    
    print(f"\n🚀 Huấn luyện {EPOCHS} epochs...")
    print(f"  📊 Classes: {num_classes}")
    print(f"  📦 Batch size: {BATCH_SIZE}")
    
    # Tính số step
    train_steps = len(train_gen)
    val_steps = len(val_gen)
    
    print(f"  ⏳ Train steps/epoch: {train_steps}")
    print(f"  ⏳ Val steps/epoch: {val_steps}\n")
    
    # Tính class weights để cân bằng dataset imbalance
    # DirectoryIterator không có samples_per_class, nên phải đếm file thủ công
    class_weights = {}
    samples_per_class = {}
    
    # Đếm ảnh trong mỗi class folder
    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.JPG', '.JPEG', '.PNG', '.BMP', '.WEBP'}
    for class_name in train_gen.class_indices.keys():
        class_dir = os.path.join(train_gen.directory, class_name)
        if os.path.isdir(class_dir):
            num_files = len([f for f in os.listdir(class_dir) 
                           if os.path.isfile(os.path.join(class_dir, f)) 
                           and os.path.splitext(f)[1] in image_extensions])
            samples_per_class[class_name] = num_files
    
    total_samples = sum(samples_per_class.values())
    
    print("⚖️ Class Weights (cân bằng dataset imbalance):")
    for class_name, num_samples in samples_per_class.items():
        class_index = train_gen.class_indices[class_name]
        weight = total_samples / (num_classes * max(num_samples, 1))
        class_weights[class_index] = weight
        print(f"    {class_name}: weight={weight:.3f} ({num_samples} ảnh)")
    
    print()
    
    # Train
    history = model.fit(
        train_gen,
        steps_per_epoch=train_steps,
        validation_data=val_gen,
        validation_steps=val_steps,
        epochs=EPOCHS,
        class_weight=class_weights if class_weights else None,
        verbose=1
    )
    
    return history


def evaluate_classification_metrics(model, val_gen):
    """Tính precision/recall/F1 trên tập validation."""

    print("\n📈 ĐÁNH GIÁ MÔ HÌNH TRÊN VALIDATION")
    val_gen.reset()

    y_prob = model.predict(val_gen, verbose=0)
    y_pred = np.argmax(y_prob, axis=1)
    y_true = val_gen.classes[:len(y_pred)]

    precision_macro = precision_score(y_true, y_pred, average='macro', zero_division=0)
    recall_macro = recall_score(y_true, y_pred, average='macro', zero_division=0)
    f1_macro = f1_score(y_true, y_pred, average='macro', zero_division=0)

    precision_weighted = precision_score(y_true, y_pred, average='weighted', zero_division=0)
    recall_weighted = recall_score(y_true, y_pred, average='weighted', zero_division=0)
    f1_weighted = f1_score(y_true, y_pred, average='weighted', zero_division=0)

    print("📊 Macro average:")
    print(f"  Precision: {precision_macro:.4f}")
    print(f"  Recall:    {recall_macro:.4f}")
    print(f"  F1-score:  {f1_macro:.4f}")

    print("\n📊 Weighted average:")
    print(f"  Precision: {precision_weighted:.4f}")
    print(f"  Recall:    {recall_weighted:.4f}")
    print(f"  F1-score:  {f1_weighted:.4f}")

    print("\n📋 Classification report:")
    target_names = [name for name, _ in sorted(val_gen.class_indices.items(), key=lambda item: item[1])]
    print(
        classification_report(
            y_true,
            y_pred,
            labels=list(range(len(target_names))),
            target_names=target_names,
            zero_division=0,
        )
    )

    return {
        'precision_macro': precision_macro,
        'recall_macro': recall_macro,
        'f1_macro': f1_macro,
        'precision_weighted': precision_weighted,
        'recall_weighted': recall_weighted,
        'f1_weighted': f1_weighted,
    }


def evaluate_test_metrics(model, test_gen):
    """Tính precision/recall/F1 trên tập test riêng biệt."""

    print("\n🧪 ĐÁNH GIÁ MÔ HÌNH TRÊN TEST")
    test_gen.reset()

    y_prob = model.predict(test_gen, verbose=0)
    y_pred = np.argmax(y_prob, axis=1)
    y_true = test_gen.classes[:len(y_pred)]

    precision_macro = precision_score(y_true, y_pred, average='macro', zero_division=0)
    recall_macro = recall_score(y_true, y_pred, average='macro', zero_division=0)
    f1_macro = f1_score(y_true, y_pred, average='macro', zero_division=0)

    precision_weighted = precision_score(y_true, y_pred, average='weighted', zero_division=0)
    recall_weighted = recall_score(y_true, y_pred, average='weighted', zero_division=0)
    f1_weighted = f1_score(y_true, y_pred, average='weighted', zero_division=0)

    print("📊 Macro average (test):")
    print(f"  Precision: {precision_macro:.4f}")
    print(f"  Recall:    {recall_macro:.4f}")
    print(f"  F1-score:  {f1_macro:.4f}")

    print("\n📊 Weighted average (test):")
    print(f"  Precision: {precision_weighted:.4f}")
    print(f"  Recall:    {recall_weighted:.4f}")
    print(f"  F1-score:  {f1_weighted:.4f}")

    print("\n📋 Test classification report:")
    target_names = [name for name, _ in sorted(test_gen.class_indices.items(), key=lambda item: item[1])]
    print(
        classification_report(
            y_true,
            y_pred,
            labels=list(range(len(target_names))),
            target_names=target_names,
            zero_division=0,
        )
    )

    return {
        'precision_macro': precision_macro,
        'recall_macro': recall_macro,
        'f1_macro': f1_macro,
        'precision_weighted': precision_weighted,
        'recall_weighted': recall_weighted,
        'f1_weighted': f1_weighted,
    }


# ============================================================================
# 6. LƯUACL MODEL VÀ MAPPING
# ============================================================================

def save_model_and_labels(model, train_gen):
    """Lưu model và file mapping labels"""
    
    print(f"\n💾 Lưu model: {MODEL_PATH}")
    model.save(MODEL_PATH)
    
    # Lấy class mapping
    class_indices = train_gen.class_indices  # {'disease': 0, ...}
    class_names = list(class_indices.keys())
    class_names.sort(key=lambda x: class_indices[x])  # Sắp xếp theo index
    
    # Tạo label mapping
    label_mapping = {
        "classes": class_names,
        "class_indices": class_indices,
        "class_vi": {disease: LABEL_VI.get(disease, disease) for disease in class_names},
        "num_classes": len(class_names),
    }
    
    # Lưu JSON
    print(f"✓ Lưu mappinè: {LABEL_FILE}")
    with open(LABEL_FILE, "w", encoding="utf-8") as f:
        json.dump(label_mapping, f, indent=2, ensure_ascii=False)
    
    # In ra
    print(f"\n📊 Class mapping:")
    for disease, idx in sorted(class_indices.items(), key=lambda x: x[1]):
        vi_name = LABEL_VI.get(disease, disease)
        print(f"  {idx}. {disease:20} → {vi_name}")
    
    return class_names


# ============================================================================
# 7. IN KẾT QUẢ TRAINING
# ============================================================================

def print_results(history, model_name, metrics=None):
    """In ra kết quả training"""
    
    print("\n" + "=" * 70)
    print("📈 KẾT QUẢ TRAINING")
    print("=" * 70)
    
    # Lấy các metric cuối cùng
    final_train_acc = history.history['accuracy'][-1] * 100
    final_val_acc = history.history['val_accuracy'][-1] * 100
    final_train_loss = history.history['loss'][-1]
    final_val_loss = history.history['val_loss'][-1]
    
    print(f"\n📊 Accuracy:")
    print(f"  Train: {final_train_acc:.2f}%")
    print(f"  Val:   {final_val_acc:.2f}%")
    
    print(f"\n📊 Loss:")
    print(f"  Train: {final_train_loss:.4f}")
    print(f"  Val:   {final_val_loss:.4f}")

    if metrics and metrics.get('test'):
        test_metrics = metrics['test']
        print(f"\n🧪 Test metrics:")
        print(f"  Precision (weighted): {test_metrics['precision_weighted']:.4f}")
        print(f"  Recall (weighted):    {test_metrics['recall_weighted']:.4f}")
        print(f"  F1-score (weighted):  {test_metrics['f1_weighted']:.4f}")
    
    print(f"\n✅ Model đã lưu: {model_name}")
    print(f"✅ Label mapping: {LABEL_FILE}")
    print("=" * 70)


def save_training_report(history, metrics):
    """Lưu kết quả huấn luyện ra file JSON để backend đọc lại."""

    training_report = {
        'trainingResults': {
            'train_accuracy': history.history['accuracy'][-1],
            'val_accuracy': history.history['val_accuracy'][-1],
            'train_loss': history.history['loss'][-1],
            'val_loss': history.history['val_loss'][-1],
            'best_val_accuracy': max(history.history['val_accuracy']),
            'best_val_loss': min(history.history['val_loss']),
        },
        'evaluation': metrics,
    }

    with open(TRAINING_REPORT_FILE, 'w', encoding='utf-8') as f:
        json.dump(training_report, f, indent=2, ensure_ascii=False)

    print(f"✅ Training report saved: {TRAINING_REPORT_FILE}")


# ============================================================================
# 8. MAIN
# ============================================================================

if __name__ == "__main__":
    try:
        # Bước 1: Chuẩn hóa dataset
        organized_dir, image_count = organize_dataset()
        
        if len(image_count) == 0:
            print("❌ Lỗi: Không tìm thấy ảnh nào!")
            exit(1)
        
        # Bước 2: Tách train/val/test
        split_dirs = split_dataset(organized_dir)

        # Bước 3: Tạo generators
        train_gen, val_gen, test_gen = create_data_generators(split_dirs)
        num_classes = len(train_gen.class_indices)
        
        # Bước 4: Xây dựng model
        model = build_model(num_classes)
        print(f"\n✓ Model tạo xong ({num_classes} classes)")
        
        # Bước 5: Huấn luyện
        history = train_model(model, train_gen, val_gen, num_classes)
        
        # Bước 6: Lưu
        class_names = save_model_and_labels(model, train_gen)
        
        # Bước 7: Đánh giá Precision / Recall / F1 trên validation
        metrics = evaluate_classification_metrics(model, val_gen)

        # Bước 8: Đánh giá cuối cùng trên test
        metrics['test'] = evaluate_test_metrics(model, test_gen)

        # Bước 9: In kết quả
        print_results(history, MODEL_PATH, metrics)

        # Bước 10: Lưu report cho frontend/backend
        save_training_report(history, metrics)
        
    except Exception as e:
        print(f"\n❌ LỖI: {e}")
        import traceback
        traceback.print_exc()
