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

SCRIPT_DIR = Path(__file__).resolve().parent

# Nguồn dữ liệu chuẩn hóa cho training
BACKEND_PATH = SCRIPT_DIR.parent / "backend"
DATASET_SOURCE_DIR = SCRIPT_DIR / "datasets"
TRAINING_IMAGES_DIR = BACKEND_PATH / "uploads" / "training"
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


CANONICAL_DISEASE_ALIASES = {
    'black_spot': 'black_spot',
    'dom_den': 'black_spot',
    'benh_dom_den': 'black_spot',
    'bệnh_đốm_đen': 'black_spot',
    'canker': 'canker',
    'loet': 'canker',
    'benh_loet': 'canker',
    'bệnh_loét': 'canker',
    'citrus_canker_diseases_leaf_orange': 'canker',
    'greening': 'greening',
    'huanglongbing': 'greening',
    'vang_la_gan_xanh': 'greening',
    'vàng_lá_gân_xanh': 'greening',
    'healthy': 'healthy',
    'khoe': 'healthy',
    'la_khoe_manh': 'healthy',
    'lá_khỏe_mạnh': 'healthy',
    'deficiency': 'deficiency',
    'thieu_dinh_duong': 'deficiency',
    'thiếu_dinh_dưỡng': 'deficiency',
    'greasy_spot': 'greasy_spot',
    'dom_dau': 'greasy_spot',
    'benh_dom_dau': 'greasy_spot',
    'bệnh_đốm_dầu': 'greasy_spot',
    'leafminer': 'leafminer',
    'sau_ve_bua': 'leafminer',
    'sâu_vẽ_bùa': 'leafminer',
    'multiple': 'multiple',
    'hon_hop': 'multiple',
    'hỗn_hợp': 'multiple',
    'citrus_leaf_curl': 'citrus_leaf_curl',
    'xoan_la': 'citrus_leaf_curl',
    'xoăn_lá': 'citrus_leaf_curl',
    'leaf_eating_worm': 'leaf_eating_worm',
    'sau_an_la': 'leaf_eating_worm',
    'sâu_ăn_lá': 'leaf_eating_worm',
}


def resolve_canonical_disease_key(name):
    """Đưa mọi tên bệnh về một hệ label canonical duy nhất."""
    if not name:
        return ''

    normalized = normalize_disease_name(name)
    return CANONICAL_DISEASE_ALIASES.get(normalized, normalized)


SOURCE1_LABEL_MAPPING = {
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


# ============================================================================
# 3. CHUẨN HÓA DATASET (Gộp dữ liệu gốc + ảnh upload mới)
# ============================================================================

def _copy_images_to_class_dirs(source_root, destination_root, class_mapper):
    """Copy ảnh từ source_root vào destination_root theo class canonical."""

    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}
    counts = {}

    source_root = Path(source_root)
    destination_root = Path(destination_root)

    if not source_root.exists():
        return counts

    for top_dir in source_root.iterdir():
        if not top_dir.is_dir():
            continue

        for disease_dir in top_dir.iterdir():
            if not disease_dir.is_dir():
                continue

            class_name = class_mapper(disease_dir.name)
            if not class_name or class_name == 'melanose':
                continue

            class_dir = destination_root / class_name
            class_dir.mkdir(parents=True, exist_ok=True)

            for img_file in disease_dir.iterdir():
                if not img_file.is_file() or img_file.suffix.lower() not in image_extensions:
                    continue

                shutil.copy2(img_file, class_dir / img_file.name)
                counts[class_name] = counts.get(class_name, 0) + 1

    return counts


def build_gop_dataset():
    """Gộp ml/datasets thành gop_dataset."""

    print("📂 Đang xây dựng gop_dataset từ ml/datasets...")

    if GOP_DATASET_DIR.exists():
        shutil.rmtree(GOP_DATASET_DIR)
    GOP_DATASET_DIR.mkdir(parents=True, exist_ok=True)

    counts = _copy_images_to_class_dirs(
        DATASET_SOURCE_DIR,
        GOP_DATASET_DIR,
        lambda name: SOURCE1_LABEL_MAPPING.get(name, resolve_canonical_disease_key(name)),
    )

    total = sum(counts.values())
    print(f"  ✓ gop_dataset: {total} ảnh")
    for disease, count in sorted(counts.items()):
        print(f"    - {disease}: {count} ảnh")
    print()

    return counts


def build_organized_dataset():
    """Gộp gop_dataset với backend/uploads/training để tạo organized_dataset."""

    print("📂 Đang xây dựng organized_dataset từ gop_dataset + training uploads...")

    if ORGANIZED_DATASET_DIR.exists():
        shutil.rmtree(ORGANIZED_DATASET_DIR)
    ORGANIZED_DATASET_DIR.mkdir(parents=True, exist_ok=True)

    counts = {}
    source2_count = 0

    if GOP_DATASET_DIR.exists():
        for disease_dir in GOP_DATASET_DIR.iterdir():
            if not disease_dir.is_dir():
                continue

            class_dir = ORGANIZED_DATASET_DIR / disease_dir.name
            class_dir.mkdir(parents=True, exist_ok=True)

            for img_file in disease_dir.iterdir():
                if img_file.is_file() and img_file.suffix.lower() in {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}:
                    shutil.copy2(img_file, class_dir / img_file.name)
                    counts[disease_dir.name] = counts.get(disease_dir.name, 0) + 1

    if TRAINING_IMAGES_DIR.exists():
        for disease_dir in TRAINING_IMAGES_DIR.iterdir():
            if not disease_dir.is_dir():
                continue

            class_name = resolve_canonical_disease_key(disease_dir.name)
            if not class_name or class_name == 'melanose':
                continue

            class_dir = ORGANIZED_DATASET_DIR / class_name
            class_dir.mkdir(parents=True, exist_ok=True)

            for img_file in disease_dir.iterdir():
                if img_file.is_file() and img_file.suffix.lower() in {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}:
                    shutil.copy2(img_file, class_dir / img_file.name)
                    counts[class_name] = counts.get(class_name, 0) + 1
                    source2_count += 1

    total = sum(counts.values())
    print(f"  ✓ organized_dataset: {total} ảnh (gốc: {total - source2_count}, upload: {source2_count})")
    for disease, count in sorted(counts.items()):
        print(f"    - {disease}: {count} ảnh")
    print()

    return counts


def organize_dataset():
    """Tạo gop_dataset rồi gộp với upload để ra organized_dataset."""

    build_gop_dataset()
    organized_dir = build_organized_dataset()

    if not organized_dir:
        print("\n❌ Không tìm thấy ảnh nào từ cả 2 nguồn!")
        return None, {}

    return str(ORGANIZED_DATASET_DIR), organized_dir


def split_dataset(organized_dir):
    """Tách dataset thành train/val/test theo tỉ lệ 80/10/10."""

    print("📂 Đang tách dataset thành train/val/test (80/10/10)...")

    split_root = str(SCRIPT_DIR / "split_dataset")
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
