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
  const [selectedDiseaseLabel, setSelectedDiseaseLabel] = useState('');
  const [lastUploadResult, setLastUploadResult] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0, message: '' });
  const [progress, setProgress] = useState({ progress: 0, status: '', error: null });
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(false);
  const fileInputRef = useRef(null);
  const eventSourceRef = useRef(null);
  const UPLOAD_BATCH_SIZE = 5;

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
      console.error('Error fetching status:', error);
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
      console.error('Error fetching maintenance status:', error);
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
      console.error('Toggle maintenance error:', error);
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
            toast.success('Đào tạo hoàn thành!');
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

  const handleUploadClick = (diseaseKey, diseaseLabel) => {
    setSelectedDisease(diseaseKey);
    setSelectedDiseaseLabel(diseaseLabel || diseaseKey);
    fileInputRef.current?.click();
  };

  const handleChooseFiles = (event) => {
    const files = Array.from(event.target.files || []);
    setSelectedFiles(files);
  };

  const handleFileSelect = async () => {
    const files = selectedFiles;
    if (files.length === 0) return;

    try {
      setUploading(true);
      setUploadProgress({ done: 0, total: files.length, message: 'Chuẩn bị tải ảnh...' });
      toast.loading(`Đang tải ${files.length} ảnh lên server...`, { id: 'ml-upload' });

      let uploadedCount = 0;

      for (let index = 0; index < files.length; index += UPLOAD_BATCH_SIZE) {
        const batch = files.slice(index, index + UPLOAD_BATCH_SIZE);
        const formData = new FormData();
        formData.append('disease_name', selectedDisease);
        batch.forEach((file) => {
          formData.append('images', file);
        });

        setUploadProgress({
          done: Math.min(index + batch.length, files.length),
          total: files.length,
          message: `Đang tải lô ${Math.floor(index / UPLOAD_BATCH_SIZE) + 1}/${Math.ceil(files.length / UPLOAD_BATCH_SIZE)} (${batch.length} ảnh/lô)`,
        });

        const res = await apiClient.post('/ml/training-images', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        if (!res.data.success) {
          throw new Error(res.data.message || 'Upload failed');
        }

        uploadedCount += Number(res.data.data?.count || batch.length || 0);

        setUploadProgress({
          done: Math.min(index + batch.length, files.length),
          total: files.length,
          message: `Đã xong lô ${Math.floor(index / UPLOAD_BATCH_SIZE) + 1}/${Math.ceil(files.length / UPLOAD_BATCH_SIZE)}, chuẩn bị lô tiếp theo...`,
        });
      }

      const diseaseLabel = selectedDiseaseLabel || trainingStatus.status?.[selectedDisease]?.ten_benh || selectedDisease;

      setLastUploadResult({
        disease: selectedDisease,
        diseaseLabel,
        count: uploadedCount,
        uploadedAt: new Date().toLocaleString('vi-VN'),
      });

      toast.success(`Đã tải lên ${uploadedCount} ảnh cho ${diseaseLabel}`, { id: 'ml-upload' });
      fetchTrainingStatus();
    } catch (error) {
      console.error('Upload error:', error);
      toast.error(error.response?.data?.message || error.message || 'Lỗi tải lên', { id: 'ml-upload' });
    } finally {
      // Reset input
      fileInputRef.current.value = '';
      setSelectedFiles([]);
      setUploading(false);
      setUploadProgress({ done: 0, total: 0, message: '' });
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
        toast.success('Bắt đầu đào tạo model (chạy nền)');
        console.log('Training status:', res.data.data.status);
      }
    } catch (error) {
      console.error('Retrain error:', error);
      toast.error(error.response?.data?.message || 'Lỗi đào tạo');
      setRetraining(false);
    }
  };

  const diseasesData = trainingStatus.status || {};
  const summary = trainingStatus.summary || {};
  const evaluation = trainingStatus.evaluation || progress.metrics || null;
  const testMetrics = evaluation?.test || null;
  const trainingResults = trainingStatus.trainingResults || progress.trainingResults || null;

  const totalDiseaseCount = summary.total_diseases || Object.keys(diseasesData).length || 0;
  const totalOriginalImages = summary.original_images || 0;
  const totalOrganizedImages = summary.organized_images || summary.total_images || 0;
  const totalTrainingImages = summary.training_images || 0;
  const trainImages = summary.train_images ?? Math.round(totalOrganizedImages * 0.8);
  const valImages = summary.val_images ?? Math.round(totalOrganizedImages * 0.1);
  const testImages = summary.test_images ?? (totalOrganizedImages - trainImages - valImages);

  // Derived totals from diseasesData
  const totalImagesFromDiseases = Object.values(diseasesData || {}).reduce(
    (sum, d) => sum + Number(d.count || d.total || 0),
    0
  );
  const totalNewImagesFromDiseases = Object.values(diseasesData || {}).reduce(
    (sum, d) => sum + Number(d.new_images || d.training_images || 0),
    0
  );

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

  const testMetricCards = testMetrics
    ? [
        {
          key: 'precision',
          label: 'Precision',
          icon: FaCheckCircle,
          macro: testMetrics.precision_macro,
          weighted: testMetrics.precision_weighted,
          accent: 'from-green-600 to-green-700',
          description: 'Độ đúng của các dự đoán bệnh dương tính trên tập test',
        },
        {
          key: 'recall',
          label: 'Recall',
          icon: FaBalanceScale,
          macro: testMetrics.recall_macro,
          weighted: testMetrics.recall_weighted,
          accent: 'from-slate-900 to-slate-700',
          description: 'Khả năng phát hiện các trường hợp bệnh thực tế trên tập test',
        },
        {
          key: 'f1',
          label: 'F1-score',
          icon: FaChartLine,
          macro: testMetrics.f1_macro,
          weighted: testMetrics.f1_weighted,
          accent: 'from-slate-900 to-slate-700',
          description: 'Chỉ số cân bằng giữa Precision và Recall trên tập test',
        },
      ]
    : [];

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Đào Tạo ML Model</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={handleToggleMaintenance}
              disabled={maintenanceLoading}
              className={`flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-900 disabled:bg-gray-400 ${maintenanceMode ? 'bg-red-600 hover:bg-red-700' : 'bg-green-700 hover:bg-green-800'}`}
            >
              {maintenanceMode ? <FaUnlock /> : <FaLock />}
              {maintenanceMode ? 'Mở Khóa Hệ Thống' : 'Bật Bảo Trì'}
            </button>
            <button
              onClick={handleRetrain}
              disabled={retraining || loading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
            >
              <FaCog className={retraining ? 'animate-spin' : ''} />
              {retraining ? 'Đang Huấn Luyện Lại...' : 'Huấn Luyện Lại'}
            </button>
          </div>
        </div>

        <div className={`rounded-2xl border p-4 flex items-center justify-between gap-4 ${maintenanceMode ? 'border-red-900 bg-red-50 text-red-900' : 'border-green-200 bg-green-50 text-green-900'}`}>
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

        {lastUploadResult && (
          <div className="rounded-2xl border border-green-200 bg-green-50 px-4 py-4 text-green-900 shadow-sm">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-700">Kết quả tải ảnh gần nhất</p>
                <p className="text-lg font-bold">
                  Đã tải lên {lastUploadResult.count} ảnh cho {lastUploadResult.diseaseLabel}
                </p>
              </div>
              <div className="text-sm text-green-700 font-medium">
                {lastUploadResult.uploadedAt}
              </div>
            </div>
          </div>
        )}

        {/* Summary Card (show only New and Total per request) */}
        <div className="bg-gray-900 text-white rounded-lg p-6 shadow">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm opacity-80">Số Bệnh</p>
              <p className="text-3xl font-bold">{totalDiseaseCount}</p>
            </div>
            <div>
              <p className="text-sm opacity-80">Ảnh Gốc</p>
              <p className="text-3xl font-bold">{totalOriginalImages}</p>
            </div>
            <div>
              <p className="text-sm opacity-80">Ảnh Mới</p>
              <p className="text-3xl font-bold">{totalTrainingImages || totalNewImagesFromDiseases || summary.new_images || 0}</p>
            </div>
            <div>
              <p className="text-sm opacity-80">Tổng</p>
              <p className="text-3xl font-bold">{totalOrganizedImages || totalImagesFromDiseases || summary.count || 0}</p>
            </div>
          </div>
        </div>

        {/* Dataset split counts (80/10/10) */}
        <div className="bg-white rounded-lg border p-4 shadow-sm">
          <div className="flex justify-between text-center">
            
            {/* Train */}
            <div className="flex-1">
              <p className="text-sm text-gray-500">Tập Huấn Luyện (80%)</p>
              <p className="font-bold text-gray-900">{trainImages}</p>
            </div>

            {/* Validation */}
            <div className="flex-1">
              <p className="text-sm text-gray-500">Tập Xác Thực (10%)</p>
              <p className="font-bold text-gray-900">{valImages}</p>
            </div>

            {/* Test */}
            <div className="flex-1">
              <p className="text-sm text-gray-500">Tập Test (10%)</p>
              <p className="font-bold text-gray-900">{testImages}</p>
            </div>

          </div>
        </div>

        {/* Training Results */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-600 mb-2">Kết quả huấn luyện</p>
              <h2 className="text-2xl font-bold text-green-600">Accuracy / Loss của lần train gần nhất</h2>
              <p className="text-sm text-gray-500 mt-1">
                Hiển thị giá trị cuối cùng của epoch cuối và các chỉ số quan trọng của lần huấn luyện gần nhất.
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
                      <p className="text-4xl font-bold text-green-600">{item.value}</p>
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
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-600 mb-2">Đánh giá mô hình</p>
              <h2 className="text-2xl font-bold text-green-600">Validation sau khi huấn luyện</h2>
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 self-start md:self-auto">
              Tập validation 
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

        {/* Test Metrics */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-3 mb-5">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-green-600 mb-2">Đánh giá cuối cùng</p>
              <h2 className="text-2xl font-bold text-green-600">Test sau khi huấn luyện</h2>
            </div>
            <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 self-start md:self-auto">
              Tập test
            </div>
          </div>

          {testMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {testMetricCards.map((item) => {
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
              Chưa có dữ liệu test. Hãy chạy huấn luyện lại để hệ thống tính kết quả cuối cùng trên tập test.
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
                    <h3 className="text-2xl font-bold text-green-600">
                      {data.ten_benh || disease}
                    </h3>
                    <p className="text-sm font-medium text-green-600 mt-1">{data.upload_key || disease}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {data.source === 'original'
                        ? 'Có ảnh gốc trong gop_dataset'
                        : 'Chỉ có ảnh mới trong uploads/training'}
                    </p>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-3 gap-2 text-center bg-gray-50 p-3 rounded">
                    <div>
                      <p className="text-xs text-gray-600">Ảnh gốc</p>
                      <p className="font-bold text-lg text-gray-900">{data.original_count || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Ảnh mới</p>
                      <p className="font-bold text-lg text-gray-900">{data.new_images || 0}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600">Tổng</p>
                      <p className="font-bold text-lg text-gray-900">{data.source_total ?? ((data.original_count || 0) + (data.new_images || 0))}</p>
                    </div>
                  </div>

                  {/* Upload Button */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => handleUploadClick(data.upload_key || disease, data.ten_benh || disease)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      <FaUpload size={14} />
                      {uploading && selectedDisease === (data.upload_key || disease) ? 'Đang tải...' : 'Chọn Nhiều Ảnh'}
                    </button>

                    {selectedDisease === (data.upload_key || disease) && selectedFiles.length > 0 && (
                      <div className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-900">
                        <p className="font-semibold mb-2">Đã chọn {selectedFiles.length} ảnh:</p>
                        <div className="max-h-28 overflow-auto space-y-1 pr-1">
                          {selectedFiles.slice(0, 6).map((file) => (
                            <p key={`${file.name}-${file.size}`} className="truncate">
                              • {file.name}
                            </p>
                          ))}
                          {selectedFiles.length > 6 && (
                            <p className="text-green-700">• Và {selectedFiles.length - 6} ảnh khác...</p>
                          )}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={handleFileSelect}
                            className="flex-1 rounded-lg bg-green-700 px-3 py-2 font-semibold text-white hover:bg-green-800 transition disabled:bg-gray-400 disabled:cursor-not-allowed"
                          >
                            {uploading ? 'Đang tải...' : `Tải lên ${selectedFiles.length} ảnh`}
                          </button>
                          <button
                            type="button"
                            disabled={uploading}
                            onClick={() => {
                              setSelectedFiles([]);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                              }
                            }}
                            className="rounded-lg border border-green-300 bg-white px-3 py-2 font-semibold text-green-900 hover:bg-green-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Hủy
                          </button>
                        </div>
                        {uploading && uploadProgress.total > 0 && (
                          <div className="mt-3 space-y-2">
                            <div className="h-2 w-full overflow-hidden rounded-full bg-green-100">
                              <div
                                className="h-full rounded-full bg-green-700 transition-all"
                                style={{ width: `${Math.max(0, Math.min((uploadProgress.done / uploadProgress.total) * 100, 100))}%` }}
                              />
                            </div>
                            <p className="text-xs font-medium text-green-800">
                              {uploadProgress.message} - {uploadProgress.done}/{uploadProgress.total} ảnh
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 text-center">
                    {(data.organized_count || data.count || data.total || 0) > 0
                      ? `✓ Đã có ${(data.organized_count || data.count || data.total || 0)} ảnh trong organized_dataset`
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
        onChange={handleChooseFiles}
        style={{ display: 'none' }}
      />

      {/* Progress Modal */}
      {retraining && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full mx-4">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Huấn luyện lại mô hình</h2>

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
