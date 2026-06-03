const express = require('express');
const multer = require('multer');
const path = require('path');
const { authenticateToken } = require('../config/auth');
const { uploadTrainingImages, getTrainingStatus, triggerRetrain, streamTrainingProgress } = require('../controllers/ml.controller');

const router = express.Router();

// ===== MULTER CONFIG =====
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../../uploads/temp'));
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 1000);
    cb(null, `${timestamp}-${random}-${file.originalname}`);
  },
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith('image/')) {
      cb(new Error('Only image files allowed'));
    } else {
      cb(null, true);
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

// ===== ROUTES =====

// Upload training images (Admin only)
// POST /api/ml/training-images?disease_name=black_spot
router.post('/training-images', authenticateToken, upload.array('images'), uploadTrainingImages);

// Get training status (Admin only)
// GET /api/ml/status
router.get('/status', authenticateToken, getTrainingStatus);

// Trigger retrain (Admin only)
// POST /api/ml/retrain
router.post('/retrain', authenticateToken, triggerRetrain);

// Stream training progress (Admin only, SSE)
// GET /api/ml/progress
router.get('/progress', authenticateToken, streamTrainingProgress);

module.exports = router;
