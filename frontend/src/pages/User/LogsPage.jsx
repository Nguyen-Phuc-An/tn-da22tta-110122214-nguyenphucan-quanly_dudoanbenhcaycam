import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const LogsPage = () => {
  const location = useLocation();
  const [logs, setLogs] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedLog, setSelectedLog] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const { register, handleSubmit, reset, watch } = useForm();

  const selectedGarden = watch('garden_id');

  const getTodayDateString = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  // Auto-open form if accessing /new route
  useEffect(() => {
    if (location.pathname === '/user/logs/new') {
      setShowForm(true);
    }
  }, [location.pathname]);

  // Auto-set season when garden is selected
  useEffect(() => {
    if (selectedGarden && seasons.length > 0) {
      const gardenSeasons = seasons.filter(
        (s) => s.garden_id?._id === selectedGarden || s.garden_id === selectedGarden
      );
      if (gardenSeasons.length > 0) {
        // Set to the first (nearest) season
        reset((formValues) => ({
          ...formValues,
          season_id: gardenSeasons[0]._id,
        }));
      }
    }
  }, [selectedGarden, seasons, reset]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Lấy vườn của user
      const gardensRes = await apiClient.get('/gardens');
      const gardensData = gardensRes.data.data || [];
      setGardens(gardensData);
      console.log('🌳 Gardens:', gardensData.map(g => ({ _id: g._id, ten_vuon: g.ten_vuon })));

      // Lấy logs từ từng vườn
      let allLogs = [];
      if (gardensData.length > 0) {
        const logPromises = gardensData.map(garden =>
          apiClient.get(`/logs/garden/${garden._id}`).catch(err => {
            console.warn(`⚠️ Error fetching logs for garden ${garden._id}:`, err.message);
            return { data: { data: [] } };
          })
        );
        const logResponses = await Promise.all(logPromises);
        allLogs = logResponses.flatMap(res => res.data.data || []);
        
        console.log('📝 All logs fetched:', allLogs.length);
        console.log('Sample logs:', allLogs.slice(0, 2).map(l => ({
          _id: l._id,
          garden_id: l.garden_id,
          garden_name: l.garden_id?.ten_vuon || 'N/A',
          task: l.task_id?.ten_cong_viec
        })));
      }

      // Lấy seasons
      const seasonsRes = await apiClient.get('/seasons');
      setSeasons(seasonsRes.data.data || []);

      // Lấy tasks
      const tasksRes = await apiClient.get('/tasks');
      setTasks(tasksRes.data.data || []);

      setLogs(allLogs);
      console.log('✓ Logs loaded:', allLogs.length);
    } catch (error) {
      console.error('❌ Error fetching data:', error);
      toast.error('Không thể tải dữ liệu');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editingId) {
        await apiClient.put(`/logs/${editingId}`, data);
        console.log('✓ Log updated:', editingId);
        toast.success('Nhật ký được cập nhật thành công');
        await fetchData();
      } else {
        const res = await apiClient.post('/logs', data);
        console.log('✓ Log created:', res.data.data);
        toast.success('Nhật ký được tạo thành công');
        await fetchData();
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
      ...log,
      garden_id: log.garden_id?._id || log.garden_id,
      season_id: log.season_id?._id || log.season_id,
      task_id: log.task_id?._id || log.task_id,
      ngay_lam: new Date(log.ngay_lam).toISOString().split('T')[0],
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

  const filteredLogs = useMemo(() => {
    let result = logs;
    
    if (searchTerm) {
      result = result.filter(log =>
        log.garden_id?.ten_vuon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.task_id?.ten_cong_viec?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.nguoi_thuc_hien?.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    return result;
  }, [logs, searchTerm]);

  const filteredSeasons = selectedGarden
    ? seasons.filter((s) => s.garden_id?._id === selectedGarden || s.garden_id === selectedGarden)
    : [];

  // Pagination logic
  const totalPages = Math.ceil(filteredLogs.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedLog(null);
  };

  return (
    <UserLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">Nhật Ký Canh Tác</h1>
          <button
            onClick={() => {
              setEditingId(null);
              reset({ ngay_lam: getTodayDateString() });
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
              {editingId ? <><FaEdit className="inline mr-2" /> Sửa Nhật Ký</> : <><FaPlus className="inline mr-2" /> Tạo Nhật Ký Mới</>}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vườn <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('garden_id', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    {...register('season_id', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    {...register('task_id', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Chọn công việc</option>
                    {tasks.map((task) => (
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
                    {...register('ngay_lam', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
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
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Table with Details Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Logs List */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-600">Đang tải nhật ký...</div>
              ) : filteredLogs.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  {logs.length === 0 ? (
                    <>
                      <p className="mb-4">📝 Chưa có nhật ký nào</p>
                      <button
                        onClick={() => {
                          setEditingId(null);
                          reset();
                          setShowForm(true);
                        }}
                        className="text-green-600 font-semibold hover:text-green-700"
                      >
                        Tạo nhật ký đầu tiên →
                      </button>
                    </>
                  ) : (
                    <p>Không tìm thấy nhật ký phù hợp</p>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Vườn
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Mùa Vụ
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Công Việc
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                        Ngày Làm
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                        Người Thực Hiện
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedLogs.map((log) => (
                      <tr
                        key={log._id}
                        onClick={() => setSelectedLog(log)}
                        className={`cursor-pointer transition ${
                          selectedLog?._id === log._id
                            ? 'bg-green-100 hover:bg-green-150'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-900">{log.garden_id?.ten_vuon}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-900">{log.season_id?.ten_mua_vu}</span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-900 font-medium">{log.task_id?.ten_cong_viec}</span>
                        </td>
                        <td className="px-6 py-4 text-center whitespace-nowrap">
                          <span className="text-gray-600 text-sm">
                            {new Date(log.ngay_lam).toLocaleDateString('vi-VN')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-900">{log.nguoi_thuc_hien || '—'}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      Trang <span className="font-semibold">{currentPage}</span> / <span className="font-semibold">{totalPages}</span> 
                      ({filteredLogs.length} nhật ký)
                    </div>
                    <div className="flex gap-1">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <button
                          key={page}
                          onClick={() => handlePageChange(page)}
                          className={`px-3 py-1 rounded text-sm font-medium transition ${
                            currentPage === page
                              ? 'bg-blue-600 text-white'
                              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {page}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          </div>

          {/* Details Panel */}
          <div>
            {selectedLog ? (
              <div className="bg-white rounded-lg shadow p-6 sticky top-6 flex flex-col max-h-[800px]">
                <h3 className="text-lg font-bold text-gray-900 mb-4 flex-shrink-0">Chi Tiết Mô Tả</h3>

                <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                  {/* Ghi Chú */}
                  {selectedLog.ghi_chu ? (
                    <div>
                      <p className="text-xs text-gray-600 uppercase mb-2 font-semibold">Mô Tả</p>
                      <p className="text-sm text-gray-800 bg-blue-50 rounded p-4 border-l-4 border-blue-500 whitespace-pre-wrap">
                        {selectedLog.ghi_chu}
                      </p>
                    </div>
                  ) : (
                    <div className="text-center text-gray-500 py-8">
                      <p>Không có mô tả</p>
                    </div>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="space-y-2 border-t pt-4 flex-shrink-0 mt-4">
                  <button
                    onClick={() => handleEdit(selectedLog)}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2"
                  >
                    <FaEdit /> Sửa
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(selectedLog._id);
                      setSelectedLog(null);
                    }}
                    className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center justify-center gap-2"
                  >
                    <FaTrash /> Xóa
                  </button>
                  <button
                    onClick={() => setSelectedLog(null)}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center justify-center gap-2"
                  >
                    <FaTimes /> Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600 sticky top-6">
                👈 Chọn một nhật ký để xem chi tiết
              </div>
            )}
          </div>
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
    </UserLayout>
  );
};

export default LogsPage;
