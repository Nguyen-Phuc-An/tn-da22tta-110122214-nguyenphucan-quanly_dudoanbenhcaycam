const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  // Tham chiếu đến vườn
  garden_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garden',
    required: [true, 'Vui lòng chỉ định vườn'],
  },
  // Tham chiếu đến mùa vụ
  season_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Season',
    required: [true, 'Vui lòng chọn mùa vụ'],
  },
  // Loại chi phí
  loai_chi_phi: {
    type: String,
    required: [true, 'Vui lòng nhập loại chi phí'],
    enum: ['Phân bón', 'Thuốc', 'Nhân công', 'Dụng cụ', 'Điện nước', 'Khác'],
  },
  // Danh sách mẫu đất liên quan
  plot_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plot',
  }],
  // Danh sách chi tiết chi phí (items)
  items: [
    {
      ten_mat_hang: {
        type: String,
        required: [true, 'Tên mặt hàng bắt buộc'],
      },
      so_luong: {
        type: Number,
        required: [true, 'Số lượng bắt buộc'],
        min: [0.01, 'Số lượng phải lớn hơn 0'],
      },
      don_vi: {
        type: String,
        required: [true, 'Đơn vị bắt buộc'],
        // ví dụ: chai, bịch, kg, lít, cái, bộ
      },
      gia_tien: {
        type: Number,
        required: [true, 'Giá tiền bắt buộc'],
        min: [0, 'Giá tiền không được âm'],
      },
      tong_tien: {
        type: Number,
        default: 0,
        // Sẽ được tính tự động = so_luong * gia_tien
      },
    },
  ],
  // Tổng số tiền chi phí (tính tự động từ items)
  so_tien: {
    type: Number,
    default: 0,
    min: 0,
    max: 999999999,
  },
  // Ngày chi phí phát sinh
  ngay: {
    type: Date,
    required: [true, 'Vui lòng nhập ngày'],
  },
  // Đơn vị tiền tệ
  don_vi: {
    type: String,
    enum: ['vnđ', 'usd'],
    default: 'vnđ',
  },
  // Ngày tạo bản ghi
  ngay_tao: {
    type: Date,
    default: Date.now,
  },
  // Ngày cập nhật bản ghi
  ngay_cap_nhat: {
    type: Date,
    default: Date.now,
  },
});

// Middleware: Tự động tính tổng tiền cho từng item và tổng toàn bộ
expenseSchema.pre('save', function (next) {
  // Kiểm tra items không rỗng
  if (!this.items || this.items.length === 0) {
    return next(new Error('Chi phí phải có ít nhất 1 mặt hàng'));
  }

  // Tính tổng tiền cho từng item
  this.items.forEach((item) => {
    item.tong_tien = Number((item.so_luong * item.gia_tien).toFixed(0));
  });

  // Tính tổng chi phí toàn bộ
  this.so_tien = this.items.reduce((sum, item) => {
    return sum + (item.tong_tien || 0);
  }, 0);

  // Cập nhật thời gian chỉnh sửa
  this.ngay_cap_nhat = new Date();

  next();
});

// Index để tìm kiếm nhanh theo vườn, mùa vụ và ngày
expenseSchema.index({ garden_id: 1, season_id: 1, ngay: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
