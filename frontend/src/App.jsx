import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import PrivateRoute from './components/Layout/PrivateRoute';
import AdminRoute from './components/Admin/AdminRoute';
import AdminDashboardPage from './pages/Admin/AdminDashboardPage';
import UsersPage from './pages/Admin/UsersPage';
import GardensPage from './pages/Admin/GardensPage';
import DiseasesPage from './pages/Admin/DiseasesPage';
import PredictionsPage from './pages/Admin/PredictionsPage';
import NotificationsPage from './pages/Admin/NotificationsPage';
import ChangePasswordPage from './pages/Admin/ChangePasswordPage';
import SeasonsPage from './pages/Admin/SeasonsPage';
import AdminExpensesPage from './pages/Admin/ExpensesPage';
import AdminLogsPage from './pages/Admin/LogsPage';
import AdminTasksPage from './pages/Admin/TasksPage';
// ===== CẬP NHẬT: Thêm FertilizerPage & PesticidePage =====
import FertilizerPage from './pages/Admin/FertilizerPage';
import PesticidePage from './pages/Admin/PesticidePage';
// ===== CẬP NHẬT: Thêm MLTrainingPage =====
import MLTrainingPage from './pages/Admin/MLTrainingPage';
// User Pages
import HomePage from './pages/User/HomePage';
import UserGardensPage from './pages/User/GardensPage';
import GardenDetailPage from './pages/User/GardenDetailPage';
import UserLogsPage from './pages/User/LogsPage';
import PredictPage from './pages/User/PredictPage';
import UserExpensesPage from './pages/User/ExpensesPage';
import StatisticsPage from './pages/User/StatisticsPage';
import ProfilePage from './pages/User/ProfilePage';
import GuidePage from './pages/User/GuidePage';
import PrivacyPage from './pages/User/PrivacyPage';
import DiseaseLibraryPage from './pages/User/DiseaseLibraryPage';
import MaintenancePage from './pages/System/MaintenancePage';
import authService from './services/authService';
import apiClient from './services/apiClient';

const RootRedirect = () => {
  if (!authService.isLoggedIn()) {
    return <Navigate to="/login" replace />;
  }

  const user = authService.getCurrentUser();
  return <Navigate to={user?.vai_tro === 'admin' ? '/admin' : '/user'} replace />;
};

const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [location.pathname, location.search]);

  return null;
};

const MaintenanceGate = ({ children, maintenanceMode, loading }) => {
  const location = useLocation();
  const user = authService.getCurrentUser();
  const isAdmin = user?.vai_tro === 'admin';
  const isAuthPage = location.pathname === '/login';
  const isMaintenancePage = location.pathname === '/maintenance';
  const isAdminPath = location.pathname.startsWith('/admin');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="text-center space-y-3">
          <div className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white animate-spin mx-auto" />
          <p className="text-sm text-slate-300">Đang kiểm tra trạng thái hệ thống...</p>
        </div>
      </div>
    );
  }

  if (!maintenanceMode) {
    if (isMaintenancePage) {
      return <RootRedirect />;
    }

    return children;
  }

  if (isMaintenancePage) {
    return children;
  }

  if (isAuthPage) {
    return children;
  }

  if (isAdmin && isAdminPath) {
    return children;
  }

  return <Navigate to="/maintenance" replace />;
};

function App() {
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceLoading, setMaintenanceLoading] = useState(true);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const syncCurrentUser = async () => {
      const token = authService.getToken();

      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const response = await apiClient.get('/auth/profile');
        if (response.data.success && response.data.data) {
          localStorage.setItem('user', JSON.stringify(response.data.data));
        }
      } catch (error) {
        console.error('❌ Failed to sync current user:', error);
      } finally {
        setAuthLoading(false);
      }
    };

    syncCurrentUser();
  }, []);

  useEffect(() => {
    const loadMaintenanceStatus = async () => {
      try {
        const res = await apiClient.get('/system/maintenance');
        if (res.data.success) {
          setMaintenanceMode(Boolean(res.data.data?.maintenanceMode));
        }
      } catch (error) {
        console.error('❌ Failed to load maintenance status:', error);
      } finally {
        setMaintenanceLoading(false);
      }
    };

    loadMaintenanceStatus();
  }, []);

  return (
    <>
      <BrowserRouter>
        <ScrollToTop />
        {authLoading ? (
          <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
            <div className="text-center space-y-3">
              <div className="h-12 w-12 rounded-full border-4 border-white/20 border-t-white animate-spin mx-auto" />
              <p className="text-sm text-slate-300">Đang xác thực tài khoản...</p>
            </div>
          </div>
        ) : (
          <MaintenanceGate maintenanceMode={maintenanceMode} loading={maintenanceLoading}>
          <Routes>
            {/* Auth Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<Navigate to="/login" replace />} />
            <Route path="/maintenance" element={<MaintenancePage />} />

            {/* Root route - redirect based on role */}
            <Route
              path="/"
              element={<RootRedirect />}
            />

            {/* User Routes */}
            <Route
              path="/user"
              element={
                <PrivateRoute>
                  <HomePage />
                </PrivateRoute>
              }
            />
          <Route
            path="/user/gardens"
            element={
              <PrivateRoute>
                <UserGardensPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/gardens/new"
            element={
              <PrivateRoute>
                <UserGardensPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/gardens/:id"
            element={
              <PrivateRoute>
                <GardenDetailPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/gardens/:id/edit"
            element={
              <PrivateRoute>
                <UserGardensPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/logs"
            element={
              <PrivateRoute>
                <UserLogsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/logs/new"
            element={
              <PrivateRoute>
                <UserLogsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/predict"
            element={
              <PrivateRoute>
                <PredictPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/expenses"
            element={
              <PrivateRoute>
                <UserExpensesPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/expenses/new"
            element={
              <PrivateRoute>
                <UserExpensesPage />
              </PrivateRoute>
            }
          />
          <Route

            path="/user/statistics"
            element={
              <PrivateRoute>
                <StatisticsPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/profile"
            element={
              <PrivateRoute>
                <ProfilePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/guide"
            element={
              <PrivateRoute>
                <GuidePage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/privacy"
            element={
              <PrivateRoute>
                <PrivacyPage />
              </PrivateRoute>
            }
          />
          <Route
            path="/user/disease-library"
            element={
              <PrivateRoute>
                <DiseaseLibraryPage />
              </PrivateRoute>
            }
          />

            {/* Admin Routes */}
            <Route
              path="/admin"
              element={
                <AdminRoute>
                  <AdminDashboardPage />
                </AdminRoute>
              }
            />
          <Route
            path="/admin/users"
            element={
              <AdminRoute>
                <UsersPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/gardens"
            element={
              <AdminRoute>
                <GardensPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/diseases"
            element={
              <AdminRoute>
                <DiseasesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/predictions"
            element={
              <AdminRoute>
                <PredictionsPage />
              </AdminRoute>
            }
          />
          <Route path="/admin/ml-monitoring" element={<Navigate to="/admin" replace />} />
          <Route
            path="/admin/notifications"
            element={
              <AdminRoute>
                <NotificationsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/change-password"
            element={
              <AdminRoute>
                <ChangePasswordPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/seasons"
            element={
              <AdminRoute>
                <SeasonsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/expenses"
            element={
              <AdminRoute>
                <AdminExpensesPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/logs"
            element={
              <AdminRoute>
                <AdminLogsPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/tasks"
            element={
              <AdminRoute>
                <AdminTasksPage />
              </AdminRoute>
            }
          />

          {/* ===== CẬP NHẬT: Thêm routes cho Fertilizer & Pesticide ===== */}
          <Route
            path="/admin/fertilizers"
            element={
              <AdminRoute>
                <FertilizerPage />
              </AdminRoute>
            }
          />
          <Route
            path="/admin/pesticides"
            element={
              <AdminRoute>
                <PesticidePage />
              </AdminRoute>
            }
          />
          {/* ===== CẬP NHẬT: Thêm route cho MLTrainingPage ===== */}
          <Route
            path="/admin/ml-training"
            element={
              <AdminRoute>
                <MLTrainingPage />
              </AdminRoute>
            }
          />

            {/* Catch all */}
            <Route path="*" element={<RootRedirect />} />
          </Routes>
          </MaintenanceGate>
        )}
      </BrowserRouter>

      {/* Toast Notification */}
      <Toaster
        position="top-right"
        reverseOrder={false}
        gutter={8}
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
            borderRadius: '8px',
            padding: '16px',
          },
          success: {
            style: {
              background: '#22c55e',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#22c55e',
            },
          },
          error: {
            style: {
              background: '#ef4444',
            },
            iconTheme: {
              primary: '#fff',
              secondary: '#ef4444',
            },
          },
        }}
      />
    </>
  );
}

export default App;
