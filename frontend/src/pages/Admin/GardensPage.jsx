import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaCheck, FaTimes, FaLeaf } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const GardensPage = () => {
  const [gardens, setGardens] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [currentPage, setCurrentPage] = useState(1);
  const { register, handleSubmit, reset, watch } = useForm();

  const emptyGardenForm = {
    ten_vuon: '',
    dia_chi: '',
    user_id: '',
    dien_tich: '',
    don_vi: 'm²',
    so_cay: '',
    trang_thai: 'Đang hoạt động',
  };

  useEffect(() => {
    fetchGardens();
    fetchUsers();
  }, []);

  const fetchGardens = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/gardens');
      console.log('✓ Gardens loaded:', res.data.data?.length || 0);
      setGardens(res.data.data || []);
    } catch (err) {
      console.error('Error fetching gardens:', err);
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
      console.error('Error fetching users:', err);
      toast.error('Không thể tải danh sách người dùng');
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

  const toggleStatus = async (garden) => {
    try {
      const newStatus = garden.trang_thai === 'Đang hoạt động' ? 'Ngưng hoạt động' : 'Đang hoạt động';
      const res = await apiClient.put(`/gardens/${garden._id}`, { trang_thai: newStatus });
      setGardens(gardens.map((g) => (g._id === garden._id ? { ...g, trang_thai: newStatus } : g)));
      toast.success(`Cập nhật trạng thái vườn thành '${newStatus}'`);
      console.log('✓ Garden status toggled:', garden._id, newStatus);
    } catch (err) {
      console.error('Error toggling garden status:', err);
      toast.error(err.response?.data?.message || 'Không thể cập nhật trạng thái vườn');
    }
  };

  const handleEdit = (garden) => {
    setEditingId(garden._id);
    reset({
      ...garden,
      user_id: garden.user_id?._id || garden.user_id || '',
    });
    setShowForm(true);
  };

  const filteredGardens = gardens.filter(
    (garden) =>
      garden.ten_vuon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      garden.dia_diem?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectableUsers = users.filter(
    (user) => String(user.vai_tro || user.role || '').toLowerCase() !== 'admin'
  );

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredGardens.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedGardens = filteredGardens.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Quản Lý Vườn</h1>
          <button
            onClick={() => {
              setEditingId(null);
              reset(emptyGardenForm);
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
            <h2 className="text-xl font-bold text-green-600 mb-4">
              {editingId ? <>Sửa Vườn</> : <>Tạo Vườn Mới</>}
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
                    {selectableUsers.map((user) => (
                      <option key={user._id} value={user._id}>
                        {user.ho_ten} ({user.email})
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Trạng Thái</label>
                  <select
                    {...register('trang_thai')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="Đang hoạt động">Đang hoạt động</option>
                    <option value="Ngưng hoạt động">Ngưng hoạt động</option>
                  </select>
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
                    reset(emptyGardenForm);
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
            <>
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
                    Trạng Thái
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedGardens.map((garden) => (
                  <tr key={garden._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-medium">
                        {garden.ten_vuon}
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
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`px-2 py-1 text-sm rounded ${garden.trang_thai === 'Đang hoạt động' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
                        {garden.trang_thai || 'Đang hoạt động'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleEdit(garden)}
                        className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition text-sm"
                      >
                        <FaEdit className="inline mr-1" /> Sửa
                      </button>
                      <button
                        onClick={() => toggleStatus(garden)}
                        className={`px-3 py-1 rounded text-sm transition ${garden.trang_thai === 'Đang hoạt động' ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                      >
                        {garden.trang_thai === 'Đang hoạt động' ? 'Ngưng hoạt động' : 'Kích hoạt'}
                      </button>

                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredGardens.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Trang <span className="font-semibold">{currentPageSafe}</span> / <span className="font-semibold">{totalPages}</span>
                  <span className="ml-2">({filteredGardens.length} vườn)</span>
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

        
      </div>
    </AdminLayout>
  );
};

export default GardensPage;
