import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PrivateRoute from './components/Layout/PrivateRoute';
import AdminRoute from './components/Admin/AdminRoute';
import AdminDashboardPage from './pages/Admin/AdminDashboardPage';
import UsersPage from './pages/Admin/UsersPage';
import GardensPage from './pages/Admin/GardensPage';
import DiseasesPage from './pages/Admin/DiseasesPage';
import PredictionsPage from './pages/Admin/PredictionsPage';
import ChatPage from './pages/Admin/ChatPage';
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
import UserLogsPage from './pages/User/LogsPage';
import PredictPage from './pages/User/PredictPage';
import UserExpensesPage from './pages/User/ExpensesPage';
import StatisticsPage from './pages/User/StatisticsPage';
import ProfilePage from './pages/User/ProfilePage';
import GuidePage from './pages/User/GuidePage';
import PrivacyPage from './pages/User/PrivacyPage';
import DiseaseLibraryPage from './pages/User/DiseaseLibraryPage';
import authService from './services/authService';

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

function App() {
  useEffect(() => {
    // Check if user is already logged in (for page refresh)
    const token = authService.getToken();
    if (token) {
      console.log('✓ User is logged in');
    }
  }, []);

  return (
    <>
      <BrowserRouter>
        <ScrollToTop />
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

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
          <Route
            path="/admin/chat"
            element={
              <AdminRoute>
                <ChatPage />
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
