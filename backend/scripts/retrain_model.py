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
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers
from tensorflow.keras.preprocessing.image import ImageDataGenerator
from tensorflow.keras.applications import MobileNetV2
from tensorflow.keras.optimizers import Adam

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
        validation_split=0.2
    )
    
    # Chỉ rescale cho validation
    val_datagen = ImageDataGenerator(
        rescale=1./255,
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
        subset='validation'
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
    try:
        # 1. Combine datasets
        combined_dir, image_count = combine_datasets()
        
        # 2. Create generators
        train_gen, val_gen = create_data_generators(combined_dir)
        
        # 3. Build model
        num_classes = len(image_count)
        model = build_model(num_classes)
        
        # 4. Train
        train_model(model, train_gen, val_gen)
        
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
        if os.path.exists(combined_dir):
            shutil.rmtree(combined_dir)
        sys.exit(1)


if __name__ == '__main__':
    main()
