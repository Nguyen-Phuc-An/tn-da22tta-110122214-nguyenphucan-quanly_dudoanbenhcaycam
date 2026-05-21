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

ORGANIZED_DATASET_DIR = sys.argv[1]
TRAINING_IMAGES_DIR = sys.argv[2]
OUTPUT_MODEL_PATH = sys.argv[3]

# ===== CONSTANTS =====
IMG_SIZE = 224
BATCH_SIZE = 32
EPOCHS = 5  # Retrain = fewer epochs (faster)
TEMP_COMBINED_DIR = "combined_dataset_temp"


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
def combine_datasets():
    """Kết hợp organized_dataset + training uploads"""
    
    print("[COMBINE] Dang ket hop datasets...")
    
    # Xóa folder cũ nếu tồn tại
    if os.path.exists(TEMP_COMBINED_DIR):
        shutil.rmtree(TEMP_COMBINED_DIR)
    
    os.makedirs(TEMP_COMBINED_DIR, exist_ok=True)
    
    image_count = {}
    
    # 1. Copy từ organized_dataset (9 bệnh cũ)
    print("  [COPY] Copying original dataset...")
    if os.path.exists(ORGANIZED_DATASET_DIR):
        for disease_dir in os.listdir(ORGANIZED_DATASET_DIR):
            disease_path = os.path.join(ORGANIZED_DATASET_DIR, disease_dir)
            if not os.path.isdir(disease_path):
                continue
            
            combined_disease_path = os.path.join(TEMP_COMBINED_DIR, disease_dir)
            os.makedirs(combined_disease_path, exist_ok=True)
            
            # Copy ảnh
            for img_file in os.listdir(disease_path):
                if img_file.lower().endswith(('.jpg', '.png', '.jpeg')):
                    src = os.path.join(disease_path, img_file)
                    dst = os.path.join(combined_disease_path, img_file)
                    shutil.copy2(src, dst)
                    image_count[disease_dir] = image_count.get(disease_dir, 0) + 1
    
    # 2. Copy từ training uploads (ảnh bổ sung + bệnh mới)
    print("  [COPY] Copying training images...")
    if os.path.exists(TRAINING_IMAGES_DIR):
        for disease_dir in os.listdir(TRAINING_IMAGES_DIR):
            disease_path = os.path.join(TRAINING_IMAGES_DIR, disease_dir)
            if not os.path.isdir(disease_path):
                continue
            
            combined_disease_path = os.path.join(TEMP_COMBINED_DIR, disease_dir)
            os.makedirs(combined_disease_path, exist_ok=True)
            
            # Copy ảnh
            for img_file in os.listdir(disease_path):
                if img_file.lower().endswith(('.jpg', '.png', '.jpeg')):
                    src = os.path.join(disease_path, img_file)
                    dst = os.path.join(combined_disease_path, img_file)
                    shutil.copy2(src, dst)
                    image_count[disease_dir] = image_count.get(disease_dir, 0) + 1
    
    # Print summary
    print(f"[OK] Ket hop xong ({TEMP_COMBINED_DIR})")
    print("PROGRESS:25:Combine datasets ok")
    print(f"  [STATS] Phan bo anh:")
    total_images = 0
    for disease, count in sorted(image_count.items()):
        print(f"    - {disease}: {count} ảnh")
        total_images += count
    print(f"  [STATS] Tong: {total_images} anh")
    print(f"  [STATS] So benh: {len(image_count)}")
    print()
    
    return TEMP_COMBINED_DIR, image_count


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
    
    labels_path = output_path.replace('.h5', '_labels.json')
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
        
        # 2. Create generators
        train_gen, val_gen = create_data_generators(combined_dir)
        
        # 3. Build model
        num_classes = len(image_count)
        model = build_model(num_classes)
        
        # 4. Train
        history = train_model(model, train_gen, val_gen)

        # 4.5 Training results
        results = print_training_results(history)

        # 4.6 Evaluate validation metrics
        metrics = evaluate_classification_metrics(model, val_gen)

        # 4.7 Save report for backend/frontend
        report_path = Path(OUTPUT_MODEL_PATH).with_name('training_report.json')
        save_training_report(history, metrics, report_path)
        
        # 5. Save
        save_model_and_labels(model, train_gen, OUTPUT_MODEL_PATH)
        
        # Cleanup
        if os.path.exists(combined_dir):
            shutil.rmtree(combined_dir)
        
        print("=" * 70)
        print("PROGRESS:100:Hoan thanh")
        print("[OK] RETRAIN COMPLETED SUCCESSFULLY")
        print("="*70)
        
    except Exception as e:
        print(f"[ERROR] {str(e)}")
        # Cleanup on error
        if combined_dir and os.path.exists(combined_dir):
            shutil.rmtree(combined_dir)
        sys.exit(1)


if __name__ == '__main__':
    main()
