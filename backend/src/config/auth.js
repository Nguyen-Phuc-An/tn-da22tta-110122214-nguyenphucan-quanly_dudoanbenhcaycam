const jwt = require('jsonwebtoken');

/**
 * ╔════════════════════════════════════════════════════════════════════════╗
 * ║              🔐 JWT AUTHENTICATION & RBAC MIDDLEWARE                   ║
 * ╠════════════════════════════════════════════════════════════════════════╣
 * ║                                                                        ║
 * ║ GIẢI THUẬT JWT (JSON Web Token)                                       ║
 * ║ ────────────────────────────────────────────────────────────────────  ║
 * ║                                                                        ║
 * ║ Bước 1: TẠO TOKEN (Khi user đăng nhập)                               ║
 * ║  jwt.sign({userId, iat, exp}, secret) →                              ║
 * ║  OUTPUT: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQi..."       ║
 * ║                                                                        ║
 * ║  Cấu trúc: header.payload.signature (3 phần)                         ║
 * ║  - Header: {alg: "HS256", typ: "JWT"}                                ║
 * ║  - Payload: {userId: "123", iat: 1234567890, exp: 1234571490}        ║
 * ║  - Signature: HMACSHA256(header.payload, JWT_SECRET)                 ║
 * ║                                                                        ║
 * ║ Bước 2: GỬI TOKEN TỚI CLIENT                                          ║
 * ║  Response: {token: "eyJ...", userRole: "user"}                       ║
 * ║                                                                        ║
 * ║ Bước 3: CLIENT GỬI TOKEN TRONG REQUEST                                ║
 * ║  Request headers: {Authorization: "Bearer eyJ..."}                    ║
 * ║                                                                        ║
 * ║ Bước 4: SERVER VERIFY TOKEN (Middleware này)                          ║
 * ║  - Lấy token từ header: Authorization.split(' ')[1]                  ║
 * ║  - Verify signature: jwt.verify(token, secret)                       ║
 * ║  - Kiểm tra expiration: Nếu hết hạn → 403 Forbidden                  ║
 * ║  - Trích userId: decoded.userId                                      ║
 * ║  - Lấy vai trò: db.User.findById(userId).vai_tro                     ║
 * ║  - Gắn vào request: req.userId, req.userRole                         ║
 * ║                                                                        ║
 * ║ Bước 5: CONTROLLER CÓ THỂ DÙNG req.userId & req.userRole              ║
 * ║  if (req.userRole === "admin") { // cho phép }                        ║
 * ║  else if (doc.user_id == req.userId) { // cho phép }                  ║
 * ║                                                                        ║
 * ║ SECURITY FEATURES                                                     ║
 * ║ - Token có thời gian hết hạn (thường 1 giờ)                          ║
 * ║ - Signature không thể giả mạo (cần secret)                            ║
 * ║ - Client không thể sửa payload (signature sẽ sai)                     ║
 * ║ - Nếu secret bị lộ → attacker có thể tạo token giả                    ║
 * ║                                                                        ║
 * ╚════════════════════════════════════════════════════════════════════════╝
 */

// Middleware kiểm tra JWT token
const authenticateToken = async (req, res, next) => {
  // Lấy token từ header Authorization
  const authHeader = req.headers['authorization'];
  let token = authHeader && authHeader.split(' ')[1]; // "Bearer TOKEN"

  // Also check for token in query params (needed for SSE/EventSource)
  if (!token && req.query.token) {
    token = req.query.token;
  }

  if (!token) {
    return res.status(401).json({
      success: false,
      message: 'Vui lòng đăng nhập',
    });
  }

  try {
    // Xác minh token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');

    // Lấy user hiện tại từ DB để tránh token cũ trỏ tới user đã bị xóa
    const User = require('../models/User');
    const user = await User.findById(decoded.userId).select('vai_tro');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Phiên đăng nhập không còn hợp lệ. Vui lòng đăng nhập lại.',
      });
    }

    req.userId = decoded.userId;
    req.userRole = user.vai_tro;
    next();
  } catch (error) {
    console.error('❌ Lỗi xác minh token:', error.message);
    res.status(403).json({
      success: false,
      message: 'Token không hợp lệ hoặc hết hạn',
    });
  }
};

module.exports = {
  authenticateToken,
};
