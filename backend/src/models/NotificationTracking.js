const mongoose = require('mongoose');

const notificationTrackingSchema = new mongoose.Schema({
  notification_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    required: [true, 'Vui lòng chọn thông báo'],
    index: true,
  },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: [true, 'Vui lòng chọn người dùng'],
    index: true,
  },
  garden_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Garden',
    required: [true, 'Vui lòng chọn vườn'],
    index: true,
  },
  plot_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plot',
    required: [true, 'Vui lòng chọn mẫu đất'],
    index: true,
  },
  status: {
    type: String,
    enum: ['pending', 'done'],
    default: 'pending',
    index: true,
  },
  ngay_tao: {
    type: Date,
    default: Date.now,
  },
  ngay_cap_nhat: {
    type: Date,
    default: Date.now,
  },
}, {
  versionKey: false,
});

notificationTrackingSchema.pre('save', function (next) {
  this.ngay_cap_nhat = Date.now();
  next();
});

notificationTrackingSchema.index({ notification_id: 1, user_id: 1, garden_id: 1, plot_id: 1 }, { unique: true });

module.exports = mongoose.model('NotificationTracking', notificationTrackingSchema);