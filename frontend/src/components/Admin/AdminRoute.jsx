import React from 'react';
import { Navigate } from 'react-router-dom';
import authService from '../../services/authService';

const AdminRoute = ({ children }) => {
  const user = authService.getCurrentUser();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Check if user is admin (vai_tro = 'admin')
  if (user.vai_tro !== 'admin') {
    return <Navigate to="/user" replace />;
  }

  return children;
};

export default AdminRoute;
