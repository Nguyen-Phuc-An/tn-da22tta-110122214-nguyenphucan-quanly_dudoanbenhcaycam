const express = require('express');
const { authenticateToken } = require('../config/auth');
const {
  getAllFertilizers,
  getFertilizerById,
  createFertilizer,
  updateFertilizer,
  deleteFertilizer,
} = require('../controllers/fertilizer.controller');

const router = express.Router();

// ===== PUBLIC ROUTES =====
// GET: Lấy danh sách tất cả phân bón
router.get('/', getAllFertilizers);

// GET: Lấy chi tiết 1 phân bón
router.get('/:id', getFertilizerById);

// ===== PROTECTED ROUTES (Admin only) =====
// POST: Tạo phân bón mới
router.post('/', authenticateToken, createFertilizer);

// PUT: Cập nhật phân bón
router.put('/:id', authenticateToken, updateFertilizer);

// DELETE: Xóa phân bón
router.delete('/:id', authenticateToken, deleteFertilizer);

module.exports = router;
