import React, { useState, useEffect, useRef } from 'react';
import { FaUpload, FaCog, FaInfoCircle, FaChartLine, FaBalanceScale, FaCheckCircle, FaBullseye, FaRegTimesCircle, FaLock, FaUnlock } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const MLTrainingPage = () => {
  const [trainingStatus, setTrainingStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState('');
  const [progress, setProgress] = useState({ progress: 0, status: '', error: null });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const fileInputRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Fetch training status on mount
  useEffect(() => {
    fetchTrainingStatus();
    fetchMaintenanceStatus();
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  const fetchTrainingStatus = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/ml/status');
      if (res.data.success) {
        setTrainingStatus(res.data.data);
      }
    } catch (error) {
      console.error('❌ Error fetching status:', error);
      toast.error('Không thể lấy trạng thái');
    } finally {
      setLoading(false);
    }
  };

  const fetchMaintenanceStatus = async () => {
    try {
      const res = await apiClient.get('/system/maintenance');
      if (res.data.success) {
        setMaintenanceMode(Boolean(res.data.data?.maintenanceMode));
      }
    } catch (error) {
      console.error('❌ Error fetching maintenance status:', error);
    }
  };

  const handleToggleMaintenance = async () => {
    try {
      setMaintenanceLoading(true);
      const res = await apiClient.patch('/system/maintenance', {
        maintenanceMode: !maintenanceMode,
      });

      if (res.data.success) {
        setMaintenanceMode(Boolean(res.data.data?.maintenanceMode));
        toast.success(res.data.message || 'Đã cập nhật chế độ bảo trì');
      }
    } catch (error) {
      console.error('❌ Toggle maintenance error:', error);
      toast.error(error.response?.data?.message || 'Không thể cập nhật chế độ bảo trì');
    } finally {
      setMaintenanceLoading(false);
    }
  };

  // Listen to SSE progress stream
  const startListeningToProgress = () => {
    // Close previous connection if exists
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    // Get token from localStorage or sessionStorage
    const token = localStorage.getItem('token') || sessionStorage.getItem('token');

    // Connect to SSE endpoint with auth header via URL
    const eventSource = new EventSource(
      `http://localhost:3000/api/ml/progress?token=${token}`
    );

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setProgress(data);

        // Auto-refresh status when training completes
        if (data.progress === 100) {
          setTimeout(() => {
            fetchTrainingStatus();
            setRetraining(false);
            toast.success('✅ Đào tạo hoàn thành!');
          }, 1000);
        }
      } catch (error) {
        console.error('Error parsing progress:', error);
      }
    };

    eventSource.onerror = () => {
      console.error('SSE connection error');
      eventSource.close();
      setRetraining(false);
    };

    eventSourceRef.current = eventSource;
  };

  const handleUploadClick = (disease) => {
    setSelectedDisease(disease);
    fileInputRef.current?.click();
  };

  const handleFileSelect = async (event) => {
    const files = Array.from(event.target.files || []);
    if (files.length === 0) return;

    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('images', file);
      });

      const res = await apiClient.post(
        `/ml/training-images?disease_name=${selectedDisease}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
        }
      );

      if (res.data.success) {
        toast.success(`✅ ${res.data.data.count} ảnh tải lên thành công`);
        fetchTrainingStatus();
      }
    } catch (error) {
      console.error('❌ Upload error:', error);
      toast.error(error.response?.data?.message || 'Lỗi tải lên');
    } finally {
      // Reset input
      fileInputRef.current.value = '';
    }
  };

  const handleRetrain = async () => {
    if (!window.confirm('⚠️ Đào tạo lại model sẽ mất 10-30 phút. Bạn chắc chắn?')) {
      return;
    }

    try {
      setRetraining(true);
      setProgress({ progress: 0, status: 'Initializing...', error: null });

      // Start listening to progress before triggering retrain
      startListeningToProgress();

      // Trigger retrain
      const res = await apiClient.post('/ml/retrain');
      if (res.data.success) {
        toast.success('🔄 Bắt đầu đào tạo model (chạy nền)');
        console.log('Training status:', res.data.data.status);
      }
    } catch (error) {
      console.error('❌ Retrain error:', error);
      toast.error(error.response?.data?.message || 'Lỗi đào tạo');
      setRetraining(false);
    }
  };

  const diseasesData = trainingStatus.status || {};
  const summary = trainingStatus.summary || {};
  const evaluation = trainingStatus.evaluation || progress.metrics || null;
  const trainingResults = trainingStatus.trainingResults || progress.trainingResults || null;

  const formatPercent = (value) => `${(Number(value || 0) * 100).toFixed(2)}%`;
  const formatLoss = (value) => Number(value || 0).toFixed(4);

  const metricCards = evaluation
    ? [
        {
          key: 'precision',
          label: 'Precision',
          icon: FaCheckCircle,
          macro: evaluation.precision_macro,
          weighted: evaluation.precision_weighted,
          accent: 'from-green-600 to-green-700',
          description: 'Độ đúng của các dự đoán bệnh dương tính',
        },
        {
          key: 'recall',
          label: 'Recall',
          icon: FaBalanceScale,
          macro: evaluation.recall_macro,
          weighted: evaluation.recall_weighted,
          accent: 'from-slate-900 to-slate-700',
          description: 'Khả năng phát hiện các trường hợp bệnh thực tế',
        },
        {
          key: 'f1',
          label: 'F1-score',
          icon: FaChartLine,
          macro: evaluation.f1_macro,
          weighted: evaluation.f1_weighted,
          accent: 'from-slate-900 to-slate-700',
          description: 'Chỉ số cân bằng giữa Precision và Recall',
        },
      ]
    : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">⚙️ Đào Tạo ML Model</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMaintenance}
              disabled={maintenanceLoading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-semibold text-white transition disabled:bg-gray-400 ${maintenanceMode ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-900 hover:bg-gray-800'}`}
            >
              {maintenanceMode ? <FaUnlock /> : <FaLock />}
              {maintenanceMode ? 'Mở Khóa Hệ Thống' : 'Bật Bảo Trì'}
            </button>
            <button
              onClick={handleRetrain}
              disabled={retraining || loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 disabled:bg-gray-400"
            >
              <FaCog className={retraining ? 'animate-spin' : ''} />
              {retraining ? 'Đang Đào Tạo...' : 'Đào Tạo Lại'}
            </button>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${maintenanceMode ? 'border-gray-900 bg-gray-50 text-gray-900' : 'border-gray-200 bg-gray-50 text-gray-900'}`}>
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] mb-1">Trạng thái hệ thống</p>
            <p className="text-lg font-bold">
              {maintenanceMode ? 'Hệ thống đang bảo trì' : 'Hệ thống đang hoạt động bình thường'}
            </p>
          </div>
          <div className="text-sm font-semibold px-4 py-2 rounded-full bg-white/70 border border-current/20">
            {maintenanceMode ? 'Locked' : 'Unlocked'}
          </div>
        </div>

        {/* Summary Card */}
        <div className="bg-gray-900 text-white rounded-lg p-6 shadow">
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm opacity-80">Số Bệnh</p>
              <p className="text-3xl font-bold">{summary.total_diseases || 0}</p>
            </div>
            <div>
              <p className="text-sm opacity-80">Ảnh Gốc</p>
              <p className="text-3xl font-bold">{summary.original_images || 0}</p>
            </div>
            <div>
              <p className="text-sm opacity-80">Ảnh Mới</p>
              <p className="text-3xl font-bold">{summary.training_images || 0}</p>
            </div>
            <div>
              <p className="text-sm opacity-80">Tổng Cộng</p>
              <p className="text-3xl font-bold">{summary.total_images || 0}</p>
            </div>
          </div>
        </div>

        {/* Training Results */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-900 mb-2">Kết quả huấn luyện</p>
              <h2 className="text-2xl font-bold text-gray-900">Accuracy / Loss của lần train gần nhất</h2>
              <p className="text-sm text-gray-500 mt-1">
                Hiển thị giá trị cuối cùng của epoch cuối và giá trị validation tốt nhất trong lần huấn luyện gần nhất.
              </p>
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 self-start md:self-auto">
              Train và validation
            </div>
          </div>

          {trainingResults ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              {[
                {
                  key: 'train_accuracy',
                  label: 'Train Accuracy',
                  value: formatPercent(trainingResults.train_accuracy),
                  icon: FaBullseye,
                  accent: 'from-gray-900 to-gray-700',
                },
                {
                  key: 'val_accuracy',
                  label: 'Val Accuracy',
                  value: formatPercent(trainingResults.val_accuracy),
                  icon: FaCheckCircle,
                  accent: 'from-green-600 to-green-700',
                },
                {
                  key: 'train_loss',
                  label: 'Train Loss',
                  value: formatLoss(trainingResults.train_loss),
                  icon: FaRegTimesCircle,
                  accent: 'from-gray-900 to-gray-700',
                },
                {
                  key: 'val_loss',
                  label: 'Val Loss',
                  value: formatLoss(trainingResults.val_loss),
                  icon: FaChartLine,
                  accent: 'from-gray-900 to-gray-700',
                },
              ].map((item) => {
                const Icon = item.icon;

                return (
                  <div key={item.key} className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 shadow-sm">
                    <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{item.label}</h3>
                      </div>
                      <Icon className="text-2xl opacity-90" />
                    </div>
                    <div className="p-5">
                      <p className="text-4xl font-bold text-gray-900">{item.value}</p>
                      <p className="mt-3 text-sm text-gray-500">
                        {item.key.includes('loss')
                          ? 'Giá trị càng thấp càng tốt'
                          : 'Giá trị càng cao càng tốt'}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-gray-600">
              Chưa có kết quả huấn luyện. Hãy chạy đào tạo lại để hệ thống lưu Train Accuracy, Val Accuracy và Loss.
            </div>
          )}
        </div>

        {/* Evaluation Metrics */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-900 mb-2">Đánh giá mô hình</p>
              <h2 className="text-2xl font-bold text-gray-900">Precision / Recall / F1-score</h2>
              <p className="text-sm text-gray-500 mt-1">
                Tính trên tập validation sau khi hoàn tất huấn luyện hoặc đào tạo lại.
              </p>
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 self-start md:self-auto">
              Macro average là chỉ số chính
            </div>
          </div>

          {evaluation ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {metricCards.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.key} className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 shadow-sm">
                    <div className="bg-gray-900 text-white px-5 py-4 flex items-center justify-between">
                      <div>
                        <h3 className="text-xl font-bold">{item.label}</h3>
                      </div>
                      <Icon className="text-2xl opacity-90" />
                    </div>
                    <div className="p-5">
                      <div className="space-y-3">
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                            <span>Macro</span>
                            <span>{(item.macro * 100).toFixed(2)}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-green-600"
                              style={{ width: `${Math.max(0, Math.min(item.macro * 100, 100))}%` }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
                            <span>Weighted</span>
                            <span>{(item.weighted * 100).toFixed(2)}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-gray-200">
                            <div
                              className="h-full rounded-full bg-gray-500"
                              style={{ width: `${Math.max(0, Math.min(item.weighted * 100, 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                      <p className="mt-4 text-sm text-gray-500 leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-6 text-gray-600">
              Chưa có dữ liệu đánh giá. Hãy chạy huấn luyện lại để hệ thống tính Precision, Recall và F1-score.
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && <p className="text-center text-gray-600">⏳ Đang tải...</p>}

        {/* Diseases List */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {Object.entries(diseasesData).map(([disease, data]) => (
              <div
                key={disease}
                className="bg-white rounded-lg shadow p-6 hover:shadow-lg transition"
              >
                <div className="space-y-4">
                  {/* Disease Name */}
                  <div>
                    <h3 className="text-2xl font-bold text-gray-900">
                      {data.ten_benh || disease}
                    </h3>
                    <p className="text-sm font-medium text-gray-500 mt-1">{disease}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {data.source === 'original'
                        ? '🎓 Bệnh gốc (organized_dataset)'
                        : '🆕 Bệnh mới'}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 p-3 rounded">
                    <div>
                      <p className="text-xs text-gray-600">Ảnh Gốc</p>
                      <p className="font-bold text-lg">{data.count}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Ảnh Mới</p>
                      <p className="font-bold text-lg text-gray-900">
                        {data.new_images}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Tổng</p>
                      <p className="font-bold text-lg">
                        {(data.total || data.count + data.new_images)}
                      </p>
                    </div>
                  </div>

                  {/* Upload Button */}
                  <button
                    onClick={() => handleUploadClick(disease)}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition"
                  >
                    <FaUpload size={14} />
                    Tải Ảnh Lên
                  </button>

                  {/* Progress Bar */}
                  {data.total > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-gray-900 h-2 rounded-full transition-all"
                        style={{
                          width: `${Math.min(
                            ((data.total || 0) / 500) * 100,
                            100
                          )}%`,
                        }}
                      />
                    </div>
                  )}
                  <p className="text-xs text-gray-500 text-center">
                    {data.total > 0
                      ? `✓ Đã có ${data.total} ảnh, có thể tiếp tục upload thêm bất kỳ lúc nào`
                      : 'Chưa có ảnh nào cho bệnh này'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && Object.keys(diseasesData).length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-600">📭 Không có dữ liệu bệnh</p>
          </div>
        )}
      </div>

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />

      {/* Progress Modal */}
      {retraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">🔄 Đào Tạo Model</h2>

            {/* Progress Bar */}
            <div className="mb-6">
              <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-center mt-2 text-2xl font-bold text-gray-900">
                {progress.progress}%
              </p>
            </div>

            {/* Status */}
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Trạng thái:</span> {progress.status || 'Waiting...'}
              </p>
            </div>

            {/* Error Message */}
            {progress.error && (
              <div className="mb-6 p-4 bg-gray-50 border border-gray-900 rounded-lg">
                <p className="text-sm text-gray-900 break-words">{progress.error}</p>
              </div>
            )}

            {/* Info */}
            <p className="text-xs text-gray-500 text-center">
              ⏳ Quá trình này có thể mất 10-30 phút. Vui lòng không đóng trang.
            </p>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default MLTrainingPage;
