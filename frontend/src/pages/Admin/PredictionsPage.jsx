import React, { useState, useEffect } from 'react';
import { FaCheck, FaTimes, FaVirus, FaChartBar, FaUser, FaLeaf, FaCalendar, FaComments } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const PredictionsPage = () => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/predictions');
      console.log('✓ Predictions loaded:', res.data.data?.length || 0);
      setPredictions(res.data.data || []);
    } catch (err) {
      console.error('Error fetching predictions:', err);
      toast.error('Không thể tải danh sách dự đoán');
    } finally {
      setLoading(false);
    }
  };

  const filteredPredictions = predictions.filter(
    (pred) =>
      pred.ket_qua_benh?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      pred.user_id?.ho_ten?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Pagination logic
  const totalPages = Math.ceil(filteredPredictions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPredictions = filteredPredictions.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedPrediction(null);
  };

  const getGradCamUrl = (gradCamPath) => {
    if (!gradCamPath) return '';
    if (gradCamPath.startsWith('http')) return gradCamPath;
    return `http://localhost:5000${gradCamPath}`;
  };

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
    setSelectedPrediction(null);
  }, [searchTerm]);

  return (
    <AdminLayout>
      <div>
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-green-600">Quản Lý Dự Đoán</h1>
          <p className="text-gray-600 mt-2">Xem và phân tích tất cả các dự đoán về bệnh</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Predictions List */}
          <div className="lg:col-span-2">
            {/* Search */}
            <div className="mb-6">
              <input
                type="text"
                placeholder="Tìm kiếm theo bệnh hoặc người dùng..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="bg-white rounded-lg shadow overflow-hidden">
              {loading ? (
                <div className="p-8 text-center text-gray-600">
                  Đang tải dự đoán...
                </div>
              ) : filteredPredictions.length === 0 ? (
                <div className="p-8 text-center text-gray-600">
                  Không tìm thấy dự đoán
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                        Người Dùng
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                        Bệnh
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                        Độ Tin Cây
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                        Ngày
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {paginatedPredictions.map((pred) => (
                      <tr
                        key={pred._id}
                        onClick={() => setSelectedPrediction(pred)}
                        className={`cursor-pointer transition ${
                          selectedPrediction?._id === pred._id
                            ? 'bg-purple-100 hover:bg-purple-150'
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-900">
                            {pred.user_id?.ho_ten || 'Unknown'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="text-gray-900 font-medium">
                            <FaVirus className="inline mr-2" /> {pred.ket_qua_benh}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-purple-600 h-2 rounded-full"
                                style={{
                                  width: `${Math.min(pred.do_tin_cay || 0, 100)}%`,
                                }}
                              ></div>
                            </div>
                            <span className="text-sm font-semibold">
                              {Math.round(pred.do_tin_cay || 0)}%
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-600 text-sm">
                          {pred.ngay_du_doan ? new Date(pred.ngay_du_doan).toLocaleDateString('vi-VN') : 'N/A'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {/* Pagination */}
              {totalPages > 1 && filteredPredictions.length > 0 && (
                <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Trang <span className="font-semibold">{currentPage}</span> / <span className="font-semibold">{totalPages}</span>
                    ({filteredPredictions.length} dự đoán)
                  </div>
                  <div className="flex gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => handlePageChange(page)}
                        className={`px-3 py-1 rounded text-sm font-medium transition ${
                          currentPage === page
                            ? 'bg-purple-600 text-white'
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
            {selectedPrediction ? (
              <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col sticky top-6 max-h-[800px]">
                {/* Header */}
                <div className="bg-gradient-to-r from-purple-500 to-purple-600 text-white p-4 flex-shrink-0">
                  <h3 className="text-lg font-bold">Chi Tiết Dự Đoán</h3>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {/* Disease Image */}
                  {selectedPrediction.hinh_anh && (
                    <div className="flex justify-center bg-gray-100 rounded-lg p-3 mb-4">
                      <img
                        src={`http://localhost:3000${selectedPrediction.hinh_anh}`}
                        alt="Disease"
                        className="max-w-full max-h-64 object-contain rounded-lg"
                        onError={(e) => {
                          e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"%3E%3Crect fill="%23ccc" width="100" height="100"/%3E%3Ctext x="50" y="50" text-anchor="middle" dy=".3em" fill="%23999" font-size="12"%3EImage not found%3C/text%3E%3C/svg%3E';
                        }}
                      />
                    </div>
                  )}

                  {/* AI Advice */}
                  {selectedPrediction.tuvan_ai && (
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-2">Tư Vấn AI</p>
                      <p className="text-sm text-gray-800 bg-purple-50 rounded p-3 border-l-4 border-purple-500 whitespace-pre-wrap">
                        {selectedPrediction.tuvan_ai}
                      </p>
                    </div>
                  )}                  

                  {/* Grad-CAM */}
                  {getGradCamUrl(selectedPrediction.grad_cam_path) && (
                    <div>
                      <p className="text-xs text-gray-600 uppercase font-semibold mb-2">Grad-CAM</p>
                      <img
                        src={getGradCamUrl(selectedPrediction.grad_cam_path)}
                        alt="Grad-CAM overlay"
                        className="w-full rounded-lg border border-gray-200 object-contain bg-gray-50"
                      />
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="border-t p-4 flex-shrink-0">
                  <button
                    onClick={() => setSelectedPrediction(null)}
                    className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium flex items-center justify-center gap-2"
                  >
                    <FaTimes /> Đóng
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-600 sticky top-6">
                Chọn một dự đoán để xem chi tiết
              </div>
            )}
          </div>
        </div>
      </div>
    </AdminLayout>
  );
};

export default PredictionsPage;
