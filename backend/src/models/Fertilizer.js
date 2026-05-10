/**
 * Fertilizer Schema (Phân Bón)
 * 
 * Ghi chú:
 * - Tên bảng: Fertilizer
 * - Dùng để quản lý các loại phân bón
 * - Liên kết: Disease có thể gợi ý nhiều Fertilizer
 */

const mongoose = require('mongoose');

const fertilizerSchema = new mongoose.Schema({
  // ===== THÔNG TIN CƠ BẢN =====
  ten_phan_bon: {
    type: String,
    required: [true, 'Vui lòng nhập tên phân bón'],
    unique: true,
    trim: true,
    // VD: "Phân NPK 16-16-8", "Phân hữu cơ"
  },

  mo_ta: {
    type: String,
    default: '',
    // Mô tả chi tiết về phân bón
  },

  thanh_phan: {
    type: String,
    required: [true, 'Vui lòng nhập thành phần'],
    // VD: "N-P-K: 16-16-8, Mg: 2%"
  },

  cong_dung: {
    type: String,
    required: [true, 'Vui lòng nhập công dụng'],
    // VD: "Cung cấp dinh dưỡng toàn diện"
  },

  gia_tien: {
    type: Number,
    required: [true, 'Vui lòng nhập giá tiền'],
    min: [0, 'Giá tiền không được âm'],
    // Giá bán tham khảo
  },

  cach_su_dung: {
    type: String,
    default: '',
    // VD: "Trộn vào đất 20-30g/m2"
  },

  don_vi: {
    type: String,
    required: [true, 'Vui lòng nhập đơn vị'],
    enum: ['kg', 'l', 'túi', 'chai', 'bao'],
    default: 'kg',
    // Đơn vị tính: kg, g, lít, ml, túi, chai...
  },

  // ===== THÔNG TIN QUẢN LÝ =====
  ngay_tao: {
    type: Date,
    default: Date.now,
  },

  ngay_cap_nhat: {
    type: Date,
    default: Date.now,
  },

}, {
  timestamps: false,
  collection: 'Fertilizer'
});

// Index để tìm kiếm nhanh
fertilizerSchema.index({ ten_phan_bon: 1 });

module.exports = mongoose.model('Fertilizer', fertilizerSchema);
