import React from 'react';
import { Link } from 'react-router-dom';
import { FaSeedling, FaChevronRight, FaBook, FaEnvelope, FaMapMarkerAlt, FaCompass } from 'react-icons/fa';
import logoDHTV from './LogoDHTV.png';

const footerLinks = [
  { label: 'Trang chủ', to: '/user' },
  { label: 'Nhật ký canh tác', to: '/user/logs' },
  { label: 'Thống kê', to: '/user/statistics' },
  { label: 'Chẩn đoán AI', to: '/user/predict' },
];

const documentLinks = [
  { label: 'Hướng dẫn sử dụng', to: '/user/guide' },
  { label: 'Thư viện bệnh cây', to: '/user/disease-library' },
  { label: 'Chính sách bảo mật', to: '/user/privacy' },
];

const UserFooter = () => {
  return (
    <footer className="bg-[#2d5a27] text-white font-sans">
      <div className="max-w-7xl mx-auto px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-16 w-16 rounded-full bg-white border border-white/30 flex items-center justify-center shrink-0 overflow-hidden p-1.5 shadow-lg shadow-black/10">
                <img src={logoDHTV} alt="Logo trường" className="h-full w-full object-contain" />
              </div>
              <div>
                <h3 className="text-2xl font-bold leading-tight">MAP Citrus</h3>
              </div>
            </div>
            <p className="text-white/85 leading-relaxed max-w-sm">
              Hệ thống quản lý vườn cây và hỗ trợ dự đoán một số bệnh trên cây có múi.
            </p>
            <div className="mt-5 flex items-center gap-2 text-white/75 text-sm">
              <FaSeedling className="text-white" />
              <span>Chăm cây chủ động, canh tác hiệu quả hơn mỗi ngày.</span>
            </div>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaCompass className="text-white/70" /> Điều hướng
            </h4>
            <ul className="space-y-3">
              {footerLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="inline-flex items-center gap-2 text-white/85 hover:text-white transition"
                  >
                    <FaChevronRight className="text-xs text-white/60" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaBook className="text-white/70" /> Tài liệu
            </h4>
            <ul className="space-y-3">
              {documentLinks.map((item) => (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    className="inline-flex items-center gap-2 text-white/85 hover:text-white transition"
                  >
                    <FaChevronRight className="text-xs text-white/60" />
                    <span>{item.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <FaEnvelope className="text-white/70" /> Liên hệ
            </h4>
            <ul className="space-y-4 text-white/85">
              <li>
                <p className="font-medium text-white">Nguyễn Phúc An</p>
              </li>
              <li className="flex items-start gap-3">
                <FaEnvelope className="mt-1 text-white/70 shrink-0" />
                <a href="mailto:anphuc1203@gmail.com" className="hover:text-white transition break-all">
                  anphuc1203@gmail.com
                </a>
              </li>
              <li className="flex items-start gap-3">
                <FaMapMarkerAlt className="mt-1 text-white/70 shrink-0" />
                <span>Trường Kỹ thuật & Công nghệ, Đại học Trà Vinh</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 pt-3 border-t border-white/15 flex flex-col md:flex-row items-center justify-center text-center gap-3 text-sm text-white/75">
          <p>© 2026 MAP Citrus. Giảng viên hướng dẫn: Phạm Minh Đương.</p>
        </div>
      </div>
    </footer>
  );
};

export default UserFooter;