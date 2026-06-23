import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FaLeaf, FaArrowLeft, FaNotesMedical, FaCoins, FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const GardenDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [garden, setGarden] = useState(null);
  const [logs, setLogs] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [plots, setPlots] = useState([]);
  const [sprayProgress, setSprayProgress] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPlotForm, setShowPlotForm] = useState(false);
  const [editingPlotId, setEditingPlotId] = useState(null);
  const plotDefaults = {
    name: '',
    area: '',
    tree_type: '',
    location_description: '',
    status: 'đang sử dụng',
  };
  const { register, handleSubmit, reset } = useForm({ defaultValues: plotDefaults });

  useEffect(() => {
    fetchGardenData();
  }, [id]);

  const fetchGardenData = async () => {
    try {
      setLoading(true);
      const [gardenRes, logsRes, expensesRes] = await Promise.all([
        apiClient.get(`/gardens/${id}`),
        apiClient.get('/logs'),
        apiClient.get('/expenses'),
      ]);
      const sprayProgressRes = await apiClient.get(`/gardens/${id}/spray-progress`);

      const gardenLogs = logsRes.data.data?.filter(l => l.garden_id?._id === id) || [];
      const gardenExpenses = expensesRes.data.data?.filter(e => e.garden_id?._id === id) || [];

      setGarden(gardenRes.data.data);
      setLogs(gardenLogs);
      setExpenses(gardenExpenses);
      setPlots(gardenRes.data.data?.plots || []);
      setSprayProgress(sprayProgressRes.data.data || null);

      console.log('✓ Garden data loaded');
    } catch (error) {
      console.error('Lỗi tải vườn:', error);
      toast.error('Không thể tải thông tin vườn');
      navigate('/user/gardens');
    } finally {
      setLoading(false);
    }
  };

  const totalExpenses = expenses.reduce((sum, e) => sum + (e.so_tien || 0), 0);
  const totalPlotArea = plots.reduce((sum, plot) => sum + Number(plot.area || 0), 0);

  // Count remaining (not completed) logs for this garden
  const remainingCount = logs.filter(l => {
    if (typeof l.is_completed === 'boolean') return !l.is_completed;
    const s = (l.trang_thai || l.status || l.trangThai || '').toString().toLowerCase();
    return s.includes('chưa');
  }).length;

  const formatExpenseDate = (expense) => {
    const rawDate = expense?.ngay || expense?.ngay_tao || expense?.ngay_cap_nhat || expense?.createdAt;
    if (!rawDate) return 'N/A';

    const parsedDate = new Date(rawDate);
    if (Number.isNaN(parsedDate.getTime())) return 'N/A';

    return parsedDate.toLocaleDateString('vi-VN');
  };

  const openCreatePlotForm = () => {
    setEditingPlotId(null);
    reset(plotDefaults);
    setShowPlotForm(true);
  };

  const handleEditPlot = (plot) => {
    setEditingPlotId(plot._id);
    reset({
      name: plot.name || '',
      area: plot.area ?? '',
      tree_type: plot.tree_type || '',
      location_description: plot.location_description || '',
      status: plot.status || 'đang sử dụng',
    });
    setShowPlotForm(true);
  };

  const handlePlotSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        garden_id: id,
        area: Number(data.area),
      };

      if (editingPlotId) {
        await apiClient.put(`/plots/${editingPlotId}`, payload);
        toast.success('Cập nhật mẫu đất thành công');
      } else {
        await apiClient.post('/plots', payload);
        toast.success('Thêm mẫu đất thành công');
      }

      setShowPlotForm(false);
      setEditingPlotId(null);
      reset(plotDefaults);
      await fetchGardenData();
    } catch (error) {
      console.error('Lỗi lưu mẫu đất:', error);
      toast.error(error.response?.data?.message || 'Không thể lưu mẫu đất');
    }
  };

  const handleDeletePlot = async (plotId) => {
    if (!window.confirm('Xóa mẫu đất này?')) {
      return;
    }

    try {
      await apiClient.delete(`/plots/${plotId}`);
      toast.success('Xóa mẫu đất thành công');
      await fetchGardenData();
    } catch (error) {
      console.error('Lỗi xóa mẫu đất:', error);
      toast.error(error.response?.data?.message || 'Không thể xóa mẫu đất');
    }
  };

  const getStatusBadgeClass = (status) => {
    return status === 'đang sử dụng'
      ? 'bg-green-100 text-green-700'
      : 'bg-gray-100 text-gray-700';
  };

  if (loading || !garden) {
    return (
      <UserLayout>
        <div className="text-center py-12">Đang tải...</div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-green-600 flex items-center gap-2">
              <FaLeaf className="text-green-600" /> {garden.ten_vuon}
            </h1>
            <p className="text-gray-600 mt-2">📍 {garden.dia_chi || garden.dia_diem || 'N/A'}</p>
          </div>
          <button
            onClick={() => navigate('/user/gardens')}
            className="text-gray-600 hover:text-gray-900 transition flex items-center gap-2"
          >
            <FaArrowLeft /> Quay lại
          </button>
        </div>

        {/* Tiến độ thực hiện công việc: hiển thị số công việc chưa hoàn thành dựa trên nhật ký */}
        <div
          onClick={() => { if (remainingCount > 0) navigate('/user/logs'); }}
          className={`bg-white rounded-xl shadow-md p-6 mb-8 ${remainingCount > 0 ? 'cursor-pointer' : ''}`}
        >
          <div className="flex items-start justify-between gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-green-600">Tiến độ thực hiện công việc</h2>
              <p className="text-sm text-gray-500 mt-1">Số công việc chưa hoàn thành từ nhật ký</p>
            </div>
            <div className="text-right">
              {remainingCount > 0 ? (
                <>
                  <p className="text-sm text-gray-500">Chưa thực hiện</p>
                  <p className="text-xl font-bold text-orange-600">{remainingCount}</p>
                </>
              ) : (
                <p className="text-xl font-bold text-green-600">Đã làm hết rồi</p>
              )}
            </div>
          </div>
        </div>

        {/* Garden Info */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-gray-600 text-sm flex items-center gap-2">
              Nhật ký
            </p>
            <p className="text-2xl font-bold text-green-600 mt-2">{logs.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-gray-600 text-sm flex items-center gap-2">
              Chi phí
            </p>
            <p className="text-2xl font-bold text-orange-600 mt-2">
              {(totalExpenses / 1000000).toFixed(2)}M ₫
            </p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-gray-600 text-sm">Mẫu đất</p>
            <p className="text-2xl font-bold text-green-600 mt-2">{plots.length}</p>
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <p className="text-gray-600 text-sm">Diện tích mẫu đất</p>
            <p className="text-2xl font-bold text-green-600 mt-2">
              {totalPlotArea.toFixed(1)} / {Number(garden.dien_tich || 0).toFixed(1)} {garden.don_vi}
            </p>
          </div>
        </div>

        {/* Plots */}
        <div className="bg-white rounded-xl shadow-md p-6 mb-8">
          <div className="flex justify-between items-start gap-4 mb-4">
            <div>
              <h2 className="text-xl font-bold text-green-600">Mẫu đất</h2>
              <p className="text-sm text-gray-500 mt-1">
                Tổng diện tích đã dùng: {totalPlotArea.toFixed(1)} / {Number(garden.dien_tich || 0).toFixed(1)}
              </p>
            </div>
            <button
              onClick={openCreatePlotForm}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <FaPlus /> Thêm Mẫu Đất
            </button>
          </div>

          {showPlotForm && (
            <div className="mb-6 border border-gray-200 rounded-xl p-4 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                {editingPlotId ? 'Sửa mẫu đất' : 'Thêm mẫu đất mới'}
              </h3>
              <form onSubmit={handleSubmit(handlePlotSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tên mẫu đất *</label>
                    <input
                      type="text"
                      {...register('name', { required: 'Tên mẫu đất là bắt buộc' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Mẫu đất A1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Diện tích *</label>
                    <input
                      type="number"
                      step="0.1"
                      {...register('area', { required: 'Diện tích là bắt buộc' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="10"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Loại cây *</label>
                    <input
                      type="text"
                      {...register('tree_type', { required: 'Loại cây là bắt buộc' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Cam, chanh, bưởi..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Trạng thái *</label>
                    <select
                      {...register('status', { required: 'Trạng thái là bắt buộc' })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <option value="đang sử dụng">Đang sử dụng</option>
                      <option value="bỏ">Bỏ</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Mô tả vị trí</label>
                  <textarea
                    {...register('location_description')}
                    rows="3"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    placeholder="Ví dụ: phía bên trái cổng chính, khu vực gần mương nước..."
                  />
                </div>

                <div className="flex gap-3 justify-end">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPlotForm(false);
                      setEditingPlotId(null);
                      reset(plotDefaults);
                    }}
                    className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition flex items-center gap-2"
                  >
                    <FaTimes /> Hủy
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                  >
                    <FaCheck /> {editingPlotId ? 'Cập nhật' : 'Lưu'}
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="p-3 text-left font-semibold border-b">Tên mẫu đất</th>
                  <th className="p-3 text-left font-semibold border-b">Diện tích</th>
                  <th className="p-3 text-left font-semibold border-b">Loại cây</th>
                  <th className="p-3 text-left font-semibold border-b">Mô tả vị trí</th>
                  <th className="p-3 text-center font-semibold border-b">Thực hiện</th>
                  <th className="p-3 text-center font-semibold border-b">Trạng thái</th>
                  <th className="p-3 text-center font-semibold border-b">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {plots.length > 0 ? (
                  plots.map((plot) => (
                    <tr key={plot._id} className="border-b hover:bg-gray-50">
                      <td className="p-3 font-semibold text-gray-900">{plot.name}</td>
                      <td className="p-3 text-gray-700">{Number(plot.area || 0).toFixed(1)}</td>
                      <td className="p-3 text-gray-700">{plot.tree_type}</td>
                      <td className="p-3 text-gray-600">{plot.location_description || '—'}</td>
                      <td className="p-3 text-center">
                        {sprayProgress?.da_xit_plots?.some((item) => item._id === plot._id) ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                            Đã thực hiện
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-orange-100 text-orange-700">
                            Chưa thực hiện
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusBadgeClass(plot.status)}`}>
                          {plot.status === 'đang sử dụng' ? 'Đang sử dụng' : 'Bỏ'}
                        </span>
                      </td>
                      <td className="p-3 text-center whitespace-nowrap space-x-2">
                        <button
                          onClick={() => handleEditPlot(plot)}
                          className="px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition text-sm"
                        >
                          <FaEdit className="inline mr-1" /> Sửa
                        </button>
                        <button
                          onClick={() => handleDeletePlot(plot._id)}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm"
                        >
                          <FaTrash className="inline mr-1" /> Xóa
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="p-8 text-center text-gray-500">
                      Chưa có mẫu đất nào trong vườn này.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Logs */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-green-600 mb-4">Nhật ký gần đây</h2>
            <div className="max-h-56 overflow-y-auto pr-1 space-y-3">
              {logs.length === 0 ? (
                <p className="text-gray-500 text-sm">Chưa có nhật ký nào</p>
              ) : (
                logs.map(log => (
                  <div key={log._id} className="pb-3 border-b last:border-0">
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <p className="text-sm text-gray-500">
                          {formatExpenseDate({ ngay: log.ngay || log.ngay_lam || log.createdAt })}
                        </p>
                        {log.task_id && (
                          <p className="font-semibold text-gray-900 text-sm">
                            {log.task_id?.ten_cong_viec}
                          </p>
                        )}
                        <p className="text-gray-600 text-sm">{log.ghi_chu}</p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Recent Expenses */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-xl font-bold text-green-600 mb-4">Chi phí gần đây</h2>
            <div className="space-y-3">
              {expenses.length === 0 ? (
                <p className="text-gray-500 text-sm">Chưa có chi phí nào</p>
              ) : (
                expenses.slice(0, 5).map(expense => (
                  <div key={expense._id} className="pb-3 border-b last:border-0 flex justify-between items-center">
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">
                        {expense.mo_ta || expense.loai_chi_phi || 'Chi phí'}
                      </p>
                      <p className="text-gray-500 text-xs">
                        {formatExpenseDate(expense)}
                      </p>
                    </div>
                    <p className="font-bold text-orange-600 text-sm">
                      {expense.so_tien?.toLocaleString('vi-VN')} ₫
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default GardenDetailPage;
