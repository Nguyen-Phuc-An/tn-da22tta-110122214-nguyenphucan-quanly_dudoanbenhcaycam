import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { FaUser, FaSignOutAlt, FaSeedling, FaBell, FaTimes } from 'react-icons/fa';
import authService from '../../services/authService';
import notificationService from '../../services/notificationService';

const UserHeader = () => {
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const navigate = useNavigate();
  const location = useLocation();
  const avatarRef = useRef(null);
  const bellRef = useRef(null);
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

  const unreadCount = notifications.filter((item) => !item.da_doc).length;

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        const response = await notificationService.getActiveNotifications();
        setNotifications(response.data || []);
      } catch (error) {
        console.error('❌ Lỗi tải thông báo:', error);
      }
    };

    loadNotifications();
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (avatarRef.current && !avatarRef.current.contains(event.target)) {
        setShowDropdown(false);
      }

      if (bellRef.current && !bellRef.current.contains(event.target)) {
        setShowNotificationDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleNotificationClick = async (notification) => {
    try {
      await notificationService.markAsRead(notification._id);
      setNotifications((prev) =>
        prev.map((item) =>
          item._id === notification._id ? { ...item, da_doc: true } : item
        )
      );
    } catch (error) {
      console.error('❌ Lỗi đánh dấu thông báo đã đọc:', error);
    }

    setShowNotificationDropdown(false);

    if (notification.link) {
      navigate(notification.link);
    }
  };

  return (
    <header className="bg-white shadow-md sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
        {/* Logo */}
        <Link to="/user" className="flex items-center gap-2">
          <div className="text-2xl font-bold text-green-600"><FaSeedling /></div>
          <div className="font-bold text-xl text-green-600">MAP Citrus</div>
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

        <div className="flex items-center gap-4">
          <div className="relative" ref={bellRef}>
            <button
              onClick={() => setShowNotificationDropdown((prev) => !prev)}
              className="relative flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 bg-white text-gray-700 transition hover:bg-gray-50"
              aria-label="Thông báo"
            >
              <FaBell className="text-lg" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-green-500 ring-2 ring-white" />
              )}
            </button>

            {showNotificationDropdown && (
              <div className="absolute right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
                <div className="flex items-center justify-between border-b px-4 py-3">
                  <div>
                    <p className="font-bold text-gray-900">Thông báo</p>
                    <p className="text-xs text-gray-500">
                      {notifications.length} thông báo đang hoạt động, {unreadCount} chưa đọc
                    </p>
                  </div>
                  <button
                    onClick={() => setShowNotificationDropdown(false)}
                    className="rounded-full p-2 text-gray-500 hover:bg-gray-100"
                    aria-label="Đóng"
                  >
                    <FaTimes />
                  </button>
                </div>

                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="px-4 py-6 text-center text-sm text-gray-500">
                      Không có thông báo mới.
                    </div>
                  ) : (
                    notifications.map((notification) => (
                      <button
                        key={notification._id}
                        onClick={() => handleNotificationClick(notification)}
                        className={`block w-full border-b px-4 py-3 text-left transition last:border-b-0 ${
                          notification.da_doc
                            ? 'bg-white hover:bg-gray-50'
                            : 'bg-blue-50 hover:bg-blue-100'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {!notification.da_doc && <span className="mt-2 h-2.5 w-2.5 rounded-full bg-blue-600 flex-shrink-0" />}
                          <div className="min-w-0 flex-1">
                            <p className={`text-sm ${notification.da_doc ? 'font-medium text-gray-800' : 'font-semibold text-gray-900'}`}>
                              {notification.tieu_de}
                            </p>
                            <p className={`mt-1 text-xs leading-relaxed ${notification.da_doc ? 'text-gray-500' : 'text-gray-700'}`}>
                              {notification.noi_dung}
                            </p>
                            {notification.link && (
                              <p className="mt-2 text-xs text-blue-600">Nhấn để xem chi tiết</p>
                            )}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Avatar Dropdown */}
          <div className="relative" ref={avatarRef}>
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
      </div>
    </header>
  );
};

export default UserHeader;
