const express = require('express');
const { authenticateToken } = require('../config/auth');
const {
  getAllPesticides,
  getPesticideById,
  createPesticide,
  updatePesticide,
  deletePesticide,
} = require('../controllers/pesticide.controller');

const router = express.Router();

// ===== PUBLIC ROUTES =====
// GET: Lấy danh sách tất cả thuốc
router.get('/', getAllPesticides);

// GET: Lấy chi tiết 1 thuốc
router.get('/:id', getPesticideById);

// ===== PROTECTED ROUTES (Admin only) =====
// POST: Tạo thuốc mới
router.post('/', authenticateToken, createPesticide);

// PUT: Cập nhật thuốc
router.put('/:id', authenticateToken, updatePesticide);

// DELETE: Xóa thuốc
router.delete('/:id', authenticateToken, deletePesticide);

module.exports = router;
