import React, { useState } from 'react';
import { FaKey, FaLock, FaEye, FaEyeSlash, FaCheck, FaTimes, FaSave, FaClipboard } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import authService from '../../services/authService';

const ChangePasswordPage = () => {
  const navigate = useNavigate();
  const user = authService.getCurrentUser();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState({
    old: false,
    new: false,
    confirm: false,
  });
  const [formData, setFormData] = useState({
    mat_khau_cu: '',
    mat_khau_moi: '',
    mat_khau_confirm: '',
  });

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
  };

  const togglePasswordVisibility = (field) => {
    setShowPassword({
      ...showPassword,
      [field]: !showPassword[field],
    });
  };

  const validateForm = () => {
    if (!formData.mat_khau_cu || !formData.mat_khau_moi || !formData.mat_khau_confirm) {
      toast.error('Vui lòng điền đầy đủ tất cả các trường');
      return false;
    }

    if (formData.mat_khau_moi.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return false;
    }

    if (formData.mat_khau_moi !== formData.mat_khau_confirm) {
      toast.error('Mật khẩu mới không trùng khớp');
      return false;
    }

    if (formData.mat_khau_cu === formData.mat_khau_moi) {
      toast.error('Mật khẩu mới phải khác mật khẩu cũ');
      return false;
    }

    return true;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);
      await apiClient.post('/users/change-password', {
        mat_khau_cu: formData.mat_khau_cu,
        mat_khau_moi: formData.mat_khau_moi,
      });

      toast.success('Đổi mật khẩu thành công!');
      
      // Reset form
      setFormData({
        mat_khau_cu: '',
        mat_khau_moi: '',
        mat_khau_confirm: '',
      });

      // Redirect to admin dashboard after 2 seconds
      setTimeout(() => {
        navigate('/admin');
      }, 2000);
    } catch (err) {
      console.error('Error changing password:', err);
      toast.error(err.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900"><FaKey className="inline mr-2" /> Đổi Mật Khẩu</h1>
          <p className="text-gray-600 mt-2">Cập nhật mật khẩu của tài khoản admin</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-lg shadow-md p-8">
          <form onSubmit={handleChangePassword} className="space-y-6">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaLock className="inline mr-2" /> Mật Khẩu Cũ <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword.old ? 'text' : 'password'}
                  name="mat_khau_cu"
                  value={formData.mat_khau_cu}
                  onChange={handleInputChange}
                  placeholder="Nhập mật khẩu hiện tại"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('old')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800"
                >
                  {showPassword.old ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaCheck className="inline mr-2" /> Mật Khẩu Mới <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword.new ? 'text' : 'password'}
                  name="mat_khau_moi"
                  value={formData.mat_khau_moi}
                  onChange={handleInputChange}
                  placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('new')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800"
                >
                  {showPassword.new ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
            </div>

            {/* Confirm New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <FaCheck className="inline mr-2" /> Xác Nhận Mật Khẩu Mới <span className="text-red-600">*</span>
              </label>
              <div className="relative">
                <input
                  type={showPassword.confirm ? 'text' : 'password'}
                  name="mat_khau_confirm"
                  value={formData.mat_khau_confirm}
                  onChange={handleInputChange}
                  placeholder="Nhập lại mật khẩu mới"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => togglePasswordVisibility('confirm')}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 hover:text-gray-800"
                >
                  {showPassword.confirm ? <FaEye /> : <FaEyeSlash />}
                </button>
              </div>
            </div>

            {/* Password Requirements */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-medium text-blue-900 mb-2"><FaClipboard className="inline mr-2" /> Yêu cầu mật khẩu:</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Tối thiểu 6 ký tự</li>
                <li>• Mật khẩu mới phải khác mật khẩu cũ</li>
                <li>• Hai trường mật khẩu mới phải trùng khớp</li>
              </ul>
            </div>

            {/* Buttons */}
            <div className="flex gap-4 pt-6">
              <button
                type="submit"
                disabled={loading}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:bg-gray-400"
              >
                {loading ? <>⏳ Đang cập nhật...</> : <><FaSave className="inline mr-2" /> Đổi Mật Khẩu</>}
              </button>
              <button
                type="button"
                onClick={() => navigate('/admin')}
                disabled={loading}
                className="flex-1 px-6 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition disabled:bg-gray-300"
              >
                <FaTimes className="inline mr-2" /> Hủy
              </button>
            </div>
          </form>
        </div>

        {/* Security Tips */}
        <div className="mt-8 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-yellow-900 mb-3"><FaLock className="inline mr-2" /> Mẹo Bảo Mật:</h3>
          <ul className="text-sm text-yellow-800 space-y-2">
            <li>• Sử dụng mật khẩu mạnh gồm chữ cái, số và ký tự đặc biệt</li>
            <li>• Không chia sẻ mật khẩu của bạn với bất kỳ ai</li>
            <li>• Thay đổi mật khẩu định kỳ để bảo mật tài khoản</li>
            <li>• Không sử dụng cùng mật khẩu cho nhiều tài khoản</li>
          </ul>
        </div>
      </div>
    </AdminLayout>
  );
};

export default ChangePasswordPage;
