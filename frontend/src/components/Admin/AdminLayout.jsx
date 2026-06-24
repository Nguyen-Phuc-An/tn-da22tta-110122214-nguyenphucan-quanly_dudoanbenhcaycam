import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { FaChartBar, FaUsers, FaLeaf, FaCalendar, FaDollarSign, FaClipboard, FaCheckCircle, FaVirus, FaCamera, FaFlask, FaPills, FaCog, FaKey, FaSignOutAlt, FaBell } from 'react-icons/fa';
import authService from '../../services/authService';

const AdminLayout = ({ children }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  const user = authService.getCurrentUser();

  const handleLogout = () => {
    authService.logout();
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  const menuItems = [
    { label: '📊 Tổng Hợp', path: '/admin', icon: FaChartBar },
    { label: '👥 Người Dùng', path: '/admin/users', icon: FaUsers },
    { label: '🌱 Vườn', path: '/admin/gardens', icon: FaLeaf },
    { label: '📅 Mùa Vụ', path: '/admin/seasons', icon: FaCalendar },
    { label: '💰 Chi Phí', path: '/admin/expenses', icon: FaDollarSign },
    { label: '📝 Nhật Ký Canh Tác', path: '/admin/logs', icon: FaClipboard },
    { label: '✅ Công Việc', path: '/admin/tasks', icon: FaCheckCircle },
    { label: '🦠 Bệnh', path: '/admin/diseases', icon: FaVirus },
    { label: '📸 Nhật Ký Bệnh', path: '/admin/predictions', icon: FaCamera },
    { label: '🔔 Thông Báo', path: '/admin/notifications', icon: FaBell },
    { label: '🌾 Phân Bón', path: '/admin/fertilizers', icon: FaFlask },
    { label: '💊 Thuốc', path: '/admin/pesticides', icon: FaPills },
    { label: '⚙️ Đào Tạo ML', path: '/admin/ml-training', icon: FaCog },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } bg-gray-900 text-white transition-all duration-300 flex flex-col shadow-xl`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-gray-700 flex items-center justify-between">
          {sidebarOpen && (
            <h2 className="text-xl font-bold text-primary flex items-center gap-2"><FaLeaf /> MAP-Citrus</h2>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white"
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>

        {/* Menu */}
        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          {menuItems.map((item) => {
            const IconComponent = item.icon;
            const labelText = item.label.split(' ').slice(1).join(' '); // Remove emoji prefix
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center gap-3 px-4 py-3 rounded-lg transition ${
                    isActive(item.path)
                      ? 'bg-primary text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }
                `}
                title={sidebarOpen ? '' : labelText}
              >
                <IconComponent size={18} className="flex-shrink-0" />
                {sidebarOpen && <span>{labelText}</span>}
              </Link>
            );
          })}
        </nav>

        {/* Logout */}
        <div className="p-4 border-t border-gray-700 space-y-2">
          <Link
            to="/admin/change-password"
            className={`
              flex items-center gap-3 px-4 py-2 rounded-lg transition text-sm ${
                isActive('/admin/change-password')
                  ? 'bg-primary text-white'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }
            `}
          >
            <FaKey size={16} className="flex-shrink-0" />
            {sidebarOpen && <span>Đổi Mật Khẩu</span>}
          </Link>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg transition text-sm"
          >
            <FaSignOutAlt size={16} className="flex-shrink-0" />
            {sidebarOpen && <span>Đăng Xuất</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {/* <header className="bg-white shadow-sm p-6 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">Bảng Điều Khiển Admin</h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-sm text-gray-600">Quản Trị Viên</p>
              <p className="font-semibold text-gray-900">{user?.ho_ten}</p>
            </div>
            <div className="w-10 h-10 bg-primary rounded-full flex items-center justify-center text-white font-bold">
              {user?.ho_ten?.[0] || 'A'}
            </div>
          </div>
        </header> */}

        {/* Content */}
        <main className="admin-border-scope flex-1 overflow-auto p-6">
          <style>{`
            .admin-border-scope :where([class*="border"]) {
              border-color: rgb(17 24 39 / var(--tw-bg-opacity, 1)) !important;
            }
          `}</style>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
