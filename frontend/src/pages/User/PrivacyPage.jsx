import React from 'react';
import { FaShieldAlt, FaLock, FaDatabase, FaUserShield, FaEnvelope } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';

const policyItems = [
  {
    icon: FaLock,
    title: 'Bảo mật tài khoản',
    text: 'Mỗi tài khoản được bảo vệ bằng mật khẩu và phiên đăng nhập riêng. Hãy đăng xuất sau khi sử dụng trên thiết bị công cộng.',
  },
  {
    icon: FaDatabase,
    title: 'Lưu trữ dữ liệu',
    text: 'Hệ thống chỉ lưu dữ liệu cần thiết cho quản lý vườn, nhật ký, chi phí và kết quả dự đoán.',
  },
  {
    icon: FaUserShield,
    title: 'Phạm vi sử dụng',
    text: 'Dữ liệu của bạn được dùng để vận hành tính năng của MAP Citrus và không chia sẻ tùy tiện cho bên thứ ba.',
  },
];

const PrivacyPage = () => {
  return (
    <UserLayout>
      <div className="space-y-8">
        <section className="bg-white rounded-3xl shadow-lg border border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#2d5a27] to-[#3d7a36] text-white px-8 py-10">
            <p className="uppercase tracking-[0.25em] text-white/70 text-xs mb-3">Tài liệu</p>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center gap-3">
              <FaShieldAlt /> Chính sách bảo mật
            </h1>
            <p className="max-w-3xl text-white/85 leading-relaxed">
              Trang này mô tả cách MAP Citrus thu thập, lưu trữ và sử dụng dữ liệu trong phạm vi chức năng của hệ thống.
            </p>
          </div>

          <div className="p-8 space-y-5">
            {policyItems.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title} className="rounded-2xl border border-gray-200 p-5 bg-gray-50 flex gap-4">
                  <div className="h-12 w-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center shrink-0">
                    <Icon />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">{item.title}</h2>
                    <p className="text-gray-600 leading-relaxed">{item.text}</p>
                  </div>
                </div>
              );
            })}

            <div className="rounded-2xl bg-green-50 border border-green-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FaEnvelope className="text-green-600" /> Liên hệ
              </h3>
              <p className="text-gray-700 leading-relaxed">
                Nếu bạn có câu hỏi về quyền riêng tư hoặc muốn chỉnh sửa dữ liệu, vui lòng liên hệ qua email
                <span className="font-semibold"> anphuc1203@gmail.com</span>.
              </p>
            </div>
          </div>
        </section>
      </div>
    </UserLayout>
  );
};

export default PrivacyPage;