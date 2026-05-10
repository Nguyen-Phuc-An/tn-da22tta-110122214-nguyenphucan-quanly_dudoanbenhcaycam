/**
 * Pesticide Schema (Thuốc)
 * 
 * Ghi chú:
 * - Tên bảng: Pesticide
 * - Dùng để quản lý các loại thuốc (trừ sâu, trừ bệnh, diệt cỏ...)
 * - Liên kết: Disease có thể gợi ý nhiều Pesticide
 */

const mongoose = require('mongoose');

const pesticideSchema = new mongoose.Schema({
  // ===== THÔNG TIN CƠ BẢN =====
  ten_thuoc: {
    type: String,
    required: [true, 'Vui lòng nhập tên thuốc'],
    unique: true,
    trim: true,
    // VD: "Xử lý bệnh đốm đen", "Diệt sâu xanh"
  },

  mo_ta: {
    type: String,
    default: '',
    // Mô tả chi tiết về thuốc
  },

  loai: {
    type: String,
    required: [true, 'Vui lòng chọn loại thuốc'],
    enum: ['Trừ sâu', 'Trừ bệnh', 'Diệt cỏ', 'Khác'],
    default: 'Trừ bệnh',
    // Phân loại thuốc
  },

  hoat_chat: {
    type: String,
    required: [true, 'Vui lòng nhập hoạt chất'],
    // VD: "Azoxystrobin 25%"
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
    // VD: "Phun 2-3ml/lít nước, phun 1-2 lần/tuần"
  },

  muc_do_doc_hai: {
    type: String,
    required: [true, 'Vui lòng chọn mức độ độc hại'],
    enum: ['Thấp', 'Trung bình', 'Cao'],
    default: 'Trung bình',
    // Mức độ độc hại: Thấp, Trung bình, Cao
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
  collection: 'Pesticide'
});

// Index để tìm kiếm nhanh
pesticideSchema.index({ ten_thuoc: 1 });
pesticideSchema.index({ loai: 1 });
pesticideSchema.index({ muc_do_doc_hai: 1 });

module.exports = mongoose.model('Pesticide', pesticideSchema);
