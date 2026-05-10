import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FaHome, FaCamera, FaFlask, FaLeaf, FaChartBar, FaMicroscope, FaDollarSign,
  FaVirus, FaBolt, FaRedo, FaBrain, FaExclamationTriangle, FaImage, FaClock,
  FaClipboardList, FaTrophy, FaList, FaCircle, FaPlus, FaFileAlt
} from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const HomePage = () => {
  const navigate = useNavigate();
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
  const [loading, setLoading] = useState(true);

  // Prediction state
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [gardens, setGardens] = useState([]);
  const [selectedGarden, setSelectedGarden] = useState('');
  const [predicting, setPredicting] = useState(false);
  const [predictionResult, setPredictionResult] = useState(null);
  const [showAdvice, setShowAdvice] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchGardens();
  }, []);

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

      // Calculate diseases
      const diseaseCount = {};
      predictions.forEach(p => {
        if (p.ket_qua_benh) {
          diseaseCount[p.ket_qua_benh] = (diseaseCount[p.ket_qua_benh] || 0) + 1;
        }
      });

      const diseases = Object.entries(diseaseCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count);

      setStats({
        gardens: gardensRes.data.data?.length || 0,
        predictions: predictions.length,
        expenses: expensesRes.data.data?.reduce((sum, e) => sum + (e.so_tien || 0), 0) || 0,
      });

      setRecentData({
        logs: logs.slice(0, 5),
        predictions: predictions.slice(0, 5),
        diseases: diseases.slice(0, 5),
        seasons: seasons.slice(0, 3),
      });
    } catch (error) {
      console.error('❌ Lỗi tải thống kê:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchGardens = async () => {
    try {
      const res = await apiClient.get('/gardens');
      setGardens(res.data.data || []);
      if (res.data.data?.length > 0) {
        setSelectedGarden(res.data.data[0]._id);
      }
    } catch (error) {
      console.error('❌ Lỗi tải vườn:', error);
    }
  };

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
    if (!selectedGarden) {
      toast.error('Vui lòng chọn vườn');
      return;
    }

    try {
      setPredicting(true);
      const formData = new FormData();
      formData.append('image', image);
      formData.append('garden_id', selectedGarden);

      const res = await apiClient.post('/predictions/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('✓ Prediction result:', res.data.data);
      setPredictionResult(res.data.data);
      toast.success('Dự đoán thành công');
    } catch (error) {
      console.error('❌ Lỗi dự đoán:', error);
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
                {(stats.expenses / 1000000).toFixed(1)}M ₫
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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Upload Form */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2"><FaMicroscope className="text-green-600" /> Dự đoán bệnh</h2>
            <form onSubmit={handlePredict} className="space-y-4">
              {/* Garden Select */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Chọn vườn
                </label>
                <select
                  value={selectedGarden}
                  onChange={(e) => setSelectedGarden(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  disabled={gardens.length === 0}
                >
                  <option value="">-- Chọn vườn --</option>
                  {gardens.map((g) => (
                    <option key={g._id} value={g._id}>
                      {g.ten_vuon}
                    </option>
                  ))}
                </select>
                {gardens.length === 0 && (
                  <p className="text-sm text-orange-500 mt-2 flex items-center gap-2">
                    <FaExclamationTriangle /> Vui lòng <Link to="/user/gardens/new" className="underline font-semibold">thêm vườn</Link> trước
                  </p>
                )}
              </div>

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Tải ảnh lá cây
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 transition">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="hidden"
                    id="image-input"
                  />
                  <label htmlFor="image-input" className="cursor-pointer">
                    {preview ? (
                      <div>
                        <img src={preview} alt="preview" className="w-32 h-32 object-cover mx-auto rounded-lg mb-2" />
                        <p className="text-green-600 font-semibold">Đã chọn ảnh</p>
                      </div>
                    ) : (
                      <div>
                        <p className="text-2xl mb-2"><FaImage className="mx-auto" /></p>
                        <p className="text-gray-700 font-semibold">Chọn hoặc kéo ảnh vào đây</p>
                        <p className="text-gray-500 text-sm">PNG, JPG, GIF up to 5MB</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={predicting || !selectedGarden || gardens.length === 0}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {predicting ? (<><FaMicroscope /> Đang dự đoán...</>) : (<><FaMicroscope /> Dự đoán ngay</>)}
              </button>
              <div className="bg-green-50 rounded-xl shadow-md p-6 border-2 border-green-200">
                <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2"><FaFlask className="text-green-600" /> Mẹo</h3>
                <p className="text-gray-700">
                  Hãy sử dụng dự đoán AI để phát hiện sớm bệnh cho cây trồng. Chụp ảnh rõ nét những lá bị bệnh để có kết quả chính xác nhất.
                </p>
              </div>
            </form>
          </div>

          {/* Result Display */}
          <div className="bg-white rounded-xl shadow-md p-6">
            {predictionResult ? (
              <div className="space-y-6">
                <h3 className="text-2xl font-bold text-gray-900">Kết quả dự đoán</h3>

                {/* Top Result */}
                <div className="bg-gradient-to-r from-green-50 to-green-100 rounded-xl p-5 border-2 border-green-300">
                  <p className="text-gray-600 text-sm mb-1 flex items-center gap-2"><FaTrophy className="text-yellow-500" /> Bệnh chính xác suất cao</p>
                  <p className="text-3xl font-bold text-gray-900">{predictionResult.main_disease}</p>
                  <div className="mt-3 flex items-center gap-2">
                    <div className="flex-1 bg-gray-300 rounded-full h-2">
                      <div
                        className="bg-green-600 h-2 rounded-full transition-all"
                        style={{ width: `${Math.round(predictionResult.confidence * 100)}%` }}
                      />
                    </div>
                    <p className="text-lg font-bold text-green-600 min-w-fit">
                      {Math.round(predictionResult.confidence * 100)}%
                    </p>
                  </div>
                </div>

                {/* Top 3 Predictions */}
                {predictionResult.top_3 && (
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FaList className="text-blue-600" /> Top 3 bệnh khả năng</h4>
                    <div className="space-y-2">
                      {predictionResult.top_3.map((pred, idx) => (
                        <div
                          key={idx}
                          className="bg-gray-100 rounded-lg p-3 flex justify-between items-center hover:bg-gray-150 transition"
                        >
                          <div>
                            <p className="font-semibold text-gray-900">
                              #{idx + 1} {pred.ten_benh}
                            </p>
                            <p className="text-sm text-gray-600">{pred.ten_benh_en}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-bold text-blue-600">
                              {Math.round(pred.confidence * 100)}%
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* AI Advice */}
                {predictionResult?.advice && (
                  <div className="bg-blue-50 rounded-xl p-5 border-2 border-blue-300">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FaBrain className="text-blue-600" /> Tư vấn AI từ Gemini</h4>
                    <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{predictionResult.advice}</p>
                  </div>
                )}

                {/* Grad-CAM */}
                {getGradCamUrl(predictionResult.grad_cam_path || predictionResult.grad_cam?.overlay_path) && (
                  <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                      <FaEye className="text-red-600" /> Grad-CAM - Vùng ảnh quan trọng
                    </h4>
                    <img
                      src={getGradCamUrl(predictionResult.grad_cam_path || predictionResult.grad_cam?.overlay_path)}
                      alt="Grad-CAM overlay"
                      className="w-full rounded-lg border border-gray-200 object-contain bg-gray-50"
                    />
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setPredictionResult(null);
                      setImage(null);
                      setPreview(null);
                      setShowAdvice(false);
                      // Reset file input
                      if (fileInputRef.current) {
                        fileInputRef.current.value = '';
                      }
                    }}
                    className="flex-1 bg-gray-600 text-white py-2 rounded-lg hover:bg-gray-700 transition font-semibold flex items-center justify-center gap-2"
                  >
                    <FaRedo /> Dự đoán lại
                  </button>
                  {predictionResult?.advice && (
                    <button
                      onClick={() => {
                        // Scroll to advice section
                        document.querySelector('.bg-blue-50')?.scrollIntoView({ behavior: 'smooth' });
                      }}
                      className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition font-semibold flex items-center justify-center gap-2"
                    >
                      <FaBrain /> Xem tư vấn AI
                    </button>
                  )}
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

        {/* Quick Actions */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2"><FaBolt className="text-yellow-500" /> Hành động nhanh</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link
              to="/user/gardens/new"
              className="bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl p-6 shadow-md hover:shadow-lg hover:from-green-600 hover:to-green-700 transition text-center font-semibold flex items-center justify-center min-h-20 gap-2"
            >
              <FaPlus className="text-lg" /> Thêm vườn
            </Link>
            <Link
              to="/user/logs/new"
              className="bg-gradient-to-r from-purple-500 to-purple-600 text-white rounded-xl p-6 shadow-md hover:shadow-lg hover:from-purple-600 hover:to-purple-700 transition text-center font-semibold flex items-center justify-center min-h-20 gap-2"
            >
              <FaPlus className="text-lg" /> Thêm nhật ký
            </Link>
            <Link
              to="/user/expenses/new"
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl p-6 shadow-md hover:shadow-lg hover:from-orange-600 hover:to-orange-700 transition text-center font-semibold flex items-center justify-center min-h-20 gap-2"
            >
              <FaDollarSign className="text-lg" /> Ghi chi phí
            </Link>
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
                      <p className="text-xs text-gray-500">{pred.garden_id?.ten_vuon || 'N/A'}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs font-bold text-green-600">{Math.round((pred.do_tin_cay || 0))}%</span>
                        <div className="flex-1 bg-gray-200 rounded-full h-1 overflow-hidden">
                          <div
                            className="bg-green-600 h-1"
                            style={{ width: `${Math.min(pred.do_tin_cay || 0, 100)}%` }}
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
