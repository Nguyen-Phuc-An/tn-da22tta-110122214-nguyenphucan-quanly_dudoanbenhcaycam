import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const { register, handleSubmit, reset, watch } = useForm();

  const selectedGarden = watch('garden_id');
  const selectedSeason = watch('season_id');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    fetchLogs();
    fetchGardens();
    fetchSeasons();
  }, []);

  useEffect(() => {
    if (selectedGarden) {
      fetchTasks();
    }
  }, [selectedGarden]);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/logs/admin/all');
      console.log('✓ Logs loaded:', res.data.data?.length || 0);
      setLogs(res.data.data || []);
    } catch (err) {
      console.error('❌ Error fetching logs:', err);
      toast.error('Không thể tải danh sách nhật ký');
    } finally {
      setLoading(false);
    }
  };

  const fetchGardens = async () => {
    try {
      const res = await apiClient.get('/gardens');
      setGardens(res.data.data || []);
    } catch (err) {
      console.error('Error fetching gardens:', err);
    }
  };

  const fetchSeasons = async () => {
    try {
      const res = await apiClient.get('/seasons');
      setSeasons(res.data.data || []);
    } catch (err) {
      console.error('Error fetching seasons:', err);
    }
  };

  const fetchTasks = async () => {
    try {
      const res = await apiClient.get(`/tasks`);
      setTasks(res.data.data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editingId) {
        await apiClient.put(`/logs/${editingId}`, data);
        console.log('✓ Log updated:', editingId);
        toast.success('Nhật ký được cập nhật thành công');
        setLogs(
          logs.map((l) => (l._id === editingId ? { ...l, ...data } : l))
        );
      } else {
        const res = await apiClient.post('/logs', data);
        console.log('✓ Log created:', res.data.data);
        toast.success('Nhật ký được tạo thành công');
        setLogs([...logs, res.data.data]);
      }
      reset();
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error('Error saving log:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu nhật ký');
    }
  };

  const handleEdit = (log) => {
    setEditingId(log._id);

    const logData = {
      garden_id: log.garden_id?._id || log.garden_id,
      season_id: log.season_id?._id || log.season_id,
      task_id: log.task_id?._id || log.task_id,
      ngay_lam: log.ngay_lam
        ? new Date(log.ngay_lam).toISOString().split('T')[0]
        : '',
      nguoi_thuc_hien: log.nguoi_thuc_hien || '',
      ghi_chu: log.ghi_chu || '',
    };

    reset(logData);
    setShowForm(true);
  };

  const handleDeleteLog = async (logId) => {
    try {
      await apiClient.delete(`/logs/${logId}`);
      console.log('✓ Log deleted:', logId);
      toast.success('Nhật ký được xóa thành công');
      setLogs(logs.filter((l) => l._id !== logId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('❌ Error deleting log:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa nhật ký');
    }
  };

  const filteredLogs = logs.filter(
    (log) =>
      log.garden_id?.ten_vuon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.task_id?.ten_cong_viec?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.nguoi_thuc_hien?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const filteredSeasons = editingId
    ? seasons
    : selectedGarden
      ? seasons.filter((s) =>
          s.garden_id?._id === selectedGarden || s.garden_id === selectedGarden
        )
      : [];

  const filteredTasks = selectedGarden
    ? tasks
    : [];
  
    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm]);

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Quản Lý Nhật Ký Canh Tác</h1>
          <button
            onClick={() => {
              setEditingId(null);
              reset();
              setShowForm(!showForm);
            }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <FaPlus /> Thêm Nhật Ký Mới
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? <><FaEdit /> Sửa Nhật Ký</> : <><FaPlus /> Tạo Nhật Ký Mới</>}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vườn Cam <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('garden_id', {
                      required: 'Bắt buộc',
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Chọn vườn</option>
                    {gardens.map((garden) => (
                      <option key={garden._id} value={garden._id}>
                        {garden.ten_vuon}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mùa Vụ <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('season_id', {
                      required: 'Bắt buộc',
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Chọn mùa vụ</option>
                    {filteredSeasons.map((season) => (
                      <option key={season._id} value={season._id}>
                        {season.ten_mua_vu} ({season.nam})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Công Việc <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('task_id', {
                      required: 'Bắt buộc',
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Chọn công việc</option>
                    {filteredTasks.map((task) => (
                      <option key={task._id} value={task._id}>
                        {task.ten_cong_viec}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày Làm <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    {...register('ngay_lam', {
                      required: 'Bắt buộc',
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Người Thực Hiện
                  </label>
                  <input
                    type="text"
                    {...register('nguoi_thuc_hien')}
                    placeholder="Tên người thực hiện..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Ghi Chú
                </label>
                <textarea
                  {...register('ghi_chu')}
                  placeholder="Ghi chú về công việc..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows="3"
                />
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
            placeholder="Tìm kiếm theo vườn, công việc hoặc người thực hiện..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải nhật ký...</div>
          ) : filteredLogs.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Không tìm thấy nhật ký</div>
          ) : (
            <>
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vườn</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mùa Vụ</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Công Việc</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Ngày Làm</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Người Thực Hiện</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Thao Tác</th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {paginatedLogs.map((log) => (
                    <tr key={log._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.garden_id?.ten_vuon}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {log.season_id?.ten_mua_vu}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium">
                        {log.task_id?.ten_cong_viec}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {new Date(log.ngay_lam).toLocaleDateString('vi-VN')}
                      </td>
                      <td className="px-6 py-4">
                        {log.nguoi_thuc_hien || '—'}
                      </td>
                      <td className="px-6 py-4 text-center space-x-2">
                        <button
                          onClick={() => handleEdit(log)}
                          className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 text-sm"
                        >
                          <FaEdit className="inline mr-1" /> Sửa
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(log._id)}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 text-sm"
                        >
                          <FaTrash className="inline mr-1" /> Xóa
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Pagination */}
              {filteredLogs.length > 0 && totalPages > 1 && (
                <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                  <div className="text-sm text-gray-600">
                    Trang <span className="font-semibold">{currentPageSafe}</span> /{' '}
                    <span className="font-semibold">{totalPages}</span>
                    <span className="ml-2">({filteredLogs.length} nhật ký)</span>
                  </div>

                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-9 rounded px-3 py-1 text-sm font-medium ${
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

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Xác Nhận Xóa
              </h3>
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa nhật ký này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDeleteLog(showDeleteConfirm)}
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

export default LogsPage;
