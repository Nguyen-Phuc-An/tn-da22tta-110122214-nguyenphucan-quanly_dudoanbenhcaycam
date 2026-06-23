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
  loai: 'normal',
  task_id: null,
  ngay_lam: '',
  ghi_chu: '',
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
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [groupSearch, setGroupSearch] = useState('');
  const [groupSuggestionOpen, setGroupSuggestionOpen] = useState(false);
  const [selectedRecipients, setSelectedRecipients] = useState([]);
  const [activeNotificationTab, setActiveNotificationTab] = useState('normal');
  const [selectedControlNotification, setSelectedControlNotification] = useState(null);
  const [controlDetail, setControlDetail] = useState(null);
  const [controlDetailLoading, setControlDetailLoading] = useState(false);
  const [sendingReminder, setSendingReminder] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const groupPickerRef = useRef(null);

  const { register, handleSubmit, reset, watch, setValue } = useForm({ defaultValues: defaultFormValues });

  const [showControlModal, setShowControlModal] = useState(false);

  const doiTuongNhan = watch('doi_tuong_nhan');
  const loaiThongBao = watch('loai');

  useEffect(() => {
    fetchNotifications();
    fetchUsers();
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await apiClient.get('/tasks');
      setTasks(res.data.data || []);
    } catch (error) {
      console.error('❌ Lỗi tải danh sách công việc:', error);
    }
  };

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
      console.error('Lỗi tải thông báo:', error);
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
    setValue('loai', 'normal');
    setValue('task_id', null);
    setValue('ngay_lam', '');
    setValue('ghi_chu', '');
    setShowControlModal(false);
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

    return `${user.ho_ten || 'Không rõ tên'}`;
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
    setValue('loai', notification.loai || 'normal');
    setValue('task_id', notification.task_id || null);
    setValue('ngay_lam', notification.ngay_lam ? new Date(notification.ngay_lam).toISOString().slice(0,10) : '');
    setValue('ghi_chu', notification.ghi_chu || '');
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
    const typeFiltered = notifications.filter((notification) => (activeNotificationTab === 'normal' ? notification.loai !== 'kiem_soat' : notification.loai === 'kiem_soat'));

    if (!keyword) {
      return typeFiltered;
    }

    return typeFiltered.filter((notification) => {
      const title = (notification.tieu_de || '').toLowerCase();
      const content = (notification.noi_dung || '').toLowerCase();
      const target = (notification.doi_tuong_nhan || '').toLowerCase();

      return title.includes(keyword) || content.includes(keyword) || target.includes(keyword);
    });
  }, [notifications, searchTerm, activeNotificationTab]);

  const ITEMS_PER_PAGE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredNotifications.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedNotifications = filteredNotifications.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeNotificationTab]);

  const loadControlDetail = async (notification) => {
    if (notification.loai !== 'kiem_soat') {
      return;
    }

    try {
      setSelectedControlNotification(notification);
      setControlDetailLoading(true);
      setControlDetail(null);
      const res = await apiClient.get(`/notifications/${notification._id}/control-detail`);
      setControlDetail(res.data.data || null);
    } catch (error) {
      console.error('Lỗi tải chi tiết thông báo kiểm soát:', error);
      toast.error(error.response?.data?.message || 'Không thể tải chi tiết thông báo kiểm soát');
    } finally {
      setControlDetailLoading(false);
    }
  };

  const handleSendControlReminder = async () => {
    if (!selectedControlNotification) {
      return;
    }

    try {
      setSendingReminder(true);
      const res = await apiClient.post(`/notifications/${selectedControlNotification._id}/control-reminder`);
      await fetchNotifications();
      toast.success(res.data?.message || 'Đã gửi thông báo nhắc nhở');
    } catch (error) {
      console.error('Lỗi gửi nhắc nhở kiểm soát:', error);
      toast.error(error.response?.data?.message || 'Không thể gửi nhắc nhở');
    } finally {
      setSendingReminder(false);
    }
  };

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
        loai: data.loai || 'normal',
        task_id: data.task_id || null,
        ngay_lam: data.ngay_lam || null,
        ghi_chu: data.ghi_chu || '',
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
      console.error('Lỗi lưu thông báo:', error);
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
      console.error('Lỗi xóa thông báo:', error);
      toast.error(error.response?.data?.message || 'Không thể xóa thông báo');
    }
  };

  return (
    <AdminLayout>
      <div className="relative min-h-full space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="flex items-center gap-3 text-3xl font-bold text-green-600">
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
                  <h2 className="flex items-center gap-2 text-xl font-bold text-green-600">
                  {editingId ? 'Chỉnh sửa thông báo' : 'Tạo thông báo mới'}
                </h2>
                <p className="mt-1 text-sm text-gray-500">Điền các trường cần thiết, sau đó lưu để hiển thị cho user.</p>
              </div>

              {/* Đã chuyển trường kiểm soát vào form (xem bên dưới) */}

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
                  <label className="mb-2 block text-sm font-semibold text-gray-700">Loại thông báo</label>
                  <select
                    {...register('loai')}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                  >
                    <option value="normal">Bình thường</option>
                    <option value="kiem_soat">Kiểm soát</option>
                  </select>
                </div>
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
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100 disabled:cursor-not-allowed disabled:bg-gray-100"
                  >
                    <option value="all">all</option>
                    <option value="group">group</option>
                  </select>
                  {loaiThongBao === 'kiem_soat' && <p className="mt-2 text-xs text-gray-500">Thông báo kiểm soát luôn gửi cho tất cả người dùng.</p>}
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

              {watch('loai') === 'kiem_soat' && (
                <div className="mb-4">
                  <button
                    type="button"
                    onClick={() => setShowControlModal(true)}
                    className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                  >
                    Thêm chi tiết kiểm soát
                  </button>

                  {showControlModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center">
                      <div className="absolute inset-0 bg-black opacity-40" onClick={() => setShowControlModal(false)} />
                      <div className="relative z-10 w-full max-w-2xl rounded-lg bg-white p-6 shadow-lg">
                        <div className="flex items-center justify-between mb-4">
                          <h3 className="text-lg font-semibold">Chi tiết kiểm soát</h3>
                          <button type="button" onClick={() => setShowControlModal(false)} className="text-gray-500 hover:text-gray-700">Đóng</button>
                        </div>

                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700">Công việc (Task) <span className="text-red-600">*</span></label>
                            <select
                              {...register('task_id', { required: true })}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                            >
                              <option value="">-- Chọn công việc --</option>
                              {tasks.map((t) => (
                                <option key={t._id} value={t._id}>{t.ten_cong_viec}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700">Ngày thực hiện</label>
                            <input
                              type="date"
                              {...register('ngay_lam')}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                            />
                          </div>

                          <div>
                            <label className="mb-2 block text-sm font-semibold text-gray-700">Ghi chú</label>
                            <input
                              type="text"
                              {...register('ghi_chu')}
                              className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-100"
                              placeholder="Ghi chú cho nhật ký tự động..."
                            />
                          </div>
                        </div>

                        <div className="mt-4 flex justify-end gap-3">
                          <button type="button" onClick={() => setShowControlModal(false)} className="px-4 py-2 rounded-lg border">Hủy</button>
                          <button type="button" onClick={() => setShowControlModal(false)} className="px-4 py-2 rounded-lg bg-green-600 text-white">Lưu</button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

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
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveNotificationTab('normal')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeNotificationTab === 'normal' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Thông báo bình thường
            </button>
            <button
              type="button"
              onClick={() => setActiveNotificationTab('kiem_soat')}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${activeNotificationTab === 'kiem_soat' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
            >
              Thông báo Kiểm soát
            </button>
          </div>
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
            <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Tiêu đề</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    {activeNotificationTab === 'normal' ? 'Nội dung' : 'Ghi chú'}
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Đối tượng</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Trạng thái</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Ngày tạo</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedNotifications.map((notification) => (
                  <tr
                    key={notification._id}
                    className={`hover:bg-gray-50 ${notification.loai === 'kiem_soat' ? 'cursor-pointer' : ''}`}
                    onClick={() => notification.loai === 'kiem_soat' && loadControlDetail(notification)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <span className="text-gray-900 font-medium">{notification.tieu_de}</span>
                        {notification.loai === 'kiem_soat' && (
                          <p className="mt-1 text-xs text-gray-600">Công việc: {notification.task_id?.ten_cong_viec || notification.task_id || 'N/A'} | Ngày: {notification.ngay_lam ? new Date(notification.ngay_lam).toLocaleDateString('vi-VN') : 'N/A'}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <p className="max-w-md text-sm text-gray-900 whitespace-normal break-words">
                        {activeNotificationTab === 'normal'
                          ? (notification.noi_dung?.trim() || '—')
                          : (notification.ghi_chu?.trim() || '—')}
                      </p>
                    </td>
                    <td className="px-6 py-4 text-gray-600 max-w-[250px] truncate">
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
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2" onClick={(e) => e.stopPropagation()}>
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
            {filteredNotifications.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Trang <span className="font-semibold">{currentPageSafe}</span> / <span className="font-semibold">{totalPages}</span>
                  <span className="ml-2">({filteredNotifications.length} thông báo)</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`min-w-9 rounded px-3 py-1 text-sm font-medium transition ${
                        currentPageSafe === page
                          ? 'bg-green-600 text-white'
                          : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
              </div>
            )}
            </>
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

        {selectedControlNotification && (
          <div
            className="absolute inset-0 z-50 flex items-center justify-center"
            onClick={(event) => {
              if (event.target === event.currentTarget) {
                setSelectedControlNotification(null);
                setControlDetail(null);
              }
            }}
          >
            <div className="relative z-10 mx-4 w-full max-w-5xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <h3 className="text-xl font-bold text-gray-900">Chi tiết thông báo kiểm soát</h3>
                  <p className="mt-1 text-sm text-gray-500">{selectedControlNotification.tieu_de}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedControlNotification(null);
                    setControlDetail(null);
                  }}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Đóng
                </button>
              </div>

              {controlDetailLoading ? (
                <div className="py-10 text-center text-gray-600">Đang tải chi tiết...</div>
              ) : controlDetail ? (
                <div>
                  {controlDetail.recent_reminder && (
                    <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                      Đã gửi nhắc nhở gần đây lúc {new Date(controlDetail.recent_reminder.ngay_tao).toLocaleString('vi-VN')}.
                      Nút nhắc nhở đang tạm khóa để tránh gửi trùng.
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                  <div className="rounded-xl border border-green-200 bg-green-50/60 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-semibold text-green-800">Đã làm</h4>
                      <span className="rounded-full bg-green-600 px-2 py-1 text-xs font-semibold text-white">{controlDetail.done.length}</span>
                    </div>
                    <div className="max-h-[18.5rem] space-y-3 overflow-auto pr-1">
                      {controlDetail.done.length === 0 ? (
                        <p className="text-sm text-gray-500">Chưa có plot nào hoàn thành.</p>
                      ) : controlDetail.done.map((item) => (
                        <div key={item._id} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-green-100">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">{item.user?.ho_ten || item.user?.email || 'Không rõ người dùng'}</p>
                              <p className="text-sm text-gray-600">{item.garden?.ten_vuon || 'N/A'} · {item.plot?.name || 'N/A'}</p>
                            </div>
                            <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700">Đã làm</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="font-semibold text-amber-800">Chưa làm</h4>
                      <span className="rounded-full bg-amber-600 px-2 py-1 text-xs font-semibold text-white">{controlDetail.pending.length}</span>
                    </div>
                    <div className="max-h-[18.5rem] space-y-3 overflow-auto pr-1">
                      {controlDetail.pending.length === 0 ? (
                        <p className="text-sm text-gray-500">Không còn plot nào chưa làm.</p>
                      ) : controlDetail.pending.map((item) => (
                        <div key={item._id} className="rounded-lg bg-white p-3 shadow-sm ring-1 ring-amber-100">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="font-semibold text-gray-900">{item.user?.ho_ten || item.user?.email || 'Không rõ người dùng'}</p>
                              <p className="text-sm text-gray-600">{item.garden?.ten_vuon || 'N/A'} · {item.plot?.name || 'N/A'}</p>
                            </div>
                            <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-700">Chưa làm</span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <button
                        type="button"
                        onClick={handleSendControlReminder}
                        disabled={sendingReminder || controlDetail.pending.length === 0 || Boolean(controlDetail.recent_reminder)}
                        className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-gray-300"
                      >
                        {sendingReminder ? 'Đang gửi...' : 'Nhắc nhở các user chưa làm'}
                      </button>
                    </div>
                  </div>
                  </div>
                </div>
              ) : (
                <div className="py-10 text-center text-gray-600">Không có dữ liệu chi tiết.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default NotificationsPage;