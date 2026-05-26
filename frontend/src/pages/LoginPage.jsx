import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import AuthLayout from '../components/Layout/AuthLayout';
import authService from '../services/authService';
import { FaEye, FaEyeSlash, FaLeaf } from 'react-icons/fa';
import loginBackground from '../components/User/Background Login.png';

const LoginPage = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm({
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      const result = await authService.login(data.email, data.password);

      if (result.success) {
        toast.success('Đăng nhập thành công!');
        
        // Redirect dựa vào role
        const redirectPath = result.user?.vai_tro === 'admin' ? '/admin' : '/';
        navigate(redirectPath);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Lỗi đăng nhập. Vui lòng thử lại.');
      console.error('Login error:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title={<span><FaLeaf className="inline mr-2" size={24} /> Quản lý Vườn Cây</span>}
      subtitle="Nhận diện bệnh cây bằng AI"
      backgroundImage={loginBackground}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-green-700 mb-2">
            Email
          </label>
          <input
            type="email"
            placeholder="email@example.com"
            className="auth-input"
            {...register('email', {
              required: 'Email là bắt buộc',
              pattern: {
                value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Email không hợp lệ',
              },
            })}
          />
          {errors.email && (
            <p className="error-text">{errors.email.message}</p>
          )}
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-green-700 mb-2">
            Mật khẩu
          </label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              placeholder="••••••••"
              className="auth-input pr-12"
              {...register('password', {
                required: 'Mật khẩu là bắt buộc',
              })}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
            >
              {showPassword ? <FaEye size={20} /> : <FaEyeSlash size={20} />}
            </button>
          </div>
          {errors.password && (
            <p className="error-text">{errors.password.message}</p>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={loading}
          className="auth-button"
        >
          {loading ? 'Đang đăng nhập...' : 'Đăng nhập'}
        </button>
      </form>
    </AuthLayout>
  );
};

export default LoginPage;
