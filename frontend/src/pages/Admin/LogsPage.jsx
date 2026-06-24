import React, { useState, useEffect } from 'react';
import { FaArrowLeft } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const LogsPage = () => {
  const [logs, setLogs] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [gardenSearch, setGardenSearch] = useState('');
  const [viewMode, setViewMode] = useState('season'); // season | user | gardens | logs
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGarden, setSelectedGarden] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  // Read-only logs page: remove create/edit/delete UI
  const { watch } = useForm();

  useEffect(() => {
    fetchLogs();
    fetchGardens();
    fetchSeasons();
    // no users fetch (user list removed)
    fetchTasks();
  }, []);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/logs/admin/all');
      setLogs(res.data.data || []);
    } catch (err) {
      console.error('Error fetching logs:', err);
      toast.error('Không thể tải danh sách nhật ký');
    } finally {
      setLoading(false);
    }
  };

  const fetchGardens = async () => {
    try {
      const res = await apiClient.get('/gardens');
      setGardens(res.data.data || []);
    } catch (err) {
      console.error('Error fetching gardens:', err);
    }
  };

  const fetchSeasons = async () => {
    try {
      const res = await apiClient.get('/seasons');
      setSeasons(res.data.data || []);
    } catch (err) {
      console.error('Error fetching seasons:', err);
    }
  };
  const fetchTasks = async () => {
    try {
      const res = await apiClient.get('/tasks');
      setTasks(res.data.data || []);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const renderSeasonListView = () => {
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-2xl text-green-600 font-bold">Danh sách Mùa Vụ</h2>
          <p className="text-sm text-gray-500 mt-1">Chọn Mùa vụ để bắt đầu: xem theo Mùa vụ → Danh sách Vườn → Nhật ký</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {getSortedSeasons().map((season) => (
            <div
              key={season._id}
              onClick={() => handleSelectSeason(season)}
              className="p-4 bg-white border-l-4 border-blue-500 rounded-lg hover:shadow-md cursor-pointer transform hover:scale-105 transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-green-600 text-lg">{season.ten_mua_vu}</h3>
                  <div className="text-sm text-gray-500">Năm: {season.nam}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${season.trang_thai === 'Đang diễn ra' ? 'bg-green-100 text-green-700' : season.trang_thai === 'Đã kết thúc' ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
                  {season.trang_thai}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const getSortedSeasons = () => {
    const getSeasonEndTime = (season) => {
      const year = Number(season?.nam);
      const startMonth = Number(season?.thang_bat_dau);
      const endMonth = Number(season?.thang_ket_thuc);
      if (!year || !startMonth || !endMonth) return new Date(year || 0, 11, 31).getTime();
      const endYear = endMonth < startMonth ? year + 1 : year;
      return new Date(endYear, endMonth, 0, 23, 59, 59, 999).getTime();
    };

    const activeSeasons = seasons
      .filter((s) => s.trang_thai === 'Đang diễn ra')
      .sort((a, b) => getSeasonEndTime(b) - getSeasonEndTime(a));

    const endedSeasons = seasons
      .filter((s) => s.trang_thai === 'Đã kết thúc')
      .sort((a, b) => getSeasonEndTime(b) - getSeasonEndTime(a));

    return [...activeSeasons, ...endedSeasons];
  };

  const renderGardensListView = () => {
    // show gardens that have logs in the selected season (no user filtering)
    const seasonGardens = gardens.filter((g) => {
      const hasLogs = logs.some((l) => {
        const lg = l.garden_id?._id || l.garden_id;
        const gardenMatch = String(lg) === String(g._id);
        const seasonMatch = selectedSeason ? String(l.season_id?._id || l.season_id) === String(selectedSeason._id) : true;
        return gardenMatch && seasonMatch;
      });
      return hasLogs;
    });

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleBackFromGardens} className="p-2 hover:bg-gray-200 rounded-lg">
            <FaArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl text-green-600 font-bold">Danh sách Vườn</h2>
            <p className="text-sm text-gray-500 mt-1">Chọn vườn để xem nhật ký trong mùa {selectedSeason?.ten_mua_vu}.</p>
          </div>
        </div>
        <div className="mb-4">
          <input
            type="text"
            placeholder="Tìm vườn theo tên..."
            value={gardenSearch}
            onChange={(e) => setGardenSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Tên vườn</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Địa chỉ</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {seasonGardens
              .filter((g) => g.ten_vuon?.toLowerCase().includes(gardenSearch.toLowerCase()))
              .map((garden) => (
              <tr key={garden._id} onClick={() => handleSelectGarden(garden)} className="cursor-pointer hover:bg-purple-50">
                <td className="px-6 py-4 font-semibold text-gray-900">{garden.ten_vuon}</td>
                <td className="px-6 py-4 text-gray-600">{garden.dia_chi || 'Chưa có địa chỉ'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const ITEMS_PER_PAGE = 10;
  const filteredLogs = logs.filter((log) => {
    const matchesSearch =
      log.garden_id?.ten_vuon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.task_id?.ten_cong_viec?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (log.nguoi_thuc_hien || '').toLowerCase().includes(searchTerm.toLowerCase());

    if (viewMode === 'logs') {
      if (selectedGarden) {
        const lg = log.garden_id?._id || log.garden_id;
        if (String(lg) !== String(selectedGarden)) return false;
      }
      if (selectedUser) {
        const gardenUserId = log.garden_id?.user_id?._id || log.garden_id?.user_id;
        if (!gardenUserId) return false;
        if (String(gardenUserId) !== String(selectedUser)) return false;
      }
      if (selectedSeason) {
        const sid = log.season_id?._id || log.season_id;
        if (String(sid) !== String(selectedSeason._id)) return false;
      }
    }

    return matchesSearch;
  });

  const totalPages = Math.max(1, Math.ceil(filteredLogs.length / ITEMS_PER_PAGE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const startIndex = (currentPageSafe - 1) * ITEMS_PER_PAGE;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const filteredSeasons = selectedGarden
    ? seasons.filter((s) => String(s.garden_id?._id || s.garden_id) === String(selectedGarden))
    : [];

  const filteredTasks = selectedGarden
    ? tasks
    : [];

  const renderLogsView = () => (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleBackFromLogs} className="p-2 hover:bg-gray-200 rounded-lg">
          <FaArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl text-green-600 font-bold">Nhật ký - {gardens.find(g => String(g._id) === String(selectedGarden))?.ten_vuon || 'Tất cả'}</h2>
          <p className="text-sm text-gray-500 mt-1">Danh sách nhật ký lọc theo Mùa vụ / Vườn đã chọn.</p>
        </div>
      </div>

      <div className="mb-6">
        <input
          type="text"
          placeholder="Tìm kiếm theo vườn, công việc hoặc người thực hiện..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-600">Đang tải nhật ký...</div>
        ) : filteredLogs.length === 0 ? (
          <div className="p-8 text-center text-gray-600">Không tìm thấy nhật ký</div>
        ) : (
          <>
            <table className="w-full">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Vườn</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Mùa Vụ</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Công Việc</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">Ngày Làm</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">Người Thực Hiện</th>
                </tr>
              </thead>

              <tbody className="divide-y">
                {paginatedLogs.map((log) => (
                  <tr key={log._id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">{log.garden_id?.ten_vuon}</td>
                    <td className="px-6 py-4 whitespace-nowrap">{log.season_id?.ten_mua_vu}</td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium">{log.task_id?.ten_cong_viec}</td>
                    <td className="px-6 py-4 text-center">{new Date(log.ngay_lam).toLocaleDateString('vi-VN')}</td>
                    <td className="px-6 py-4">{log.nguoi_thuc_hien || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {filteredLogs.length > 0 && totalPages > 1 && (
              <div className="flex items-center justify-between border-t bg-gray-50 px-6 py-4">
                <div className="text-sm text-gray-600">
                  Trang <span className="font-semibold">{currentPageSafe}</span> / <span className="font-semibold">{totalPages}</span>
                  <span className="ml-2">({filteredLogs.length} nhật ký)</span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button key={page} onClick={() => setCurrentPage(page)} className={`min-w-9 rounded px-3 py-1 text-sm font-medium ${currentPageSafe === page ? 'bg-green-600 text-white' : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-100'}`}>
                      {page}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
  
    useEffect(() => {
      setCurrentPage(1);
    }, [searchTerm]);

    // Navigation handlers (season -> user -> gardens -> logs)
    const handleSelectSeason = (season) => {
      setSelectedSeason(season);
      setViewMode('gardens');
      setSelectedUser(null);
      setSelectedGarden(null);
      setSearchTerm('');
    };

    const handleSelectUser = (user) => {
      setSelectedUser(user._id);
      setViewMode('gardens');
      setSelectedGarden(null);
      setSearchTerm('');
    };

    const handleSelectGarden = (garden) => {
      setSelectedGarden(garden._id);
      setViewMode('logs');
      setSearchTerm('');
    };

    const handleBackFromUser = () => {
      setViewMode('season');
      setSelectedSeason(null);
      setSelectedUser(null);
    };

    const handleBackFromGardens = () => {
      // Return to season selection (not user list) when backing from gardens
      setViewMode('season');
      setSelectedSeason(null);
      setSelectedUser(null);
      setSelectedGarden(null);
    };

    const handleBackFromLogs = () => {
      setViewMode('gardens');
      setSelectedGarden(null);
    };

    const getGardensForUserInSeason = () => {
      // user-based filtering removed; keep for compatibility (return empty)
      return [];
    };

  return (
    <AdminLayout>
      <div className="">
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Xem Nhật Ký Canh Tác</h1>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-md">
          {viewMode === 'season' && renderSeasonListView()}
          {viewMode === 'user' && renderUserListView()}
          {viewMode === 'gardens' && renderGardensListView()}
          {viewMode === 'logs' && renderLogsView()}
        </div>
      </div>
    </AdminLayout>
  );
};

export default LogsPage;
