import apiClient from './apiClient';

const notificationService = {
  getActiveNotifications: async () => {
    const response = await apiClient.get('/notifications/active');
    return response.data;
  },

  markAsRead: async (id) => {
    const response = await apiClient.patch(`/notifications/${id}/read`);
    return response.data;
  },

  getAllNotifications: async () => {
    const response = await apiClient.get('/notifications');
    return response.data;
  },

  createNotification: async (payload) => {
    const response = await apiClient.post('/notifications', payload);
    return response.data;
  },

  updateNotification: async (id, payload) => {
    const response = await apiClient.put(`/notifications/${id}`, payload);
    return response.data;
  },

  deleteNotification: async (id) => {
    const response = await apiClient.delete(`/notifications/${id}`);
    return response.data;
  },
};

export default notificationService;