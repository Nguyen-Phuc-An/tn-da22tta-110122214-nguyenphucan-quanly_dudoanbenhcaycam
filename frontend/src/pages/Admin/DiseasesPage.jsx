import React, { useState, useEffect } from 'react';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes, FaVirus, FaSave } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const DiseasesPage = () => {
  const HIDDEN_DISEASES = new Set(['melanose']);
  // Core diseases that must not be deletable from the admin UI.
  // If you need to adjust which diseases are protected, update this list
  // to match the `ten_benh_en` values used by the backend.
  const PROTECTED_DISEASES = new Set([
    'multiple',
    'canker',
    'greening',
    'greasy_spot',
    'black_spot',
    'healthy',
    'leafminer',
    'deficiency',
  ]);
  const [diseases, setDiseases] = useState([]);
  const [fertilizers, setFertilizers] = useState([]);
  const [pesticides, setPesticides] = useState([]);
  const [fertilizerSearch, setFertilizerSearch] = useState('');
  const [pesticideSearch, setPesticideSearch] = useState('');
  const [selectedFertilizers, setSelectedFertilizers] = useState([]);
  const [selectedPesticides, setSelectedPesticides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const { register, handleSubmit, reset } = useForm();

  const emptyDiseaseForm = {
    ten_benh: '',
    ten_benh_en: '',
    mo_ta: '',
    nguyen_nhan: '',
    trieu_chung: '',
    huong_xu_ly: '',
    loai_cay_bi_anh_huong: [],
    muc_do_nguy_hiem: '',
    goi_y_phan_bon: [],
    goi_y_thuoc: [],
  };

  useEffect(() => {
    fetchDiseases();
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const [fertilizerRes, pesticideRes] = await Promise.all([
        apiClient.get('/fertilizers'),
        apiClient.get('/pesticides'),
      ]);

      setFertilizers(fertilizerRes.data.data || []);
      setPesticides(pesticideRes.data.data || []);
    } catch (error) {
      console.error('Error fetching suggestions:', error);
      toast.error('Không thể tải danh sách gợi ý phân bón/thuốc');
    }
  };

  const fetchDiseases = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/diseases');
      const visibleDiseases = (res.data.data || []).filter((disease) => !HIDDEN_DISEASES.has(disease.ten_benh_en));
      console.log('✓ Diseases loaded:', visibleDiseases.length);
      setDiseases(visibleDiseases);
    } catch (err) {
      console.error('Error fetching diseases:', err);
      toast.error('Không thể tải danh sách bệnh');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      const payload = {
        ...data,
        goi_y_phan_bon: selectedFertilizers,
        goi_y_thuoc: selectedPesticides,
        muc_do_nguy_hiem: normalizeDangerLevel(data.muc_do_nguy_hiem),
      };

      if (editingId) {
        await apiClient.put(`/diseases/${editingId}`, payload);
        console.log('✓ Disease updated:', editingId);
        toast.success('Bệnh được cập nhật thành công');
        setDiseases(
          diseases.map((d) => (d._id === editingId ? { ...d, ...payload } : d))
        );
      } else {
        const res = await apiClient.post('/diseases', payload);
        console.log('✓ Disease created:', res.data.data);
        toast.success('Bệnh được tạo thành công');
        setDiseases([...diseases, res.data.data]);
      }
      clearFormState();
      setShowForm(false);
    } catch (err) {
      console.error('Error saving disease:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu bệnh');
    }
  };

  const handleEdit = (disease) => {
    if (HIDDEN_DISEASES.has(disease.ten_benh_en)) return;
    setEditingId(disease._id);
    reset({
      ...disease,
      goi_y_phan_bon: (disease.goi_y_phan_bon || []).map((item) => item?._id || item),
      goi_y_thuoc: (disease.goi_y_thuoc || []).map((item) => item?._id || item),
      muc_do_nguy_hiem: normalizeDangerLevel(disease.muc_do_nguy_hiem),
    });
    setSelectedFertilizers((disease.goi_y_phan_bon || []).map((item) => item?._id || item));
    setSelectedPesticides((disease.goi_y_thuoc || []).map((item) => item?._id || item));
    setFertilizerSearch('');
    setPesticideSearch('');
    setShowForm(true);
  };

  const clearFormState = () => {
    reset(emptyDiseaseForm);
    setSelectedFertilizers([]);
    setSelectedPesticides([]);
    setFertilizerSearch('');
    setPesticideSearch('');
    setEditingId(null);
  };

  const handleAddNewDisease = () => {
    clearFormState();
    setShowForm(true);
  };

  const addSelectedFertilizer = (fertilizerId) => {
    if (selectedFertilizers.includes(fertilizerId)) return;
    setSelectedFertilizers([...selectedFertilizers, fertilizerId]);
    setFertilizerSearch('');
  };

  const addSelectedPesticide = (pesticideId) => {
    if (selectedPesticides.includes(pesticideId)) return;
    setSelectedPesticides([...selectedPesticides, pesticideId]);
    setPesticideSearch('');
  };

  const removeSelectedFertilizer = (fertilizerId) => {
    setSelectedFertilizers(selectedFertilizers.filter((id) => id !== fertilizerId));
  };

  const removeSelectedPesticide = (pesticideId) => {
    setSelectedPesticides(selectedPesticides.filter((id) => id !== pesticideId));
  };

  const fertilizerLabel = (fertilizer) => {
    return fertilizer?.ten_phan_bon || 'Không rõ tên';
  };

  const pesticideLabel = (pesticide) => {
    return pesticide?.ten_thuoc || 'Không rõ tên';
  };

  const selectedFertilizerItems = selectedFertilizers
    .map((id) => fertilizers.find((fertilizer) => fertilizer._id === id))
    .filter(Boolean);

  const selectedPesticideItems = selectedPesticides
    .map((id) => pesticides.find((pesticide) => pesticide._id === id))
    .filter(Boolean);

  const filteredFertilizerSuggestions = fertilizerSearch.trim()
    ? fertilizers.filter((fertilizer) =>
        fertilizerLabel(fertilizer)
          .toLowerCase()
          .includes(fertilizerSearch.trim().toLowerCase())
      )
    : [];

  const filteredPesticideSuggestions = pesticideSearch.trim()
    ? pesticides.filter((pesticide) =>
        pesticideLabel(pesticide)
          .toLowerCase()
          .includes(pesticideSearch.trim().toLowerCase())
      )
    : [];

  const handleDeleteDisease = async (diseaseId) => {
    const disease = diseases.find((d) => d._id === diseaseId);
    if (!disease) return setShowDeleteConfirm(null);

    if (PROTECTED_DISEASES.has(disease.ten_benh_en)) {
      toast.error('Không thể xóa bệnh lõi hệ thống');
      setShowDeleteConfirm(null);
      return;
    }

    try {
      await apiClient.delete(`/diseases/${diseaseId}`);
      console.log('✓ Disease deleted:', diseaseId);
      toast.success('Bệnh được xóa thành công');
      setDiseases(diseases.filter((d) => d._id !== diseaseId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('Error deleting disease:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa bệnh');
    }
  };

  const filteredDiseases = diseases.filter((disease) => !HIDDEN_DISEASES.has(disease.ten_benh_en)).filter(
    (disease) =>
      disease.ten_benh?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      disease.ten_benh_en?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const ITEMS_PER_PAGE = 12;
  const totalPages = Math.max(1, Math.ceil(filteredDiseases.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedDiseases = filteredDiseases.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const getDangerBadge = (level) => {
    const colors = {
      "Cao": 'bg-orange-100 text-orange-800',
      "Trung bình": 'bg-yellow-100 text-yellow-800',
      "Thấp": 'bg-green-100 text-green-800',
      "Không": 'bg-blue-100 text-blue-800',
    };

    return colors[level] || 'bg-gray-100 text-gray-800';
  };

  const normalizeDangerLevel = (level) => {
    const mapping = {
      Low: 'Thấp',
      Medium: 'Trung bình',
      High: 'Cao',
    };

    return mapping[level] || level || '';
  };

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Quản Lý Bệnh</h1>
          <button
            onClick={handleAddNewDisease}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <FaPlus /> Thêm Bệnh Mới
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-green-600 mb-4">
              {editingId ? <> Sửa Bệnh</> : <> Tạo Bệnh Mới</>}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Bệnh (Tiếng Việt)
                  </label>
                  <input
                    type="text"
                    {...register('ten_benh', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Bệnh bia lá..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Tên Bệnh (Tiếng Anh)
                  </label>
                  <input
                    type="text"
                    {...register('ten_benh_en', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Leaf spot..."
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mô Tả
                </label>
                <textarea
                  {...register('mo_ta')}
                  rows="3"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Mô tả bệnh..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nguyên Nhân
                </label>
                <textarea
                  {...register('nguyen_nhan')}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Nguyên nhân gây bệnh..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Cách Xử Lý
                </label>
                <textarea
                  {...register('huong_xu_ly')}
                  rows="2"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Cách xử lý..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gợi Ý Phân Bón
                  </label>
                  <input
                    type="text"
                    value={fertilizerSearch}
                    onChange={(e) => setFertilizerSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Gõ tên phân bón để tìm..."
                    autoComplete="off"
                  />
                  {fertilizerSearch.trim() && (
                    <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-auto">
                      {filteredFertilizerSuggestions.length > 0 ? (
                        filteredFertilizerSuggestions.map((fertilizer) => (
                          <button
                            key={fertilizer._id}
                            type="button"
                            onClick={() => addSelectedFertilizer(fertilizer._id)}
                            className="w-full text-left px-3 py-2 hover:bg-red-50 transition border-b last:border-b-0"
                          >
                            {fertilizerLabel(fertilizer)}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          Không tìm thấy phân bón phù hợp
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedFertilizerItems.map((fertilizer) => (
                      <span
                        key={fertilizer._id}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm"
                      >
                        {fertilizerLabel(fertilizer)}
                        <button
                          type="button"
                          onClick={() => removeSelectedFertilizer(fertilizer._id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FaTimes />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Gợi Ý Thuốc
                  </label>
                  <input
                    type="text"
                    value={pesticideSearch}
                    onChange={(e) => setPesticideSearch(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                    placeholder="Gõ tên thuốc để tìm..."
                    autoComplete="off"
                  />
                  {pesticideSearch.trim() && (
                    <div className="mt-2 border border-gray-200 rounded-lg bg-white shadow-sm max-h-48 overflow-auto">
                      {filteredPesticideSuggestions.length > 0 ? (
                        filteredPesticideSuggestions.map((pesticide) => (
                          <button
                            key={pesticide._id}
                            type="button"
                            onClick={() => addSelectedPesticide(pesticide._id)}
                            className="w-full text-left px-3 py-2 hover:bg-red-50 transition border-b last:border-b-0"
                          >
                            {pesticideLabel(pesticide)}
                          </button>
                        ))
                      ) : (
                        <div className="px-3 py-2 text-sm text-gray-500">
                          Không tìm thấy thuốc phù hợp
                        </div>
                      )}
                    </div>
                  )}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedPesticideItems.map((pesticide) => (
                      <span
                        key={pesticide._id}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-50 text-red-700 text-sm"
                      >
                        {pesticideLabel(pesticide)}
                        <button
                          type="button"
                          onClick={() => removeSelectedPesticide(pesticide._id)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <FaTimes />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Mức Độ Nguy Hiểm
                </label>
                <select
                  {...register('muc_do_nguy_hiem')}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Chọn mức độ</option>
                  <option value="Thấp">Thấp</option>
                  <option value="Trung bình">Trung bình</option>
                  <option value="Cao">Cao</option>
                </select>
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
                    clearFormState();
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
            placeholder="Search by disease name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải bệnh...</div>
          ) : filteredDiseases.length === 0 ? (
            <div className="p-8 text-center text-gray-600">Không tìm thấy bệnh</div>
          ) : (
            <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Tên Bệnh (VI)
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Tên Bệnh (EN)
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Mức Độ Nguy Hiểm
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                    Thao Tác
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {paginatedDiseases.map((disease) => (
                  <tr key={disease._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-medium">
                        <FaVirus className="inline mr-2" /> {disease.ten_benh}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-600">
                      {disease.ten_benh_en}
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${getDangerBadge(
                          disease.muc_do_nguy_hiem
                        )}`}
                      >
                        {disease.muc_do_nguy_hiem || 'N/A'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap space-x-2">
                      <button
                        onClick={() => handleEdit(disease)}
                        className="px-3 py-1 bg-green-50 text-green-600 rounded hover:bg-green-100 transition text-sm"
                      >
                        <FaEdit className="inline mr-1" /> Sửa
                      </button>
                      {PROTECTED_DISEASES.has(disease.ten_benh_en) ? (
                        <button
                          type="button"
                          disabled
                          title="Bệnh lõi - không thể xóa"
                          className="px-3 py-1 bg-gray-100 text-gray-400 rounded text-sm cursor-not-allowed"
                        >
                          <FaTrash className="inline mr-1" /> Xóa
                        </button>
                      ) : (
                        <button
                          onClick={() => setShowDeleteConfirm(disease._id)}
                          className="px-3 py-1 bg-red-50 text-red-600 rounded hover:bg-red-100 transition text-sm"
                        >
                          <FaTrash className="inline mr-1" /> Xóa
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredDiseases.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Trang <span className="font-semibold">{currentPageSafe}</span> / <span className="font-semibold">{totalPages}</span>
                  <span className="ml-2">({filteredDiseases.length} bệnh)</span>
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
                Bạn có chắc chắn muốn xóa bệnh này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDeleteDisease(showDeleteConfirm)}
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

export default DiseasesPage;
