import React from 'react';
import { FaTools, FaLock, FaLeaf } from 'react-icons/fa';

const MaintenancePage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12 bg-[radial-gradient(circle_at_top,rgba(59,130,246,0.18),transparent_36%),linear-gradient(135deg,#0f172a_0%,#111827_45%,#1f2937_100%)] text-white">
      <div className="max-w-3xl w-full rounded-3xl border border-white/10 bg-white/10 backdrop-blur-xl shadow-2xl p-8 md:p-12 text-center font-sans">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-2xl bg-white/15 border border-white/10 mb-6">
          <FaTools className="text-3xl text-amber-300" />
        </div>

        <p className="inline-flex items-center gap-2 rounded-full border border-amber-300/40 bg-amber-300/10 px-4 py-2 text-sm font-medium text-amber-200 mb-5">
          <FaLock /> Hệ thống đang bảo trì
        </p>

        <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 leading-tight">
          Chúng tôi đang nâng cấp hệ thống
        </h1>

        <p className="text-base md:text-lg text-slate-200 leading-relaxed max-w-xl mx-auto">
          Trang web tạm thời bị khóa để admin chỉnh sửa, huấn luyện lại mô hình hoặc cập nhật dữ liệu.
          Vui lòng quay lại sau khi hệ thống được mở khóa.
        </p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4 text-left">
          {[
            'Đang bảo trì và cập nhật mô hình ML',
            'Không ảnh hưởng đến dữ liệu đã lưu',
            'Sẽ mở lại khi admin hoàn tất thao tác',
          ].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/10 px-4 py-4 text-sm text-slate-100 leading-relaxed">
              <div className="flex items-start gap-3">
                <FaLeaf className="mt-1 text-emerald-300" />
                <span>{item}</span>
              </div>
            </div>
          ))}
        </div>

        <p className="mt-8 text-xs text-slate-300/80">
          Hệ thống quản lý vườn cây & dự đoán bệnh
        </p>
      </div>
    </div>
  );
};

export default MaintenancePage;