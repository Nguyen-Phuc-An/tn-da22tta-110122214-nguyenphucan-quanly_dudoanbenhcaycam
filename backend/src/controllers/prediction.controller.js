const Prediction = require('../models/Prediction');
const Garden = require('../models/Garden');
const Disease = require('../models/Disease');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const FormData = require('form-data');
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Tạo thư mục uploads nếu chưa tồn tại
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// URL API ML (Flask)
const ML_API_URL = process.env.ML_API_URL || 'http://localhost:5000';

// Gemini AI initialization
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
console.log('🔑 GEMINI_API_KEY loaded:', GEMINI_API_KEY ? `✓ (${GEMINI_API_KEY.length} chars)` : '❌ NOT SET');

const genAI = GEMINI_API_KEY ? new GoogleGenerativeAI(GEMINI_API_KEY) : null;

const formatFertilizerNames = (items = []) =>
  items
    .map((item) => item?.ten_phan_bon)
    .filter(Boolean);

const formatPesticideNames = (items = []) =>
  items
    .map((item) => item?.ten_thuoc)
    .filter(Boolean);

const normalizeDiseaseKey = (value) => {
  if (!value) return '';

  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
};

const DISEASE_ALIASES = {
  leaf_eating_worm: 'leaf_eating_worm',
  sau_an_la: 'leaf_eating_worm',
  citrus_leaf_curl: 'citrus_leaf_curl',
  xoan_la: 'citrus_leaf_curl',
  greasy_spot: 'greasy_spot',
  dom_dau: 'greasy_spot',
  leafminer: 'leafminer',
  sau_ve_bua: 'leafminer',
  black_spot: 'black_spot',
  dom_den: 'black_spot',
  canker: 'canker',
  loet: 'canker',
  greening: 'greening',
  huanglongbing: 'greening',
  deficiency: 'deficiency',
  thieu_dinh_duong: 'deficiency',
  healthy: 'healthy',
  khoe: 'healthy',
  multiple: 'multiple',
  hon_hop: 'multiple',
};

const resolveDiseaseKey = (value) => DISEASE_ALIASES[normalizeDiseaseKey(value)] || normalizeDiseaseKey(value);

const buildDiseaseMap = (diseases = []) => {
  const diseaseMap = {};

  diseases.forEach((d) => {
    diseaseMap[d.ten_benh_en] = d;
    diseaseMap[resolveDiseaseKey(d.ten_benh_en)] = d;
    diseaseMap[d.ten_benh] = d;
    diseaseMap[resolveDiseaseKey(d.ten_benh)] = d;
  });

  return diseaseMap;
};

/**
 * Tạo tư vấn AI bằng Gemini (với nhiều bệnh)
 */
const generateAIAdvice = async (predictions, diseaseMap) => {
  try {
    if (!genAI) {
      console.error("❌ GEMINI_API_KEY not configured");
      return "Tư vấn AI chưa được cấu hình. Vui lòng kiểm tra GEMINI_API_KEY.";
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const diseasesList = predictions.map((p, i) => {
      const d = diseaseMap[resolveDiseaseKey(p.label)] || diseaseMap[normalizeDiseaseKey(p.label)] || diseaseMap[p.label];
      if (!d) return "";

      const allowedFertilizers = formatFertilizerNames(d.goi_y_phan_bon);
      const allowedPesticides = formatPesticideNames(d.goi_y_thuoc);

      return `
${i + 1}. ${d.ten_benh} (${Math.round(p.confidence * 100)}%)

* Mô tả: ${d.mo_ta}
* Nguyên nhân: ${d.nguyen_nhan}
* Hướng xử lý: ${d.huong_xu_ly}
    * Phân bón được phép đề xuất: ${allowedFertilizers.length > 0 ? allowedFertilizers.join(', ') : 'Không có'}
    * Thuốc được phép đề xuất: ${allowedPesticides.length > 0 ? allowedPesticides.join(', ') : 'Không có'}
      `;
    }).join('\n');

    // Build prompt: when multiple diseases selected, force combined advice explicitly
    const multiDiseaseHeader = predictions.length > 1
      ? 'LƯU Ý: BẠN ĐÃ CHỌN NHIỀU BỆNH. KHÔNG CHỌN BỆNH CHÍNH. HÃY TRẢ LỜI BẰNG MỘT TƯ VẤN TỔNG HỢP CHO TẤT CẢ CÁC BỆNH DƯỚI ĐÂY.'
      : 'Hãy đưa tư vấn cho bệnh được cung cấp.';

    const prompt = `
    Bạn là chuyên gia nông nghiệp và hệ thống tư vấn AI.

    Yêu cầu về phong cách:
    - KHÔNG sử dụng lời chào (ví dụ: "Chào bạn")
    - Viết theo văn phong học thuật, rõ ràng, súc tích
    - Không dùng cảm xúc hoặc văn nói
    - Trình bày thành đoạn văn logic, tối đa 6 câu

    ${multiDiseaseHeader}

    Thông tin bệnh (danh sách các bệnh và tỷ lệ dự đoán):

    ${diseasesList}

    Yêu cầu nội dung:
    - Nếu có nhiều bệnh: HÃY TRÌNH BÀY MỘT GIẢI PHÁP TỔNG HỢP phục vụ cho việc xử lý đồng thời các bệnh đã liệt kê; không chỉ chọn 1 bệnh chính.
    - Nêu nguyên nhân chính cho từng bệnh ngắn gọn nếu có thể, rồi tóm tắt các hướng xử lý chung, ưu tiên các biện pháp canh tác không hoá học trước.
    - Đưa các bước xử lý cụ thể, thời điểm và mức độ can thiệp (ví dụ ngưỡng % lá nhiễm hoặc mật độ sâu) nếu có.
    - Chỉ đề xuất phân bón/thuốc nếu chúng xuất hiện trong danh sách "phân bón được phép đề xuất" hoặc "thuốc được phép đề xuất".

    Ràng buộc:
    - KHÔNG bịa thêm tên thuốc/phân bón
    - Nếu không có dữ liệu → nói rõ "chưa có gợi ý từ cơ sở dữ liệu"

    Định dạng output:
    - Không xuống dòng linh tinh
    - Không dùng Markdown, không dùng bullet
    - Viết thành 1 đoạn hoàn chỉnh, không dùng bullet hoặc markdown
    - Không chào hỏi, không kêu gọi hành động
    `;

    const result = await model.generateContent(prompt);
    console.log("✓ Gemini advice generated successfully");
    return result.response.text();
  } catch (error) {
    console.error("❌ Lỗi Gemini:", {
      message: error.message,
      code: error.code,
      status: error.status
    });

    // Thông báo cụ thể nếu lỗi do vị trí người dùng không được hỗ trợ
    if (error.message && error.message.includes('User location is not supported')) {
      return 'Dịch vụ tư vấn AI chưa khả dụng tại vị trí của bạn. Vui lòng thử lại sau hoặc liên hệ quản trị.';
    }

    return "Không thể tạo tư vấn AI lúc này. Vui lòng thử lại sau.";
  }
};

const generateAIAdviceForDisease = async (disease, confidence = null) => {
  try {
    if (!genAI) {
      console.error("❌ GEMINI_API_KEY not configured");
      return "Tư vấn AI chưa được cấu hình. Vui lòng kiểm tra GEMINI_API_KEY.";
    }

    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const allowedFertilizers = formatFertilizerNames(disease.goi_y_phan_bon);
    const allowedPesticides = formatPesticideNames(disease.goi_y_thuoc);

    const prompt = `
Bạn là chuyên gia nông nghiệp.

Bệnh được chọn:
* Tên bệnh: ${disease.ten_benh}
* Tên tiếng Anh: ${disease.ten_benh_en}
* Độ tin cậy dự đoán: ${confidence !== null ? `${Math.round(confidence * 100)}%` : 'Không xác định'}
* Mô tả: ${disease.mo_ta || 'Không có'}
* Nguyên nhân: ${disease.nguyen_nhan || 'Không có'}
* Hướng xử lý: ${disease.huong_xu_ly || 'Không có'}
* Phân bón được phép đề xuất: ${allowedFertilizers.length > 0 ? allowedFertilizers.join(', ') : 'Không có'}
* Thuốc được phép đề xuất: ${allowedPesticides.length > 0 ? allowedPesticides.join(', ') : 'Không có'}

Yêu cầu:
* Hãy tư vấn đúng theo bệnh được chọn
* Viết ngắn gọn, dễ hiểu trong 3-5 câu
* Không tự bịa tên phân bón hoặc thuốc
* Chỉ nhắc đến phân bón/thuốc nếu có trong danh sách được phép đề xuất
* Nếu không có gợi ý cụ thể thì nói rõ là chưa có gợi ý từ cơ sở dữ liệu
    `;

    const result = await model.generateContent(prompt);
    console.log("✓ Gemini disease advice generated successfully");
    return result.response.text();
  } catch (error) {
    console.error("❌ Lỗi Gemini theo bệnh:", {
      message: error.message,
      code: error.code,
      status: error.status
    });
    if (error.message && error.message.includes('User location is not supported')) {
      return 'Dịch vụ tư vấn AI chưa khả dụng tại vị trí của bạn. Vui lòng thử lại sau hoặc liên hệ quản trị.';
    }
    return "Không thể tạo tư vấn AI lúc này. Vui lòng thử lại sau.";
  }
};

/**
 * Upload ảnh và gọi API ML để dự đoán bệnh
 * 
 * Body:
 *   - garden_id (required)
 *   - image file (required)
 * 
 * Luồng:
 * 1. Kiểm tra file upload
 * 2. Kiểm tra quyền (garden_id)
 * 3. Gửi ảnh sang Flask API
 * 4. Nhận kết quả dự đoán
 * 5. Lưu vào MongoDB
 * 6. Trả kết quả
 */
const uploadPrediction = async (req, res) => {
  try {
    const predictStartedAt = Date.now();
    // ✓ Kiểm tra upload file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng tải lên hình ảnh',
      });
    }

    const CONFIDENCE_THRESHOLD = 0.80; // 80% trở lên mới lưu vào database

    // NOTE: garden_id removed - prediction is tied to user only

    console.log(`\n📤 Gửi ảnh sang ML API: ${ML_API_URL}`);

    // ✓ 1. Gửi ảnh sang Flask API ML
    const fileStream = fs.createReadStream(req.file.path);
    const formData = new FormData();
    formData.append('image', fileStream, req.file.filename);

    let mlResponse;
    try {
      mlResponse = await axios.post(`${ML_API_URL}/predict`, formData, {
        headers: formData.getHeaders(),
        timeout: 30000, // 30 giây timeout
      });
    } catch (mlError) {
      console.error(`❌ Lỗi gọi ML API:`, mlError.message);
      if (mlError.response?.data) {
        console.error('❌ ML API response:', mlError.response.data);
      }
      
      // Xóa file nếu ML API lỗi
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });
      
      return res.status(500).json({
        success: false,
        message: mlError.response?.data?.error || mlError.response?.data?.message || 'Không thể kết nối AI. Vui lòng thử lại sau.',
        error: mlError.message,
      });
    }

    // ✓ 2. Kiểm tra response từ ML
    if (!mlResponse.data.success) {
      console.error('❌ ML API lỗi:', mlResponse.data.message);
      
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });
      
      return res.status(500).json({
        success: false,
        message: 'AI không thể phân tích ảnh. Vui lòng thử ảnh khác.',
      });
    }

    // ✓ 3. Lấy kết quả dự đoán từ Flask
    const mlData = mlResponse.data.data;
    if (!mlData.top_3 || !Array.isArray(mlData.top_3)) {
      console.error('❌ ML không trả về top_3');

      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });

      return res.status(500).json({
        success: false,
        message: 'Dữ liệu từ AI không hợp lệ',
      });
    }
    console.log(`✓ ML API trả kết quả: ${mlData.disease_en} (confidence: ${mlData.confidence})`);
    const gradCamPath = mlData.grad_cam?.overlay_path || '';

    // ✓ 3.1 Xử lý top_3: convert 100 → 1, sort, filter
    let predictions = mlData.top_3.map(item => ({
      label: item.disease_en,
      confidence: item.confidence / 100
    }));

    predictions = predictions
      .filter(p => p.confidence > 0)
      .sort((a, b) => b.confidence - a.confidence);
    
    if (!predictions || predictions.length === 0) {
      console.error('❌ Không có kết quả dự đoán hợp lệ');

      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });

      return res.status(500).json({
        success: false,
        message: 'Không thể phân tích ảnh. Vui lòng thử ảnh rõ hơn.',
      });
    }

    console.log(`✓ Top 3 predictions:`, predictions.length);

    // ✓ 3.2 Lấy danh sách bệnh từ DB dùng find (không findOne)
    // ===== CẬP NHẬT: Populate fertilizer & pesticide suggestions =====
    const diseases = await Disease.find({})
      .populate('goi_y_phan_bon', 'ten_phan_bon thanh_phan cong_dung')
      .populate('goi_y_thuoc', 'ten_thuoc loai hoat_chat cach_su_dung muc_do_doc_hai');

    if (diseases.length === 0) {
      console.error(`❌ Không tìm thấy bệnh cho predictions`);
      
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });
      
      return res.status(500).json({
        success: false,
        message: `Không tìm thấy thông tin bệnh trong database`,
      });
    }

    // ✓ 3.3 Map diseaseMap để tra cứu nhanh
    const diseaseMap = {};
    diseases.forEach(d => {
      diseaseMap[d.ten_benh_en] = d;
      diseaseMap[resolveDiseaseKey(d.ten_benh_en)] = d;
      diseaseMap[d.ten_benh] = d;
      diseaseMap[resolveDiseaseKey(d.ten_benh)] = d;
    });

    // ✓ 3.4 Xác định bệnh chính (prediction đầu tiên)
    const mainPrediction = predictions[0];
    if (!mainPrediction || !mainPrediction.label) {
      console.error('❌ Không xác định được prediction chính');

      return res.status(500).json({
        success: false,
        message: 'Không xác định được kết quả dự đoán',
      });
    }
    const mainDisease = diseaseMap[resolveDiseaseKey(mainPrediction.label)] || diseaseMap[normalizeDiseaseKey(mainPrediction.label)] || diseaseMap[mainPrediction.label];

    // Nếu confidence thấp → reject
    if (mainPrediction.confidence < CONFIDENCE_THRESHOLD) {
      console.log('⚠️ Confidence thấp, không lưu database nhưng trả về kết quả tạm thời');

      // ❗ Xóa ảnh vì không lưu
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });

      // Trả về kết quả tạm thời để UI vẫn hiển thị tên bệnh và top-3,
      // nhưng không lưu vào database. Client có thể hiển thị cảnh báo "Độ tin cậy thấp".
      return res.status(200).json({
        success: true,
        message: 'Ảnh không đủ điều kiện để lưu nhưng trả về kết quả tạm thời',
        data: {
          confidence: mainPrediction.confidence,
          isLowConfidence: true,
          main_disease_en: mainPrediction.label,
          main_disease_vi: (diseaseMap[mainPrediction.label]?.ten_benh) || mainPrediction.label,
          top_3: predictions.map(p => ({
            ten_benh: (diseaseMap[p.label]?.ten_benh) || p.label,
            ten_benh_en: p.label,
            confidence: p.confidence
          })),
        },
      });
    }

    if (!mainDisease) {
      console.error(`❌ Không tìm thấy bệnh chính: ${mainPrediction.label}`);
      
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });
      
      return res.status(500).json({
        success: false,
        message: `Không tìm thấy thông tin bệnh chính`,
      });
    }

    // ✓ 4. Đường dẫn file
    const hinh_anh = `/uploads/${req.file.filename}`;

    // ✓ 5. Tạo tư vấn AI bằng Gemini trước
    const advice = await generateAIAdvice(predictions, diseaseMap);

    // ✓ 6. Tạo prediction trong database (lưu bệnh chính + tư vấn)
    const prediction = new Prediction({
      user_id: req.userId,
      hinh_anh,
      ket_qua_benh: mainDisease.ten_benh,  // Tên bệnh tiếng Việt từ bệnh chính
      do_tin_cay: Math.round(mainPrediction.confidence * 100),  // Convert 0-1 → 0-100
      mo_ta_benh: mainDisease.mo_ta || 'Không có thông tin',
      huong_xu_ly: mainDisease.huong_xu_ly || 'Cần tư vấn chuyên gia',
      tuvan_ai: advice,  // Lưu tư vấn AI
      grad_cam_path: gradCamPath,
      thoi_gian_xu_ly_ms: Date.now() - predictStartedAt,
      ngay_du_doan: new Date(),
    });

    await prediction.save();
    console.log(`✓ Lưu dự đoán vào database`);

    // ✓ 7. Trả kết quả đầy đủ
    // ===== CẬP NHẬT: Thêm fertilizer & pesticide suggestions =====
    res.status(201).json({
      success: true,
      message: 'Dự đoán thành công',
      data: {
        id: prediction._id,
        main_disease: mainDisease.ten_benh,
        confidence: mainPrediction.confidence,
        
        top_3: predictions.map(p => {
          const d = diseaseMap[p.label];
          return {
            ten_benh: d?.ten_benh,
            ten_benh_en: p.label,
            confidence: p.confidence
          };
        }),
        
        advice,
        grad_cam: mlData.grad_cam || null,
        grad_cam_path: gradCamPath,
        
        // ===== MỚI: Gợi ý phân bón =====
        phan_bon_goi_y: mainDisease.goi_y_phan_bon || [],
        
        // ===== MỚI: Gợi ý thuốc =====
        thuoc_goi_y: mainDisease.goi_y_thuoc || [],
        
        ngay_du_doan: prediction.ngay_du_doan,
      },
    });

  } catch (error) {
    // Xóa file nếu lỗi
    if (req.file) {
      fs.unlink(req.file.path, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });
    }

    console.error('❌ Lỗi dự đoán:', error.message);
    res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống. Vui lòng thử lại sau.',
      error: error.message,
    });
  }
};

// Lấy danh sách dự đoán của user
const getPredictionsByUser = async (req, res) => {
  try {
      const predictions = await Prediction.find({ user_id: req.userId })
        .sort({ ngay_du_doan: -1 });

    console.log('✓ Lấy danh sách dự đoán:', predictions.length);

    res.json({
      success: true,
      count: predictions.length,
      data: predictions,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy dự đoán:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy chi tiết 1 dự đoán
const getPredictionById = async (req, res) => {
  try {
    const prediction = await Prediction.findById(req.params.id);

    if (!prediction) {
      return res.status(404).json({
        success: false,
        message: 'Dự đoán không tồn tại',
      });
    }

    // Kiểm tra quyền
    if (prediction.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem dự đoán này',
      });
    }

    // ===== CẬP NHẬT: Lấy disease với populated suggestions =====
    const disease = await Disease.findOne({ ten_benh: prediction.ket_qua_benh })
      .populate('goi_y_phan_bon', 'ten_phan_bon thanh_phan cong_dung')
      .populate('goi_y_thuoc', 'ten_thuoc loai hoat_chat cach_su_dung muc_do_doc_hai');

    res.json({
      success: true,
      data: {
        ...prediction.toObject(),
        phan_bon_goi_y: disease?.goi_y_phan_bon || [],
        thuoc_goi_y: disease?.goi_y_thuoc || [],
      },
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết dự đoán:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getAdviceForSelectedDisease = async (req, res) => {
  try {
    const { disease_en, confidence } = req.body;

    if (!disease_en || !String(disease_en).trim()) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn 1 bệnh để nhận tư vấn',
      });
    }

    const diseases = await Disease.find({})
      .populate('goi_y_phan_bon', 'ten_phan_bon thanh_phan cong_dung')
      .populate('goi_y_thuoc', 'ten_thuoc loai hoat_chat cach_su_dung muc_do_doc_hai');

    const diseaseMap = buildDiseaseMap(diseases);
    const disease = diseaseMap[resolveDiseaseKey(disease_en)] || diseaseMap[String(disease_en).trim()] || null;

    if (!disease) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy thông tin bệnh để tư vấn',
      });
    }

    const advice = await generateAIAdviceForDisease(disease, confidence);

    return res.json({
      success: true,
      data: {
        disease_en: disease.ten_benh_en,
        disease_vi: disease.ten_benh,
        advice,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi lấy tư vấn theo bệnh:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message,
    });
  }
};

// Nhận nhiều bệnh được chọn và trả về tư vấn tổng hợp từ AI (không lưu vào DB)
const getAdviceForSelectedDiseases = async (req, res) => {
  try {
    const { predictions } = req.body; // predictions: [{ disease_en, confidence }, ...]

    if (!predictions || !Array.isArray(predictions) || predictions.length === 0) {
      return res.status(400).json({ success: false, message: 'Vui lòng gửi danh sách dự đoán (top-k) để tư vấn' });
    }

    const diseases = await Disease.find({})
      .populate('goi_y_phan_bon', 'ten_phan_bon thanh_phan cong_dung')
      .populate('goi_y_thuoc', 'ten_thuoc loai hoat_chat cach_su_dung muc_do_doc_hai');

    if (!diseases || diseases.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin bệnh để tư vấn' });
    }

    const diseaseMap = buildDiseaseMap(diseases);

    const resolvedDiseases = predictions
      .map((p) => {
        const label = String(p.disease_en || p.label || '').trim();
        const disease = diseaseMap[resolveDiseaseKey(label)] || diseaseMap[label];
        return disease;
      })
      .filter(Boolean);

    if (resolvedDiseases.length === 0) {
      return res.status(404).json({ success: false, message: 'Không tìm thấy thông tin bệnh để tư vấn' });
    }

    // Normalize predictions shape to { label, confidence } expected by generateAIAdvice
    const normalizedPreds = predictions.map(p => ({
      label: String(p.disease_en || p.label || '').trim(),
      confidence: typeof p.confidence === 'number' ? p.confidence : parseFloat(p.confidence) || 0,
    })).filter(p => p.label);

    // Gọi generator AI với danh sách predictions và map
    const advice = await generateAIAdvice(normalizedPreds, diseaseMap);

    return res.json({ success: true, data: { predictions, advice } });
  } catch (error) {
    console.error('❌ Lỗi tư vấn nhiều bệnh:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: error.message });
  }
};

// Xóa dự đoán
const deletePrediction = async (req, res) => {
  try {
    console.log(`\n🔍 DELETE REQUEST - ID: ${req.params.id}, User: ${req.userId}`);
    
    const prediction = await Prediction.findById(req.params.id);

    if (!prediction) {
      console.log(`❌ Prediction not found: ${req.params.id}`);
      return res.status(404).json({
        success: false,
        message: 'Dự đoán không tồn tại',
      });
    }

    console.log(`✓ Found prediction`);
    console.log(`  - prediction.user_id: ${prediction.user_id} (type: ${typeof prediction.user_id})`);
    console.log(`  - req.userId: ${req.userId} (type: ${typeof req.userId})`);
    console.log(`  - prediction.user_id.toString(): ${prediction.user_id.toString()}`);
    console.log(`  - Match: ${prediction.user_id.toString() === req.userId}`);

    // Kiểm tra quyền
    if (prediction.user_id.toString() !== req.userId) {
      console.log(`❌ Permission denied - user mismatch`);
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa dự đoán này',
      });
    }

    // Xóa file
    if (prediction.hinh_anh) {
      const filePath = path.join(__dirname, '../../' + prediction.hinh_anh);
      fs.unlink(filePath, (err) => {
        if (err) console.error('Lỗi xóa file:', err);
      });
    }

    await Prediction.findByIdAndDelete(req.params.id);
    console.log('✓ Xóa dự đoán thành công');

    res.json({
      success: true,
      message: 'Xóa dự đoán thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa dự đoán:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy tất cả dự đoán (chỉ admin)
const getAllPredictions = async (req, res) => {
  try {
    console.log('👉 GET /api/predictions called');

    // Kiểm tra admin role
    const User = require('../models/User');
    const currentUser = await User.findById(req.userId);
    
    if (!currentUser || currentUser.vai_tro !== 'admin') {
      console.log('❌ Access denied - not admin');
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin only',
      });
    }

    console.log('✓ Admin access granted');

    // Lấy tất cả predictions, populate user và garden info
    const predictions = await Prediction.find()
      .populate('user_id', 'ho_ten email vai_tro')
      .sort({ ngay_du_doan: -1 })
      .limit(100);

    console.log(`✓ Retrieved ${predictions.length} predictions`);

    // ===== CẬP NHẬT: Fetch disease suggestions cho mỗi prediction =====
    const predictionsWithSuggestions = await Promise.all(
      predictions.map(async (pred) => {
        const disease = await Disease.findOne({ ten_benh: pred.ket_qua_benh })
          .populate('goi_y_phan_bon', 'ten_phan_bon thanh_phan')
          .populate('goi_y_thuoc', 'ten_thuoc loai');
        
        return {
          ...pred.toObject(),
          phan_bon_goi_y: disease?.goi_y_phan_bon || [],
          thuoc_goi_y: disease?.goi_y_thuoc || [],
        };
      })
    );

    res.json({
      success: true,
      data: predictionsWithSuggestions,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách dự đoán:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  uploadPrediction,
  getPredictionsByUser,
  getPredictionById,
  getAdviceForSelectedDisease,
  getAdviceForSelectedDiseases,
  deletePrediction,
  getAllPredictions,
};
