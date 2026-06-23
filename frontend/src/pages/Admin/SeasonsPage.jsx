import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const SeasonsPage = () => {
  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncingGardens, setSyncingGardens] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { register, handleSubmit, reset, watch } = useForm();

  const emptySeasonForm = {
    ten_mua_vu: '',
    nam: '',
    thang_bat_dau: '',
    thang_ket_thuc: '',
    trang_thai: '',
    mo_ta: '',
  };

  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/seasons/admin/all');
      console.log('✓ Seasons loaded:', res.data.data?.length || 0);
      setSeasons(res.data.data || []);
    } catch (err) {
      console.error('Error fetching seasons:', err);
      toast.error('Không thể tải danh sách mùa vụ');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (editingId) {
        await apiClient.put(`/seasons/${editingId}`, data);
        console.log('✓ Season updated:', editingId);
        toast.success('Mùa vụ được cập nhật thành công');
        setSeasons(
          seasons.map((s) => (s._id === editingId ? { ...s, ...data } : s))
        );
      } else {
        const res = await apiClient.post('/seasons', data);
        console.log('✓ Season created:', res.data.data);
        toast.success('Mùa vụ được tạo thành công');
        setSeasons([...seasons, res.data.data]);
      }
      reset();
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error('Error saving season:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu mùa vụ');
    }
  };

  const handleEdit = (season) => {
    setEditingId(season._id);
    reset(season);
    setShowForm(true);
  };

  const handleDeleteSeason = async (seasonId) => {
    try {
      await apiClient.delete(`/seasons/${seasonId}`);
      console.log('✓ Season deleted:', seasonId);
      toast.success('Mùa vụ được xóa thành công');
      setSeasons(seasons.filter((s) => s._id !== seasonId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting season:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa mùa vụ');
    }
  };

  const handleSyncCurrentSeasonForAllGardens = async () => {
    if (!window.confirm('Cập nhật mùa vụ đang diễn ra cho tất cả vườn?')) {
      return;
    }

    try {
      setSyncingGardens(true);
      const res = await apiClient.post('/seasons/admin/sync-gardens');
      toast.success(res.data?.message || 'Đã cập nhật mùa vụ cho tất cả vườn');
      await fetchSeasons();
    } catch (err) {
      console.error('Error syncing current season for all gardens:', err);
      toast.error(err.response?.data?.message || 'Không thể cập nhật mùa vụ cho vườn');
    } finally {
      setSyncingGardens(false);
    }
  };

  const filteredSeasons = seasons
  .filter((season) =>
    season.ten_mua_vu?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  .sort((a, b) => {
    // So sánh năm trước
    if (b.nam !== a.nam) {
      return b.nam - a.nam; // năm lớn hơn lên trước
    }

    // Nếu cùng năm thì so sánh tháng bắt đầu
    return (b.thang_bat_dau || 0) - (a.thang_bat_dau || 0);
  });

  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(1, Math.ceil(filteredSeasons.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedSeasons = filteredSeasons.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Quản Lý Mùa Vụ</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSyncCurrentSeasonForAllGardens}
              disabled={syncingGardens}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <FaCheck /> {syncingGardens ? 'Đang cập nhật...' : 'Cập nhật mùa vụ cho tất cả vườn'}
            </button>
            <button
              onClick={() => {
                setEditingId(null);
                reset(emptySeasonForm);
                setShowForm(!showForm);
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <FaPlus /> Thêm Mùa Vụ Mới
            </button>
          </div>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-green-600 mb-4 flex items-center gap-2">
              {editingId ? <>Sửa Mùa Vụ</> : <>Tạo Mùa Vụ Mới</>}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Mùa Vụ <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="text"
                    {...register('ten_mua_vu', {
                      required: 'Bắt buộc',
                    })}
                    placeholder="Tên mùa vụ..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Năm <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="number"
                    {...register('nam', {
                      required: 'Bắt buộc',
                    })}
                    placeholder="Nhập năm..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tháng Bắt Đầu
                  </label>
                  <select
                    {...register('thang_bat_dau')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Chọn tháng</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Tháng {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tháng Kết Thúc
                  </label>
                  <select
                    {...register('thang_ket_thuc')}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Chọn tháng</option>
                    {Array.from({ length: 12 }, (_, i) => (
                      <option key={i + 1} value={i + 1}>
                        Tháng {i + 1}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Trạng Thái <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...register('trang_thai', {
                      required: 'Bắt buộc',
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Chọn trạng thái</option>
                    <option value="Sắp diễn ra">Sắp diễn ra</option>
                    <option value="Đang diễn ra">Đang diễn ra</option>
                    <option value="Đã kết thúc">Đã kết thúc</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô Tả
                </label>
                <textarea
                  {...register('mo_ta')}
                  placeholder="Mô tả mùa vụ..."
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
                    reset(emptySeasonForm);
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
            placeholder="Tìm kiếm theo tên mùa vụ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải mùa vụ...</div>
          ) : filteredSeasons.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Không tìm thấy mùa vụ</div>
          ) : (
            <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Tên Mùa Vụ
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Năm
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Khoảng Tháng
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
                {paginatedSeasons.map((season) => (
                  <tr key={season._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-medium">{season.ten_mua_vu}</span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="text-gray-900">{season.nam}</span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="text-gray-900">
                        {season.thang_bat_dau ? `T${season.thang_bat_dau}` : '?'} -{' '}
                        {season.thang_ket_thuc ? `T${season.thang_ket_thuc}` : '?'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        season.trang_thai === 'Đang diễn ra'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {season.trang_thai || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                      {/* Quy tắc:
                          - 'Đã kết thúc' : không cho sửa hoặc xóa
                          - 'Đang diễn ra' : chỉ cho sửa
                          - 'Sắp diễn ra' : cho sửa và xóa
                      */}
                      {(() => {
                        const status = season.trang_thai;
                        const canEdit = status === 'Đang diễn ra' || status === 'Sắp diễn ra';
                        const canDelete = status === 'Sắp diễn ra';

                        return (
                          <>
                            <button
                              onClick={() => canEdit && handleEdit(season)}
                              disabled={!canEdit}
                              className={`px-3 py-1 rounded text-sm transition ${canEdit ? 'bg-green-50 text-green-600 hover:bg-green-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                              <FaEdit className="inline mr-1" /> Sửa
                            </button>

                            <button
                              onClick={() => canDelete && setShowDeleteConfirm(season._id)}
                              disabled={!canDelete}
                              className={`px-3 py-1 rounded text-sm transition ${canDelete ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                            >
                              <FaTrash className="inline mr-1" /> Xóa
                            </button>
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredSeasons.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Trang <span className="font-semibold">{currentPageSafe}</span> / <span className="font-semibold">{totalPages}</span>
                  <span className="ml-2">({filteredSeasons.length} mùa vụ)</span>
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
                Bạn có chắc chắn muốn xóa mùa vụ này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDeleteSeason(showDeleteConfirm)}
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

export default SeasonsPage;
