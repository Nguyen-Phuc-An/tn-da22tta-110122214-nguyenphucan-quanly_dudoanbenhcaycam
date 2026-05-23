const mongoose = require('mongoose');

const plotSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Vui lòng nhập tên mẫu đất'],
    trim: true,
    maxlength: 120,
  },
  garden_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garden',
    required: [true, 'Vui lòng chỉ định vườn'],
    index: true,
  },
  area: {
    type: Number,
    required: [true, 'Vui lòng nhập diện tích'],
    min: [0.01, 'Diện tích phải lớn hơn 0'],
  },
  tree_type: {
    type: String,
    required: [true, 'Vui lòng nhập loại cây'],
    trim: true,
    maxlength: 100,
  },
  location_description: {
    type: String,
    default: '',
    trim: true,
    maxlength: 300,
  },
  status: {
    type: String,
    enum: ['đang sử dụng', 'bỏ'],
    default: 'đang sử dụng',
  },
  created_at: {
    type: Date,
    default: Date.now,
  },
});

plotSchema.index({ garden_id: 1, status: 1, created_at: -1 });

module.exports = mongoose.model('Plot', plotSchema);