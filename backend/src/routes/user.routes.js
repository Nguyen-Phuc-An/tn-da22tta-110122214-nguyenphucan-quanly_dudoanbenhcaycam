const express = require('express');
const { register, login, getProfile, getAllUsers, lockUser, createUser, updateUser, deleteUser, changePassword } = require('../controllers/user.controller');
const { authenticateToken } = require('../config/auth');

const router = express.Router();

// Đăng ký (không cần authentication)
router.post('/register', register);

// Đăng nhập (không cần authentication)
router.post('/login', login);

// Lấy profile (cần authentication)
router.get('/profile', authenticateToken, getProfile);

// Lấy danh sách user (cần authentication + admin role)
router.get('/', authenticateToken, getAllUsers);

// Tạo user mới (admin only)
router.post('/', authenticateToken, createUser);

// Cập nhật user (admin only)
router.put('/:userId', authenticateToken, updateUser);

// Xóa user (admin only)
router.delete('/:userId', authenticateToken, deleteUser);

// Khóa/Mở khóa user (cần authentication + admin role)
router.patch('/:userId/lock', authenticateToken, lockUser);

// Đổi mật khẩu (cần authentication)
router.post('/change-password', authenticateToken, changePassword);

module.exports = router;
