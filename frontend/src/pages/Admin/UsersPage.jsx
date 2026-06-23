import React, { useState, useEffect } from 'react';
import { FaLock, FaUnlock, FaEdit, FaCheck, FaKey, FaUser, FaPlus, FaTimes, FaTrash } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const UsersPage = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [formMode, setFormMode] = useState('create');
  const [editingUserId, setEditingUserId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [formData, setFormData] = useState({
    ho_ten: '',
    email: '',
    mat_khau: '',
    is_locked: false,
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/users');
      console.log('✓ Users loaded:', res.data.data?.length || 0);
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
      toast.error('Không thể tải danh sách người dùng');
    } finally {
      setLoading(false);
    }
  };

  const handleLockUser = async (userId, currentLockStatus) => {
    try {
      const res = await apiClient.patch(`/users/${userId}/lock`, {
        is_locked: !currentLockStatus,
      });
      console.log('✓ User lock status updated:', userId);
      toast.success(res.data.message);
      
      // Cập nhật danh sách users
      setUsers(users.map((u) => 
        u._id === userId 
          ? { ...u, is_locked: !currentLockStatus }
          : u
      ));
    } catch (err) {
      console.error('Error locking user:', err);
      toast.error(err.response?.data?.message || 'Không thể cập nhật trạng thái người dùng');
    }
  };

  

  const openCreateForm = () => {
    setFormMode('create');
    setEditingUserId(null);
    setFormData({
      ho_ten: '',
      email: '',
      mat_khau: '',
      is_locked: false,
    });
    setShowForm(true);
  };

  const openEditForm = (user) => {
    setFormMode('edit');
    setEditingUserId(user._id);
    setFormData({
      ho_ten: user.ho_ten || '',
      email: user.email || '',
      mat_khau: '',
      is_locked: Boolean(user.is_locked),
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingUserId(null);
    setFormData({
      ho_ten: '',
      email: '',
      mat_khau: '',
      is_locked: false,
    });
  };

  const handleFormChange = (event) => {
    const { name, value, type, checked } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);

      const payload = {
        ho_ten: formData.ho_ten,
        email: formData.email,
        vai_tro: 'user',
        is_locked: formData.is_locked,
      };

      if (formMode === 'create' || formData.mat_khau) {
        payload.mat_khau = formData.mat_khau;
      }

      if (!payload.ho_ten || !payload.email || (formMode === 'create' && !payload.mat_khau)) {
        toast.error('Vui lòng nhập đầy đủ họ tên, email và mật khẩu');
        return;
      }

      const res = formMode === 'create'
        ? await apiClient.post('/users', payload)
        : await apiClient.put(`/users/${editingUserId}`, payload);

      toast.success(res.data.message || (formMode === 'create' ? 'Tạo người dùng thành công' : 'Cập nhật người dùng thành công'));
      await fetchUsers();
      closeForm();
    } catch (err) {
      console.error('Error saving user:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu người dùng');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      user.vai_tro === 'user' &&
      (user.ho_ten?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const ITEMS_PER_PAGE = 9;
  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Quản Lý Người Dùng</h1>
          <button
            onClick={openCreateForm}
            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-white font-semibold hover:bg-green-700 transition"
          >
            <FaPlus /> Thêm người dùng
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên hoặc email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải người dùng...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Không tìm thấy người dùng</div>
          ) : (
            <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Tên
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Email
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Vai Trò
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Trạng Thái
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Vườn
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedUsers.map((user) => (
                  <tr key={user._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                          {user.ho_ten?.[0] || 'U'}
                        </div>
                        <span className="ml-3 text-gray-900">{user.ho_ten}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full font-semibold ${
                          user.vai_tro === 'admin'
                            ? 'bg-red-100 text-red-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {user.vai_tro === 'admin' ? <><FaKey className="inline mr-1" /> Admin</> : <><FaUser className="inline mr-1" /> Người Dùng</>}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-1 text-xs rounded-full font-semibold ${
                          user.is_locked
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-green-100 text-green-800'
                        }`}
                      >
                        {user.is_locked ? <><FaLock className="inline mr-1" /> Khóa</> : <><FaCheck className="inline mr-1" /> Hoạt Động</>}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap text-gray-600">
                      {user.gardens?.length || 0}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleLockUser(user._id, user.is_locked)}
                        disabled={user.vai_tro === 'admin'}
                        className={`px-3 py-1 rounded hover:opacity-80 transition text-sm font-medium ${
                          user.is_locked
                            ? 'bg-green-50 text-green-600'
                            : 'bg-yellow-50 text-yellow-600'
                        } ${user.vai_tro === 'admin' ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {user.is_locked ? <><FaUnlock className="inline mr-1" /> Mở Khóa</> : <><FaLock className="inline mr-1" /> Khóa</>}
                      </button>
                      <button
                        onClick={() => openEditForm(user)}
                        className="px-3 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition text-sm font-medium"
                      >
                        <FaEdit className="inline mr-1" /> Sửa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredUsers.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Trang <span className="font-semibold">{currentPageSafe}</span> / <span className="font-semibold">{totalPages}</span>
                  <span className="ml-2">({filteredUsers.length} người dùng)</span>
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

        {showForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-6">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-2xl">
              <div className="mb-6 flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {formMode === 'create' ? 'Thêm người dùng' : 'Sửa người dùng'}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    {formMode === 'create' ? 'Tạo tài khoản mới cho người dùng' : 'Cập nhật thông tin tài khoản'}
                  </p>
                </div>
                <button
                  onClick={closeForm}
                  className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                >
                  <FaTimes />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Họ tên</label>
                    <input
                      name="ho_ten"
                      value={formData.ho_ten}
                      onChange={handleFormChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">Email</label>
                    <input
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleFormChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                      placeholder=""
                    />
                  </div>
                  <div>
                    <label className="mb-2 block text-sm font-semibold text-gray-700">
                      Mật khẩu {formMode === 'edit' && <span className="text-gray-400 font-normal">(để trống nếu không đổi)</span>}
                    </label>
                    <input
                      name="mat_khau"
                      type="password"
                      value={formData.mat_khau}
                      onChange={handleFormChange}
                      className="w-full rounded-lg border border-gray-300 px-4 py-2 focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
                      placeholder=""
                    />
                  </div>
                </div>

                <label className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                  <input
                    name="is_locked"
                    type="checkbox"
                    checked={formData.is_locked}
                    onChange={handleFormChange}
                    className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                  />
                  Khóa tài khoản
                </label>

                <div className="flex items-center justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={closeForm}
                    className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
                  >
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-lg bg-green-600 px-4 py-2 font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-400"
                  >
                    {submitting ? 'Đang lưu...' : formMode === 'create' ? 'Tạo mới' : 'Cập nhật'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AdminLayout>
  );
};

export default UsersPage;
