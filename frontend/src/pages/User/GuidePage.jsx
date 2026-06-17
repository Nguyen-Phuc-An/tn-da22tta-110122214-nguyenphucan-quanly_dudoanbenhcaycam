import React from 'react';
import { FaBook, FaLeaf, FaSearch, FaBrain, FaCamera, FaClipboardList, FaShieldAlt, FaArrowRight } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';

const steps = [
  {
    icon: FaLeaf,
    title: 'Quản lý vườn',
    description: 'Thêm và theo dõi thông tin vườn cây, mùa vụ, diện tích và loại cây.',
  },
  {
    icon: FaCamera,
    title: 'Chẩn đoán AI',
    description: 'Tải ảnh lá cây để hệ thống phân tích bệnh và trả kết quả dự đoán.',
  },
  {
    icon: FaClipboardList,
    title: 'Nhật ký & chi phí',
    description: 'Ghi nhận hoạt động canh tác, chi phí chăm sóc và lịch sử theo từng vườn.',
  },
  {
    icon: FaSearch,
    title: 'Tra cứu nhanh',
    description: 'Xem thống kê, khám phá bệnh cây và tìm hướng xử lý phù hợp.',
  },
];

const GuidePage = () => {
  return (
    <UserLayout>
      <div className="space-y-8">
        <section className="bg-white rounded-3xl shadow-lg border border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#2d5a27] to-[#3d7a36] text-white px-8 py-10">
            <p className="uppercase tracking-[0.25em] text-white/70 text-xs mb-3">Tài liệu</p>
            <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center gap-3">
              <FaBook /> Hướng dẫn sử dụng
            </h1>
            <p className="max-w-3xl text-white/85 leading-relaxed">
              MAP Citrus được thiết kế để hỗ trợ người dùng quản lý vườn cây, ghi nhận hoạt động canh tác,
              theo dõi bệnh hại và dự đoán bằng AI theo cách trực quan, nhanh gọn.
            </p>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {steps.map((step) => {
                const Icon = step.icon;
                return (
                  <div key={step.title} className="rounded-2xl border border-gray-200 bg-gray-50 p-5 hover:shadow-md transition">
                    <div className="h-12 w-12 rounded-xl bg-green-100 text-green-700 flex items-center justify-center mb-4">
                      <Icon />
                    </div>
                    <h2 className="text-xl font-semibold text-gray-900 mb-2">{step.title}</h2>
                    <p className="text-gray-600 leading-relaxed">{step.description}</p>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-green-50 border border-green-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FaArrowRight className="text-green-600" /> Các bước bắt đầu nhanh
                </h3>
                <ol className="space-y-3 text-gray-700 list-decimal list-inside">
                  <li>Vào trang Bảng điều khiển để xem tổng quan.</li>
                  <li>Thêm vườn và mùa vụ trước khi ghi nhật ký hay chi phí.</li>
                  <li>Dùng mục Chẩn đoán AI để dự đoán bệnh từ ảnh lá cây.</li>
                  <li>Tra cứu bệnh trong Thư viện bệnh cây để xem mô tả và hình ảnh mẫu.</li>
                </ol>
              </div>

              <div className="rounded-2xl bg-white border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <FaShieldAlt className="text-green-600" /> Lưu ý sử dụng
                </h3>
                <ul className="space-y-3 text-gray-700">
                  <li>• Nên chụp ảnh lá cây rõ nét, đủ sáng để AI nhận diện tốt hơn.</li>
                  <li>• Ghi nhật ký thường xuyên để dễ theo dõi tình trạng vườn.</li>
                  <li>• Tên bệnh và hướng xử lý chỉ mang tính hỗ trợ tham khảo.</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </div>
    </UserLayout>
  );
};

export default GuidePage;