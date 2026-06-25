import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaHome, FaCamera, FaFlask, FaLeaf, FaChartBar, FaMicroscope, FaDollarSign,
  FaVirus, FaBolt, FaRedo, FaBrain, FaExclamationTriangle, FaImage, FaClock, FaBell,
  FaClipboardList, FaTrophy, FaList, FaCircle, FaFileAlt, FaEye, FaHourglassHalf
} from 'react-icons/fa';
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
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';
import toast from 'react-hot-toast';

const HomePage = () => {
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const fileInputRef = React.useRef(null);
  const [stats, setStats] = useState({
    gardens: 0,
    predictions: 0,
    expenses: 0,
  });
  const [recentData, setRecentData] = useState({
    logs: [],
    predictions: [],
    diseases: [],
    seasons: [],
  });
  const [allPredictions, setAllPredictions] = useState([]);
  const [allLogs, setAllLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  // Prediction state
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  // garden selection removed for predictions
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [selectedAdvice, setSelectedAdvice] = useState('');
  const [selectedAdviceLoading, setSelectedAdviceLoading] = useState(false);
  const [selectedTopDisease, setSelectedTopDisease] = useState(null);
  const [multiSelectedPreds, setMultiSelectedPreds] = useState([]);

  const CONFIDENCE_THRESHOLD = 80; // 80% trở lên mới hiển thị kết quả chính xác

  useEffect(() => {
    fetchStats();
    fetchNotifications();
  }, []);

  const fetchNotifications = async () => {
    try {
      setNotificationsLoading(true);
      const response = await notificationService.getActiveNotifications();
      setNotifications(response.data || []);
    } catch (error) {
      console.error('❌ Lỗi tải thông báo:', error);
    } finally {
      setNotificationsLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setLoading(true);
      const [gardensRes, predictionsRes, expensesRes, logsRes, seasonsRes] = await Promise.all([
        apiClient.get('/gardens'),
        apiClient.get('/predictions'),
        apiClient.get('/expenses'),
        apiClient.get('/logs'),
        apiClient.get('/seasons'),
      ]);

      const predictions = predictionsRes.data.data || [];
      const logs = logsRes.data.data || [];
      const seasons = seasonsRes.data.data || [];

      const extractId = (value) => {
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' || typeof value === 'number') return String(value);
        if (typeof value === 'object') return String(value._id || value.id || '');
        return '';
      };

      const currentUserId = currentUser?._id ? String(currentUser._id) : '';
      const userPredictions = currentUserId
        ? predictions.filter((prediction) => extractId(prediction.user_id) === currentUserId)
        : predictions;

      const allGardens = gardensRes.data.data || [];
      const userGardens = currentUserId
        ? allGardens.filter((garden) => extractId(garden.user_id) === currentUserId)
        : allGardens;

      const userGardenIds = new Set(
        userGardens.map((garden) => extractId(garden._id)).filter(Boolean)
      );

      // /api/logs đã trả logs theo user hiện tại ở backend, không lọc lại theo userGardens
      const userLogs = logs;

      // Fallback nếu thiếu userGardens metadata
      if (userGardenIds.size === 0) {
        userLogs.forEach((log) => {
          const logGardenId = extractId(log.garden_id);
          if (logGardenId) userGardenIds.add(logGardenId);
        });
      }

      const allExpenses = expensesRes.data.data || [];
      const userExpenses = userGardenIds.size > 0
        ? allExpenses.filter((expense) => userGardenIds.has(extractId(expense.garden_id)))
        : allExpenses;

      // Calculate diseases
      const diseaseCount = {};
      userPredictions.forEach(p => {
        if (p.ket_qua_benh) {
          diseaseCount[p.ket_qua_benh] = (diseaseCount[p.ket_qua_benh] || 0) + 1;
        }
      });

      const diseases = Object.entries(diseaseCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setStats({
        gardens: userGardens.length,
        predictions: userPredictions.length,
        expenses: userExpenses.reduce((sum, e) => sum + (e.so_tien || 0), 0),
      });

      setAllPredictions(userPredictions);
      setAllLogs(userLogs);

      setRecentData({
        logs: userLogs.slice(0, 5),
        predictions: userPredictions.slice(0, 5),
        diseases: diseases.slice(0, 5),
        seasons: seasons.slice(0, 3),
      });
    } catch (error) {
      console.error('❌ Lỗi tải thống kê:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatAIText = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*/g, '')   // bỏ markdown **
      .trim();
  };

  // fetchGardens removed

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handlePredict = async (e) => {
    e.preventDefault();
    if (!image) {
      toast.error('Vui lòng chọn ảnh');
      return;
    }
    try {
      setPredicting(true);
      const formData = new FormData();
      formData.append('image', image);
      // garden_id removed from prediction

      const res = await apiClient.post('/predictions/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('✓ Prediction result:', res.data.data);
      setPredictionResult(res.data.data);
      setSelectedAdvice('');
      setSelectedTopDisease(null);
      toast.success('Dự đoán thành công');
    } catch (error) {
      console.error('Lỗi dự đoán:', error);
      toast.error(error.response?.data?.message || 'Dự đoán thất bại');
    } finally {
      setPredicting(false);
    }
  };

  const getGradCamUrl = (gradCamPath) => {
    if (!gradCamPath) return '';
    if (gradCamPath.startsWith('http')) return gradCamPath;
    return `http://localhost:5000${gradCamPath}`;
  };

  const getConfidencePercent = (confidence) => {
    if (confidence === null || confidence === undefined) return 0;
    const numeric = Number(confidence) || 0;
    return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
  };

  const selectedAdviceTitle = selectedTopDisease?.ten_benh
    || (multiSelectedPreds.length > 0 ? 'Nhiều bệnh đã chọn' : 'Bệnh đã chọn');

  const chartData = useMemo(() => {
    const byDayMap = new Map();
    const byDiseaseMap = new Map();
    const activityByGardenMap = new Map();
    const confidenceBuckets = [
      { name: '0-39%', value: 0 },
      { name: '40-59%', value: 0 },
      { name: '60-79%', value: 0 },
      { name: '80-100%', value: 0 },
    ];

    allPredictions.forEach((prediction) => {
      // Use ISO date as key for correct chronological sorting, and keep a display string
      const isoKey = prediction.ngay_du_doan ? new Date(prediction.ngay_du_doan).toISOString().slice(0, 10) : 'N/A';
      const display = prediction.ngay_du_doan ? new Date(prediction.ngay_du_doan).toLocaleDateString('vi-VN') : 'N/A';
      const existing = byDayMap.get(isoKey) || { date: display, count: 0 };
      existing.count += 1;
      byDayMap.set(isoKey, existing);

      const diseaseKey = prediction.ket_qua_benh || 'Không xác định';
      byDiseaseMap.set(diseaseKey, (byDiseaseMap.get(diseaseKey) || 0) + 1);

      const confidence = getConfidencePercent(prediction.do_tin_cay);
      if (confidence < 40) confidenceBuckets[0].value += 1;
      else if (confidence < 60) confidenceBuckets[1].value += 1;
      else if (confidence < 80) confidenceBuckets[2].value += 1;
      else confidenceBuckets[3].value += 1;
    });

    allLogs.forEach((log) => {
      const gardenName = log?.garden_id?.ten_vuon || 'Chưa gắn vườn';
      activityByGardenMap.set(gardenName, (activityByGardenMap.get(gardenName) || 0) + 1);
    });

    return {
      // Sort days ascending (oldest -> newest) for left-to-right chart axis
      byDay: Array.from(byDayMap.entries())
        .map(([iso, obj]) => ({ iso, date: obj.date, count: obj.count }))
        .sort((a, b) => a.iso.localeCompare(b.iso))
        .map(({ date, count }) => ({ date, count })),
      byDisease: Array.from(byDiseaseMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
      activityByGarden: Array.from(activityByGardenMap.entries())
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 6),
      confidenceBuckets,
    };
  }, [allPredictions, allLogs]);

  const chartColors = ['#ef4444', '#f97316', '#eab308', '#22c55e'];

  const handleSelectTopDisease = async (pred) => {
    try {
      setSelectedTopDisease(pred);
      setSelectedAdviceLoading(true);
      setSelectedAdvice('');

      const response = await apiClient.post('/predictions/advice', {
        disease_en: pred.ten_benh_en,
        confidence: pred.confidence,
      });

      setSelectedAdvice(response.data?.data?.advice || '');
    } catch (error) {
      console.error('Lỗi lấy tư vấn AI:', error);
      toast.error(error.response?.data?.message || 'Không thể tạo tư vấn AI');
    } finally {
      setSelectedAdviceLoading(false);
    }
  };

  return (
    <UserLayout>
      <div>
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900">Trang chủ</h1>
          <p className="text-gray-600 mt-2">Chào mừng trở lại - Hôm nay bạn có gì mới?</p>
        </div>

        {/* Alerts */}
        <div className="mb-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Most Common Disease Alert */}
            <div className="bg-red-50 rounded-xl shadow-md p-6 border-l-4 border-red-500">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FaVirus className="text-red-600" /> Bệnh phổ biến nhất
              </h3>
              {recentData.diseases.length > 0 ? (
                <div>
                  <p className="text-2xl font-bold text-red-600 mb-2">{recentData.diseases[0].name}</p>
                  <p className="text-sm text-gray-700">
                    Đã phát hiện <span className="font-bold">{recentData.diseases[0].count}</span> trường hợp.
                    Hãy để ý các vườn của bạn!
                  </p>
                </div>
              ) : (
                <p className="text-gray-500">Chưa có dữ liệu</p>
              )}
            </div>

            {/* High Expenses Alert */}
            <div className="bg-orange-50 rounded-xl shadow-md p-6 border-l-4 border-orange-500">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FaDollarSign className="text-orange-600" /> Chi phí
              </h3>
              <p className="text-2xl font-bold text-orange-600 mb-2">
                {(stats.expenses / 1000000).toFixed(2)}M ₫
              </p>
              <p className="text-sm text-gray-700">
                Tổng chi phí của bạn. Kiểm tra danh sách chi phí để tối ưu hóa.
              </p>
            </div>

            {/* Garden Count Alert */}
            <div className="bg-green-50 rounded-xl shadow-md p-6 border-l-4 border-green-500">
              <h3 className="font-bold text-gray-900 mb-2 flex items-center gap-2">
                <FaLeaf className="text-green-600" /> Số vườn
              </h3>
              <p className="text-2xl font-bold text-green-600 mb-2">{stats.gardens} vườn</p>
              <p className="text-sm text-gray-700">
                {stats.gardens === 0 
                  ? 'Bắt đầu bằng cách thêm vườn đầu tiên' 
                  : 'Bạn đang quản lý ' + stats.gardens + ' vườn'}
              </p>
            </div>
          </div>
        </div>

        {/* Prediction Section */}
        <div className="space-y-6 mb-8">
          <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6 md:p-8">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-600 mb-2">Dự đoán AI</p>
                <h2 className="text-3xl font-bold text-green-600 flex items-center gap-3">
                  <FaMicroscope className="text-green-600" /> Dự đoán bệnh
                </h2>
                <p className="text-sm text-gray-500 mt-2">
                  Tải ảnh lá cây lên để hệ thống phân tích và trả kết quả dự đoán.
                </p>
              </div>
              <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 self-start md:self-auto">
                Tải ảnh và xem kết quả ngay
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                <form onSubmit={handlePredict} className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Tải ảnh lá cây</label>
                    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center cursor-pointer hover:border-green-500 transition bg-gray-50/60">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="hidden"
                        id="image-input"
                      />
                      <label htmlFor="image-input" className="cursor-pointer block">
                        {preview ? (
                          <div>
                            <img src={preview} alt="preview" className="w-32 h-32 object-cover mx-auto rounded-lg mb-3 shadow-sm" />
                            <p className="text-green-600 font-semibold">Đã chọn ảnh</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-2xl mb-2"><FaImage className="mx-auto text-gray-500" /></p>
                            <p className="text-gray-700 font-semibold">Chọn hoặc kéo ảnh vào đây</p>
                            <p className="text-gray-500 text-sm mt-1">PNG, JPG, GIF up to 5MB</p>
                          </div>
                        )}
                      </label>
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={predicting || !image}
                    className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400 flex items-center justify-center gap-2"
                  >
                    {predicting ? (<><FaHourglassHalf className="animate-spin" /> Đang dự đoán...</>) : (<><FaMicroscope /> Dự đoán ngay</>)}
                  </button>
                </form>

                <div className="mt-5 bg-green-50 rounded-xl shadow-sm p-5 border border-green-200">
                  <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                    <FaFlask className="text-green-600" /> Mẹo chụp ảnh
                  </h3>
                  <p className="text-gray-700 leading-relaxed">
                    Hãy chụp lá bệnh rõ nét, đủ sáng và lấy gần vùng tổn thương để kết quả dự đoán chính xác hơn.
                  </p>
                </div>

                {getGradCamUrl(predictionResult?.grad_cam_path || predictionResult?.grad_cam?.overlay_path) && (
                      <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <FaEye className="text-red-600" /> Grad-CAM - Vùng ảnh quan trọng
                        </h4>
                        <img
                          src={getGradCamUrl(predictionResult?.grad_cam_path || predictionResult?.grad_cam?.overlay_path)}
                          alt="Grad-CAM overlay"
                          className="w-full rounded-lg border border-gray-200 object-contain bg-gray-50"
                        />
                      </div>
                    )}
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                {predictionResult ? (
                  <div className="space-y-6">
                    {getConfidencePercent(predictionResult.confidence) < CONFIDENCE_THRESHOLD ? (
                      <div className="rounded-xl border border-red-200 bg-gradient-to-br from-red-50 to-white p-5 shadow-sm">
                        <div className="flex items-start gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 text-red-600">
                            <FaExclamationTriangle />
                          </div>

                          <div className="space-y-2">
                            <p className="font-semibold text-red-700 text-base">
                              Kết quả chưa đủ độ tin cậy
                            </p>

                            <p className="text-sm text-gray-700 leading-relaxed text-justify">
                              Hệ thống chưa thể xác định chính xác bệnh từ ảnh này. Nguyên nhân có thể đến từ chất lượng ảnh 
                              (mờ, thiếu sáng, góc chụp chưa phù hợp) hoặc trường hợp bệnh chưa nằm trong tập dữ liệu huấn luyện.
                            </p>

                            <ul className="text-sm text-gray-700 list-disc pl-5 space-y-1 text-justify">
                              <li>Ảnh chưa rõ vùng lá bị bệnh</li>
                              <li>Điều kiện ánh sáng không ổn định</li>
                              <li>Bệnh hiếm hoặc chưa có trong hệ thống</li>
                            </ul>

                            <p className="text-sm text-gray-700 italic text-justify">
                              👉 Khuyến nghị: thử lại với ảnh rõ nét hơn hoặc tham khảo chuyên gia nông nghiệp.
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                        <p className="text-gray-600 text-sm flex items-center gap-2">
                          <FaTrophy className="text-yellow-500" /> Bệnh chính xác suất cao
                        </p>
                        <p className="text-2xl font-bold text-gray-900 mt-1">
                          {predictionResult.main_disease}
                        </p>

                        <div className="mt-3 flex items-center gap-2">
                          <div className="flex-1 bg-gray-300 rounded-full h-2 overflow-hidden">
                            <div
                              className="bg-green-600 h-2 rounded-full transition-all"
                              style={{ width: `${getConfidencePercent(predictionResult.confidence)}%` }}
                            />
                          </div>
                          <p className="text-lg font-bold text-green-600 min-w-fit">
                            {getConfidencePercent(predictionResult.confidence)}%
                          </p>
                        </div>
                      </div>
                    )}

                    {getConfidencePercent(predictionResult.confidence) >= CONFIDENCE_THRESHOLD && predictionResult.top_3 && (
                      <div>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <FaList className="text-blue-600" /> Top 3 bệnh khả năng
                        </h4>
                        <p className="mb-3 text-sm text-gray-600">
                          Chọn 1 bệnh bên dưới để AI tư vấn đúng theo kết quả bạn muốn xem.
                        </p>
                        <div className="space-y-2">
                          {predictionResult.top_3.map((pred, idx) => {
                            const checked = multiSelectedPreds.includes(pred.ten_benh_en);
                            return (
                              <div key={idx} className={`w-full rounded-lg p-3 flex justify-between items-center transition text-left ${selectedTopDisease?.ten_benh_en === pred.ten_benh_en ? 'bg-green-100 border border-green-300' : 'bg-gray-100 hover:bg-gray-200'}`}>
                                <div className="flex items-center gap-3">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    disabled={!!selectedAdvice || selectedAdviceLoading}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => {
                                      e.stopPropagation();
                                      const next = e.target.checked
                                        ? Array.from(new Set([...multiSelectedPreds, pred.ten_benh_en]))
                                        : multiSelectedPreds.filter(x => x !== pred.ten_benh_en);
                                      setMultiSelectedPreds(next);
                                    }}
                                  />
                                  <div>
                                    <p className="font-semibold text-gray-900">#{idx + 1} {pred.ten_benh}</p>
                                    <p className="text-sm text-gray-600">{pred.ten_benh_en}</p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-lg font-bold text-blue-600">
                                    {Math.round(pred.confidence * 100)}%
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      {!selectedAdvice && (
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            type="button"
                            disabled={multiSelectedPreds.length === 0 || selectedAdviceLoading}
                            onClick={async () => {
                              try {
                                setSelectedAdviceLoading(true);
                                setSelectedAdvice('');

                                const payload = predictionResult.top_3
                                  .filter(p => multiSelectedPreds.includes(p.ten_benh_en))
                                  .map(p => ({ disease_en: p.ten_benh_en, confidence: p.confidence }));

                                const res = await apiClient.post('/predictions/advice-multi', { predictions: payload });
                                setSelectedAdvice(res.data?.data?.advice || '');
                                setSelectedTopDisease(null);
                              } catch (err) {
                                console.error('Lỗi lấy tư vấn nhiều bệnh:', err);
                                toast.error(err.response?.data?.message || 'Không thể lấy tư vấn AI');
                              } finally {
                                setSelectedAdviceLoading(false);
                              }
                            }}
                            className={`px-4 py-2 rounded-lg bg-purple-600 text-white ${multiSelectedPreds.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-purple-700'}`}
                          >
                            Gửi để tư vấn cho {multiSelectedPreds.length} bệnh đã chọn
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setMultiSelectedPreds([]);
                              setSelectedAdvice('');
                            }}
                            className="px-3 py-2 rounded-lg bg-gray-100 hover:bg-gray-200"
                          >
                            Bỏ chọn
                          </button>
                        </div>
                      )}
                      </div>
                    )}

                    {getConfidencePercent(predictionResult.confidence) >= CONFIDENCE_THRESHOLD &&
                    (selectedAdviceLoading || selectedAdvice || selectedTopDisease) && (
                      <div className={`rounded-xl p-5 border-l-4 ${selectedAdviceLoading ? 'bg-purple-100 border-purple-500' : 'bg-purple-50 border-purple-500'}`}>
                        <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                          <FaBrain className="text-purple-600" /> Tư vấn AI từ Gemini
                        </h4>
                        {selectedAdviceLoading ? (
                          <p className="text-sm text-gray-600">Đang tư vấn AI...</p>
                        ) : selectedAdvice ? (
                          <div className="space-y-2">
                            <p className="text-sm font-semibold text-gray-800">
                              Tư vấn cho: {selectedAdviceTitle}
                            </p>
                            <p className="text-sm text-gray-800 whitespace-pre-wrap text-justify">
                              {formatAIText(selectedAdvice)}
                            </p>
                          </div>
                        ) : selectedTopDisease ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-purple-200 text-purple-700">
                                <FaHourglassHalf className="animate-spin" />
                              </div>
                              <div>
                                <p className="text-sm font-semibold text-gray-800">Đang phân tích bệnh đã chọn...</p>
                                <p className="text-xs text-gray-600">AI đang tạo tư vấn cho {selectedTopDisease.ten_benh}</p>
                              </div>
                            </div>
                            <div className="space-y-2 rounded-lg bg-white/70 p-3 border border-purple-100">
                              <div className="h-3 w-3/4 animate-pulse rounded-full bg-purple-200" />
                              <div className="h-3 w-5/6 animate-pulse rounded-full bg-purple-200" />
                              <div className="h-3 w-2/3 animate-pulse rounded-full bg-purple-200" />
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600">Chọn một bệnh hoặc nhiều bệnh để nhận tư vấn AI.</p>
                        )}
                      </div>
                    )}

                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setPredictionResult(null);
                          setImage(null);
                          setPreview(null);
                          setSelectedAdvice('');
                          setSelectedTopDisease(null);
                          setSelectedAdviceLoading(false);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = '';
                          }
                        }}
                        className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition font-semibold flex items-center justify-center gap-2"
                      >
                        <FaRedo /> Dự đoán lại
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center text-gray-500 py-12">
                    <p className="text-4xl mb-4"><FaChartBar className="mx-auto" /></p>
                    <p className="font-semibold">Kết quả dự đoán sẽ hiển thị ở đây</p>
                    <p className="text-sm mt-2">Upload ảnh lá cây bên trái để bắt đầu</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Charts */}
        <div className="mb-8 space-y-6">
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Tổng quan dự đoán theo ngày</h2>
                  <p className="text-sm text-gray-500">Số lượt dự đoán gần đây của hệ thống</p>
                </div>
                <div className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">Live</div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData.byDay}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="date" tick={{ fill: '#475569', fontSize: 12 }} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#2563eb" strokeWidth={3} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Tỷ lệ confidence</h2>
                  <p className="text-sm text-gray-500">Phân bố độ tin cậy của các dự đoán</p>
                </div>
                <div className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">Donut</div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={chartData.confidenceBuckets} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95} paddingAngle={3}>
                      {chartData.confidenceBuckets.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Phân bố bệnh phổ biến</h2>
                  <p className="text-sm text-gray-500">Top bệnh được dự đoán nhiều nhất</p>
                </div>
                <div className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">Top 6</div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.byDisease}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#16a34a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-6">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-gray-900">Hoạt động theo vườn</h2>
                  <p className="text-sm text-gray-500">Số nhật ký canh tác theo từng vườn</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Top 6</div>
              </div>
              <div className="h-72 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData.activityByGarden}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                    <XAxis dataKey="name" tick={{ fill: '#475569', fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={60} />
                    <YAxis tick={{ fill: '#475569', fontSize: 12 }} />
                    <Tooltip />
                    <Bar dataKey="value" fill="#0f172a" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Activities */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2"><FaClipboardList className="text-indigo-600" /> Hoạt động gần đây</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Recent Logs */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><FaFileAlt className="text-purple-500" /> Nhật ký gần đây</h3>
              {recentData.logs.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Chưa có nhật ký</p>
              ) : (
                <div className="space-y-3">
                  {recentData.logs.map((log, idx) => (
                    <div key={idx} className="border-l-4 border-purple-500 pl-3 py-2">
                      <p className="font-semibold text-gray-900 text-sm">{log.task_id?.ten_cong_viec || 'N/A'}</p>
                      <p className="text-xs text-gray-500">{log.garden_id?.ten_vuon || 'N/A'}</p>
                      <p className="text-xs text-gray-400 flex items-center gap-1"><FaClock className="text-xs" /> {new Date(log.ngay_lam).toLocaleDateString('vi-VN')}</p>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/user/logs" className="text-purple-600 hover:text-purple-700 font-semibold text-sm mt-4 block">
                Xem tất cả →
              </Link>
            </div>

            {/* Recent Predictions */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><FaMicroscope className="text-blue-500" /> Dự đoán gần đây</h3>
              {recentData.predictions.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Chưa có dự đoán</p>
              ) : (
                <div className="space-y-3">
                  {recentData.predictions.map((pred, idx) => (
                    <div key={idx} className="border-l-4 border-blue-500 pl-3 py-2">
                      <p className="font-semibold text-gray-900 text-sm">{pred.ket_qua_benh}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-green-600">{getConfidencePercent(pred.do_tin_cay)}%</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-green-600 h-1"
                            style={{ width: `${Math.min(getConfidencePercent(pred.do_tin_cay), 100)}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Link to="/user/predict" className="text-blue-600 hover:text-blue-700 font-semibold text-sm mt-4 block">
                Xem tất cả →
              </Link>
            </div>

            {/* Top Diseases */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2"><FaVirus className="text-red-500" /> Bệnh phổ biến</h3>
              {recentData.diseases.length === 0 ? (
                <p className="text-gray-500 text-center py-4">Chưa có dử liệu</p>
              ) : (
                <div className="space-y-3">
                  {recentData.diseases.map((disease, idx) => (
                    <div key={idx} className="border-l-4 border-red-500 pl-3 py-2">
                      <p className="font-semibold text-gray-900 text-sm">{disease.name}</p>
                      <p className="text-xs text-red-600 font-bold flex items-center gap-1"><FaCircle className="text-xs" /> {disease.count} lần</p>
                      <div className="flex-1 bg-gray-200 rounded-full h-1 mt-1 overflow-hidden">
                        <div
                          className="bg-red-600 h-1"
                          style={{ width: `${(disease.count / recentData.diseases[0].count) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>        
      </div>
    </UserLayout>
  );
};

export default HomePage;
