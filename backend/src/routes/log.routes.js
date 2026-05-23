const express = require('express');
const {
	createLog,
	getLogsByGarden,
	getLogsByPlot,
	getLogsBySeason,
	getLogById,
	getAllLogsForUser,
	getAllLogsByAdmin,
	updateLog,
	deleteLog,
} = require('../controllers/log.controller');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

// Tất cả route cần authentication
router.use(authenticateToken);

/**
 * GET /api/logs
 * Lấy tất cả nhật ký của user hiện tại
 */
router.get('/', getAllLogsForUser);

/**
 * GET /api/logs/admin/all
 * Admin: Lấy tất cả nhật ký
 */
router.get('/admin/all', getAllLogsByAdmin);

/**
 * GET /api/logs/garden/:garden_id
 * Lấy nhật ký theo vườn
 */
router.get('/garden/:garden_id', getLogsByGarden);

/**
 * GET /api/logs/plot/:id
 * Lấy nhật ký theo mẫu đất
 */
router.get('/plot/:id', getLogsByPlot);

/**
 * GET /api/logs/season/:season_id
 * Lấy nhật ký theo mùa vụ
 */
router.get('/season/:season_id', getLogsBySeason);

/**
 * GET /api/logs/:id
 * Chi tiết nhật ký
 */
router.get('/:id', getLogById);

/**
 * POST /api/logs
 * Tạo nhật ký mới
 */
router.post('/', createLog);

/**
 * PUT /api/logs/:id
 * Cập nhật nhật ký
 */
router.put('/:id', updateLog);

/**
 * DELETE /api/logs/:id
 * Xóa nhật ký
 */
router.delete('/:id', deleteLog);

module.exports = router;
