import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const TasksPage = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { register, handleSubmit, reset } = useForm();

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/tasks');
      console.log('✓ Tasks loaded:', res.data.data?.length || 0);
      setTasks(res.data.data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      toast.error('Không thể tải danh sách công việc');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editingId) {
        await apiClient.put(`/tasks/${editingId}`, data);
        console.log('✓ Task updated:', editingId);
        toast.success('Công việc được cập nhật thành công');
        setTasks(
          tasks.map((t) => (t._id === editingId ? { ...t, ...data } : t))
        );
      } else {
        const res = await apiClient.post('/tasks', data);
        console.log('✓ Task created:', res.data.data);
        toast.success('Công việc được tạo thành công');
        setTasks([...tasks, res.data.data]);
      }
      reset();
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error('Error saving task:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu công việc');
    }
  };

  const handleEdit = (task) => {
    setEditingId(task._id);
    reset(task);
    setShowForm(true);
  };

  const handleDeleteTask = async (taskId) => {
    try {
      await apiClient.delete(`/tasks/${taskId}`);
      console.log('✓ Task deleted:', taskId);
      toast.success('Công việc được xóa thành công');
      setTasks(tasks.filter((t) => t._id !== taskId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting task:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa công việc');
    }
  };

  const filteredTasks = tasks.filter(
    (task) =>
      task.ten_cong_viec?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ITEMS_PER_PAGE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredTasks.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedTasks = filteredTasks.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Quản Lý Công Việc</h1>
          <button
            onClick={() => {
              setEditingId(null);
              reset();
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
        >
            <FaPlus /> Thêm Công Việc Mới
            </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-green-600 mb-4">
              {editingId ? <>Sửa Công Việc</> : <>Tạo Công Việc Mới</>}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Tên Công Việc <span className="text-red-600">*</span>
                </label>
                <input
                  type="text"
                  {...register('ten_cong_viec', {
                    required: 'Bắt buộc',
                  })}
                  placeholder="Tên công việc..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô Tả
                </label>
                <textarea
                  {...register('mo_ta')}
                  placeholder="Mô tả công việc..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="3"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Điều Kiện Thực Hiện
                </label>
                <textarea
                  {...register('dieu_kien_thuc_hien')}
                  placeholder="Những điều kiện cần để thực hiện công việc..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  rows="2"
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
            placeholder="Tìm kiếm theo tên công việc..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải công việc...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Không tìm thấy công việc</div>
          ) : (
            <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Tên Công Việc
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Mô Tả
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Điều Kiện
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedTasks.map((task) => (
                  <tr key={task._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-medium">{task.ten_cong_viec}</span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <span className="text-gray-600 text-sm line-clamp-2">{task.mo_ta}</span>
                    </td>
                    <td className="px-6 py-4 max-w-xs">
                      <span className="text-gray-600 text-sm line-clamp-2">{task.dieu_kien_thuc_hien}</span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleEdit(task)}
                        className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition text-sm"
                      >
                        <FaEdit className="inline mr-1" /> Sửa
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(task._id)}
                        className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm"
                      >
                        <FaTrash className="inline mr-1" /> Xóa
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredTasks.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Trang <span className="font-semibold">{currentPageSafe}</span> / <span className="font-semibold">{totalPages}</span>
                  <span className="ml-2">({filteredTasks.length} công việc)</span>
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

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Xác Nhận Xóa
              </h3>
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa công việc này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDeleteTask(showDeleteConfirm)}
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

export default TasksPage;
