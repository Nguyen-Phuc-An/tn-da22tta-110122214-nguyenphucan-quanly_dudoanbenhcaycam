"""
RETRAIN ML MODEL - Hybrid Training
Kết hợp organized_dataset (9 bệnh cũ) + training uploads (bệnh mới/ảnh bổ sung)
Output: model.h5 cập nhật (N-class, N >= 9)
"""

import sys
import os

# Fix encoding for Windows
if sys.platform == 'win32':
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

import json
import shutil
from pathlib import Path
import numpy as np
import cv2
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.optimizers import Adam
from sklearn.metrics import classification_report, precision_score, recall_score, f1_score

# ===== ARGUMENTS =====
if len(sys.argv) < 4:
    print("Usage: python retrain_model.py <organized_dataset_dir> <training_images_dir> <output_model_path>")
    sys.exit(1)

ORGANIZED_DATASET_DIR = Path(sys.argv[1]).resolve()
TRAINING_IMAGES_DIR = Path(sys.argv[2]).resolve()
OUTPUT_MODEL_PATH = Path(sys.argv[3]).resolve()
ML_DIR = ORGANIZED_DATASET_DIR.parent
DATASET_SOURCE_DIR = ML_DIR / 'datasets'
GOP_DATASET_DIR = ML_DIR / 'gop_dataset'
SPLIT_DATASET_DIR = ML_DIR / 'split_dataset'

# ===== CONSTANTS =====
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 5  # Retrain = fewer epochs (faster)
EXCLUDED_CLASSES = {"melanose"}


def normalize_disease_name(name):
    """Chuẩn hóa tên bệnh thành slug không dấu."""

    import unicodedata

    nfd = unicodedata.normalize('NFD', name)
    without_accents = ''.join(c for c in nfd if unicodedata.category(c) != 'Mn')
    slug = without_accents.lower().strip().replace(' ', '_').replace('-', '_')
    slug = ''.join(c for c in slug if c.isalnum() or c == '_')
    return slug


SOURCE1_LABEL_MAPPING = {
    'Black spot': 'black_spot',
    'Canker': 'canker',
    'Greening': 'greening',
    'Healthy': 'healthy',
    'Citrus_Canker_Diseases_Leaf_Orange': 'canker',
    'Citrus_Nutrient_Deficiency_Yellow_Leaf_Orange': 'deficiency',
    'Healthy_Leaf_Orange': 'healthy',
    'Multiple_Diseases_Leaf_Orange': 'multiple',
    'Young_Healthy_Leaf_Orange': 'healthy',
    'deficiency': 'deficiency',
    'greasy spot': 'greasy_spot',
    'huanglongbing': 'greening',
    'leafminer': 'leafminer',
    'phytophthora': 'multiple',
}


def resolve_canonical_disease_key(name):
    """Đưa tên folder bệnh về class canonical dùng chung."""

    if not name:
        return ''

    normalized = normalize_disease_name(name)
    alias_map = {
        'black_spot': 'black_spot',
        'dom_den': 'black_spot',
        'benh_dom_den': 'black_spot',
        'canker': 'canker',
        'loet': 'canker',
        'benh_loet': 'canker',
        'citrus_canker_diseases_leaf_orange': 'canker',
        'greening': 'greening',
        'huanglongbing': 'greening',
        'vang_la_gan_xanh': 'greening',
        'healthy': 'healthy',
        'khoe': 'healthy',
        'la_khoe_manh': 'healthy',
        'deficiency': 'deficiency',
        'thieu_dinh_duong': 'deficiency',
        'greasy_spot': 'greasy_spot',
        'dom_dau': 'greasy_spot',
        'benh_dom_dau': 'greasy_spot',
        'leafminer': 'leafminer',
        'sau_ve_bua': 'leafminer',
        'multiple': 'multiple',
        'hon_hop': 'multiple',
        'citrus_leaf_curl': 'citrus_leaf_curl',
        'xoan_la': 'citrus_leaf_curl',
        'leaf_eating_worm': 'leaf_eating_worm',
        'sau_an_la': 'leaf_eating_worm',
    }

    return alias_map.get(normalized, normalized)


def crop_to_leaf_region(image_array):
    """Cắt vùng lá ước lượng để giảm ảnh hưởng của nền và viền ảnh."""

    if image_array is None or image_array.size == 0:
        return image_array

    try:
        image_uint8 = np.clip(image_array, 0, 255).astype(np.uint8)
        hsv = cv2.cvtColor(image_uint8, cv2.COLOR_RGB2HSV)
        lower_green = np.array([20, 25, 20], dtype=np.uint8)
        upper_green = np.array([95, 255, 255], dtype=np.uint8)
        mask = cv2.inRange(hsv, lower_green, upper_green)

        kernel = np.ones((5, 5), np.uint8)
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)

        contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        if not contours:
            return image_array

        largest = max(contours, key=cv2.contourArea)
        if cv2.contourArea(largest) < image_uint8.shape[0] * image_uint8.shape[1] * 0.03:
            return image_array

        x, y, w, h = cv2.boundingRect(largest)
        pad = int(max(w, h) * 0.15)
        x1 = max(x - pad, 0)
        y1 = max(y - pad, 0)
        x2 = min(x + w + pad, image_uint8.shape[1])
        y2 = min(y + h + pad, image_uint8.shape[0])

        cropped = image_uint8[y1:y2, x1:x2]
        if cropped.size == 0:
            return image_array

        resized = cv2.resize(cropped, (image_uint8.shape[1], image_uint8.shape[0]), interpolation=cv2.INTER_AREA)
        return resized.astype(image_array.dtype)
    except Exception:
        return image_array

print("=" * 70)
print("🔄 RETRAIN MODEL - Hybrid Training")
print("=" * 70)
print(f"[DIR] Original Dataset: {ORGANIZED_DATASET_DIR}")
print(f"   Exists: {os.path.exists(ORGANIZED_DATASET_DIR)}")
print(f"[DIR] Training Images: {TRAINING_IMAGES_DIR}")
print(f"   Exists: {os.path.exists(TRAINING_IMAGES_DIR)}")
print(f"[SAVE] Output Model: {OUTPUT_MODEL_PATH}")
print(f"   Directory exists: {os.path.exists(os.path.dirname(OUTPUT_MODEL_PATH))}")
print()



# ===== COMBINE DATASETS =====
def _copy_images_to_class_dirs(source_root, destination_root, class_mapper):
    """Copy toàn bộ ảnh từ source_root vào destination_root theo class canonical."""

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
            if not class_name or class_name in EXCLUDED_CLASSES:
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

    print("[BUILD] Building gop_dataset from ml/datasets...")

    if GOP_DATASET_DIR.exists():
        shutil.rmtree(GOP_DATASET_DIR)
    GOP_DATASET_DIR.mkdir(parents=True, exist_ok=True)

    counts = _copy_images_to_class_dirs(
        DATASET_SOURCE_DIR,
        GOP_DATASET_DIR,
        lambda name: SOURCE1_LABEL_MAPPING.get(name, resolve_canonical_disease_key(name)),
    )

    total = sum(counts.values())
    print(f"[OK] gop_dataset ready: {GOP_DATASET_DIR}")
    for disease, count in sorted(counts.items()):
        print(f"  - {disease}: {count} ảnh")
    print(f"  [STATS] Tổng gop_dataset: {total} ảnh")
    print()

    return counts


def build_organized_dataset():
    """Gộp gop_dataset với backend/uploads/training để tạo organized_dataset."""

    print("[BUILD] Building organized_dataset from gop_dataset + training uploads...")

    if ORGANIZED_DATASET_DIR.exists():
        shutil.rmtree(ORGANIZED_DATASET_DIR)
    ORGANIZED_DATASET_DIR.mkdir(parents=True, exist_ok=True)

    counts = {}

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
            if not class_name or class_name in EXCLUDED_CLASSES:
                continue

            class_dir = ORGANIZED_DATASET_DIR / class_name
            class_dir.mkdir(parents=True, exist_ok=True)

            for img_file in disease_dir.iterdir():
                if img_file.is_file() and img_file.suffix.lower() in {'.jpg', '.jpeg', '.png', '.bmp', '.webp'}:
                    shutil.copy2(img_file, class_dir / img_file.name)
                    counts[class_name] = counts.get(class_name, 0) + 1

    total = sum(counts.values())
    print(f"[OK] organized_dataset ready: {ORGANIZED_DATASET_DIR}")
    for disease, count in sorted(counts.items()):
        print(f"  - {disease}: {count} ảnh")
    print(f"  [STATS] Tổng organized_dataset: {total} ảnh")
    print()

    return counts


def combine_datasets():
    """Tạo gop_dataset từ ml/datasets rồi gộp với uploads vào organized_dataset."""

    print("[COMBINE] Starting 2-stage dataset build...")
    build_gop_dataset()
    image_count = build_organized_dataset()
    print("PROGRESS:25:Combine datasets ok")

    return str(ORGANIZED_DATASET_DIR), image_count


def sync_uploads_to_organized(organized_dir, training_dir):
    """Copy/merge images from training uploads into organized_dataset to keep it in sync."""
    try:
        print(f"[SYNC] Syncing training uploads from {training_dir} -> {organized_dir}...")
        if not os.path.exists(training_dir):
            print(f"[SYNC] Training dir does not exist: {training_dir}")
            return

        os.makedirs(organized_dir, exist_ok=True)

        for disease in os.listdir(training_dir):
            src_disease = os.path.join(training_dir, disease)
            if not os.path.isdir(src_disease):
                continue

            dst_disease = os.path.join(organized_dir, disease)
            os.makedirs(dst_disease, exist_ok=True)

            copied = 0
            for fname in os.listdir(src_disease):
                if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
                    continue
                src = os.path.join(src_disease, fname)
                dst = os.path.join(dst_disease, fname)
                # If dst exists, skip to avoid overwriting
                if os.path.exists(dst):
                    continue
                try:
                    shutil.copy2(src, dst)
                    copied += 1
                except Exception as e:
                    print(f"  ✗ Failed to copy {src} -> {dst}: {e}")

            print(f"  [SYNC] {disease}: copied {copied} files")

        print("[SYNC] Sync completed")
    except Exception as e:
        print(f"[SYNC] Error during sync: {e}")


# ===== DATA GENERATORS =====
def create_data_generators(combined_dir):
    """Tạo ImageDataGenerator (80/20 train/val)"""
    
    print("PROGRESS:30:Tao data generators")
    print("[DATA] Tao data generators (80/20 train/val)...")
    
    # Augmentation cho training
    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        zoom_range=0.2,
        preprocessing_function=crop_to_leaf_region,
        validation_split=0.2
    )
    
    # Chỉ rescale cho validation
    val_datagen = ImageDataGenerator(
        rescale=1./255,
        preprocessing_function=crop_to_leaf_region,
        validation_split=0.2
    )
    
    # Training generator
    train_generator = train_datagen.flow_from_directory(
        combined_dir,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='training'
    )
    
    # Validation generator
    val_generator = val_datagen.flow_from_directory(
        combined_dir,
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        subset='validation',
        shuffle=False
    )
    
    print(f"[OK] Generators ready")
    print(f"  [TRAIN] Training batches: {len(train_generator)}")
    print(f"  [VAL] Validation batches: {len(val_generator)}")
    print("PROGRESS:40:Generators ready")
    print()
    
    return train_generator, val_generator


def create_data_generators_from_splits(split_dirs):
    """Tạo ImageDataGenerator cho train/validation/test từ thư mục đã split."""
    print("PROGRESS:30:Tao data generators from splits")
    print("[DATA] Tao data generators (train/val/test)...")

    train_datagen = ImageDataGenerator(
        rescale=1./255,
        rotation_range=20,
        width_shift_range=0.2,
        height_shift_range=0.2,
        horizontal_flip=True,
        zoom_range=0.2,
        preprocessing_function=crop_to_leaf_region,
    )

    eval_datagen = ImageDataGenerator(rescale=1./255, preprocessing_function=crop_to_leaf_region)

    train_generator = train_datagen.flow_from_directory(
        split_dirs['train'],
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=True
    )

    val_generator = eval_datagen.flow_from_directory(
        split_dirs['val'],
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False
    )

    test_generator = eval_datagen.flow_from_directory(
        split_dirs['test'],
        target_size=(IMG_SIZE, IMG_SIZE),
        batch_size=BATCH_SIZE,
        class_mode='categorical',
        shuffle=False
    )

    print(f"[OK] Generators ready: train_batches={len(train_generator)}, val_batches={len(val_generator)}, test_batches={len(test_generator)}")
    print("PROGRESS:40:Generators ready")
    print()

    return train_generator, val_generator, test_generator


# ===== BUILD MODEL =====
def build_model(num_classes):
    """Transfer Learning - MobileNetV2"""
    
    print("PROGRESS:45:Xay dung model")
    print(f"[BUILD] Xay dung model (Transfer Learning - MobileNetV2, {num_classes} classes)...")
    
    # Load pretrained MobileNetV2
    base_model = MobileNetV2(
        input_shape=(IMG_SIZE, IMG_SIZE, 3),
        include_top=False,
        weights='imagenet'
    )
    
    # Freeze base model
    base_model.trainable = False
    
    # Thêm custom layers
    model = keras.Sequential([
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(256, activation='relu'),
        layers.Dropout(0.5),
        layers.Dense(num_classes, activation='softmax')
    ])
    
    # Compile
    model.compile(
        optimizer=Adam(learning_rate=0.001),
        loss='categorical_crossentropy',
        metrics=['accuracy']
    )
    
    print(f"[OK] Model ready")
    print("PROGRESS:50:Model ready")
    print()
    
    return model


# ===== TRAIN MODEL =====
def train_model(model, train_gen, val_gen):
    """Huấn luyện model"""
    
    print("PROGRESS:55:Bat dau training")
    print("[TRAIN] Bat dau training...")
    
    history = model.fit(
        train_gen,
        epochs=EPOCHS,
        validation_data=val_gen,
        verbose=1
    )
    
    print("PROGRESS:85:Training hoan thanh")
    print("[OK] Training completed")
    print()
    
    return history


def print_training_results(history):
    """In và xuất kết quả huấn luyện cuối cùng."""

    final_train_accuracy = history.history['accuracy'][-1]
    final_val_accuracy = history.history['val_accuracy'][-1]
    final_train_loss = history.history['loss'][-1]
    final_val_loss = history.history['val_loss'][-1]

    best_val_accuracy = max(history.history['val_accuracy'])
    best_val_loss = min(history.history['val_loss'])

    results = {
        'train_accuracy': final_train_accuracy,
        'val_accuracy': final_val_accuracy,
        'train_loss': final_train_loss,
        'val_loss': final_val_loss,
        'best_val_accuracy': best_val_accuracy,
        'best_val_loss': best_val_loss,
    }

    print("[RESULTS] Final training results:")
    print(f"  Train Accuracy: {final_train_accuracy * 100:.2f}%")
    print(f"  Val Accuracy:   {final_val_accuracy * 100:.2f}%")
    print(f"  Train Loss:     {final_train_loss:.4f}")
    print(f"  Val Loss:       {final_val_loss:.4f}")
    print(f"  Best Val Acc:   {best_val_accuracy * 100:.2f}%")
    print(f"  Best Val Loss:  {best_val_loss:.4f}")
    print(f"TRAIN_RESULTS:{json.dumps(results, ensure_ascii=False)}")

    return results


def save_training_report(history, metrics, report_path):
    """Lưu kết quả huấn luyện ra file JSON để backend đọc lại sau này."""

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

    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(training_report, f, indent=2, ensure_ascii=False)

    print(f"[RESULTS] Saved training report: {report_path}")


def evaluate_classification_metrics(model, val_gen):
    """Tính precision/recall/F1 trên tập validation."""

    print("\n[METRICS] Validation metrics...")
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

    print("[METRICS] Macro average:")
    print(f"  Precision: {precision_macro:.4f}")
    print(f"  Recall:    {recall_macro:.4f}")
    print(f"  F1-score:  {f1_macro:.4f}")

    print("[METRICS] Weighted average:")
    print(f"  Precision: {precision_weighted:.4f}")
    print(f"  Recall:    {recall_weighted:.4f}")
    print(f"  F1-score:  {f1_weighted:.4f}")

    print("[METRICS] Classification report:")
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

    metrics = {
        'precision_macro': precision_macro,
        'recall_macro': recall_macro,
        'f1_macro': f1_macro,
        'precision_weighted': precision_weighted,
        'recall_weighted': recall_weighted,
        'f1_weighted': f1_weighted,
    }

    print(f"METRICS:{json.dumps(metrics, ensure_ascii=False)}")

    return metrics


def evaluate_test_metrics(model, test_gen):
    """Tính precision/recall/F1 trên tập test (giống validate nhưng dùng test_gen)."""
    print("\n[METRICS] Test metrics...")
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

    print("[METRICS] Macro average (test):")
    print(f"  Precision: {precision_macro:.4f}")
    print(f"  Recall:    {recall_macro:.4f}")
    print(f"  F1-score:  {f1_macro:.4f}")

    print("[METRICS] Weighted average (test):")
    print(f"  Precision: {precision_weighted:.4f}")
    print(f"  Recall:    {recall_weighted:.4f}")
    print(f"  F1-score:  {f1_weighted:.4f}")

    metrics = {
        'precision_macro': precision_macro,
        'recall_macro': recall_macro,
        'f1_macro': f1_macro,
        'precision_weighted': precision_weighted,
        'recall_weighted': recall_weighted,
        'f1_weighted': f1_weighted,
    }

    print(f"METRICS_TEST:{json.dumps(metrics, ensure_ascii=False)}")

    return metrics


def split_dataset(organized_dir):
    """Tách dataset thành train/val/test theo tỉ lệ 80/10/10."""

    print("Splitting combined dataset into train/val/test (80/10/10)...")

    split_root = Path("split_dataset")
    if split_root.exists():
        shutil.rmtree(split_root)

    split_dirs = {
        'train': split_root / 'train',
        'val': split_root / 'val',
        'test': split_root / 'test',
    }

    for p in split_dirs.values():
        p.mkdir(parents=True, exist_ok=True)

    image_extensions = {'.jpg', '.jpeg', '.png', '.bmp', '.webp', '.JPG', '.JPEG', '.PNG', '.BMP', '.WEBP'}

    for disease_dir in Path(organized_dir).iterdir():
        if not disease_dir.is_dir():
            continue

        class_name = disease_dir.name
        files = [p for p in disease_dir.iterdir() if p.is_file() and p.suffix.lower() in image_extensions]

        if len(files) == 0:
            continue

        # Shuffle and split
        rng = np.random.default_rng(42)
        files_shuffled = list(files)
        rng.shuffle(files_shuffled)

        n_total = len(files_shuffled)
        n_train = int(n_total * 0.8)
        n_temp = n_total - n_train
        n_val = n_temp // 2
        n_test = n_temp - n_val

        train_files = files_shuffled[:n_train]
        val_files = files_shuffled[n_train:n_train + n_val]
        test_files = files_shuffled[n_train + n_val:]

        subsets = [('train', train_files), ('val', val_files), ('test', test_files)]

        for subset_name, subset_files in subsets:
            subset_class_dir = split_dirs[subset_name] / class_name
            subset_class_dir.mkdir(parents=True, exist_ok=True)
            for img_file in subset_files:
                try:
                    shutil.copy2(img_file, subset_class_dir / img_file.name)
                except Exception as e:
                    print(f"  ✗ Lỗi copy {img_file}: {e}")

        print(f"  ✓ {class_name}: train={len(train_files)}, val={len(val_files)}, test={len(test_files)}")

    print(f"✓ Split completed at: {split_root}\n")
    return {k: str(v) for k, v in split_dirs.items()}


# ===== SAVE MODEL & LABELS =====
def save_model_and_labels(model, train_gen, output_path):
    """Lưu model + disease labels"""
    
    print("PROGRESS:90:Luu model va label")
    print("[SAVE] Luu model...")
    
    # Ensure output directory exists
    output_dir = os.path.dirname(output_path)
    os.makedirs(output_dir, exist_ok=True)
    
    # Save model
    model.save(output_path)
    print(f"[OK] Model saved: {output_path}")
    
    # Save disease labels
    class_indices = train_gen.class_indices
    label_mapping = {idx: name for name, idx in class_indices.items()}
    
    labels_path = Path(output_path).with_name(Path(output_path).stem + '_labels.json')
    with open(labels_path, 'w', encoding='utf-8') as f:
        json.dump(label_mapping, f, indent=2, ensure_ascii=False)
    
    print(f"[OK] Labels saved: {labels_path}")
    print("PROGRESS:95:Da luu xong")
    print(f"  [INFO] Diseases: {list(label_mapping.values())}")
    print()


# ===== MAIN EXECUTION =====
def main():
    combined_dir = None

    try:
        # 1. Combine datasets
        combined_dir, image_count = combine_datasets()

        # 2. Split into train/val/test
        split_dirs = split_dataset(combined_dir)

        # 3. Create generators from splits
        train_gen, val_gen, test_gen = create_data_generators_from_splits(split_dirs)

        # 4. Build model
        num_classes = len(image_count)
        model = build_model(num_classes)

        # 5. Train
        history = train_model(model, train_gen, val_gen)

        # 6. Training results
        results = print_training_results(history)

        # 7. Evaluate validation metrics
        metrics = evaluate_classification_metrics(model, val_gen)

        # 8. Evaluate test metrics and attach
        test_metrics = evaluate_test_metrics(model, test_gen)
        metrics['test'] = test_metrics

        # 9. Save report for backend/frontend
        report_path = Path(OUTPUT_MODEL_PATH).with_name('training_report.json')
        save_training_report(history, metrics, report_path)
        
        # 5. Save
        save_model_and_labels(model, train_gen, OUTPUT_MODEL_PATH)
        
        print("=" * 70)
        print("PROGRESS:100:Hoan thanh")
        print("[OK] RETRAIN COMPLETED SUCCESSFULLY")
        print("="*70)
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        sys.exit(1)


if __name__ == '__main__':
    main()
