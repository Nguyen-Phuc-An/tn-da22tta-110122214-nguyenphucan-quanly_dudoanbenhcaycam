import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUser, FaLock, FaCheck, FaTimes } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const navigate = useNavigate();
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const [loading, setLoading] = useState(false);

  const [formData, setFormData] = useState({
    ho_ten: user.ho_ten || '',
    email: user.email || '',
  });

  const [passwordForm, setPasswordForm] = useState({
    oldPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      await apiClient.put('/auth/profile', formData);
      toast.success('Cập nhật hồ sơ thành công');

      const updatedUser = { ...user, ...formData };
      localStorage.setItem('user', JSON.stringify(updatedUser));
    } catch (error) {
      console.error('Lỗi cập nhật:', error);
      toast.error(error.response?.data?.message || 'Cập nhật thất bại');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('Mật khẩu không trùng khớp');
      return;
    }

    try {
      setLoading(true);
      await apiClient.put('/auth/change-password', {
        oldPassword: passwordForm.oldPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Đổi mật khẩu thành công');
      setPasswordForm({ oldPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      console.error('Lỗi đổi mật khẩu:', error);
      toast.error(error.response?.data?.message || 'Đổi mật khẩu thất bại');
    } finally {
      setLoading(false);
    }
  };

  return (
    <UserLayout>
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-8 flex items-center gap-2">
          <FaUser /> Hồ sơ cá nhân
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Avatar */}
          <div className="bg-white rounded-xl shadow-md p-6 flex flex-col items-center">
            <div className="w-32 h-32 bg-green-600 rounded-full flex items-center justify-center text-white text-5xl font-bold mb-4">
              {user.ho_ten?.charAt(0).toUpperCase()}
            </div>
            <p className="text-xl font-bold text-gray-900 text-center">{user.ho_ten}</p>
            <p className="text-gray-600 text-center text-sm">{user.email}</p>
            <div className="mt-4 w-full pt-4 border-t">
              <p className="text-xs text-gray-500 text-center">
                Vai trò: <span className="font-semibold text-green-600 ">{user.vai_tro.toUpperCase()}</span>
              </p>
            </div>
          </div>

          {/* Forms */}
          <div className="lg:col-span-2 space-y-6">
            {/* Update Profile Form */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FaUser className="text-blue-600" /> Cập nhập thông tin
              </h3>
              <form onSubmit={handleUpdateProfile} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Họ tên
                  </label>
                  <input
                    type="text"
                    name="ho_ten"
                    value={formData.ho_ten}
                    onChange={handleInputChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-100 text-gray-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:bg-gray-400 flex items-center justify-center gap-2 font-semibold"
                >
                  <FaCheck /> {loading ? 'Đang cập nhật...' : 'Cập nhật hồ sơ'}
                </button>
              </form>
            </div>

            {/* Change Password Form */}
            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                <FaLock className="text-red-600" /> Đổi mật khẩu
              </h3>
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mật khẩu hiện tại
                  </label>
                  <input
                    type="password"
                    name="oldPassword"
                    value={passwordForm.oldPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Mật khẩu mới
                  </label>
                  <input
                    type="password"
                    name="newPassword"
                    value={passwordForm.newPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Xác nhận mật khẩu
                  </label>
                  <input
                    type="password"
                    name="confirmPassword"
                    value={passwordForm.confirmPassword}
                    onChange={handlePasswordChange}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition disabled:bg-gray-400 flex items-center justify-center gap-2 font-semibold"
                >
                  <FaCheck /> {loading ? 'Đang cập nhật...' : 'Đổi mật khẩu'}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </UserLayout>
  );
};

export default ProfilePage;
