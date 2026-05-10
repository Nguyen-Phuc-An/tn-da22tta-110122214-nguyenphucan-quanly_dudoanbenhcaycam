import React, { useState, useEffect, useRef } from 'react';
import { FaUpload, FaSync, FaCog, FaInfoCircle } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const MLTrainingPage = () => {
  const [trainingStatus, setTrainingStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [retraining, setRetraining] = useState(false);
  const [selectedDisease, setSelectedDisease] = useState('');
  const [progress, setProgress] = useState({ progress: 0, status: '', error: null });
  const fileInputRef = useRef(null);
  const eventSourceRef = useRef(null);

  // Fetch training status on mount
  useEffect(() => {
    fetchTrainingStatus();
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

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-900">⚙️ Đào Tạo ML Model</h1>
          <button
            onClick={handleRetrain}
            disabled={retraining || loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400"
          >
            <FaCog className={retraining ? 'animate-spin' : ''} />
            {retraining ? 'Đang Đào Tạo...' : '🔄 Đào Tạo Lại'}
          </button>
        </div>

        {/* Summary Card */}
        <div className="bg-gradient-to-r from-blue-500 to-blue-700 text-white rounded-lg p-6 shadow">
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

        {/* Info */}
        <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
          <div className="flex gap-3">
            <FaInfoCircle className="text-blue-600 flex-shrink-0 mt-1" />
            <div className="text-sm text-blue-800">
              <p className="font-semibold">ℹ️ Hướng dẫn:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Chọn bệnh → Upload ảnh (tối thiểu 100 ảnh cho bệnh mới)</li>
                <li>Sau khi upload xong, click "🔄 Đào Tạo Lại" để cập nhật model</li>
                <li>Quá trình đào tạo mất 10-30 phút, chạy nền không cần chờ</li>
              </ul>
            </div>
          </div>
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
                    <h3 className="text-lg font-bold text-gray-900">{disease}</h3>
                    <p className="text-xs text-gray-500">
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
                      <p className="font-bold text-lg text-blue-600">
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
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-lg font-semibold hover:bg-green-600 transition"
                  >
                    <FaUpload size={14} />
                    Tải Ảnh Lên
                  </button>

                  {/* Progress Bar */}
                  {data.total > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
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
                    {data.total > 100
                      ? '✓ Đủ dữ liệu'
                      : `⚠️ Cần ${Math.max(0, 100 - (data.total || 0))} ảnh nữa`}
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
                  className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-300"
                  style={{ width: `${progress.progress}%` }}
                />
              </div>
              <p className="text-center mt-2 text-2xl font-bold text-blue-600">
                {progress.progress}%
              </p>
            </div>

            {/* Status */}
            <div className="mb-6 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-gray-700">
                <span className="font-semibold">Trạng thái:</span> {progress.status || 'Waiting...'}
              </p>
            </div>

            {/* Error Message */}
            {progress.error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-700 break-words">{progress.error}</p>
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
