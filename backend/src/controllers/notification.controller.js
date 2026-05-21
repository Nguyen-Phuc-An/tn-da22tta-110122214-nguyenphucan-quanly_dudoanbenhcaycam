const Notification = require('../models/Notification');
const User = require('../models/User');

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

const createNotification = async (req, res) => {
  try {
    if (!isAdmin(req)) {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có quyền tạo thông báo',
      });
    }

    const { tieu_de, noi_dung, doi_tuong_nhan = 'all', nhom_nguoi_nhan = [], link = null, trang_thai = 'active' } = req.body;

    const errors = validateNotificationPayload({ tieu_de, noi_dung, doi_tuong_nhan, trang_thai });

    const recipientList = normalizeRecipientList(nhom_nguoi_nhan);

    if (doi_tuong_nhan === 'group' && recipientList.length === 0) {
      errors.push('Vui lòng nhập nhóm người nhận');
    }

    if (doi_tuong_nhan === 'group') {
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
      doi_tuong_nhan,
      nhom_nguoi_nhan: doi_tuong_nhan === 'group' ? recipientList : [],
      link: normalizeLink(link),
      trang_thai,
    });

    await notification.save();

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
    const { tieu_de, noi_dung, doi_tuong_nhan, nhom_nguoi_nhan, link, trang_thai } = req.body;

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

    if (tieu_de !== undefined) notification.tieu_de = String(tieu_de).trim();
    if (noi_dung !== undefined) notification.noi_dung = String(noi_dung).trim();
    if (doi_tuong_nhan !== undefined) notification.doi_tuong_nhan = doi_tuong_nhan;
    if (link !== undefined) notification.link = normalizeLink(link);
    if (trang_thai !== undefined) notification.trang_thai = trang_thai;

    if (notification.doi_tuong_nhan === 'group') {
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
  getActiveNotifications,
  markNotificationAsRead,
};