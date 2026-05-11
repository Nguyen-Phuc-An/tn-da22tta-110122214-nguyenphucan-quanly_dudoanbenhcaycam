import React from 'react';
import UserHeader from './UserHeader';
import UserFooter from './UserFooter';

const UserLayout = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <UserHeader />
      <main className="max-w-7xl mx-auto px-4 py-8 w-full flex-1">
        {children}
      </main>
      <UserFooter />
    </div>
  );
};

export default UserLayout;
