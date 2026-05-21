import React, { useEffect, useMemo, useRef, useState } from 'react';
import { FaBell, FaEdit, FaTrash, FaPlus, FaSave, FaTimes, FaLink, FaUsers, FaSearch } from 'react-icons/fa';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import notificationService from '../../services/notificationService';

const defaultFormValues = {
  tieu_de: '',
  noi_dung: '',
  doi_tuong_nhan: 'all',
  nhom_nguoi_nhan: [],
  link: '',
  trang_thai: 'active',
};

const normalizeRecipientIds = (value) => {
  if (Array.isArray(value)) {
    return [...new Set(value.map((item) => String(item).trim()).filter(Boolean))];
  }

  if (typeof value === 'string' && value.trim()) {
    return [value.trim()];
  }

  return [];
};

const NotificationsPage = () => {
  const [notifications, setNotifications] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSuggestionOpen, setGroupSuggestionOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const groupPickerRef = useRef(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm({ defaultValues: defaultFormValues });

  const doiTuongNhan = watch('doi_tuong_nhan');

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (groupPickerRef.current && !groupPickerRef.current.contains(event.target)) {
        setGroupSuggestionOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchNotifications = async () => {
    try {
      setLoading(true);
      const res = await notificationService.getAllNotifications();
      setNotifications(res.data || []);
    } catch (error) {
      console.error('❌ Lỗi tải thông báo:', error);
      toast.error(error.response?.data?.message || 'Không thể tải danh sách thông báo');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/users');
      const userList = (res.data.data || []).filter((user) => user.vai_tro === 'user');
      setUsers(userList);
    } catch (error) {
      console.error('❌ Lỗi tải danh sách user:', error);
    }
  };

  const clearForm = () => {
    setEditingId(null);
    reset(defaultFormValues);
    setGroupSearch('');
    setGroupSuggestionOpen(false);
    setSelectedRecipients([]);
    setValue('nhom_nguoi_nhan', [], { shouldValidate: true });
  };

  const handleAddNew = () => {
    clearForm();
    setShowForm(true);
  };

  const resolveUserLabel = (userId) => {
    const user = users.find((item) => item._id === userId);

    if (!user) {
      return userId || '';
    }

    return `${user.ho_ten || 'Không rõ tên'} (${user.email || 'không có email'})`;
  };

  const handleSelectUser = (user) => {
    const nextRecipients = normalizeRecipientIds([...selectedRecipients, user._id]);
    setSelectedRecipients(nextRecipients);
    setValue('nhom_nguoi_nhan', nextRecipients, { shouldValidate: true });
    setGroupSearch('');
    setGroupSuggestionOpen(true);
  };

  const handleRemoveUser = (userId) => {
    const nextRecipients = selectedRecipients.filter((id) => id !== userId);
    setSelectedRecipients(nextRecipients);
    setValue('nhom_nguoi_nhan', nextRecipients, { shouldValidate: true });
  };

  const handleEdit = (notification) => {
    const nextRecipients = normalizeRecipientIds(notification.nhom_nguoi_nhan);

    setEditingId(notification._id);
    reset({
      tieu_de: notification.tieu_de || '',
      noi_dung: notification.noi_dung || '',
      doi_tuong_nhan: notification.doi_tuong_nhan || 'all',
      nhom_nguoi_nhan: nextRecipients,
      link: notification.link || '',
      trang_thai: notification.trang_thai || 'active',
    });
    setSelectedRecipients(nextRecipients);
    setGroupSearch('');
    setGroupSuggestionOpen(false);
    setShowForm(true);
  };

  const filteredUserSuggestions = useMemo(() => {
    const search = groupSearch.trim().toLowerCase();

    return users
      .filter((user) => !selectedRecipients.includes(user._id))
      .filter((user) => {
        if (!search) {
          return true;
        }

        const hoTen = (user.ho_ten || '').toLowerCase();
        const email = (user.email || '').toLowerCase();

        return hoTen.includes(search) || email.includes(search);
      })
      .slice(0, 8);
  }, [groupSearch, users, selectedRecipients]);

  const filteredNotifications = useMemo(() => {
    const keyword = searchTerm.trim().toLowerCase();

    if (!keyword) {
      return notifications;
    }

    return notifications.filter((notification) => {
      const title = (notification.tieu_de || '').toLowerCase();
      const content = (notification.noi_dung || '').toLowerCase();
      const target = (notification.doi_tuong_nhan || '').toLowerCase();

      return title.includes(keyword) || content.includes(keyword) || target.includes(keyword);
    });
  }, [notifications, searchTerm]);

  const onSubmit = async (data) => {
    try {
      const recipientIds = data.doi_tuong_nhan === 'group' ? selectedRecipients : [];

      if (data.doi_tuong_nhan === 'group' && recipientIds.length === 0) {
        toast.error('Vui lòng chọn ít nhất 1 người nhận');
        return;
      }

      const payload = {
        tieu_de: data.tieu_de,
        noi_dung: data.noi_dung,
        doi_tuong_nhan: data.doi_tuong_nhan,
        nhom_nguoi_nhan: recipientIds,
        link: data.link?.trim() || null,
        trang_thai: data.trang_thai,
      };

      if (editingId) {
        const res = await notificationService.updateNotification(editingId, payload);
        setNotifications((prev) => prev.map((item) => (item._id === editingId ? res.data : item)));
        toast.success('Cập nhật thông báo thành công');
      } else {
        const res = await notificationService.createNotification(payload);
        setNotifications((prev) => [res.data, ...prev]);
        toast.success('Tạo thông báo thành công');
      }

      clearForm();
      setShowForm(false);
    } catch (error) {
      console.error('❌ Lỗi lưu thông báo:', error);
      toast.error(error.response?.data?.message || 'Không thể lưu thông báo');
    }
  };

  const handleDelete = async (notificationId) => {
    try {
      await notificationService.deleteNotification(notificationId);
      setNotifications((prev) => prev.filter((item) => item._id !== notificationId));
      toast.success('Xóa thông báo thành công');
      setShowDeleteConfirm(null);
    } catch (error) {
      console.error('❌ Lỗi xóa thông báo:', error);
      toast.error(error.response?.data?.message || 'Không thể xóa thông báo');
    }
  };

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
              Quản Lý Thông Báo
            </h1>
          </div>

          <button
            onClick={handleAddNew}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 font-semibold text-white transition hover:bg-green-700"
          >
            <FaPlus /> Tạo thông báo
          </button>
        </div>

        {showForm && (
          <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <div className="mb-6 flex items-center justify-between gap-3">
              <div>
                <h2 className="flex items-center gap-2 text-xl font-bold text-gray-900">
                  {editingId ? <FaEdit className="text-green-600" /> : <FaPlus className="text-green-600" />}
                  {editingId ? 'Chỉnh sửa thông báo' : 'Tạo thông báo mới'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">Điền các trường cần thiết, sau đó lưu để hiển thị cho user.</p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  clearForm();
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <FaTimes /> Đóng
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Tiêu đề <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('tieu_de', { required: 'Vui lòng nhập tiêu đề' })}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                    placeholder="Nhập tiêu đề thông báo..."
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Trạng thái <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('trang_thai')}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                  >
                    <option value="active">active</option>
                    <option value="inactive">inactive</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">
                    Đối tượng nhận <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('doi_tuong_nhan')}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                  >
                    <option value="all">all</option>
                    <option value="group">group</option>
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Link khi click</label>
                  <div className="relative">
                    <FaLink className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      {...register('link')}
                      className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                      placeholder="/admin/notifications hoặc để trống"
                    />
                  </div>
                </div>

                {doiTuongNhan === 'group' && (
                  <div ref={groupPickerRef} className="relative lg:col-span-2">
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Nhóm người nhận <span className="text-red-600">*</span>
                    </label>
                    <div className="relative">
                      <FaSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={groupSearch}
                        onChange={(e) => {
                          setGroupSearch(e.target.value);
                          setGroupSuggestionOpen(true);
                        }}
                        onFocus={() => setGroupSuggestionOpen(true)}
                        className="w-full rounded-lg border border-gray-300 py-2.5 pl-10 pr-4 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                        placeholder="Gõ tên hoặc email để chọn nhiều user..."
                        autoComplete="off"
                      />
                      <input type="hidden" {...register('nhom_nguoi_nhan')} value={JSON.stringify(selectedRecipients)} />

                      {groupSuggestionOpen && filteredUserSuggestions.length > 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 max-h-64 overflow-auto rounded-xl border border-gray-200 bg-white shadow-xl">
                          {filteredUserSuggestions.map((user) => (
                            <button
                              key={user._id}
                              type="button"
                              onClick={() => handleSelectUser(user)}
                              className="flex w-full items-center gap-3 border-b border-gray-100 px-4 py-3 text-left hover:bg-green-50 last:border-b-0"
                            >
                              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700">
                                {(user.ho_ten || 'U').charAt(0).toUpperCase()}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate font-semibold text-gray-900">{user.ho_ten || 'Không rõ tên'}</span>
                                <span className="block truncate text-xs text-gray-500">{user.email || 'Không có email'}</span>
                              </span>
                            </button>
                          ))}
                        </div>
                      )}

                      {groupSuggestionOpen && groupSearch.trim() && filteredUserSuggestions.length === 0 && (
                        <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-xl border border-gray-200 bg-white p-4 text-sm text-gray-500 shadow-xl">
                          Không tìm thấy người dùng phù hợp.
                        </div>
                      )}
                    </div>

                    {selectedRecipients.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {selectedRecipients.map((userId) => (
                          <span
                            key={userId}
                            className="inline-flex items-center gap-2 rounded-full bg-green-100 px-3 py-1 text-sm font-medium text-green-800"
                          >
                            {resolveUserLabel(userId)}
                            <button
                              type="button"
                              onClick={() => handleRemoveUser(userId)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <FaTimes className="text-xs" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-gray-700">
                  Nội dung <span className="text-red-600">*</span>
                </label>
                <textarea
                  rows={5}
                  {...register('noi_dung', { required: 'Vui lòng nhập nội dung' })}
                  className="w-full rounded-lg border border-gray-300 px-4 py-3 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                  placeholder="Nhập nội dung thông báo..."
                />
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  type="submit"
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition hover:bg-green-700"
                >
                  <FaSave /> {editingId ? 'Cập nhật thông báo' : 'Tạo thông báo'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    clearForm();
                  }}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                  <FaTimes /> Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="mb-6">
          <input
            type="text"
            placeholder="Tìm kiếm theo tiêu đề, nội dung hoặc đối tượng nhận..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">

          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải thông báo...</div>
          ) : filteredNotifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">Chưa có thông báo nào.</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tiêu đề</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Đối tượng</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Ngày tạo</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredNotifications.map((notification) => (
                  <tr key={notification._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className="text-gray-900 font-medium">{notification.tieu_de}</span>
                        <p className="mt-1 text-xs text-gray-500 max-w-md truncate">{notification.noi_dung}</p>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">
                        {notification.doi_tuong_nhan === 'all'
                          ? 'Tất cả user'
                          : `Nhóm: ${normalizeRecipientIds(notification.nhom_nguoi_nhan).map((id) => resolveUserLabel(id)).join(', ') || 'N/A'}`}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${notification.trang_thai === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {notification.trang_thai}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">
                      {notification.ngay_tao ? new Date(notification.ngay_tao).toLocaleString('vi-VN') : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleEdit(notification)}
                        className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition text-sm"
                      >
                        <FaEdit className="inline mr-1" /> Sửa
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(notification._id)}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm"
                      >
                        <FaTrash className="inline mr-1" /> Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Xác Nhận Xóa</h3>
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa thông báo này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDelete(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default NotificationsPage;