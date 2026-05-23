const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  // TODO (Cải thiện tương lai):
  // Thêm user_id để query logs nhanh hơn:
  // user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }
  // Lợi ích:
  // - Query trực tiếp: Log.find({ user_id: userId })
  // - Không cần lookup Garden
  // - Performance tốt hơn với large dataset
  // - Dễ dàng xóa logs khi user bị xóa (cascade delete)

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
  // Tham chiếu đến thông báo từ admin (nếu có)
  notification_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Notification',
    default: null,
  },
  // Tham chiếu đến công việc
  task_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Task',
    required: [true, 'Vui lòng chọn công việc'],
  },
  // Nhật ký gắn với đúng 1 mẫu đất
  plot_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plot',
    required: [true, 'Vui lòng chọn mẫu đất'],
    index: true,
  },
  // Danh sách mẫu đất liên quan
  plot_ids: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Plot',
  }],
  // Ngày thực hiện công việc
  ngay_lam: {
    type: Date,
    required: [true, 'Vui lòng nhập ngày'],
  },
  // Ghi chú thêm về công việc
  ghi_chu: {
    type: String,
    default: '',
  },
  // Trạng thái hoàn thành công việc
  is_completed: {
    type: Boolean,
    default: false,
    index: true,
  },
  // Người thực hiện công việc
  nguoi_thuc_hien: {
    type: String,
    default: '',
  },
  // Ngày tạo bản ghi
  ngay_tao: {
    type: Date,
    default: Date.now,
  },
});

// Index để tìm kiếm nhanh theo vườn, mẫu đất, mùa vụ và ngày
logSchema.index({ garden_id: 1, plot_id: 1, season_id: 1, ngay_lam: -1 });

module.exports = mongoose.model('Log', logSchema);
