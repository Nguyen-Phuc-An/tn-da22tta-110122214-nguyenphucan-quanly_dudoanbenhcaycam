import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  FaImage, FaCamera, FaFlask, FaCheck, FaEye, FaTimes, 
  FaMicroscope, FaTrophy, FaList, FaBrain, FaChartBar, 
  FaHourglassHalf, FaExclamationTriangle, FaInfoCircle 
} from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const PredictPage = () => {
  const navigate = useNavigate();
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  // gardens removed from prediction; predictions tied to user only
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [selectedAdvice, setSelectedAdvice] = useState('');
  const [selectedAdviceLoading, setSelectedAdviceLoading] = useState(false);
  const [selectedTopDisease, setSelectedTopDisease] = useState(null);
  const [predictions, setPredictions] = useState([]);
  const [selectedPrediction, setSelectedPrediction] = useState(null);
  const [multiSelectedPreds, setMultiSelectedPreds] = useState([]); // array of ten_benh_en
  const [currentPage, setCurrentPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const CONFIDENCE_THRESHOLD = 80;

  useEffect(() => {
    fetchPredictions();
  }, []);

  // fetchGardens removed

  const fetchPredictions = async () => {
    try {
      const res = await apiClient.get('/predictions');
      console.log('✓ Predictions loaded:', res.data.data?.length || 0);
      setPredictions(res.data.data || []);
    } catch (error) {
      console.error('❌ Lỗi tải lịch sử dự đoán:', error);
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
    // No garden required anymore

    try {
      setLoading(true);
      const formData = new FormData();
      formData.append('image', image);
      // garden_id removed from prediction payload

      const res = await apiClient.post('/predictions/predict', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      console.log('✓ Prediction result:', res.data.data);
      setResult(res.data.data);
      setSelectedAdvice('');
      setSelectedTopDisease(null);
      toast.success('Dự đoán thành công');
      // Refresh predictions list
      fetchPredictions();
    } catch (error) {
      console.error('Lỗi dự đoán:', error);
      toast.error(error.response?.data?.message || 'Dự đoán thất bại');
    } finally {
      setLoading(false);
    }
  };

  // Helper function to normalize confidence to 0-100 range
  const getConfidencePercent = (confidence) => {
    if (!confidence && confidence !== 0) return 0;
    let conf = Number(confidence) || 0;
    // If confidence is between 0 and 1, multiply by 100 (it's in decimal form)
    if (conf <= 1) return Math.round(conf * 100);
    // If confidence is greater than 100, assume it's 0-10000 scale, divide by 100
    if (conf > 100) return Math.round(conf / 100);
    // Otherwise, it's already 0-100
    return Math.round(conf);
  };

  const gradCamPath = result?.grad_cam_path || result?.grad_cam?.overlay_path;

  // Helper function to format date safely
  const formatDate = (dateString) => {
    try {
      if (!dateString) return 'N/A';
      // Try multiple possible field names
      const actualDate = new Date(dateString);
      if (isNaN(actualDate.getTime())) return 'N/A';
      return actualDate.toLocaleDateString('vi-VN');
    } catch (e) {
      console.error('Date parse error:', dateString, e);
      return 'N/A';
    }
  };

  const formatDateTime = (dateString) => {
    try {
      if (!dateString) return 'N/A';
      const actualDate = new Date(dateString);
      if (isNaN(actualDate.getTime())) return 'N/A';
      return actualDate.toLocaleString('vi-VN');
    } catch (e) {
      console.error('DateTime parse error:', dateString, e);
      return 'N/A';
    }
  };

  const getGradCamUrl = (gradCamPath) => {
    if (!gradCamPath) return '';
    if (gradCamPath.startsWith('http')) return gradCamPath;
    return `http://localhost:5000${gradCamPath}`;
  };
  
  const formatAIText = (text) => {
    if (!text) return '';
    return text
      .replace(/\*\*/g, '')   // bỏ markdown **
      .trim();
  };

  // Pagination logic
  const totalPages = Math.ceil(predictions.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const paginatedPredictions = predictions.slice(startIndex, endIndex);

  const handlePageChange = (page) => {
    setCurrentPage(page);
    setSelectedPrediction(null);
  };

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
        <h1 className="text-3xl font-bold text-green-600 mb-8 flex items-center gap-2">
          <FaFlask /> Dự đoán bệnh
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Form */}
          <div className="bg-white rounded-xl shadow-md p-6">
            <form onSubmit={handlePredict} className="space-y-4">
              {/* Garden removed from prediction form */}

              {/* Image Upload */}
              <div>
                <label className="block text-sm font-semibold text-green-600 mb-2">
                  Tải ảnh lá cây
                </label>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-green-500 transition">
                  <input
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
                        <p className="text-2xl text-green-600 mb-2"><FaImage className="mx-auto" /></p>
                        <p className="text-green-600 font-semibold">Chọn hoặc kéo ảnh vào đây</p>
                      </div>
                    )}
                  </label>
                </div>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-green-600 text-white py-3 rounded-lg hover:bg-green-700 transition font-semibold disabled:bg-gray-400 flex items-center justify-center gap-2"
              >
                {loading ? (<><FaHourglassHalf className="animate-spin" /> Đang dự đoán...</>) : (<><FaMicroscope /> Dự đoán</>)}
              </button>

              {/* Grad-CAM */}
                {getGradCamUrl(gradCamPath) ? (
                  <div className="bg-white rounded-lg p-4 border border-gray-200 shadow-sm">
                    <p className="text-gray-600 text-sm font-semibold mb-3 flex items-center gap-2">
                      <FaEye className="text-red-600" /> Grad-CAM - Vùng ảnh quan trọng
                    </p>
                    <img
                      src={getGradCamUrl(gradCamPath)}
                      alt="Grad-CAM overlay"
                      className="w-full rounded-lg border border-gray-200 object-contain bg-gray-50"
                    />
                  </div>
                ) : (
                  <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                    <p className="text-gray-600 text-sm font-semibold mb-1 flex items-center gap-2">
                      <FaEye className="text-gray-500" /> Grad-CAM
                    </p>
                    <p className="text-sm text-gray-600">
                      Hãy dự đoán bệnh để xem Grad-CAM.
                    </p>
                  </div>
                )}
            </form>
          </div>

          {/* Result */}
          <div className="bg-white rounded-xl shadow-md p-6">
            {result ? (
              <div className="space-y-6">
                {/* Top Result OR Low Confidence Warning */}
                {getConfidencePercent(result.confidence) < CONFIDENCE_THRESHOLD ? (
                  <div className="bg-red-50 border border-red-200 rounded-xl p-5 shadow-sm space-y-4">
                    {/* Header */}
                    <div className="flex items-start gap-3">
                      <div className="bg-red-100 text-red-600 p-2 rounded-full">
                        <FaExclamationTriangle />
                      </div>
                      <div>
                        <p className="font-semibold text-red-700 text-base">
                          Kết quả không đủ độ tin cậy
                        </p>
                        <p className="text-xs text-red-500">
                          Confidence dưới ngưỡng hệ thống yêu cầu
                        </p>
                      </div>
                    </div>

                    {/* Nội dung */}
                    <div className="text-sm text-gray-700 leading-relaxed space-y-2">
                      <p>
                        Mô hình học máy không thể <span className="font-semibold">trích xuất đặc trưng hình ảnh</span> một cách rõ ràng
                        từ dữ liệu đầu vào.
                      </p>

                      <ul className="list-disc pl-5 space-y-1 text-gray-600">
                        <li>Ảnh đầu vào bị mờ, nhiễu hoặc điều kiện ánh sáng chưa phù hợp</li>
                        <li>Vùng lá bệnh không được thể hiện rõ hoặc không phải là vùng đặc trưng</li>
                        <li>Bệnh chưa xuất hiện trong tập dữ liệu huấn luyện của mô hình</li>
                        <li>Biểu hiện bệnh không điển hình hoặc đang ở giai đoạn sớm</li>
                      </ul>
                      <p>
                        Do đó, độ tin cậy của mô hình <span className="font-semibold text-red-600">không đạt ngưỡng chấp nhận</span>.
                      </p>
                    </div>

                    {/* Gợi ý */}
                    <div className="bg-white border border-red-100 rounded-lg p-3 flex items-start gap-2">
                      <FaInfoCircle className="text-red-500 mt-1" />
                      <p className="text-sm text-gray-700">
                        Để cải thiện kết quả, nên cung cấp ảnh có <span className="font-semibold">độ phân giải cao</span>, 
                        ánh sáng đầy đủ và tập trung rõ vào khu vực lá có dấu hiệu bất thường.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="bg-green-50 rounded-xl p-4 border-2 border-green-200">
                    <p className="text-gray-600 text-sm flex items-center gap-2">
                      <FaTrophy className="text-yellow-500" /> Bệnh chính xác suất cao
                    </p>
                    <p className="text-2xl font-bold text-gray-900">{result.main_disease}</p>

                    <div className="mt-3 flex items-center gap-2">
                      <div className="flex-1 bg-gray-300 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-green-600 h-2 rounded-full transition-all"
                          style={{
                            width: `${Math.min(getConfidencePercent(result.confidence), 100)}%`,
                          }}
                        />
                      </div>
                      <p className="text-lg font-bold text-green-600 min-w-fit">
                        {getConfidencePercent(result.confidence)}%
                      </p>
                    </div>
                  </div>
                )}

                {/* Top 3 Predictions */}
                {getConfidencePercent(result.confidence) >= CONFIDENCE_THRESHOLD && result.top_3 && (
                  <div>
                    <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FaList className="text-blue-600" /> Top 3 bệnh khả năng</h4>
                    <p className="mb-3 text-sm text-gray-600">Chọn 1 bệnh bên dưới để AI tư vấn đúng theo kết quả bạn muốn xem.</p>
                    <div className="space-y-2">
                      {result.top_3.map((pred, idx) => {
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
                              {getConfidencePercent(pred.confidence)}%
                            </p>
                          </div>
                        </div>
                        );
                      })}

                      {!selectedAdvice && (
                        <div className="flex items-center gap-3 mt-3">
                          <button
                            type="button"
                            disabled={multiSelectedPreds.length === 0 || selectedAdviceLoading}
                            onClick={async () => {
                              try {
                                setSelectedAdviceLoading(true);
                                setSelectedAdvice('');

                                // build payload: [{ disease_en, confidence }, ...]
                                const payload = result.top_3
                                  .filter(p => multiSelectedPreds.includes(p.ten_benh_en))
                                  .map(p => ({ disease_en: p.ten_benh_en, confidence: p.confidence }));

                                const res = await apiClient.post('/predictions/advice-multi', { predictions: payload });
                                setSelectedAdvice(res.data?.data?.advice || '');
                                // clear single selection
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
                              // reset multi selection
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
                  </div>
                )}

                {/* AI Advice */}
                {getConfidencePercent(result.confidence) >= CONFIDENCE_THRESHOLD &&
                (selectedAdviceLoading || selectedAdvice || selectedTopDisease) && (
                  <div className={`rounded-lg p-4 border-l-4 ${selectedAdviceLoading ? 'bg-purple-100 border-purple-500' : 'bg-purple-50 border-purple-500'}`}>
                    <p className="text-gray-600 text-sm font-semibold mb-2 flex items-center gap-2">
                      <FaBrain className="text-purple-600" />
                      Tư Vấn AI từ Gemini
                    </p>
                    {(!selectedTopDisease && !selectedAdvice) ? (
                      <p className="text-sm text-gray-600">Đang tạo tư vấn AI...</p>
                    ) : selectedAdviceLoading ? (
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
                      <div className="space-y-2">
                        <p className="text-sm font-semibold text-gray-800">
                          {selectedTopDisease ? `Tư vấn cho: ${selectedTopDisease.ten_benh}` : `Tư vấn tổng hợp cho ${multiSelectedPreds.length} bệnh`}
                        </p>
                        <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed text-justify">
                          {formatAIText(selectedAdvice)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center text-gray-500 py-12">
                <p className="text-2xl mb-2"><FaChartBar className="mx-auto" /></p>
                <p>Kết quả dự đoán sẽ hiển thị ở đây</p>
              </div>
            )}
          </div>
        </div>

        {/* Prediction History */}
        <div className="mt-12">
          <h2 className="text-2xl font-bold text-green-600 mb-6 flex items-center gap-2">
            <FaList /> Lịch sử dự đoán
          </h2>

          {predictions.length === 0 ? (
            <div className="bg-white rounded-xl shadow-md p-12 text-center text-gray-600">
              <p className="text-lg">Chưa có lịch sử dự đoán nào</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Predictions List */}
              <div className="lg:col-span-2">
                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-gray-50 border-b">
                      <tr>
                        {/* Vườn removed - predictions no longer tied to gardens */}
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                          Bệnh phát hiện
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                          Độ tin cậy
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                          Ngày dự đoán
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
                              ? 'bg-green-100 hover:bg-green-150'
                              : 'hover:bg-gray-50'
                          }`}
                        >
                          {/* garden removed */}
                          <td className="px-6 py-4">
                            <p className="font-semibold text-gray-900">{pred.ket_qua_benh || '—'}</p>
                          </td>
                          <td className="px-6 py-4 text-right whitespace-nowrap">
                            <div className="flex items-center justify-center gap-2">
                              <div className="w-20 bg-gray-300 rounded-full h-2 overflow-hidden">
                                <div
                                  className="bg-green-600 h-2 rounded-full"
                                  style={{ width: `${Math.min(getConfidencePercent(pred.do_tin_cay), 100)}%` }}
                                />
                              </div>
                              <span className="font-semibold text-green-600 min-w-fit text-sm">
                                {getConfidencePercent(pred.do_tin_cay)}%
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center whitespace-nowrap text-sm text-gray-600">
                            {formatDate(pred.ngay_du_doan)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
                      <div className="text-sm text-gray-600">
                        Trang <span className="font-semibold">{currentPage}</span> / <span className="font-semibold">{totalPages}</span> 
                        ({predictions.length} dự đoán)
                      </div>
                      <div className="flex gap-1">
                        {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                          <button
                            key={page}
                            onClick={() => handlePageChange(page)}
                            className={`px-3 py-1 rounded text-sm font-medium transition ${
                              currentPage === page
                                ? 'bg-blue-600 text-white'
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
                  <div className="bg-white rounded-xl shadow-md p-6 sticky top-6 flex flex-col max-h-[800px]">
                    {/* Hình ảnh */}
                    {selectedPrediction.hinh_anh && (
                      <div className="mb-4 flex justify-center bg-gray-100 rounded-lg p-2 flex-shrink-0">
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

                    <div className="space-y-4 flex-1 overflow-y-auto pr-2">
                      {/* Tư vấn AI */}
                      {selectedPrediction.tuvan_ai && (
                        <div>
                          <p className="text-xs text-gray-600 uppercase font-semibold">Tư Vấn AI</p>
                          <p className="text-sm text-gray-800 bg-purple-50 rounded p-3 border-l-4 border-purple-500 whitespace-pre-wrap leading-relaxed text-justify">
                            {formatAIText(selectedPrediction.tuvan_ai)}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    <button
                      onClick={() => setSelectedPrediction(null)}
                      className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition mt-4 flex-shrink-0 flex items-center justify-center gap-2"
                    >
                      <FaTimes /> Đóng
                    </button>
                  </div>
                ) : (
                  <div className="bg-white rounded-xl shadow-md p-6 text-center text-gray-600 sticky top-6">
                    👈 Chọn một dự đoán để xem chi tiết
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

      </div>
    </UserLayout>
  );
};

export default PredictPage;
