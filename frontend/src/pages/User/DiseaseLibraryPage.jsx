import React, { useEffect, useMemo, useState } from 'react';
import { FaBookOpen, FaImage, FaLeaf, FaSearch, FaTint, FaVial, FaChevronRight } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const diseaseImageBaseUrl = 'http://localhost:3000';

const DiseaseLibraryPage = () => {
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDisease, setSelectedDisease] = useState(null);
  const [activeView, setActiveView] = useState('info');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const diseasesRes = await apiClient.get('/diseases/library');

      const diseaseData = diseasesRes.data.data || [];

      setDiseases(diseaseData);
      setSelectedDisease(diseaseData[0] || null);
      setActiveView('info');
    } catch (error) {
      console.error('Lỗi tải thư viện bệnh:', error);
      toast.error('Không thể tải thư viện bệnh cây');
    } finally {
      setLoading(false);
    }
  };

  const diseaseCards = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return diseases.filter((disease) => {
      const name = disease.ten_benh || '';
      const nameEn = disease.ten_benh_en || '';
      return !term || name.toLowerCase().includes(term) || nameEn.toLowerCase().includes(term);
    });
  }, [diseases, searchTerm]);

  const selectedDiseaseImages = useMemo(() => {
    if (!selectedDisease) return [];

    const images = (selectedDisease.sample_images || []).map((image, index) => ({
      id: `${selectedDisease._id}-${index}`,
      src: `${diseaseImageBaseUrl}${image.url}`,
      name: image.name,
    }));

    // Shuffle (Fisher-Yates chuẩn)
    for (let i = images.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [images[i], images[j]] = [images[j], images[i]];
    }

    return images;
  }, [selectedDisease]);

  const getSeverityClass = (level) => {
    const mapping = {
      'Không': 'bg-gray-100 text-gray-700',
      'Thấp': 'bg-green-100 text-green-700',
      'Trung bình': 'bg-yellow-100 text-yellow-700',
      'Cao': 'bg-red-100 text-red-700',
    };
    return mapping[level] || 'bg-gray-100 text-gray-700';
  };

  return (
    <UserLayout>
      <div className="space-y-8">
        <section className="bg-white rounded-3xl shadow-lg border border-green-100 overflow-hidden">
          <div className="bg-gradient-to-r from-[#2d5a27] to-[#3d7a36] text-white px-8 py-10">
            <h1 className="text-3xl md:text-4xl font-bold mb-3 flex items-center gap-3">
              <FaBookOpen /> Thư viện bệnh cây
            </h1>
            <p className="max-w-3xl text-white/85 leading-relaxed">
              Chọn một bệnh bên dưới để xem mô tả, mức độ nguy hiểm và các hình ảnh mẫu bệnh.
            </p>
          </div>

          <div className="p-8">
            <div className="flex flex-col lg:flex-row gap-6">
              <div className="lg:w-[38%] space-y-4">
                <div className="relative">
                  <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Tìm bệnh..."
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-1 gap-4 max-h-[640px] overflow-y-auto pr-1">
                  {loading ? (
                    <div className="rounded-2xl border border-gray-200 p-6 text-gray-500">Đang tải dữ liệu bệnh...</div>
                  ) : diseaseCards.length === 0 ? (
                    <div className="rounded-2xl border border-gray-200 p-6 text-gray-500">Không tìm thấy bệnh phù hợp</div>
                  ) : (
                    diseaseCards.map((disease) => {
                      const isSelected = selectedDisease?._id === disease._id;

                      return (
                        <button
                          key={disease._id}
                          type="button"
                          onClick={() => setSelectedDisease(disease)}
                          onFocus={() => setActiveView('info')}
                          className={`text-left rounded-2xl border p-5 transition shadow-sm ${
                            isSelected
                              ? 'border-green-500 bg-green-50 ring-2 ring-green-200'
                              : 'border-gray-200 bg-white hover:border-green-300 hover:shadow-md'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <div>
                              <h3 className="font-semibold text-gray-900 leading-tight">{disease.ten_benh}</h3>
                              <p className="text-sm text-gray-500">{disease.ten_benh_en}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getSeverityClass(disease.muc_do_nguy_hiem)}`}>
                              {disease.muc_do_nguy_hiem}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 line-clamp-3 mb-4">{disease.mo_ta}</p>
                          <div className="flex items-center justify-between text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1"><FaLeaf /> {disease.sample_image_count || 0} ảnh mẫu</span>
                            <span className="inline-flex items-center gap-1 text-green-700 font-medium"><FaChevronRight /> Xem chi tiết</span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="lg:w-[62%]">
                {selectedDisease ? (
                  <div className="space-y-6">
                    <div className="rounded-3xl border border-gray-200 bg-white p-6">
                      <div className="flex flex-col gap-3 mb-6">
                        <div className="grid w-full grid-cols-2 gap-2 rounded-2xl bg-gray-100 p-1">
                          <button
                            type="button"
                            onClick={() => setActiveView('info')}
                            className={`w-full justify-center px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                              activeView === 'info'
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <FaVial /> Thông tin bệnh
                          </button>
                          <button
                            type="button"
                            onClick={() => setActiveView('images')}
                            className={`w-full justify-center px-4 py-2 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${
                              activeView === 'images'
                                ? 'bg-green-600 text-white shadow-sm'
                                : 'text-gray-600 hover:text-gray-900'
                            }`}
                          >
                            <FaImage /> Hình ảnh bệnh
                            <span className="text-xs opacity-80">({selectedDiseaseImages.length})</span>
                          </button>
                        </div>

                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">{selectedDisease.ten_benh}</h2>
                          <p className="text-gray-500">{selectedDisease.ten_benh_en}</p>
                        </div>
                      </div>

                      {activeView === 'info' ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-700">
                          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                            <p className="font-semibold text-gray-900 mb-2">Mô tả</p>
                            <p className="leading-relaxed">{selectedDisease.mo_ta}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                            <p className="font-semibold text-gray-900 mb-2">Triệu chứng</p>
                            <p className="leading-relaxed">{selectedDisease.trieu_chung || 'Chưa cập nhật'}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                            <p className="font-semibold text-gray-900 mb-2">Nguyên nhân</p>
                            <p className="leading-relaxed">{selectedDisease.nguyen_nhan || 'Chưa cập nhật'}</p>
                          </div>
                          <div className="rounded-2xl bg-gray-50 border border-gray-200 p-4">
                            <p className="font-semibold text-gray-900 mb-2">Hướng xử lý</p>
                            <p className="leading-relaxed">{selectedDisease.huong_xu_ly}</p>
                          </div>
                        </div>
                      ) : (
                        <div>
                          {selectedDiseaseImages.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-300 p-10 text-center text-gray-500">
                              Chưa có hình ảnh mẫu nào cho bệnh này.
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 max-h-[560px] overflow-y-auto pr-1">
                              {selectedDiseaseImages.map((image) => (
                                <div key={image.id} className="rounded-2xl border border-gray-200 overflow-hidden bg-gray-50 shadow-sm">
                                  <img
                                    src={image.src}
                                    alt={selectedDisease.ten_benh}
                                    className="h-44 w-full object-cover"
                                    onError={(event) => {
                                      event.currentTarget.style.display = 'none';
                                    }}
                                  />
                                  <div className="p-4 text-sm text-gray-600">
                                    <div className="flex items-center justify-between gap-3 mb-2">
                                      <span className="inline-flex items-center gap-1 text-green-700 font-medium">
                                        <FaTint /> {image.name}
                                      </span>
                                    </div>
                                    <p className="text-gray-700">Ảnh mẫu ban đầu từ organized_dataset.</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center text-gray-500 h-full flex items-center justify-center min-h-[520px]">
                    <div>
                      <FaVial className="text-4xl text-green-600 mx-auto mb-4" />
                      <p className="text-lg font-medium text-gray-700">Chọn một bệnh để xem thông tin và hình ảnh liên quan</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </UserLayout>
  );
};

export default DiseaseLibraryPage;