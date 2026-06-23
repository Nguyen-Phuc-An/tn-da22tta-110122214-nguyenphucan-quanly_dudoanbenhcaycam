const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  uploadPrediction,
  getPredictionsByUser,
  getPredictionById,
  getAdviceForSelectedDisease,
  getAdviceForSelectedDiseases,
  deletePrediction,
  getAllPredictions,
} = require('../controllers/prediction.controller');
const { authenticateToken } = require('../config/auth');

/**
 * Cấu hình multer cho upload ảnh
 * 
 * - Destination: /uploads
 * - File name: prediction-{timestamp}-{random}.{ext}
 * - Filter: Chỉ chấp nhận ảnh
 * - Limit: 5MB
 */

// Cấu hình storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads'));
  },
  filename: (req, file, cb) => {
    // Tạo tên file duy nhất: prediction-{timestamp}-{random}.{ext}
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'prediction-' + uniqueSuffix + path.extname(file.originalname));
  },
});

// Filter chỉ chấp nhận ảnh
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Chỉ chấp nhận file ảnh'), false);
  }
};

// Khởi tạo multer
const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

const router = express.Router();

// ✓ Tất cả route yêu cầu JWT authentication
router.use(authenticateToken);

/**
 * GET /api/predictions
 * Lấy danh sách dự đoán
 * - Nếu admin: trả về tất cả dự đoán
 * - Nếu user: trả về chỉ dự đoán của user đó
 */
router.get('/', async (req, res, next) => {
  try {
    const User = require('../models/User');
    const currentUser = await User.findById(req.userId);
    
    // Nếu là admin, gọi getAllPredictions; nếu không, gọi getPredictionsByUser
    if (currentUser && currentUser.vai_tro === 'admin') {
      return getAllPredictions(req, res);
    } else {
      return getPredictionsByUser(req, res);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/predictions/:id
 * Lấy chi tiết 1 dự đoán
 */
router.get('/:id', getPredictionById);

/**
 * POST /api/predict
 * Upload ảnh và dự đoán bệnh
 * 
 * Request:
 *   - Form data:
 *     * image: file ảnh (required)
 *     (prediction is tied to authenticated user; no garden_id required)
 * 
 * Response:
 *   {
 *     success: true,
 *     data: {
 *       ket_qua_benh: "Bệnh loét",
 *       do_tin_cay: 92.45,
 *       ...
 *     }
 *   }
 */
router.post('/predict', upload.single('image'), uploadPrediction);

/**
 * POST /api/predictions/advice
 * Tạo tư vấn AI theo bệnh user chọn trong top 3
 */
router.post('/advice', getAdviceForSelectedDisease);
/**
 * POST /api/predictions/advice-multi
 * Tạo tư vấn AI cho nhiều bệnh được chọn (top-k) — trả về tư vấn tổng hợp
 */
router.post('/advice-multi', getAdviceForSelectedDiseases);

/**
 * DELETE /api/predictions/:id
 * Xóa dự đoán
 */
router.delete('/:id', deletePrediction);

module.exports = router;
