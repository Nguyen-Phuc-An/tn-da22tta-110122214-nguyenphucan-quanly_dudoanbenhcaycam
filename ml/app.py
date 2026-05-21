"""
Flask API - Dự đoán bệnh cây có múi
POST /predict - Upload ảnh, trả kết quả tiếng Việt
"""

import os
import json
from flask import Flask, request, jsonify
from flask import send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from predict import load_model_and_labels, predict

# ============================================================================
# CẤUNHẠC
# ============================================================================

UPLOAD_FOLDER = "uploads"
GRADCAM_FOLDER = os.path.join(UPLOAD_FOLDER, "gradcam")
ALLOWED_EXTENSIONS = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB

# Tạo app
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = MAX_FILE_SIZE

# Enable CORS
CORS(app)

# Tạo thư mục uploads
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(GRADCAM_FOLDER, exist_ok=True)

# Load model & labels (1 lần khi khởi động)
try:
    model, labels = load_model_and_labels()
    print("✓ Model loaded successfully!")
except Exception as e:
    print(f"❌ Error loading model: {e}")
    model = None
    labels = None


# ============================================================================
# HỎ HELPER
# ============================================================================

def allowed_file(filename):
    """Kiểm tra phần mở rộng file"""
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS


@app.route("/uploads/<path:filename>", methods=["GET"])
def serve_upload(filename):
    """Phục vụ các file ảnh upload và Grad-CAM."""
    return send_from_directory(UPLOAD_FOLDER, filename)


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.route("/", methods=["GET"])
def home():
    """Trang chủ"""
    return jsonify({
        "message": "API Dự đoán Bệnh Cây Có Múi",
        "endpoint": "/predict",
        "method": "POST",
        "input": "form-data: image (file)",
        "output": {
            "disease_en": "disease name (English)",
            "disease_vi": "tên bệnh (Tiếng Việt)",
            "confidence": "độ tin cậy (%)",
            "top_3": "3 dự đoán hàng đầu"
        }
    })


@app.route("/api/diseases", methods=["GET"])
def get_diseases():
    """Lấy danh sách bệnh"""
    if labels is None:
        return jsonify({"error": "Model chưa load"}), 500
    
    return jsonify({
        "success": True,
        "diseases": [
            {
                "en": disease_en,
                "vi": labels["class_vi"][disease_en]
            }
            for disease_en in labels["classes"]
        ]
    })


@app.route("/predict", methods=["POST", "OPTIONS"])
def predict_disease():
    """
    Dự đoán bệnh từ ảnh
    
    Input: 
        - file: image file (jpg, png, etc)
    
    Output:
        - disease_en: Tên bệnh tiếng Anh
        - disease_vi: Tên bệnh tiếng Việt
        - confidence: Độ tin cậy (%)
        - top_3: 3 dự đoán hàng đầu
    """
    
    # Kiểm tra model
    if model is None or labels is None:
        return jsonify({"error": "❌ Model chưa load"}), 500
    
    # Kiểm tra request
    if 'image' not in request.files:
        print(f"❌ Missing file field. Keys: {list(request.files.keys())}")
        return jsonify({"error": "❌ Không có file 'image'"}), 400
    
    file = request.files['image']
    print(f"📎 Received file: name={file.filename}, mimetype={file.mimetype}")
    
    if file.filename == '':
        return jsonify({"error": "❌ Chưa chọn file"}), 400
    
    if not allowed_file(file.filename):
        return jsonify({
            "error": f"❌ Định dạng không hỗ trợ. Chỉ chấp nhận: {', '.join(ALLOWED_EXTENSIONS)}"
        }), 400
    
    filepath = None

    try:
        # Lưu file
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        # Dự đoán
        result = predict(filepath, model, labels)
        return jsonify({
            "success": True,
            "data": result
        })

    except ValueError as e:
        return jsonify({
            "success": False,
            "error": str(e)
        }), 400

    except Exception as e:
        print(f"❌ Lỗi dự đoán chi tiết: {e}")
        return jsonify({
            "success": False,
            "error": f"❌ Lỗi dự đoán: {str(e)}"
        }), 500

    finally:
        if filepath and os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception as remove_error:
                print(f"⚠️ Không xóa được file tạm: {remove_error}")


@app.route("/reload-model", methods=["POST"])
def reload_model():
    """Tải lại model (dùng sau khi retrain)"""
    global model, labels
    try:
        print("🔄 Reloading model...")
        model, labels = load_model_and_labels()
        print("✓ Model reloaded successfully!")
        return jsonify({
            "success": True,
            "message": "Model reloaded successfully"
        })
    except Exception as e:
        print(f"❌ Error reloading model: {e}")
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500


@app.route("/health", methods=["GET"])
def health():
    """Kiểm tra API sống"""
    return jsonify({"status": "✓ API đang chạy"})


# ============================================================================
# ERROR HANDLERS
# ============================================================================

@app.errorhandler(413)
def too_large(e):
    """File quá lớn"""
    return jsonify({"error": "❌ File quá lớn (max: 5MB)"}), 413


@app.errorhandler(404)
def not_found(e):
    """Endpoint không tồn tại"""
    return jsonify({"error": "❌ Endpoint không tồn tại"}), 404


@app.errorhandler(500)
def server_error(e):
    """Lỗi server"""
    return jsonify({"error": "❌ Lỗi server"}), 500


# ============================================================================
# MAIN
# ============================================================================

if __name__ == "__main__":
    print("=" * 70)
    print("🚀 KHỞI ĐỘNG FLASK API")
    print("=" * 70)
    print("📍 API: http://localhost:5000")
    print("📌 Endpoint: POST /predict")
    print("📌 Danh sách bệnh: GET /api/diseases")
    print("=" * 70)
    print()
    
    # Chạy Flask
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=False,
        use_reloader=False
    )
