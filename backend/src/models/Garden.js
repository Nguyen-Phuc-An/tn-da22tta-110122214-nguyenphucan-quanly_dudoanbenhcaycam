const mongoose = require('mongoose');

const gardenSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vui lòng chỉ định người dùng'],
  },
  season_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Season',
    required: false,
    default: null,
  },
  ten_vuon: {
    type: String,
    required: [true, 'Vui lòng nhập tên vườn'],
    minlength: 2,
    maxlength: 100,
  },
  dien_tich: {
    type: Number,
    required: [true, 'Vui lòng nhập diện tích'],
    min: 1,
  },
  don_vi: {
    type: String,
    enum: ['m²', 'hectare', 'công'],
    default: 'm²',
  },
  dia_chi: {
    type: String,
    required: [true, 'Vui lòng nhập địa chỉ'],
  },
  so_cay: {
    type: Number,
    default: 0,
    min: 0,
  },
  trang_thai: {
    type: String,
    enum: ['Đang hoạt động', 'Ngưng hoạt động'],
    default: 'Đang hoạt động',
  },
  ngay_tao: {
    type: Date,
    default: Date.now,
  },
  ngay_cap_nhat: {
    type: Date,
    default: Date.now,
  },
});

// Index để tìm kiếm nhanh
gardenSchema.index({ user_id: 1, season_id: 1 });

gardenSchema.virtual('plots', {
  ref: 'Plot',
  localField: '_id',
  foreignField: 'garden_id',
});

gardenSchema.set('toJSON', { virtuals: true });
gardenSchema.set('toObject', { virtuals: true });

// Cập nhật ngay_cap_nhat khi lưu
gardenSchema.pre('save', function (next) {
  this.ngay_cap_nhat = Date.now();
  next();
});

module.exports = mongoose.model('Garden', gardenSchema);
