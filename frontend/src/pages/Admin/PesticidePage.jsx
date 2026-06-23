import React, { useState, useEffect } from 'react';
import { FaEdit, FaTrash, FaPlus } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const PesticidePage = () => {
  const formatCurrency = (value) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(value || 0));

  const [pesticides, setPesticides] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [modal_them, setModalThem] = useState(false);
  const [modal_sua, setModalSua] = useState(false);
  const [selected_id, setSelectedId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  const [form_data, setFormData] = useState({
    ten_thuoc: '',
    mo_ta: '',
    loai: 'Trừ bệnh',
    hoat_chat: '',
    gia_tien: '',
    cach_su_dung: '',
    muc_do_doc_hai: 'Trung bình',
  });

  // Fetch danh sách thuốc
  useEffect(() => {
    fetchPesticides();
  }, []);

  const fetchPesticides = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/pesticides');
      setPesticides(res.data.data || []);
    } catch (error) {
      console.error('Lỗi lấy danh sách thuốc:', error);
      toast.error('Không thể lấy danh sách thuốc');
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      ten_thuoc: '',
      mo_ta: '',
      loai: 'Trừ bệnh',
      hoat_chat: '',
      gia_tien: '',
      cach_su_dung: '',
      muc_do_doc_hai: 'Trung bình',
    });
    setSelectedId(null);
  };

  // Mở modal thêm
  const handleOpenAddModal = () => {
    resetForm();
    setModalThem(true);
  };

  // Mở modal sửa
  const handleOpenEditModal = (pesticide) => {
    setFormData(pesticide);
    setSelectedId(pesticide._id);
    setModalSua(true);
  };

  // Thêm thuốc
  const handleAdd = async () => {
    try {
      if (!form_data.ten_thuoc || !form_data.loai || !form_data.hoat_chat || form_data.gia_tien === '' || form_data.gia_tien === null || form_data.gia_tien === undefined || !form_data.muc_do_doc_hai) {
        toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
      }

      const res = await apiClient.post('/pesticides', form_data);
      if (res.data.success) {
        toast.success('Thêm thuốc thành công');
        setModalThem(false);
        resetForm();
        fetchPesticides();
      }
    } catch (error) {
      console.error('Lỗi thêm thuốc:', error);
      toast.error(error.response?.data?.message || 'Lỗi thêm thuốc');
    }
  };

  // Sửa thuốc
  const handleEdit = async () => {
    try {
      if (!form_data.ten_thuoc || !form_data.loai || !form_data.hoat_chat || form_data.gia_tien === '' || form_data.gia_tien === null || form_data.gia_tien === undefined || !form_data.muc_do_doc_hai) {
        toast.error('Vui lòng điền đầy đủ thông tin bắt buộc');
        return;
      }

      const res = await apiClient.put(`/pesticides/${selected_id}`, form_data);
      if (res.data.success) {
        toast.success('Cập nhật thuốc thành công');
        setModalSua(false);
        resetForm();
        fetchPesticides();
      }
    } catch (error) {
      console.error('Lỗi cập nhật thuốc:', error);
      toast.error(error.response?.data?.message || 'Lỗi cập nhật thuốc');
    }
  };

  // Xóa thuốc
  const handleDelete = async (id) => {
    try {
      const res = await apiClient.delete(`/pesticides/${id}`);
      if (res.data.success) {
        toast.success('Xóa thuốc thành công');
        fetchPesticides();
        setShowDeleteConfirm(null);
      }
    } catch (error) {
      console.error('Lỗi xóa thuốc:', error);
      toast.error(error.response?.data?.message || 'Lỗi xóa thuốc');
    }
  };

  const getLoaiBadge = (loai) => {
    const colors = {
      'Trừ sâu': 'bg-red-100 text-red-800',
      'Trừ bệnh': 'bg-blue-100 text-blue-800',
      'Diệt cỏ': 'bg-yellow-100 text-yellow-800',
      'Khác': 'bg-gray-100 text-gray-800',
    };
    return colors[loai] || 'bg-gray-100 text-gray-800';
  };

  const getToxicBadge = (toxicity) => {
    const colors = {
      'Thấp': 'bg-green-100 text-green-800',
      'Trung bình': 'bg-yellow-100 text-yellow-800',
      'Cao': 'bg-red-100 text-red-800',
    };
    return colors[toxicity] || 'bg-gray-100 text-gray-800';
  };

  const filteredPesticides = pesticides.filter((pest) =>
    pest.ten_thuoc?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ITEMS_PER_PAGE = 8;
  const totalPages = Math.max(1, Math.ceil(filteredPesticides.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedPesticides = filteredPesticides.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Quản Lý Thuốc</h1>
          <button
            onClick={handleOpenAddModal}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <FaPlus /> Thêm Thuốc Mới
          </button>
        </div>

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Search by pesticide name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Loading */}
        {loading && <div className="p-8 text-center text-gray-600">Đang tải thuốc...</div>}

        {/* Danh sách */}
        {!loading && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full table-fixed">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase w-40">Tên Thuốc</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase w-20">Loại</th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-700 uppercase w-48">Hoạt Chất</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase w-24">Giá Tiền</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase w-24">Độc Hại</th>
                  <th className="px-3 py-3 text-center text-xs font-medium text-gray-700 uppercase w-40">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedPesticides.length > 0 ? (
                  paginatedPesticides.map((pest) => (
                    <tr key={pest._id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 w-96 max-w-96">
                        <span className="block truncate text-gray-900 font-medium" title={pest.ten_thuoc}>
                          {pest.ten_thuoc}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center whitespace-nowrap w-20">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getLoaiBadge(pest.loai)}`}>
                          {pest.loai}
                        </span>
                      </td>
                      <td className="px-3 py-4 max-w-32">
                        <span className="text-gray-600 text-sm line-clamp-2">{pest.hoat_chat}</span>
                      </td>
                      <td className="px-3 py-4 text-center whitespace-nowrap w-24">
                        <span className="font-medium text-green-600">{formatCurrency(pest.gia_tien)}</span>
                      </td>
                      <td className="px-3 py-4 text-center whitespace-nowrap w-24">
                        <span className={`px-2 py-1 rounded text-xs font-semibold ${getToxicBadge(pest.muc_do_doc_hai)}`}>
                          {pest.muc_do_doc_hai}
                        </span>
                      </td>
                      <td className="px-3 py-4 text-center whitespace-nowrap w-40">
                        <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleOpenEditModal(pest)}
                          className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition text-sm"
                        >
                          <FaEdit className="inline mr-1" /> Sửa
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(pest._id)}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm"
                        >
                          <FaTrash className="inline mr-1" /> Xóa
                        </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="p-4 text-center text-gray-600">
                      {searchTerm ? 'Không tìm thấy thuốc phù hợp' : 'Chưa có thuốc nào'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
            {filteredPesticides.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Trang <span className="font-semibold">{currentPageSafe}</span> / <span className="font-semibold">{totalPages}</span>
                  <span className="ml-2">({filteredPesticides.length} thuốc)</span>
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
          </div>
        )}
      </div>

      {/* Modal Thêm */}
      {modal_them && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-96 max-w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl text-green-600 font-bold mb-4">Thêm Thuốc Mới</h2>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Tên thuốc *"
                value={form_data.ten_thuoc}
                onChange={(e) => setFormData({ ...form_data, ten_thuoc: e.target.value })}
                className="w-full border rounded-lg p-2"
              />
              
              <textarea
                placeholder="Mô tả"
                value={form_data.mo_ta}
                onChange={(e) => setFormData({ ...form_data, mo_ta: e.target.value })}
                className="w-full border rounded-lg p-2 h-16"
              />
              
              <select
                value={form_data.loai}
                onChange={(e) => setFormData({ ...form_data, loai: e.target.value })}
                className="w-full border rounded-lg p-2"
              >
                <option value="Trừ sâu">Trừ sâu</option>
                <option value="Trừ bệnh">Trừ bệnh</option>
                <option value="Diệt cỏ">Diệt cỏ</option>
                <option value="Khác">Khác</option>
              </select>
              
              <input
                type="text"
                placeholder="Hoạt chất *"
                value={form_data.hoat_chat}
                onChange={(e) => setFormData({ ...form_data, hoat_chat: e.target.value })}
                className="w-full border rounded-lg p-2"
              />

              <input
                type="number"
                min="0"
                placeholder="Giá tiền *"
                value={form_data.gia_tien}
                onChange={(e) => setFormData({ ...form_data, gia_tien: e.target.value })}
                className="w-full border rounded-lg p-2"
              />
              
              <textarea
                placeholder="Cách sử dụng"
                value={form_data.cach_su_dung}
                onChange={(e) => setFormData({ ...form_data, cach_su_dung: e.target.value })}
                className="w-full border rounded-lg p-2 h-20"
              />
              
              <select
                value={form_data.muc_do_doc_hai}
                onChange={(e) => setFormData({ ...form_data, muc_do_doc_hai: e.target.value })}
                className="w-full border rounded-lg p-2"
              >
                <option value="Thấp">Thấp</option>
                <option value="Trung bình">Trung bình</option>
                <option value="Cao">Cao</option>
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setModalThem(false); resetForm(); }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold hover:bg-gray-400"
              >
                Hủy
              </button>
              <button
                onClick={handleAdd}
                className="flex-1 px-4 py-2 bg-green-500 text-white rounded font-semibold hover:bg-green-600"
              >
                ✅ Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Sửa */}
      {modal_sua && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-8 rounded-lg shadow-xl w-96 max-w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-2xl font-bold mb-4">✏️ Sửa Thuốc</h2>
            
            <div className="space-y-3">
              <input
                type="text"
                placeholder="Tên thuốc *"
                value={form_data.ten_thuoc}
                onChange={(e) => setFormData({ ...form_data, ten_thuoc: e.target.value })}
                className="w-full border rounded-lg p-2"
              />
              
              <textarea
                placeholder="Mô tả"
                value={form_data.mo_ta}
                onChange={(e) => setFormData({ ...form_data, mo_ta: e.target.value })}
                className="w-full border rounded-lg p-2 h-16"
              />
              
              <select
                value={form_data.loai}
                onChange={(e) => setFormData({ ...form_data, loai: e.target.value })}
                className="w-full border rounded-lg p-2"
              >
                <option value="Trừ sâu">Trừ sâu</option>
                <option value="Trừ bệnh">Trừ bệnh</option>
                <option value="Diệt cỏ">Diệt cỏ</option>
                <option value="Khác">Khác</option>
              </select>
              
              <input
                type="text"
                placeholder="Hoạt chất *"
                value={form_data.hoat_chat}
                onChange={(e) => setFormData({ ...form_data, hoat_chat: e.target.value })}
                className="w-full border rounded-lg p-2"
              />

              <input
                type="number"
                min="0"
                placeholder="Giá tiền *"
                value={form_data.gia_tien}
                onChange={(e) => setFormData({ ...form_data, gia_tien: e.target.value })}
                className="w-full border rounded-lg p-2"
              />
              
              <textarea
                placeholder="Cách sử dụng"
                value={form_data.cach_su_dung}
                onChange={(e) => setFormData({ ...form_data, cach_su_dung: e.target.value })}
                className="w-full border rounded-lg p-2 h-20"
              />
              
              <select
                value={form_data.muc_do_doc_hai}
                onChange={(e) => setFormData({ ...form_data, muc_do_doc_hai: e.target.value })}
                className="w-full border rounded-lg p-2"
              >
                <option value="Thấp">Thấp</option>
                <option value="Trung bình">Trung bình</option>
                <option value="Cao">Cao</option>
              </select>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => { setModalSua(false); resetForm(); }}
                className="flex-1 px-4 py-2 bg-gray-300 text-gray-800 rounded font-semibold hover:bg-gray-400"
              >
                Hủy
              </button>
              <button
                onClick={handleEdit}
                className="flex-1 px-4 py-2 bg-blue-500 text-white rounded font-semibold hover:bg-blue-600"
              >
                ✅ Cập Nhật
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">Xác Nhận Xóa</h3>
            <p className="text-gray-600 mb-6">
              Bạn có chắc chắn muốn xóa thuốc này không? Hành động này không thể hoàn tác.
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
    </AdminLayout>
  );
};

export default PesticidePage;
