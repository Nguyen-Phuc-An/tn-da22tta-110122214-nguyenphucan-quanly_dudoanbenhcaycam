import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const GardensPage = () => {
  const navigate = useNavigate();
  const [gardens, setGardens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  

  useEffect(() => {
    fetchGardens();
  }, []);

  const fetchGardens = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/gardens');
      console.log('✓ Gardens loaded:', res.data.data?.length || 0);
      setGardens(res.data.data || []);
    } catch (err) {
      console.error('Error fetching gardens:', err);
      toast.error('Không thể tải danh sách vườn');
    } finally {
      setLoading(false);
    }
  };

  // edit/delete functionality removed for users page

  const filteredGardens = gardens.filter(
    (garden) =>
      garden.ten_vuon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      garden.dia_chi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <UserLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Vườn Của Tôi</h1>
        </div>

        {/* Create/Edit form removed for users */}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Tìm kiếm theo tên vườn hoặc địa chỉ..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải vườn...</div>
          ) : filteredGardens.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              {gardens.length === 0 ? (
                <>
                  <p className="mb-4">🌳 Chưa có vườn nào</p>
                </>
              ) : (
                <p>Không tìm thấy vườn phù hợp</p>
              )}
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Tên Vườn
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Địa Chỉ
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Diện Tích
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                    Mùa Vụ
                  </th>
              
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredGardens.map((garden) => (
                  <tr
                      key={garden._id}
                      onClick={() => {
                        if (garden.trang_thai === 'Ngưng hoạt động') return;
                        navigate(`/user/gardens/${garden._id}`);
                      }}
                      className={`transition ${garden.trang_thai === 'Ngưng hoạt động' ? 'bg-red-50 text-red-700 opacity-90 cursor-not-allowed' : 'hover:bg-gray-50 cursor-pointer'}`}
                    >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900 font-medium">{garden.ten_vuon}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900">{garden.dia_chi}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-gray-900">{garden.dien_tich} {garden.don_vi || 'm²'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {garden.season_id ? (
                        <div className="flex flex-col gap-1">
                          <span className="text-gray-900 font-medium">{garden.season_id.ten_mua_vu}</span>
                          <span className={`text-xs px-2 py-1 rounded-full w-fit ${
                            garden.season_id.trang_thai === 'Đang diễn ra'
                              ? 'bg-green-100 text-green-700'
                              : garden.season_id.trang_thai === 'Sắp diễn ra'
                              ? 'bg-yellow-100 text-yellow-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {garden.season_id.trang_thai}
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 italic">Chưa có</span>
                      )}
                    </td>
                    
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Delete confirmation removed */}
      </div>
    </UserLayout>
  );
};

export default GardensPage;
