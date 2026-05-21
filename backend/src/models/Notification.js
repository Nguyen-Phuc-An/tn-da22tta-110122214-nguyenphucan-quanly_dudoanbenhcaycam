const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  tieu_de: {
    type: String,
    required: [true, 'Vui lòng nhập tiêu đề'],
    trim: true,
  },
  noi_dung: {
    type: String,
    required: [true, 'Vui lòng nhập nội dung'],
    trim: true,
  },
  doi_tuong_nhan: {
    type: String,
    enum: ['all', 'group'],
    required: true,
    default: 'all',
  },
  nhom_nguoi_nhan: {
    type: [String],
    default: [],
  },
  da_doc_boi: {
    type: [String],
    default: [],
  },
  link: {
    type: String,
    default: null,
    trim: true,
  },
  trang_thai: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active',
    index: true,
  },
  ngay_tao: {
    type: Date,
    default: Date.now,
    index: true,
  },
}, {
  versionKey: false,
});

notificationSchema.index({ doi_tuong_nhan: 1, nhom_nguoi_nhan: 1, trang_thai: 1, ngay_tao: -1 });

module.exports = mongoose.model('Notification', notificationSchema);