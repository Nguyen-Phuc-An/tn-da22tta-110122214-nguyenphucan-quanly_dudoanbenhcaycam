import React, { useState, useEffect, useMemo } from 'react';
import {
  FaChartBar,
  FaChartLine,
  FaVirus,
  FaLeaf,
  FaClipboardList,
  FaDollarSign,
  FaFileAlt,
  FaClock,
  FaUser,
  FaSeedling,
  FaArrowUp,
  FaBullseye,
} from 'react-icons/fa';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const StatisticsPage = () => {
  const [stats, setStats] = useState({
    totalExpenses: 0,
    predictions: [],
    mostCommonDisease: null,
    gardens: [],
    logs: [],
    expenses: [],
    diseaseList: [],
    expensesByType: {},
  });
  const [loading, setLoading] = useState(true);

  const confidenceColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [expensesRes, predictionsRes, gardensRes, logsRes] = await Promise.all([
        apiClient.get('/expenses'),
        apiClient.get('/predictions'),
        apiClient.get('/gardens'),
        apiClient.get('/logs'),
      ]);

      const expenses = expensesRes.data.data || [];
      const predictions = predictionsRes.data.data || [];
      const gardens = gardensRes.data.data || [];
      const logs = logsRes.data.data || [];

      const totalExpenses = expenses.reduce((sum, e) => sum + (e.so_tien || 0), 0);

      // Tìm bệnh phổ biến nhất
      const diseaseCount = {};
      predictions.forEach(p => {
        if (p.ket_qua_benh) {
          diseaseCount[p.ket_qua_benh] = (diseaseCount[p.ket_qua_benh] || 0) + 1;
        }
      });

      const diseaseList = Object.entries(diseaseCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      const mostCommon = diseaseList[0];

      // Chi phí breakdown theo loại chi phí
      const expensesByType = {};
      expenses.forEach(e => {
        const type = e.loai_chi_phi || 'Khác';
        expensesByType[type] = (expensesByType[type] || 0) + (e.so_tien || 0);
      });

      setStats({
        totalExpenses,
        predictions,
        mostCommonDisease: mostCommon || null,
        gardens,
        logs,
        expenses,
        diseaseList,
        expensesByType,
      });
    } catch (error) {
      console.error('❌ Lỗi tải thống kê:', error);
      toast.error('Không thể tải thống kê');
    } finally {
      setLoading(false);
    }
  };

  const getConfidencePercent = (confidence) => {
    if (!confidence && confidence !== 0) return 0;
    let conf = Number(confidence) || 0;
    if (conf <= 1) return Math.round(conf * 100);
    if (conf > 100) return Math.round(conf / 100);
    return Math.round(conf);
  };

  const insights = useMemo(() => {
    const totalPredictions = stats.predictions.length;
    const avgExpensePerGarden = stats.gardens.length ? stats.totalExpenses / stats.gardens.length : 0;
    const avgConfidence = totalPredictions
      ? stats.predictions.reduce((sum, prediction) => sum + getConfidencePercent(prediction.do_tin_cay), 0) / totalPredictions
      : 0;

    const byDayMap = new Map();
    const byGardenMap = new Map();
    const confidenceBuckets = [
      { name: '0-39%', value: 0 },
      { name: '40-59%', value: 0 },
      { name: '60-79%', value: 0 },
      { name: '80-100%', value: 0 },
    ];

    stats.predictions.forEach((prediction) => {
      // Use ISO keys for reliable chronological ordering
      const iso = prediction.ngay_du_doan ? new Date(prediction.ngay_du_doan).toISOString().slice(0, 10) : 'N/A';
      const display = prediction.ngay_du_doan ? new Date(prediction.ngay_du_doan).toLocaleDateString('vi-VN') : 'N/A';
      const existing = byDayMap.get(iso) || { date: display, count: 0 };
      existing.count += 1;
      byDayMap.set(iso, existing);

      const gardenKey = prediction.user_id?.ho_ten || 'Chưa gắn user';
      byGardenMap.set(gardenKey, (byGardenMap.get(gardenKey) || 0) + 1);

      const confidence = getConfidencePercent(prediction.do_tin_cay);
      if (confidence < 40) confidenceBuckets[0].value += 1;
      else if (confidence < 60) confidenceBuckets[1].value += 1;
      else if (confidence < 80) confidenceBuckets[2].value += 1;
      else confidenceBuckets[3].value += 1;
    });

    const topGarden = Array.from(byGardenMap.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)[0];

    const recentLog = stats.logs[0];

    return {
      avgExpensePerGarden,
      avgConfidence,
      // Return last 10 days but sorted oldest->newest for charts
      byDay: Array.from(byDayMap.entries())
        .map(([iso, obj]) => ({ iso, date: obj.date, count: obj.count }))
        .sort((a, b) => a.iso.localeCompare(b.iso))
        .slice(-10)
        .map(({ date, count }) => ({ date, count })),
      byGarden: Array.from(byGardenMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
      confidenceBuckets,
      topGarden,
      recentLog,
    };
  }, [stats]);

  // Get latest prediction for each user (garden removed)
  const getLatestPredictionByUser = () => {
    const predictionsByUser = {};
    
    stats.predictions.forEach(pred => {
      const userId = pred.user_id?._id || pred.user_id;
      if (!predictionsByUser[userId] || 
          new Date(pred.ngay_du_doan) > new Date(predictionsByUser[userId].ngay_du_doan)) {
        predictionsByUser[userId] = pred;
      }
    });

    return Object.values(predictionsByUser).sort((a, b) => 
      new Date(b.ngay_du_doan) - new Date(a.ngay_du_doan)
    );
  };

  if (loading) {
    return (
      <UserLayout>
        <div className="text-center py-12">Đang tải...</div>
      </UserLayout>
    );
  }

  return (
    <UserLayout>
      <div className="space-y-8">
        <section className="rounded-3xl bg-slate-900 px-8 py-8 text-white shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="mt-4 text-3xl font-bold md:text-4xl">Tổng quan dữ liệu của bạn</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">
                Theo dõi dự đoán, chi phí, vườn và nhật ký theo một giao diện gọn, rõ và dễ đọc.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Dự đoán</div>
                <div className="mt-1 font-semibold">{stats.predictions.length}</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">Confidence TB</div>
                <div className="mt-1 font-semibold">{insights.avgConfidence.toFixed(1)}%</div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Tổng chi phí</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{(stats.totalExpenses / 1000000).toFixed(1)}M ₫</p>
              </div>
              <div className="text-3xl text-slate-900/20"><FaDollarSign /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-blue-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Dự đoán</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.predictions.length}</p>
              </div>
              <div className="text-3xl text-blue-600/20"><FaChartBar /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-rose-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Bệnh phổ biến</p>
                <p className="text-lg font-bold text-gray-900 mt-2">{stats.mostCommonDisease?.name || 'N/A'}</p>
              </div>
              <div className="text-3xl text-rose-600/20">🦠</div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-emerald-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Số vườn</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.gardens.length}</p>
              </div>
              <div className="text-3xl text-emerald-600/20"><FaLeaf /></div>
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-md p-6 border-l-4 border-violet-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-600 text-sm">Nhật ký</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stats.logs.length}</p>
              </div>
              <div className="text-3xl text-violet-600/20"><FaFileAlt /></div>
            </div>
          </div>
        </div>

        {/* Trend / Summary */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 bg-white rounded-xl shadow-md p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-bold text-gray-900 flex items-center gap-2">
                  <FaChartLine className="text-blue-600" /> Xu hướng dự đoán theo ngày
                </h3>
                <p className="text-sm text-gray-500">Nhìn nhanh mức độ hoạt động gần đây</p>
              </div>
              <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">10 ngày gần nhất</div>
            </div>
            {insights.byDay.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Chưa có dữ liệu dự đoán</div>
            ) : (
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={insights.byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FaClock className="text-emerald-600" /> Chỉ số nhanh
            </h3>
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Độ tin cậy TB</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{insights.avgConfidence.toFixed(1)}%</p>
                <p className="text-sm text-slate-500 mt-1">Mức confidence trung bình của các dự đoán</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Chi phí TB / vườn</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{(insights.avgExpensePerGarden / 1000000).toFixed(2)}M ₫</p>
                <p className="text-sm text-slate-500 mt-1">Dùng để so sánh giữa các vườn</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Nhật ký gần nhất</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{insights.recentLog?.task_id?.ten_cong_viec || 'Chưa có'}</p>
                <p className="text-sm text-slate-500 mt-1">{insights.recentLog?.garden_id?.ten_vuon || '—'}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Details Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Disease Statistics - Pie Chart */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FaVirus className="text-rose-600" /> Bệnh phát hiện
            </h3>

            {stats.diseaseList.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Chưa có dự đoán nào</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={stats.diseaseList}
                    dataKey="count"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, count }) => `${name}: ${count}`}
                  >
                    {stats.diseaseList.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={confidenceColors[index % confidenceColors.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `${value} lần`} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Expense by Type - Bar Chart */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FaDollarSign className="text-blue-600" /> Chi phí theo loại
            </h3>

            {Object.keys(stats.expensesByType).length === 0 ? (
              <div className="text-center text-gray-500 py-8">Chưa có chi phí nào</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={Object.entries(stats.expensesByType)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, amount]) => ({
                      name: type,
                      amount: amount / 1000000,
                    }))}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                  <YAxis label={{ value: 'Triệu ₫', angle: -90, position: 'insideLeft' }} />
                  <Tooltip formatter={(value) => `${value.toFixed(2)}M ₫`} />
                  <Bar dataKey="amount" fill="#2563eb" />
                </BarChart>
              </ResponsiveContainer>
            )}

            {stats.totalExpenses > 0 && (
              <div className="mt-4 pt-4 border-t">
                <div className="flex justify-between items-center">
                  <p className="font-bold text-gray-900">Tổng cộng</p>
                  <p className="font-bold text-lg text-gray-900">
                    {(stats.totalExpenses / 1000000).toFixed(2)}M ₫
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Prediction Details - 3 Most Recent Predictions */}
        {stats.predictions.length > 0 && (
          <div className="mt-6 bg-white rounded-xl shadow-md p-6">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <FaClipboardList className="text-blue-600" /> 3 dự đoán bệnh gần nhất
            </h3>

            {stats.predictions.length === 0 ? (
              <div className="text-center text-gray-500 py-8">Chưa có dự đoán nào</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stats.predictions
                  .slice()
                  .sort((a, b) => new Date(b.ngay_du_doan) - new Date(a.ngay_du_doan))
                  .slice(0, 3)
                  .map((prediction) => {
                    const user = prediction.user_id?.ho_ten || 'N/A';
                    return (
                      <div
                        key={prediction._id}
                        className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition"
                      >
                        {/* Prediction Details */}
                        <div className="space-y-2">
                          {/* Disease */}
                          <div className="flex items-start gap-2">
                            <span className="text-sm font-medium text-gray-600 w-20">Bệnh:</span>
                            <span className="inline-block bg-red-100 text-red-800 px-2 py-1 rounded text-xs font-semibold">
                              {prediction.ket_qua_benh || 'N/A'}
                            </span>
                          </div>

                          {/* Confidence */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Độ tin cậy:</span>
                            <span className="font-semibold text-green-600">
                              {getConfidencePercent(prediction.do_tin_cay)}%
                            </span>
                          </div>

                          {/* Date */}
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-600">Ngày:</span>
                            <span className="text-sm text-gray-600">
                              {new Date(prediction.ngay_du_doan).toLocaleDateString('vi-VN')}
                            </span>
                          </div>

                          {/* AI Advice */}
                          {prediction.tuvan_ai && (
                            <div className="mt-3 pt-3 border-t">
                              <p className="text-xs font-medium text-gray-600 mb-1">💡 Lời khuyên:</p>
                              <p className="text-xs text-gray-700 line-clamp-2">{prediction.tuvan_ai}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        )}
      </div>
    </UserLayout>
  );
};

export default StatisticsPage;
