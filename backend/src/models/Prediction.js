const mongoose = require('mongoose');

const predictionSchema = new mongoose.Schema({
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vui lòng chỉ định người dùng'],
  },
  hinh_anh: {
    type: String,
    required: [true, 'Vui lòng upload hình ảnh'],
  },
  ket_qua_benh: {
    type: String,
    default: null,
  },
  do_tin_cay: {
    type: Number,
    min: 0,
    max: 100,
    default: 0,
  },
  mo_ta_benh: {
    type: String,
    default: '',
  },
  huong_xu_ly: {
    type: String,
    default: '',
  },
  tuvan_ai: {
    type: String,
    default: '',
  },
  grad_cam_path: {
    type: String,
    default: '',
  },
  thoi_gian_xu_ly_ms: {
    type: Number,
    default: 0,
  },
  ngay_du_doan: {
    type: Date,
    default: Date.now,
  },
});

// Index để tìm kiếm nhanh
predictionSchema.index({ user_id: 1, ngay_du_doan: -1 });

module.exports = mongoose.model('Prediction', predictionSchema);
