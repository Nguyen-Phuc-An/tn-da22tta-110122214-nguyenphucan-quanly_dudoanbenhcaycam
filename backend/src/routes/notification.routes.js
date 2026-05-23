const express = require('express');
const { authenticateToken } = require('../config/auth');
const {
  createNotification,
  updateNotification,
  deleteNotification,
  getNotificationsForAdmin,
  getControlNotificationDetail,
  createControlReminderNotification,
  getActiveNotifications,
  markNotificationAsRead,
} = require('../controllers/notification.controller');

const router = express.Router();

router.use(authenticateToken);

router.get('/active', getActiveNotifications);
router.patch('/:id/read', markNotificationAsRead);
router.get('/:id/control-detail', getControlNotificationDetail);
router.post('/:id/control-reminder', createControlReminderNotification);
router.get('/', getNotificationsForAdmin);
router.post('/', createNotification);
router.put('/:id', updateNotification);
router.delete('/:id', deleteNotification);

module.exports = router;