import React, { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  FaBolt,
  FaCamera,
  FaChartBar,
  FaChartLine,
  FaCheck,
  FaClipboard,
  FaClock,
  FaDollarSign,
  FaExclamationTriangle,
  FaInfoCircle,
  FaLeaf,
  FaPlus,
  FaScrewdriver,
  FaShieldAlt,
  FaThermometerHalf,
  FaUsers,
  FaVirus,
} from 'react-icons/fa';

const LOW_CONFIDENCE_THRESHOLD = 60;
const CONFIDENCE_COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

const formatNumber = (value) => Number(value || 0).toLocaleString('vi-VN');
const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;
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

const quickActions = [
  {
    label: 'Tạo Bệnh Mới',
    icon: <FaPlus className="inline mr-2" />,
    to: '/admin/diseases',
    className: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  },
  {
    label: 'Tạo Người Dùng Mới',
    icon: <FaPlus className="inline mr-2" />,
    to: '/admin/users',
    className: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  },
  {
    label: 'Xem Báo Cáo',
    icon: <FaChartBar className="inline mr-2" />,
    to: '/admin/predictions',
    className: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  },
  {
    label: 'Cài Đặt Hệ Thống',
    icon: <FaScrewdriver className="inline mr-2" />,
    to: '/admin/ml-training',
    className: 'bg-gray-100 text-gray-900 hover:bg-gray-200',
  },
];

const groupByDay = (predictions) => {
  // Group by ISO date (YYYY-MM-DD) to ensure correct chronological ordering
  const buckets = new Map();

  predictions.forEach((item) => {
    if (!item || !item.ngay_du_doan) return;
    const iso = new Date(item.ngay_du_doan).toISOString().slice(0, 10);
    const display = new Date(item.ngay_du_doan).toLocaleDateString('vi-VN');
    const existing = buckets.get(iso) || { date: display, count: 0 };
    existing.count += 1;
    buckets.set(iso, existing);
  });

  return Array.from(buckets.entries())
    .map(([iso, obj]) => ({ iso, date: obj.date, count: obj.count }))
    .sort((a, b) => a.iso.localeCompare(b.iso))
    .map(({ date, count }) => ({ date, count }));
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

const AdminDashboardPage = () => {
  const [stats, setStats] = useState({ users: 0, gardens: 0, diseases: 0, predictions: 0 });
  const [predictions, setPredictions] = useState([]);
  const [mlStatus, setMlStatus] = useState(null);
  const [apiLatency, setApiLatency] = useState({ users: 0, gardens: 0, diseases: 0, predictions: 0, mlStatus: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [recentPage, setRecentPage] = useState(1);
  const [selectedDiseaseMonth, setSelectedDiseaseMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  const RECENT_PAGE_SIZE = 10;

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        setLoading(true);

        const measure = async (key, requestFn) => {
          const startedAt = performance.now();
          try {
            const response = await requestFn();
            setApiLatency((prev) => ({ ...prev, [key]: Math.round(performance.now() - startedAt) }));
            return response;
          } catch (requestError) {
            setApiLatency((prev) => ({ ...prev, [key]: Math.round(performance.now() - startedAt) }));
            throw requestError;
          }
        };

        const [usersRes, gardensRes, diseasesRes, predictionsRes, mlStatusRes] = await Promise.allSettled([
          measure('users', () => apiClient.get('/users')),
          measure('gardens', () => apiClient.get('/gardens')),
          measure('diseases', () => apiClient.get('/diseases')),
          measure('predictions', () => apiClient.get('/predictions')),
          measure('mlStatus', () => apiClient.get('/ml/status')),
        ]);

        const usersData = usersRes.status === 'fulfilled' ? usersRes.value.data.data || [] : [];
        const gardensData = gardensRes.status === 'fulfilled' ? gardensRes.value.data.data || [] : [];
        const diseasesData = diseasesRes.status === 'fulfilled' ? diseasesRes.value.data.data || [] : [];
        const predictionsData = predictionsRes.status === 'fulfilled' ? predictionsRes.value.data.data || [] : [];

        if (usersRes.status === 'rejected' || gardensRes.status === 'rejected' || diseasesRes.status === 'rejected' || predictionsRes.status === 'rejected') {
          throw new Error('Không thể tải toàn bộ dữ liệu dashboard');
        }

        const normalUsers = usersData.filter((user) => user.vai_tro === 'user');

        setStats({
          users: normalUsers.length,
          gardens: gardensData.length,
          diseases: diseasesData.length,
          predictions: predictionsData.length,
        });
        setPredictions(predictionsData);

        if (mlStatusRes.status === 'fulfilled') {
          setMlStatus(mlStatusRes.value.data.data || null);
        }
      } catch (fetchError) {
        console.error('❌ Error fetching dashboard data:', fetchError);
        setError('Không thể tải thống kê');
        setStats({ users: 5, gardens: 8, diseases: 12, predictions: 24 });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const dashboard = useMemo(() => {
    const totalPredictions = predictions.length;
    const avgConfidence = totalPredictions
      ? predictions.reduce((sum, item) => sum + Number(item.do_tin_cay || 0), 0) / totalPredictions
      : 0;
    const lowConfidenceCount = predictions.filter((item) => Number(item.do_tin_cay || 0) < LOW_CONFIDENCE_THRESHOLD).length;
    const avgProcessingTime = totalPredictions
      ? predictions.reduce((sum, item) => sum + Number(item.thoi_gian_xu_ly_ms || 0), 0) / totalPredictions
      : 0;

      return {
        totalPredictions,
        avgConfidence,
        lowConfidenceCount,
        lowConfidenceRate: totalPredictions ? (lowConfidenceCount / totalPredictions) * 100 : 0,
        avgProcessingTime,
        byDay: groupByDay(predictions),
        byDisease: groupByDisease(predictions),
        confidenceBuckets: buildConfidenceBuckets(predictions),
        // sort predictions newest first for listing; pagination will handle slicing
        recentPredictions: predictions.slice().sort((a, b) => new Date(b.ngay_du_doan) - new Date(a.ngay_du_doan)),
      };
  }, [predictions]);

  const summary = mlStatus?.summary || {};
  const trainingResults = mlStatus?.trainingResults || null;
  const evaluation = mlStatus?.evaluation || null;
  const testMetrics = evaluation?.test || null;

  // derive total images from mlStatus.status (per-disease counts) if available
  const totalImagesFromMlStatus = Object.values(mlStatus?.status || {}).reduce(
    (s, d) => s + Number(d.count || d.total || 0),
    0
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

  const StatCard = ({ icon, label, value, color }) => (
    <div className={`bg-white rounded-lg shadow p-6 border-l-4 ${color} hover:shadow-lg transition`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-gray-600 text-sm">{label}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
        </div>
        <div className="text-4xl">{icon}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <AdminLayout>
        <div className="space-y-6">
          <div className="rounded-3xl bg-slate-900 px-8 py-8 text-white shadow-2xl">
            <div className="h-6 w-72 rounded bg-white/15 animate-pulse" />
            <div className="mt-3 h-4 w-full max-w-2xl rounded bg-white/10 animate-pulse" />
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 rounded-2xl bg-white shadow-sm animate-pulse" />
            ))}
          </div>
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="h-80 rounded-2xl bg-white shadow-sm animate-pulse" />
            <div className="h-80 rounded-2xl bg-white shadow-sm animate-pulse" />
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <section className="rounded-3xl bg-slate-900 px-8 py-8 text-white shadow-2xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="mt-4 text-3xl font-bold md:text-4xl">Bảng điều khiển + ML Monitoring</h1>
              <p className="mt-3 max-w-3xl text-sm text-slate-300">
                Trang tổng hợp thống kê hệ thống và theo dõi ML để theo dõi nhanh tình trạng vận hành.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm text-slate-200">
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">API dự đoán</div>
                <div className="mt-1 font-semibold">{apiLatency.predictions} ms</div>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                <div className="text-xs text-slate-400">API trạng thái ML</div>
                <div className="mt-1 font-semibold">{apiLatency.mlStatus} ms</div>
              </div>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-sm text-slate-900">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard icon={<FaUsers />} label="Tổng người dùng" value={stats.users } color="border-gray-900 text-green-600" />
          <StatCard icon={<FaLeaf />} label="Tổng khu vườn" value={stats.gardens} color="border-gray-900 text-green-600" />
          <StatCard icon={<FaVirus />} label="Tổng bệnh cây" value={stats.diseases} color="border-gray-900 text-green-600" />
          <StatCard icon={<FaCamera />} label="Tổng dự đoán" value={stats.predictions} color="border-gray-900 text-green-600" />
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 border-t-gray-900">
            <p className="text-sm font-medium text-slate-500">Độ tin cậy TB</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{formatPercent(dashboard.avgConfidence)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 border-t-gray-700">
            <p className="text-sm font-medium text-slate-500">Low-confidence</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{formatNumber(dashboard.lowConfidenceCount)}</p>
            <p className="mt-2 text-xs text-slate-500">&lt; {LOW_CONFIDENCE_THRESHOLD}%</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 border-t-gray-800">
            <p className="text-sm font-medium text-slate-500">Thời gian xử lý TB</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{Math.round(dashboard.avgProcessingTime)} ms</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm border-t-4 border-t-gray-900">
            <p className="text-sm font-medium text-slate-500">Tổng ảnh huấn luyện</p>
            <p className="mt-2 text-3xl font-bold text-green-600">{formatNumber(totalImagesFromMlStatus || summary.total_images || summary.count || 0)}</p>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-green-600">Số lần dự đoán theo ngày</h2>
                <p className="text-sm text-slate-500">Dựa trên lịch sử dự đoán gần nhất</p>
              </div>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dashboard.byDay}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4">
              <h2 className="text-lg font-bold text-green-600">Phân bố độ tin cậy</h2>
              <p className="text-sm text-slate-500">Tỷ lệ các mức confidence</p>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={dashboard.confidenceBuckets} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                    {dashboard.confidenceBuckets.map((entry, index) => (
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

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-green-600">Phân bố bệnh dự đoán</h2>
                <p className="text-sm text-slate-500">
                  Theo tháng {formatMonthLabel(selectedDiseaseMonth)} • {formatNumber(diseaseDistributionForMonth.total)} lượt dự đoán
                </p>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedDiseaseMonth}
                  onChange={(event) => setSelectedDiseaseMonth(event.target.value)}
                  className="rounded-md border border-slate-300 bg-white px-3 py-1 text-sm text-slate-700"
                >
                  {diseaseMonthOptions.map((month) => (
                    <option key={month.value} value={month.value}>{month.label}</option>
                  ))}
                </select>
              </div>
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

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-green-600">Dataset / Model health</h2>
                <p className="text-sm text-slate-500">Dữ liệu từ /api/ml/status</p>
              </div>
              <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Tổng hợp retrain</div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Tổng ảnh</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(summary.total_images)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Số class</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(summary.total_diseases)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Ảnh gốc</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(summary.original_images)}</div>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="text-xs text-slate-500">Ảnh train thêm</div>
                <div className="mt-1 text-2xl font-bold text-slate-900">{formatNumber(summary.training_images)}</div>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaShieldAlt /> Lần huấn luyện gần nhất</div>
                <div className="mt-2 text-sm text-slate-500">
                  {trainingResults
                    ? `Val Acc: ${formatPercent(trainingResults.val_accuracy * 100)} | Val Loss: ${Number(trainingResults.val_loss || 0).toFixed(4)}`
                    : 'Chưa có báo cáo huấn luyện gần nhất'}
                </div>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaThermometerHalf /> Chỉ số validation</div>
                <div className="mt-2 text-sm text-slate-500">
                  {evaluation
                    ? `F1 weighted: ${formatPercent(evaluation.f1_weighted * 100)} | Recall weighted: ${formatPercent(evaluation.recall_weighted * 100)}`
                    : 'Chưa có đánh giá validation gần nhất'}
                </div>
                <p className="mt-1 text-xs text-slate-400">Dùng để theo dõi trong lúc huấn luyện và chọn model.</p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4 md:col-span-2">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-700"><FaCheck /> Chỉ số test</div>
                <div className="mt-2 text-sm text-slate-500">
                  {testMetrics
                    ? `F1 weighted: ${formatPercent(testMetrics.f1_weighted * 100)} | Recall weighted: ${formatPercent(testMetrics.recall_weighted * 100)} | Precision weighted: ${formatPercent(testMetrics.precision_weighted * 100)}`
                    : 'Chưa có đánh giá test gần nhất'}
                </div>
                <p className="mt-1 text-xs text-slate-400">Đây là kết quả cuối cùng trên dữ liệu chưa dùng để huấn luyện.</p>
              </div>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-green-600">Lịch sử dự đoán gần nhất</h2>
              <p className="text-sm text-slate-500">Danh sách này có thể dùng làm bảng monitoring chính</p>
            </div>
            <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">low confidence: {dashboard.lowConfidenceCount}</div>
          </div>

            <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Thời gian</th>
                  <th className="px-4 py-3 text-left font-semibold">Bệnh</th>
                  <th className="px-4 py-3 text-left font-semibold">Độ tin cậy</th>
                  <th className="px-4 py-3 text-left font-semibold">Xử lý</th>
                  <th className="px-4 py-3 text-left font-semibold">Người dùng</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {dashboard.recentPredictions.length > 0 ? (
                  // paginate recentPredictions (already sorted newest-first)
                  dashboard.recentPredictions
                    .slice((recentPage - 1) * RECENT_PAGE_SIZE, recentPage * RECENT_PAGE_SIZE)
                    .map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-slate-700">{new Date(item.ngay_du_doan).toLocaleString('vi-VN')}</td>
                        <td className="px-4 py-3 font-medium text-slate-900">{item.ket_qua_benh}</td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${Number(item.do_tin_cay || 0) < LOW_CONFIDENCE_THRESHOLD ? 'bg-slate-200 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>
                            {Number(item.do_tin_cay || 0)}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{Number(item.thoi_gian_xu_ly_ms || 0)} ms</td>
                        <td className="px-4 py-3 text-slate-700">{item.user_id?.ho_ten || item.user_id?.email || '-'}</td>
                      </tr>
                    ))
                ) : (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={5}>
                      Chưa có dữ liệu dự đoán để hiển thị.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination controls for recent predictions */}
          {dashboard.recentPredictions.length > RECENT_PAGE_SIZE && (
            <div className="mt-3 flex items-center justify-between">
              <div className="text-sm text-slate-600">Hiển thị {(recentPage - 1) * RECENT_PAGE_SIZE + 1} - {Math.min(recentPage * RECENT_PAGE_SIZE, dashboard.recentPredictions.length)} trên {dashboard.recentPredictions.length}</div>
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 rounded-md border bg-white text-sm"
                  onClick={() => setRecentPage((p) => Math.max(1, p - 1))}
                  disabled={recentPage === 1}
                >
                  Trước
                </button>
                <span className="text-sm text-slate-600">{recentPage} / {Math.ceil(dashboard.recentPredictions.length / RECENT_PAGE_SIZE)}</span>
                <button
                  className="px-3 py-1 rounded-md border bg-white text-sm"
                  onClick={() => setRecentPage((p) => Math.min(Math.ceil(dashboard.recentPredictions.length / RECENT_PAGE_SIZE), p + 1))}
                  disabled={recentPage === Math.ceil(dashboard.recentPredictions.length / RECENT_PAGE_SIZE)}
                >
                  Sau
                </button>
              </div>
            </div>
          )}
        </section>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboardPage;
