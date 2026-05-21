import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaLeaf } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const GardensPage = () => {
  const [gardens, setGardens] = useState([]);
  const [users, setUsers] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const { register, handleSubmit, reset, watch } = useForm();

  useEffect(() => {
    fetchGardens();
    fetchUsers();
    fetchSeasons();
  }, []);

  const fetchGardens = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/gardens');
      console.log('✓ Gardens loaded:', res.data.data?.length || 0);
      setGardens(res.data.data || []);
    } catch (err) {
      console.error('❌ Error fetching gardens:', err);
      toast.error('Không thể tải danh sách vườn');
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/users');
      console.log('✓ Users loaded:', res.data.data?.length || 0);
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('❌ Error fetching users:', err);
      toast.error('Không thể tải danh sách người dùng');
    }
  };

  const fetchSeasons = async () => {
    try {
      const res = await apiClient.get('/seasons/admin/all');
      console.log('✓ Seasons loaded:', res.data.data?.length || 0);
      // Only show active seasons (Đang diễn ra)
      const activeSeasons = (res.data.data || []).filter(s => s.trang_thai === 'Đang diễn ra');
      setSeasons(activeSeasons);
    } catch (err) {
      console.error('❌ Error fetching seasons:', err);
      toast.error('Không thể tải danh sách mùa vụ');
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editingId) {
        await apiClient.put(`/gardens/${editingId}`, data);
        console.log('✓ Garden updated:', editingId);
        toast.success('Garden updated successfully');
        setGardens(
          gardens.map((g) => (g._id === editingId ? { ...g, ...data } : g))
        );
      } else {
        const res = await apiClient.post('/gardens', data);
        console.log('✓ Garden created:', res.data.data);
        toast.success('Garden created successfully');
        setGardens([...gardens, res.data.data]);
      }
      reset();
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error('Error saving garden:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu vườn');
    }
  };

  const handleEdit = (garden) => {
    setEditingId(garden._id);
    reset(garden);
    setShowForm(true);
  };

  const handleDeleteGarden = async (gardenId) => {
    try {
      await apiClient.delete(`/gardens/${gardenId}`);
      console.log('✓ Garden deleted:', gardenId);
      toast.success('Garden deleted successfully');
      setGardens(gardens.filter((g) => g._id !== gardenId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('❌ Error deleting garden:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa vườn');
    }
  };

  const filteredGardens = gardens.filter(
    (garden) =>
      garden.ten_vuon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      garden.dia_diem?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Quản Lý Vườn</h1>
          <button
            onClick={() => {
              setEditingId(null);
              reset();
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <FaPlus /> Thêm Vườn Mới
            </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? <><FaEdit /> Sửa Vườn</> : <><FaPlus /> Tạo Vườn Mới</>}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Vườn
                  </label>
                  <input
                    type="text"
                    {...register('ten_vuon', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Tên vườn..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Địa Chỉ
                  </label>
                  <input
                    type="text"
                    {...register('dia_chi', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Địa chỉ vườn..."
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Người Dùng
                  </label>
                  <select
                    {...register('user_id', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Chọn người dùng</option>
                    {users.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.ho_ten} ({user.email})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loại Cây
                  </label>
                  <select
                    {...register('loai_cay', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Chọn loại cây</option>
                    <option value="Cam">Cam (Orange)</option>
                    <option value="Chanh">Chanh (Lemon)</option>
                    <option value="Bưởi">Bưởi (Pomelo)</option>
                    <option value="Khác">Khác (Khác)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mùa Vụ (Tùy Chọn)
                  </label>
                  <select
                    {...register('season_id')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Không có mùa vụ</option>
                    {seasons.map((season) => (
                      <option key={season._id} value={season._id}>
                        {season.ten_mua_vu} ({season.nam})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diện Tích
                  </label>
                  <input
                    type="number"
                    {...register('dien_tich', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="100"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Đơn Vị
                  </label>
                  <select
                    {...register('don_vi')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="m²">m²</option>
                    <option value="hectare">hectare</option>
                    <option value="công">công</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số Lượng Cây
                  </label>
                  <input
                    type="number"
                    {...register('so_cay')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="0"
                  />
                </div>                
              </div>

              <div className="flex gap-3">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  {editingId ? <><FaCheck /> Cập Nhật</> : <><FaCheck /> Tạo Mới</>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                    setEditingId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition flex items-center justify-center gap-2"
                >
                  <FaTimes /> Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Tìm theo tên vườn hoặc địa chỉ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải vườn...</div>
          ) : filteredGardens.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Không tìm thấy vườn</div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Tên Vườn
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Địa Chỉ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Diện Tích (m²)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Chủ Sở Hữu
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Mùa Vụ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredGardens.map((garden) => (
                  <tr key={garden._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-medium">
                        <FaLeaf className="inline mr-2" /> {garden.ten_vuon}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {garden.dia_chi || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap text-gray-600">
                      {garden.dien_tich || 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="text-gray-600 text-sm">
                        {garden.user_id?.ho_ten || 'Unknown'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      {garden.season_id ? (
                        <span className="text-gray-600 text-sm">
                          {garden.season_id.ten_mua_vu} ({garden.season_id.nam})
                        </span>
                      ) : (
                        <span className="text-gray-400 text-sm italic">Không có</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleEdit(garden)}
                        className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition text-sm"
                      >
                        <FaEdit className="inline mr-1" /> Sửa
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(garden._id)}
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

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Xác Nhận Xóa
              </h3>
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa vườn này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                Hủy
                </button>
                <button
                  onClick={() => handleDeleteGarden(showDeleteConfirm)}
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

export default GardensPage;
