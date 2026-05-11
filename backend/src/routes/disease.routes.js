const express = require('express');
const {
  getAllDiseases,
  getDiseaseById,
  getDiseaseLibrary,
  getDiseaseByEnName,
  createDisease,
  updateDisease,
  deleteDisease,
  migrateEnFields,
} = require('../controllers/disease.controller');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

// GET tất cả bệnh (không cần authentication)
router.get('/', getAllDiseases);

// GET thư viện bệnh + ảnh mẫu gốc (không cần authentication)
router.get('/library', getDiseaseLibrary);

// GET bệnh theo tiếng Anh (không cần authentication)
router.get('/en/:en_name', getDiseaseByEnName);

// GET chi tiết bệnh (không cần authentication)
router.get('/:id', getDiseaseById);

// POST, PUT, DELETE cần authentication và phải là Admin
router.use(authenticateToken);

// PUT migration (Admin)
router.put('/migrate-en', migrateEnFields);

// POST tạo bệnh (Admin)
router.post('/', createDisease);

// PUT cập nhật bệnh (Admin)
router.put('/:id', updateDisease);

// DELETE xóa bệnh (Admin)
router.delete('/:id', deleteDisease);

module.exports = router;
