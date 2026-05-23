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
  // Loại thông báo: normal (bình thường) | kiem_soat (kiểm soát)
  loai: {
    type: String,
    enum: ['normal', 'kiem_soat'],
    default: 'normal',
    index: true,
  },
  // Nếu là thông báo kiểm soát, có thể gắn một công việc và ngày được hẹn
  task_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    default: null,
  },
  ngay_lam: {
    type: Date,
    default: null,
  },
  ghi_chu: {
    type: String,
    default: '',
    trim: true,
  },
  nhac_nho_cho_notification_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    default: null,
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