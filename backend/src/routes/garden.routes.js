const express = require('express');
const {
  createGarden,
  getGardensByUser,
  getGardenById,
  updateGarden,
  changeSeasonForGarden,
  deleteGarden,
  getSprayProgress,
} = require('../controllers/garden.controller');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

// Tất cả route cần authentication
router.use(authenticateToken);

// GET tất cả vườn của user
router.get('/', getGardensByUser);

// GET chi tiết 1 vườn
router.get('/:id', getGardenById);

// GET tiến độ xịt thuốc của vườn
router.get('/:id/spray-progress', getSprayProgress);

// POST tạo vườn mới
router.post('/', createGarden);

// PUT cập nhật vườn
router.put('/:id', updateGarden);

// POST chuyển mùa vụ cho vườn
router.post('/:id/change-season', changeSeasonForGarden);

// DELETE xóa vườn
router.delete('/:id', deleteGarden);

module.exports = router;
