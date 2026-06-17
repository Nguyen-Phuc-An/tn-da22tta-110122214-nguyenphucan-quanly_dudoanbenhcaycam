const Notification = require('../models/Notification');
const User = require('../models/User');
const Log = require('../models/Log');
const Garden = require('../models/Garden');
const Plot = require('../models/Plot');
const NotificationTracking = require('../models/NotificationTracking');
const Task = require('../models/Task');

const isAdmin = (req) => req.userRole === 'admin';

const normalizeLink = (link) => {
  if (link === undefined) {
    return undefined;
  }

  if (link === null) {
    return null;
  }

  const value = String(link).trim();
  return value ? value : null;
};

const normalizeRecipientList = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
};

const validateRecipientsAreUsers = async (recipientIds) => {
  if (!recipientIds.length) {
    return {
      ok: false,
      message: 'Vui lòng chọn ít nhất 1 người nhận',
    };
  }

  const users = await User.find({
    _id: { $in: recipientIds },
    vai_tro: 'user',
  }).select('_id');

  const validIds = new Set(users.map((user) => String(user._id)));
  const invalidIds = recipientIds.filter((id) => !validIds.has(String(id)));

  if (invalidIds.length > 0) {
    return {
      ok: false,
      message: 'Chỉ được chọn người dùng thường, không chọn admin',
    };
  }

  return { ok: true };
};

const validateNotificationPayload = (payload, isPartial = false) => {
  const errors = [];

  if (!isPartial || payload.tieu_de !== undefined) {
    if (!payload.tieu_de || !String(payload.tieu_de).trim()) {
      errors.push('Vui lòng nhập tiêu đề');
    }
  }

  if (!isPartial || payload.noi_dung !== undefined) {
    if (!payload.noi_dung || !String(payload.noi_dung).trim()) {
      errors.push('Vui lòng nhập nội dung');
    }
  }

  if (!isPartial || payload.doi_tuong_nhan !== undefined) {
    if (!['all', 'group'].includes(payload.doi_tuong_nhan)) {
      errors.push('Đối tượng nhận phải là all hoặc group');
    }
  }

  if (!isPartial || payload.loai !== undefined) {
    if (payload.loai && !['normal', 'kiem_soat'].includes(payload.loai)) {
      errors.push('Loại thông báo không hợp lệ');
    }
  }

  if ((!isPartial || payload.trang_thai !== undefined) && payload.trang_thai && !['active', 'inactive'].includes(payload.trang_thai)) {
    errors.push('Trạng thái phải là active hoặc inactive');
  }

  return errors;
};

const buildVisibleQuery = (userId, userRole) => {
  const orConditions = [{ doi_tuong_nhan: 'all' }];

  if (userId) {
    orConditions.push({
      doi_tuong_nhan: 'group',
      nhom_nguoi_nhan: { $in: [String(userId)] },
    });
  }

  if (userRole) {
    orConditions.push({
      doi_tuong_nhan: 'group',
      nhom_nguoi_nhan: { $in: [userRole] },
    });
  }

  return {
    trang_thai: 'active',
    $or: orConditions,
  };
};

const isVisibleToCurrentUser = (notification, userId, userRole) => {
  if (notification.doi_tuong_nhan === 'all') {
    return true;
  }

  const recipientList = normalizeRecipientList(notification.nhom_nguoi_nhan);
  if (recipientList.includes(String(userId))) {
    return true;
  }

  if (userRole && recipientList.includes(userRole)) {
    return true;
  }

  return false;
};

const buildControlNotificationDetail = async (notificationId) => {
  const trackings = await NotificationTracking.find({ notification_id: notificationId })
    .populate('user_id', 'ho_ten email')
    .populate('garden_id', 'ten_vuon')
    .populate('plot_id', 'name area tree_type status')
    .sort({ ngay_cap_nhat: -1 })
    .lean();

  const mapName = (user) => `${user?.ho_ten || user?.email || ''}`.toLowerCase();

  const items = trackings.map((item) => ({
    _id: item._id,
    status: item.status,
    user: item.user_id,
    garden: item.garden_id,
    plot: item.plot_id,
    ngay_cap_nhat: item.ngay_cap_nhat,
  }));

  items.sort((a, b) => {
    const userCompare = mapName(a.user).localeCompare(mapName(b.user));
    if (userCompare !== 0) return userCompare;
    return String(a.plot?.name || '').localeCompare(String(b.plot?.name || ''));
  });

  return {
    done: items.filter((item) => item.status === 'done'),
    pending: items.filter((item) => item.status !== 'done'),
  };
};

const getRecentReminderForControlNotification = async (notificationId) => {
  const recentCutoff = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);

  return Notification.findOne({
    nhac_nho_cho_notification_id: notificationId,
    ngay_tao: { $gte: recentCutoff },
    loai: 'normal',
    doi_tuong_nhan: 'group',
  })
    .select('_id tieu_de ngay_tao')
    .sort({ ngay_tao: -1 })
    .lean();
};

const createControlReminderNotification = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Chỉ admin mới có quyền gửi nhắc nhở' });
    }

    const { id } = req.params;
    const sourceNotification = await Notification.findById(id).lean();

    if (!sourceNotification || sourceNotification.loai !== 'kiem_soat') {
      return res.status(404).json({ success: false, message: 'Thông báo kiểm soát không tồn tại' });
    }

    const detail = await buildControlNotificationDetail(id);
    const recipientIds = [...new Set(detail.pending.map((item) => String(item.user?._id || '')).filter(Boolean))];

    if (recipientIds.length === 0) {
      return res.status(400).json({ success: false, message: 'Không có user nào chưa làm để gửi nhắc nhở' });
    }

    const recentReminder = await getRecentReminderForControlNotification(id);

    if (recentReminder) {
      return res.status(429).json({
        success: false,
        message: 'Đã gửi nhắc nhở gần đây, vui lòng đợi thêm 1-2 ngày trước khi gửi lại',
      });
    }

    const reminderNotification = new Notification({
      tieu_de: `Nhắc nhở: ${sourceNotification.tieu_de}`,
      noi_dung: sourceNotification.noi_dung,
      doi_tuong_nhan: 'group',
      nhom_nguoi_nhan: recipientIds,
      link: normalizeLink(sourceNotification.link),
      trang_thai: 'active',
      loai: 'normal',
      nhac_nho_cho_notification_id: id,
    });

    await reminderNotification.save();

    return res.status(201).json({
      success: true,
      message: 'Gửi nhắc nhở thành công',
      data: reminderNotification,
      recipients: recipientIds,
    });
  } catch (error) {
    console.error('❌ Lỗi gửi nhắc nhở kiểm soát:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: error.message });
  }
};

const createNotification = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền tạo thông báo',
      });
    }

    const { tieu_de, noi_dung, doi_tuong_nhan = 'all', nhom_nguoi_nhan = [], link = null, trang_thai = 'active', loai = 'normal', task_id = null, ngay_lam = null, ghi_chu = '' } = req.body;
    const normalizedLoai = loai === 'kiem_soat' ? 'kiem_soat' : 'normal';
    const normalizedTarget = normalizedLoai === 'kiem_soat' ? 'all' : doi_tuong_nhan;

    const errors = validateNotificationPayload({ tieu_de, noi_dung, doi_tuong_nhan: normalizedTarget, trang_thai, loai: normalizedLoai });

    const recipientList = normalizeRecipientList(nhom_nguoi_nhan);

    if (normalizedTarget === 'group' && recipientList.length === 0) {
      errors.push('Vui lòng nhập nhóm người nhận');
    }

    if (normalizedTarget === 'group') {
      const recipientCheck = await validateRecipientsAreUsers(recipientList);
      if (!recipientCheck.ok) {
        errors.push(recipientCheck.message);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
      });
    }

    const notification = new Notification({
      tieu_de: String(tieu_de).trim(),
      noi_dung: String(noi_dung).trim(),
      doi_tuong_nhan: normalizedTarget,
      nhom_nguoi_nhan: normalizedTarget === 'group' ? recipientList : [],
      link: normalizeLink(link),
      trang_thai,
      loai: normalizedLoai,
      task_id: task_id || null,
      ngay_lam: ngay_lam || null,
      ghi_chu: ghi_chu || '',
    });

    await notification.save();

    // Nếu là thông báo kiểm soát và gửi cho tất cả user, tạo nhật ký cho mọi mẫu đất của mỗi user
    if (normalizedLoai === 'kiem_soat') {
      try {
        // Task phải tồn tại
        if (!task_id) {
          // rollback: xóa notification vừa tạo
          await Notification.findByIdAndDelete(notification._id);
          return res.status(400).json({ success: false, message: 'Vui lòng cung cấp công việc (task_id) cho thông báo kiểm soát' });
        }

        const task = await Task.findById(task_id);
        if (!task) {
          await Notification.findByIdAndDelete(notification._id);
          return res.status(404).json({ success: false, message: 'Công việc không tồn tại' });
        }

        // Lấy tất cả user thường
        const users = await User.find({ vai_tro: 'user' }).select('_id');
        const userIds = users.map((u) => u._id);

        if (userIds.length > 0) {
          // Lấy tất cả vườn thuộc các user này
          const gardens = await Garden.find({ user_id: { $in: userIds } }).select('_id user_id season_id');
          const gardenMap = new Map(gardens.map((g) => [String(g._id), g]));
          const gardenIds = gardens.map((g) => g._id);

          if (gardenIds.length > 0) {
            // Lấy tất cả plot thuộc các vườn này
            const plots = await Plot.find({ garden_id: { $in: gardenIds } }).select('_id garden_id');

            const logsToInsert = [];
            const trackingToInsert = [];

            for (const plot of plots) {
              const g = gardenMap.get(String(plot.garden_id));
              if (!g) continue;
              // Không bỏ qua vườn chưa có mùa vụ - tạo thông báo cho tất cả vườn/mẫu đất
              const seasonId = g.season_id || null;

              logsToInsert.push({
                garden_id: g._id,
                season_id: seasonId,
                notification_id: notification._id,
                task_id: task._id,
                plot_id: plot._id,
                plot_ids: [plot._id],
                ngay_lam: ngay_lam || new Date(),
                ghi_chu: ghi_chu || '',
                is_completed: false,
                nguoi_thuc_hien: '',
                ngay_tao: new Date(),
              });

              trackingToInsert.push({
                notification_id: notification._id,
                user_id: g.user_id,
                garden_id: g._id,
                plot_id: plot._id,
                status: 'pending',
              });
            }

            let insertedLogs = [];
            if (logsToInsert.length > 0) {
              insertedLogs = await Log.insertMany(logsToInsert, { ordered: false });
            }

            if (trackingToInsert.length > 0) {
              try {
                await NotificationTracking.insertMany(trackingToInsert, { ordered: false });
              } catch (err) {
                // ignore duplicates / partial failures
                console.warn('⚠️ NotificationTracking insertMany warning:', err.message);
              }
            }

            return res.status(201).json({
              success: true,
              message: 'Tạo thông báo kiểm soát thành công và đã tạo nhật ký cho các mẫu đất',
              data: {
                notification,
                created_logs: insertedLogs.length || logsToInsert.length,
              },
            });
          }
        }
      } catch (err) {
        console.error('❌ Lỗi khi tạo nhật ký tự động cho thông báo kiểm soát:', err.message);
        // không rollback notification here to preserve admin action, but return info
        return res.status(500).json({ success: false, message: 'Tạo thông báo thất bại khi tạo nhật ký tự động', error: err.message });
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Tạo thông báo thành công',
      data: notification,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo thông báo:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message,
    });
  }
};

const updateNotification = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền cập nhật thông báo',
      });
    }

    const { id } = req.params;
    const { tieu_de, noi_dung, doi_tuong_nhan, nhom_nguoi_nhan, link, trang_thai, loai, task_id, ngay_lam, ghi_chu } = req.body;

    const errors = validateNotificationPayload({ tieu_de, noi_dung, doi_tuong_nhan, trang_thai }, true);

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: errors[0],
      });
    }

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Thông báo không tồn tại',
      });
    }

    const prevLoai = notification.loai;

    if (tieu_de !== undefined) notification.tieu_de = String(tieu_de).trim();
    if (noi_dung !== undefined) notification.noi_dung = String(noi_dung).trim();
    if (doi_tuong_nhan !== undefined) notification.doi_tuong_nhan = doi_tuong_nhan;
    if (link !== undefined) notification.link = normalizeLink(link);
    if (trang_thai !== undefined) notification.trang_thai = trang_thai;
    if (loai !== undefined) notification.loai = loai;
    if (task_id !== undefined) notification.task_id = task_id || null;
    if (ngay_lam !== undefined) notification.ngay_lam = ngay_lam || null;
    if (ghi_chu !== undefined) notification.ghi_chu = ghi_chu || '';

    if (notification.loai === 'kiem_soat') {
      notification.doi_tuong_nhan = 'all';
      notification.nhom_nguoi_nhan = [];
    } else if (notification.doi_tuong_nhan === 'group') {
      const nextGroup = nhom_nguoi_nhan !== undefined ? normalizeRecipientList(nhom_nguoi_nhan) : normalizeRecipientList(notification.nhom_nguoi_nhan);

      const recipientCheck = await validateRecipientsAreUsers(nextGroup);

      if (!recipientCheck.ok) {
        return res.status(400).json({
          success: false,
          message: recipientCheck.message,
        });
      }

      if (nextGroup.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Vui lòng nhập nhóm người nhận',
        });
      }

      notification.nhom_nguoi_nhan = nextGroup;
    } else {
      notification.nhom_nguoi_nhan = [];
    }

    await notification.save();
    // Nếu chuyển sang loại kiểm soát và gửi cho tất cả user, tạo nhật ký tự động
    if (notification.loai === 'kiem_soat' && notification.doi_tuong_nhan === 'all' && prevLoai !== 'kiem_soat') {
      try {
        if (!notification.task_id) {
          return res.status(400).json({ success: false, message: 'Vui lòng cung cấp công việc (task_id) cho thông báo kiểm soát' });
        }

        const task = await Task.findById(notification.task_id);
        if (!task) {
          return res.status(404).json({ success: false, message: 'Công việc không tồn tại' });
        }

        const users = await User.find({ vai_tro: 'user' }).select('_id');
        const userIds = users.map((u) => u._id);

        if (userIds.length > 0) {
          const gardens = await Garden.find({ user_id: { $in: userIds } }).select('_id user_id season_id');
          const gardenMap = new Map(gardens.map((g) => [String(g._id), g]));
          const gardenIds = gardens.map((g) => g._id);

          if (gardenIds.length > 0) {
            const plots = await Plot.find({ garden_id: { $in: gardenIds } }).select('_id garden_id');

            const logsToInsert = [];
            const trackingToInsert = [];

            for (const plot of plots) {
              const g = gardenMap.get(String(plot.garden_id));
              if (!g) continue;
              const seasonId = g.season_id || null;
              if (!seasonId) continue;

              logsToInsert.push({
                garden_id: g._id,
                season_id: seasonId,
                notification_id: notification._id,
                task_id: task._id,
                plot_id: plot._id,
                plot_ids: [plot._id],
                ngay_lam: notification.ngay_lam || new Date(),
                ghi_chu: notification.ghi_chu || '',
                is_completed: false,
                nguoi_thuc_hien: '',
                ngay_tao: new Date(),
              });

              trackingToInsert.push({
                notification_id: notification._id,
                user_id: g.user_id,
                garden_id: g._id,
                plot_id: plot._id,
                status: 'pending',
              });
            }

            let insertedLogs = [];
            if (logsToInsert.length > 0) {
              insertedLogs = await Log.insertMany(logsToInsert, { ordered: false });
            }

            if (trackingToInsert.length > 0) {
              try {
                await NotificationTracking.insertMany(trackingToInsert, { ordered: false });
              } catch (err) {
                console.warn('⚠️ NotificationTracking insertMany warning on update:', err.message);
              }
            }

            return res.json({
              success: true,
              message: 'Cập nhật thông báo thành công và đã tạo nhật ký tự động',
              data: {
                notification,
                created_logs: insertedLogs.length || logsToInsert.length,
              },
            });
          }
        }
      } catch (err) {
        console.error('❌ Lỗi khi tạo nhật ký tự động trên cập nhật thông báo:', err.message);
        return res.status(500).json({ success: false, message: 'Cập nhật thông báo nhưng lỗi khi tạo nhật ký tự động', error: err.message });
      }
    }

    return res.json({
      success: true,
      message: 'Cập nhật thông báo thành công',
      data: notification,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật thông báo:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message,
    });
  }
};

const deleteNotification = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền xóa thông báo',
      });
    }

    const { id } = req.params;
    const notification = await Notification.findByIdAndDelete(id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Thông báo không tồn tại',
      });
    }

    return res.json({
      success: true,
      message: 'Xóa thông báo thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa thông báo:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message,
    });
  }
};

const getNotificationsForAdmin = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền xem danh sách thông báo',
      });
    }

    const notifications = await Notification.find()
      .populate('task_id', 'ten_cong_viec')
      .sort({ ngay_tao: -1 })
      .lean();

    return res.json({
      success: true,
      data: notifications,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách thông báo:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message,
    });
  }
};

const getControlNotificationDetail = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({ success: false, message: 'Chỉ admin mới có quyền xem chi tiết thông báo kiểm soát' });
    }

    const { id } = req.params;
    const notification = await Notification.findById(id).populate('task_id', 'ten_cong_viec').lean();

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Thông báo không tồn tại' });
    }

    const detail = await buildControlNotificationDetail(id);
    const recentReminder = await getRecentReminderForControlNotification(id);

    return res.json({
      success: true,
      data: {
        notification,
        ...detail,
        recent_reminder: recentReminder,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết thông báo kiểm soát:', error.message);
    return res.status(500).json({ success: false, message: 'Lỗi hệ thống', error: error.message });
  }
};

const getActiveNotifications = async (req, res) => {
  try {
    const userId = req.userId;
    const userRole = req.userRole || 'user';
    const notifications = await Notification.find(buildVisibleQuery(userId, userRole))
      .sort({ ngay_tao: -1 })
      .lean();

    const visibleNotifications = notifications
      .filter((notification) => isVisibleToCurrentUser(notification, userId, userRole))
      .map((notification) => ({
        ...notification,
        da_doc: normalizeRecipientList(notification.da_doc_boi).includes(String(userId)),
      }));

    return res.json({
      success: true,
      data: visibleNotifications,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy thông báo active:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message,
    });
  }
};

const markNotificationAsRead = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = String(req.userId);
    const userRole = req.userRole || 'user';

    const notification = await Notification.findOne({
      _id: id,
      trang_thai: 'active',
    });

    if (!notification || !isVisibleToCurrentUser(notification, userId, userRole)) {
      return res.status(404).json({
        success: false,
        message: 'Thông báo không tồn tại',
      });
    }

    notification.da_doc_boi = Array.isArray(notification.da_doc_boi) ? notification.da_doc_boi : [];

    if (!notification.da_doc_boi.includes(userId)) {
      notification.da_doc_boi.push(userId);
      await notification.save();
    }

    return res.json({
      success: true,
      message: 'Đã đánh dấu đã đọc',
    });
  } catch (error) {
    console.error('❌ Lỗi đánh dấu đã đọc:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Lỗi hệ thống',
      error: error.message,
    });
  }
};

module.exports = {
  createNotification,
  updateNotification,
  deleteNotification,
  getNotificationsForAdmin,
  getControlNotificationDetail,
  createControlReminderNotification,
  getActiveNotifications,
  markNotificationAsRead,
};