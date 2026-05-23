import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const GardensPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    // Auto-open form if accessing /new route
    if (location.pathname === '/user/gardens/new') {
      setShowForm(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    fetchGardens();
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

  const onSubmit = async (data) => {
    try {
      delete data.season_id;
      data.so_cay = parseInt(data.so_cay) || 0;
      
      if (editingId) {
        await apiClient.put(`/gardens/${editingId}`, data);
        console.log('✓ Garden updated:', editingId);
        toast.success('Vườn được cập nhật thành công');
        setGardens(
          gardens.map((g) => (g._id === editingId ? { ...g, ...data } : g))
        );
      } else {
        const res = await apiClient.post('/gardens', data);
        console.log('✓ Garden created:', res.data.data);
        toast.success('Vườn được tạo thành công');
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
      toast.success('Vườn được xóa thành công');
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
      garden.dia_chi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <UserLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Vườn Của Tôi</h1>
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
              {editingId ? <><FaEdit className="inline mr-2" /> Sửa Vườn</> : <><FaPlus className="inline mr-2" /> Tạo Vườn Mới</>}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Vườn <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('ten_vuon', { required: 'Bắt buộc' })}
                    placeholder="Tên vườn..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Địa Chỉ <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('dia_chi', { required: 'Bắt buộc' })}
                    placeholder="Địa chỉ..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Diện Tích <span className="text-red-600">*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      {...register('dien_tich', { required: 'Bắt buộc' })}
                      placeholder="Diện tích..."
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                    <select
                      {...register('don_vi')}
                      className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      defaultValue="m²"
                    >
                      <option value="m²">m²</option>
                      <option value="hectare">hectare</option>
                      <option value="công">công</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Số Cây
                  </label>
                  <input
                    type="number"
                    {...register('so_cay')}
                    placeholder="Số cây..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

              </div>

              <div className="flex gap-2">
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
            placeholder="Tìm kiếm theo tên vườn hoặc địa chỉ..."
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
            <div className="p-8 text-center text-gray-600">
              {gardens.length === 0 ? (
                <>
                  <p className="mb-4">🌳 Chưa có vườn nào</p>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      reset();
                      setShowForm(true);
                    }}
                    className="text-green-600 font-semibold hover:text-green-700"
                  >
                    Tạo vườn đầu tiên →
                  </button>
                </>
              ) : (
                <p>Không tìm thấy vườn phù hợp</p>
              )}
            </div>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Diện Tích
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Mùa Vụ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredGardens.map((garden) => (
                  <tr
                    key={garden._id}
                    onClick={() => navigate(`/user/gardens/${garden._id}`)}
                    className="hover:bg-gray-50 cursor-pointer transition"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-medium">{garden.ten_vuon}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900">{garden.dia_chi}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900">{garden.dien_tich} {garden.don_vi || 'm²'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {garden.season_id ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-medium">{garden.season_id.ten_mua_vu}</span>
                          <span className={`text-xs px-2 py-1 rounded-full w-fit ${
                            garden.season_id.trang_thai === 'Đang diễn ra'
                              ? 'bg-green-100 text-green-700'
                              : garden.season_id.trang_thai === 'Sắp diễn ra'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {garden.season_id.trang_thai}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Chưa có</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          handleEdit(garden);
                        }}
                        className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-sm"
                      >
                        <FaEdit className="inline mr-1" /> Sửa
                      </button>
                      <button
                        onClick={(event) => {
                          event.stopPropagation();
                          setShowDeleteConfirm(garden._id);
                        }}
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
    </UserLayout>
  );
};

export default GardensPage;
