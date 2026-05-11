import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaUser, FaSignOutAlt, FaSeedling } from 'react-icons/fa';
import authService from '../../services/authService';

const UserHeader = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Determine if a path is active
  const isActive = (path) => {
    if (path === '/user') {
      return location.pathname === '/user';
    }
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link to="/user" className="flex items-center gap-2">
          <div className="text-2xl font-bold text-green-600"><FaSeedling /></div>
          <div className="font-bold text-xl text-gray-900">MAP-Citrus</div>
        </Link>

        {/* Menu */}
        <nav className="hidden md:flex gap-6 items-center">
          <Link 
            to="/user" 
            className={`pb-2 border-b-2 transition ${
              isActive('/user') 
                ? 'text-green-600 border-green-600 font-medium' 
                : 'text-gray-700 border-transparent hover:text-green-600'
            }`}
          >
            Trang chủ
          </Link>
          <Link 
            to="/user/gardens" 
            className={`pb-2 border-b-2 transition ${
              isActive('/user/gardens') 
                ? 'text-green-600 border-green-600 font-medium' 
                : 'text-gray-700 border-transparent hover:text-green-600'
            }`}
          >
            Vườn cây
          </Link>
          <Link 
            to="/user/predict" 
            className={`pb-2 border-b-2 transition ${
              isActive('/user/predict') 
                ? 'text-green-600 border-green-600 font-medium' 
                : 'text-gray-700 border-transparent hover:text-green-600'
            }`}
          >
            Dự đoán
          </Link>
          <Link 
            to="/user/logs" 
            className={`pb-2 border-b-2 transition ${
              isActive('/user/logs') 
                ? 'text-green-600 border-green-600 font-medium' 
                : 'text-gray-700 border-transparent hover:text-green-600'
            }`}
          >
            Nhật ký
          </Link>
          <Link 
            to="/user/expenses" 
            className={`pb-2 border-b-2 transition ${
              isActive('/user/expenses') 
                ? 'text-green-600 border-green-600 font-medium' 
                : 'text-gray-700 border-transparent hover:text-green-600'
            }`}
          >
            Chi phí
          </Link>
          <Link 
            to="/user/statistics" 
            className={`pb-2 border-b-2 transition ${
              isActive('/user/statistics') 
                ? 'text-green-600 border-green-600 font-medium' 
                : 'text-gray-700 border-transparent hover:text-green-600'
            }`}
          >
            Thống kê
          </Link>
        </nav>

        {/* Avatar Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-10 h-10 bg-green-600 text-white rounded-full flex items-center justify-center font-bold hover:bg-green-700 transition"
          >
            {user.ho_ten?.charAt(0).toUpperCase()}
          </button>

          {showDropdown && (
            <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-4 py-3 border-b text-gray-700">
                <p className="font-bold">{user.ho_ten}</p>
                <p className="text-sm text-gray-500">{user.email}</p>
              </div>
              <Link
                to="/user/profile"
                className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 transition"
                onClick={() => setShowDropdown(false)}
              >
                <FaUser className="text-gray-500" /> Hồ sơ
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 text-left px-4 py-2 text-red-600 hover:bg-red-50 transition"
              >
                <FaSignOutAlt className="text-red-600" /> Đăng xuất
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default UserHeader;
