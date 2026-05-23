import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { FaLeaf, FaArrowLeft, FaPlus, FaEdit, FaCheck, FaTimes } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const GardenFormPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { register, handleSubmit, reset } = useForm();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    // Only fetch if id exists and is not 'new' (editing mode)
    if (id && id !== 'new') {
      fetchGarden();
    } else if (!id || id === 'new') {
      // In create mode, not fetching anything
      setIsEditing(false);
      setLoading(false);
    }
  }, [id]);

  const fetchGarden = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get(`/gardens/${id}`);
      const garden = res.data.data;
      reset(garden);
      setIsEditing(true);
      console.log('✓ Garden loaded for editing:', garden.ten_vuon);
    } catch (error) {
      console.error('❌ Lỗi tải vườn:', error);
      toast.error('Không thể tải thông tin vườn');
      navigate('/user/gardens');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data) => {
    try {
      if (isEditing) {
        // Update existing garden
        await apiClient.put(`/gardens/${id}`, data);
        toast.success('Cập nhật vườn thành công');
      } else {
        // Create new garden
        const res = await apiClient.post('/gardens', data);
        toast.success('Tạo vườn thành công');
        console.log('✓ Garden created:', res.data.data);
      }
      navigate('/user/gardens');
    } catch (error) {
      console.error('❌ Lỗi lưu vườn:', error);
      toast.error(error.response?.data?.message || 'Không thể lưu vườn');
    }
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
      <div>
        {/* Header */}
        <div className="flex justify-between items-start mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
              {isEditing ? <><FaEdit className="text-blue-600" /> Chỉnh sửa vườn</> : <><FaPlus className="text-green-600" /> Tạo vườn mới</>}
            </h1>
            <p className="text-gray-600 mt-2">
              {isEditing ? 'Cập nhật thông tin vườn của bạn' : 'Thêm một vườn mới vào hệ thống'}
            </p>
          </div>
          <button
            onClick={() => navigate('/user/gardens')}
            className="text-gray-600 hover:text-gray-900 transition flex items-center gap-2"
          >
            <FaArrowLeft /> Quay lại
          </button>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-md p-8 max-w-2xl">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* Tên vườn */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Tên vườn <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                {...register('ten_vuon', { required: 'Tên vườn là bắt buộc' })}
                placeholder="Vườn cam Hà Nội..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Diện tích */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Diện tích <span className="text-red-600">*</span>
                </label>
                <input
                  type="number"
                  step="0.1"
                  {...register('dien_tich', { required: 'Diện tích là bắt buộc' })}
                  placeholder="100"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Đơn vị <span className="text-red-600">*</span>
                </label>
                <select
                  {...register('don_vi', { required: 'Đơn vị là bắt buộc' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">-- Chọn đơn vị --</option>
                  <option value="m²">m² (Mét vuông)</option>
                  <option value="hectare">hectare</option>
                  <option value="sào">sào (Việt Nam)</option>
                </select>
              </div>
            </div>

            {/* Địa điểm */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Địa điểm <span className="text-red-600">*</span>
              </label>
              <input
                type="text"
                {...register('dia_diem', { required: 'Địa điểm là bắt buộc' })}
                placeholder="Huyện X, Tỉnh Y"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Mô tả */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Mô tả thêm
              </label>
              <textarea
                {...register('mo_ta')}
                placeholder="Thêm thông tin về vườn của bạn..."
                rows="4"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>

            {/* Actions */}
            <div className="flex gap-4 justify-end">
              <button
                type="button"
                onClick={() => navigate('/user/gardens')}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-semibold"
              >
                Hủy
              </button>
              <button
                type="submit"
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-semibold"
              >
                {isEditing ? 'Cập nhật' : 'Tạo vườn'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </UserLayout>
  );
};

export default GardenFormPage;
