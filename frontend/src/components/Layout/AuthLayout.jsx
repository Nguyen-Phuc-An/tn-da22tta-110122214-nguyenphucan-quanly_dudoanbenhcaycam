import React from 'react';

const AuthLayout = ({ children, title, subtitle, backgroundImage }) => {
  const backgroundStyle = backgroundImage
    ? {
        backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.45), rgba(15, 23, 42, 0.45)), url(${backgroundImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
      }
    : undefined;

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4" style={backgroundStyle}>
      <div className="auth-card" style={{ backgroundColor: 'rgba(255, 255, 255, 0.7)' }}>
        {/* Logo / Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-green-700 mb-2">{title}</h1>
          {subtitle && (
            <p className="text-green-700 text-sm">{subtitle}</p>
          )}
        </div>

        {/* Form Content */}
        <div className="space-y-6">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
