"""
Dự đoán bệnh cây từ ảnh
Load model.h5 và trả kết quả tiếng Việt

╔════════════════════════════════════════════════════════════════════════════╗
║                  🎯 QUY TRÌNH DỰ ĐOÁN CHI TIẾT                             ║
╠════════════════════════════════════════════════════════════════════════════╣
║                                                                            ║
║ INPUT: user.jpg (bất kỳ size, RGB)                                        ║
║   ↓                                                                        ║
║ 1. IMAGE PREPROCESSING (preprocess_image)                                 ║
║    - Mở ảnh: PIL.Image.open()                                             ║
║    - Convert RGB: .convert("RGB")                                         ║
║    - Resize: 224×224 (yêu cầu của MobileNetV2)                            ║
║    - Normalize: pixel / 255 → [0, 1]                                      ║
║    - Add batch: shape = (1, 224, 224, 3)                                  ║
║   ↓                                                                        ║
║ 2. CNN INFERENCE (model.predict)                                          ║
║    - Đầu vào: ảnh [1, 224, 224, 3]                                        ║
║    - Đi qua MobileNetV2 (10 triệu parameters)                             ║
║    - Output logits: [9] → logits cho 9 loại bệnh                          ║
║   ↓                                                                        ║
║ 3. SOFTMAX CONVERSION                                                      ║
║    - Công thức: P(i) = exp(logit[i]) / Σ(exp(logit[j]))                  ║
║    - Kết quả: Xác suất chuẩn hóa [0-100%], tổng = 100%                    ║
║    - argmax() → tìm loại bệnh có xác suất cao nhất                         ║
║   ↓                                                                        ║
║ 4. TOP-K PREDICTION (get_top_3)                                            ║
║    - Sắp xếp 9 loại bệnh giảm dần theo xác suất                           ║
║    - Lấy top-3: [P1 ≥ P2 ≥ P3]                                            ║
║    - Lợi ích: Nếu P1=35%, P2=32%, không 100% tin kết quả                  ║
║   ↓                                                                        ║
║ 5. LABEL TRANSLATION                                                      ║
║    - English: "black_spot"                                                ║
║    - Vietnamese: "Bệnh đốm đen"                                           ║
║    - Từ disease_labels.json                                               ║
║   ↓                                                                        ║
║ OUTPUT: JSON                                                               ║
║   {                                                                        ║
║     "disease_en": "black_spot",                                           ║
║     "disease_vi": "Bệnh đốm đen",                                         ║
║     "confidence": 78.45,                                                  ║
║     "top_3": [                                                            ║
║       {"disease_vi": "Bệnh đốm đen", "confidence": 78.45},                ║
║       {"disease_vi": "Bệnh loét", "confidence": 15.30},                   ║
║       {"disease_vi": "Thiếu dinh dưỡng", "confidence": 4.25}              ║
║     ]                                                                      ║
║   }                                                                        ║
║                                                                            ║
╚════════════════════════════════════════════════════════════════════════════╝
"""

import os
import json
import numpy as np
from PIL import Image, UnidentifiedImageError
import tensorflow as tf
import cv2
from uuid import uuid4

# ============================================================================
# CẤUNHẠC
# ============================================================================

MODEL_PATH = "model.h5"
LABEL_FILE = "disease_labels.json"
IMG_SIZE = 224

# ============================================================================
# LOAD MODEL VÀ LABEL
# ============================================================================

def load_model_and_labels():
    """Load model và mapping nhãn"""
    
    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(f"❌ Không tìm thấy model: {MODEL_PATH}")
    
    if not os.path.exists(LABEL_FILE):
        raise FileNotFoundError(f"❌ Không tìm thấy label file: {LABEL_FILE}")
    
    print(f"📥 Load model: {MODEL_PATH}")
    model = tf.keras.models.load_model(MODEL_PATH)
    
    print(f"📥 Load labels: {LABEL_FILE}")
    with open(LABEL_FILE, "r", encoding="utf-8") as f:
        labels = json.load(f)
    
    return model, labels


def find_last_conv_layer(model):
    """Tìm layer convolution cuối cùng trong model, kể cả model lồng nhau."""

    conv_layer_types = (
        tf.keras.layers.Conv2D,
        tf.keras.layers.DepthwiseConv2D,
        tf.keras.layers.SeparableConv2D,
    )

    for layer in reversed(getattr(model, "layers", [])):
        if isinstance(layer, conv_layer_types):
            return layer

        if isinstance(layer, tf.keras.Model):
            nested_layer = find_last_conv_layer(layer)
            if nested_layer is not None:
                return nested_layer

    return None


# ============================================================================
# TIỀN XỬ LÝ ẢNH
# ============================================================================

def preprocess_image(image_path):
    """Tiền xử lý ảnh giống như train"""
    
    try:
        img = Image.open(image_path).convert("RGB")
    except UnidentifiedImageError as exc:
        raise ValueError("Định dạng ảnh chưa được hỗ trợ. Vui lòng dùng JPG, PNG hoặc WEBP.") from exc

    img_array = np.array(img, dtype=np.uint8)
    img_array = crop_to_leaf_region(img_array)

    img = Image.fromarray(img_array).convert("RGB")
    img = img.resize((IMG_SIZE, IMG_SIZE))
    img_array = np.array(img, dtype=np.float32) / 255.0
    img_array = np.expand_dims(img_array, axis=0)  # Thêm batch dimension
    
    return img_array


def crop_to_leaf_region(image_array):
    """Cắt vùng lá ước lượng để giảm ảnh hưởng của nền và viền ảnh."""

    if image_array is None or image_array.size == 0:
        return image_array

    try:
        hsv = cv2.cvtColor(image_array, cv2.COLOR_RGB2HSV)
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
        if cv2.contourArea(largest) < image_array.shape[0] * image_array.shape[1] * 0.03:
            return image_array

        x, y, w, h = cv2.boundingRect(largest)
        pad = int(max(w, h) * 0.15)
        x1 = max(x - pad, 0)
        y1 = max(y - pad, 0)
        x2 = min(x + w + pad, image_array.shape[1])
        y2 = min(y + h + pad, image_array.shape[0])

        cropped = image_array[y1:y2, x1:x2]
        if cropped.size == 0:
            return image_array

        return cropped
    except Exception:
        return image_array


def generate_gradcam(image_path, model, class_index=None):
    """Tạo ảnh Grad-CAM overlay để giải thích vùng ảnh quan trọng."""

    base_model = model.layers[0] if getattr(model, "layers", []) and isinstance(model.layers[0], tf.keras.Model) else model
    last_conv_layer = find_last_conv_layer(base_model)
    if last_conv_layer is None:
        return None

    original_image = Image.open(image_path).convert("RGB")
    original_array = np.array(original_image)
    original_height, original_width = original_array.shape[:2]

    img_array = preprocess_image(image_path)

    classifier_head = tf.keras.Sequential(model.layers[1:])

    grad_model = tf.keras.models.Model(
        inputs=base_model.input,
        outputs=[last_conv_layer.output, classifier_head(base_model.output)]
    )

    with tf.GradientTape() as tape:
        conv_outputs, predictions = grad_model(img_array)
        if class_index is None:
            class_index = tf.argmax(predictions[0])
        class_channel = predictions[:, class_index]

    grads = tape.gradient(class_channel, conv_outputs)
    if grads is None:
        return None

    pooled_grads = tf.reduce_mean(grads, axis=(0, 1, 2))
    conv_outputs = conv_outputs[0]
    heatmap = tf.reduce_sum(conv_outputs * pooled_grads, axis=-1)
    heatmap = tf.maximum(heatmap, 0)

    max_value = tf.reduce_max(heatmap)
    if float(max_value.numpy()) == 0.0:
        return None

    heatmap = heatmap / max_value
    heatmap = heatmap.numpy()
    heatmap = cv2.resize(heatmap, (original_width, original_height))
    heatmap = np.uint8(255 * heatmap)
    heatmap = cv2.applyColorMap(heatmap, cv2.COLORMAP_JET)

    original_bgr = cv2.cvtColor(original_array, cv2.COLOR_RGB2BGR)
    overlay = cv2.addWeighted(original_bgr, 0.6, heatmap, 0.4, 0)

    gradcam_dir = os.path.join("uploads", "gradcam")
    os.makedirs(gradcam_dir, exist_ok=True)

    output_filename = f"gradcam-{uuid4().hex[:10]}.png"
    output_path = os.path.join(gradcam_dir, output_filename)
    cv2.imwrite(output_path, overlay)

    return {
        "overlay_path": f"/uploads/gradcam/{output_filename}"
    }


# ============================================================================
# DỰ ĐOÁN
# ============================================================================

def predict(image_path, model, labels):
    """Dự đoán bệnh từ ảnh"""
    
    if not os.path.exists(image_path):
        raise FileNotFoundError(f"❌ Không tìm thấy ảnh: {image_path}")
    
    # Tiền xử lý
    img_array = preprocess_image(image_path)
    
    # Dự đoán
    predictions = model.predict(img_array, verbose=0)
    
    # Kiểm tra predictions shape
    if predictions is None or len(predictions) == 0:
        raise ValueError("❌ Model không trả về predictions")
    
    predictions_flat = predictions[0] if len(predictions.shape) > 1 else predictions
    
    if len(predictions_flat) == 0:
        raise ValueError("❌ Predictions không có phần tử")
    
    pred_idx = np.argmax(predictions_flat)
    
    # Kiểm tra index hợp lệ
    if pred_idx >= len(labels["classes"]):
        raise ValueError(
            f"❌ Index dự đoán ({pred_idx}) vượt quá số bệnh ({len(labels['classes'])}). "
            f"Model có thể được train với dữ liệu khác. Vui lòng retrain lại model."
        )
    
    confidence = float(predictions_flat[pred_idx]) * 100

    grad_cam = generate_gradcam(image_path, model, int(pred_idx))
    
    # Lấy tên bệnh
    disease_en = labels["classes"][pred_idx]
    disease_vi = labels["class_vi"].get(disease_en, disease_en)
    
    return {
        "disease_en": disease_en,
        "disease_vi": disease_vi,
        "confidence": round(confidence, 2),
        "top_3": get_top_3(predictions_flat, labels),
        "grad_cam": grad_cam
    }


def get_top_3(predictions, labels):
    """Lấy 3 dự đoán hàng đầu"""
    
    if predictions is None or len(predictions) == 0:
        return []
    
    num_classes = min(3, len(predictions), len(labels["classes"]))
    top_3_idx = np.argsort(predictions)[::-1][:num_classes]
    top_3 = []
    
    for idx in top_3_idx:
        idx = int(idx)
        
        # Kiểm tra index hợp lệ
        if idx >= len(labels["classes"]):
            continue
        
        disease_en = labels["classes"][idx]
        disease_vi = labels["class_vi"].get(disease_en, disease_en)
        top_3.append({
            "disease_en": disease_en,
            "disease_vi": disease_vi,
            "confidence": round(float(predictions[idx] * 100), 2)
        })
    
    return top_3


# ============================================================================
# TEST (Chạy trực tiếp)
# ============================================================================

if __name__ == "__main__":
    try:
        # Load model
        model, labels = load_model_and_labels()
        print("✓ Model sẵn sàng!\n")
        
        # Test ảnh (nếu có)
        test_image = "test_image.jpg"  # Chỉnh sửa đường dẫn nếu cần
        
        if os.path.exists(test_image):
            print(f"🔍 Dự đoán: {test_image}")
            result = predict(test_image, model, labels)
            print(json.dumps(result, indent=2, ensure_ascii=False))
        else:
            print("💡 Để test, hãy tạo biến result = predict(image_path, model, labels)")
            print(f"💡 Hoặc dùng Flask app.py")
        
    except Exception as e:
        print(f"❌ LỖI: {e}")
        import traceback
        traceback.print_exc()
