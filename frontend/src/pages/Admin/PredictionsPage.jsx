import React, { useMemo, useState, useEffect } from 'react';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { FaTimes, FaVirus } from 'react-icons/fa';

const CONFIDENCE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN');

const getMonthKeyFromDate = (dateValue) => {
  if (!dateValue) return '';
  const parsed = new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return '';
  return `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonthLabel = (monthKey) => {
  if (!monthKey) return 'N/A';
  const [year, month] = monthKey.split('-');
  if (!year || !month) return monthKey;
  return `${month}/${year}`;
};

const groupByDisease = (predictions) => {
  const buckets = new Map();

  predictions.forEach((item) => {
    const key = item.ket_qua_benh || 'Không xác định';
    buckets.set(key, (buckets.get(key) || 0) + 1);
  });

  return Array.from(buckets.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);
};

const buildConfidenceBuckets = (predictions) => {
  const buckets = [
    { name: '0-39%', value: 0 },
    { name: '40-59%', value: 0 },
    { name: '60-79%', value: 0 },
    { name: '80-100%', value: 0 },
  ];

  predictions.forEach((item) => {
    const confidence = Number(item.do_tin_cay || 0);
    if (confidence < 40) buckets[0].value += 1;
    else if (confidence < 60) buckets[1].value += 1;
    else if (confidence < 80) buckets[2].value += 1;
    else buckets[3].value += 1;
  });

  return buckets;
};

const PredictionsPage = () => {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDiseaseMonth, setSelectedDiseaseMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const ITEMS_PER_PAGE = 12;

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

  const diseaseMonthOptions = useMemo(() => {
    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const monthSet = new Set([currentMonthKey]);

    predictions.forEach((item) => {
      const monthKey = getMonthKeyFromDate(item.ngay_du_doan);
      if (monthKey) monthSet.add(monthKey);
    });

    return Array.from(monthSet)
      .sort((a, b) => b.localeCompare(a))
      .map((value) => ({
        value,
        label: formatMonthLabel(value),
      }));
  }, [predictions]);

  const diseaseDistributionForMonth = useMemo(() => {
    const monthPredictions = predictions.filter(
      (item) => getMonthKeyFromDate(item.ngay_du_doan) === selectedDiseaseMonth
    );

    return {
      items: groupByDisease(monthPredictions),
      total: monthPredictions.length,
    };
  }, [predictions, selectedDiseaseMonth]);

  const recentTimelinePredictions = useMemo(() => {
    return [...predictions]
      .sort((a, b) => new Date(b.ngay_du_doan) - new Date(a.ngay_du_doan))
      .slice(0, 6);
  }, [predictions]);

  const confidenceBuckets = useMemo(() => buildConfidenceBuckets(predictions), [predictions]);

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
          <h1 className="text-3xl font-bold text-green-600">Nhật Ký Bệnh</h1>
          <p className="text-gray-600 mt-2">Xem và phân tích tất cả các dự đoán về bệnh</p>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-2">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-green-600">Phân bố bệnh dự đoán</h2>
                <p className="text-sm text-slate-500">
                  Theo tháng {formatMonthLabel(selectedDiseaseMonth)} • {formatNumber(diseaseDistributionForMonth.total)} lượt dự đoán
                </p>
              </div>
              <select
                value={selectedDiseaseMonth}
                onChange={(event) => setSelectedDiseaseMonth(event.target.value)}
                className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
              >
                {diseaseMonthOptions.map((month) => (
                  <option key={month.value} value={month.value}>
                    {month.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="h-80 w-full">
              {diseaseDistributionForMonth.items.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={diseaseDistributionForMonth.items.slice(0, 8)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  Không có dữ liệu dự đoán trong tháng {formatMonthLabel(selectedDiseaseMonth)}.
                </div>
              )}
            </div>
          </div>
          
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm xl:col-span-1">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-green-600">Phân bố độ tin cậy</h2>
                <p className="text-sm text-slate-500">Tỷ lệ các mức confidence của dự đoán</p>
              </div>
            </div>

            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={confidenceBuckets} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {confidenceBuckets.map((entry, index) => (
                      <Cell key={entry.name} fill={CONFIDENCE_COLORS[index % CONFIDENCE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
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
