import React, { useState, useEffect } from 'react';
import { FaArrowLeft, FaChevronRight } from 'react-icons/fa';
import AdminLayout from '../../components/Admin/AdminLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';

const ExpensesPage = () => {
  const [expenses, setExpenses] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [seasons, setSeasons] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Navigation state
  const [viewMode, setViewMode] = useState('season'); // 'season', 'user', 'gardens', 'expenses'
  const [selectedSeason, setSelectedSeason] = useState(null);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedGarden, setSelectedGarden] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [gardenSearchTerm, setGardenSearchTerm] = useState('');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      await Promise.all([fetchExpenses(), fetchGardens(), fetchSeasons(), fetchUsers()]);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const res = await apiClient.get('/expenses/admin/all');
      setExpenses(res.data.data || []);
    } catch (err) {
      console.error('Error fetching expenses:', err);
      toast.error('Không thể tải danh sách chi phí');
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
      const res = await apiClient.get('/seasons/admin/all');
      setSeasons(res.data.data || []);
    } catch (err) {
      console.error('Error fetching seasons:', err);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await apiClient.get('/users');
      setUsers(res.data.data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  // Calculate total expenses for season
  const getSeasonTotal = (seasonId) => {
    return expenses
      .filter((e) => e.season_id?._id === seasonId || e.season_id === seasonId)
      .reduce((sum, e) => sum + (e.so_tien || 0), 0);
  };

  // Calculate total expenses for season
  const getSeasonTotalExp = (seasonId) => {
    return expenses
      .filter((e) => e.season_id?._id === seasonId || e.season_id === seasonId)
      .reduce((sum, e) => sum + (e.so_tien || 0), 0);
  };

  // Calculate total expenses for user in selected season (all gardens)
  const getUserTotalForSeason = (userId) => {
    // Get all user's gardens
    const userGardenIds = gardens
      .filter((g) => g.user_id?._id === userId || g.user_id === userId)
      .map(g => g._id);
    
    // Sum expenses from these gardens in selected season
    return expenses
      .filter((e) => {
        const gardenId = e.garden_id?._id || e.garden_id;
        const inSeason = selectedSeason && (e.season_id?._id === selectedSeason._id || e.season_id === selectedSeason._id);
        return userGardenIds.includes(gardenId) && inSeason;
      })
      .reduce((sum, e) => sum + (e.so_tien || 0), 0);
  };

  // Get gardens for selected user in selected season
    const getGardensForUserInSeason = () => {
    if (!selectedUser || !selectedSeason) return [];

    // 1. Lấy tất cả expense của season này
    const seasonExpenses = expenses.filter(
      (e) =>
        e.season_id?._id === selectedSeason._id ||
        e.season_id === selectedSeason._id
    );

    // 2. Lấy tất cả garden_id từ expense
    const gardenIds = seasonExpenses
      .map((e) => e.garden_id?._id || e.garden_id)
      .filter(Boolean);

    // 3. Lọc garden theo user + nằm trong expense
    return gardens.filter((g) => {
      const isUserGarden =
        g.user_id?._id === selectedUser || g.user_id === selectedUser;

      return isUserGarden && gardenIds.includes(g._id);
    });
  };

  // Get expenses for selected garden in selected season
  const getExpensesForGarden = () => {
    if (!selectedGarden || !selectedSeason) return [];
    return expenses.filter(
      (e) => {
        const gardenMatch = e.garden_id?._id === selectedGarden || e.garden_id === selectedGarden;
        const seasonMatch = e.season_id?._id === selectedSeason._id || e.season_id === selectedSeason._id;
        return gardenMatch && seasonMatch;
      }
    );
  };

  // Get sorted seasons
  const getSortedSeasons = () => {
    const getSeasonEndTime = (season) => {
      const year = Number(season?.nam);
      const startMonth = Number(season?.thang_bat_dau);
      const endMonth = Number(season?.thang_ket_thuc);

      if (!year || !startMonth || !endMonth) {
        return new Date(year || 0, 11, 31, 23, 59, 59, 999).getTime();
      }

      const endYear = endMonth < startMonth ? year + 1 : year;
      return new Date(endYear, endMonth, 0, 23, 59, 59, 999).getTime();
    };

    const activeSeasons = seasons
      .filter((season) => season.trang_thai === 'Đang diễn ra')
      .sort((a, b) => getSeasonEndTime(b) - getSeasonEndTime(a));

    const endedSeasons = seasons
      .filter((season) => season.trang_thai === 'Đã kết thúc')
      .sort((a, b) => getSeasonEndTime(b) - getSeasonEndTime(a));

    // Chỉ hiển thị: đang diễn ra trước, sau đó tới các mùa đã kết thúc; ẩn mùa sắp diễn ra.
    return [...activeSeasons, ...endedSeasons];
  };

  const handleSelectSeason = (season) => {
    setSelectedSeason(season);
    setViewMode('user');
    setSelectedUser(null);
    setSelectedGarden(null);
    setUserSearchTerm('');
    setGardenSearchTerm('');
  };

  const handleSelectUser = (user) => {
    setSelectedUser(user._id);
    setViewMode('gardens');
    setGardenSearchTerm('');
  };

  const handleBackFromUser = () => {
    setViewMode('season');
    setSelectedSeason(null);
    setSelectedUser(null);
    setUserSearchTerm('');
  };

  const handleSelectGarden = (garden) => {
    setSelectedGarden(garden._id);
    setViewMode('expenses');
  };

  const handleBackFromGardens = () => {
    setViewMode('user');
    setSelectedUser(null);
    setSelectedGarden(null);
    setGardenSearchTerm('');
  };

  const handleBackFromExpenses = () => {
    setViewMode('gardens');
    setSelectedGarden(null);
    setSelectedExpense(null);
  };

  const handleSelectExpense = (expense) => {
    setSelectedExpense(expense);
  };

  const formatCurrency = (value) => Number(value || 0).toLocaleString('vi-VN');

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';
    return new Date(dateValue).toLocaleDateString('vi-VN');
  };

  const getExpenseTypeColor = (type) => {
    const value = String(type || '').toLowerCase();
    if (value.includes('phân') || value.includes('fertil')) return 'bg-emerald-100 text-emerald-700';
    if (value.includes('thuốc') || value.includes('pesti')) return 'bg-rose-100 text-rose-700';
    if (value.includes('lao động') || value.includes('nhân công')) return 'bg-amber-100 text-amber-700';
    return 'bg-slate-100 text-slate-700';
  };

  const nonAdminUsers = users.filter((user) => String(user.vai_tro || user.role || '').toLowerCase() !== 'admin');
  const filteredUsers = nonAdminUsers.filter((user) => {
    const query = userSearchTerm.toLowerCase();
    return (
      user.ten?.toLowerCase().includes(query) ||
      user.ho_ten?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query)
    );
  });

  const sortedFilteredUsers = filteredUsers
    .map((user) => {
      const total = getUserTotalForSeason(user._id);
      const userGardens = gardens.filter(
        (g) => g.user_id?._id === user._id || g.user_id === user._id
      );

      return {
        ...user,
        _displayName: user.ten || user.ho_ten || 'Không tên',
        _totalSeasonExpense: total,
        _gardenCount: userGardens.length,
      };
    })
    .sort((a, b) => {
      if (b._totalSeasonExpense !== a._totalSeasonExpense) {
        return b._totalSeasonExpense - a._totalSeasonExpense;
      }

      return a._displayName.localeCompare(b._displayName, 'vi', { sensitivity: 'base' });
    });

  // Render SEASON LIST view
  const renderSeasonListView = () => (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl text-green-600 font-bold">Danh sách Mùa Vụ</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {getSortedSeasons().map((season) => {
          const total = getSeasonTotalExp(season._id);
          return (
            <div
              key={season._id}
              onClick={() => handleSelectSeason(season)}
              className="p-4 bg-white border-l-4 border-blue-500 rounded-lg hover:shadow-md cursor-pointer transform hover:scale-105 transition-all"
            >
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-bold text-green-600 text-lg">{season.ten_mua_vu}</h3>
                </div>
                <p className="text-gray-600 text-sm">Năm: {season.nam}</p>
              </div>
              <div className="mt-3 pt-3 border-t flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm text-gray-600">Tổng chi phí:</p>
                  <p className="text-lg font-bold text-blue-600">{total.toLocaleString('vi-VN')} đ</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full font-semibold whitespace-nowrap ${
                  season.trang_thai === 'Đang diễn ra'
                    ? 'bg-green-100 text-green-700'
                    : season.trang_thai === 'Sắp diễn ra'
                    ? 'bg-yellow-100 text-yellow-700'
                    : 'bg-red-100 text-red-700'
                }`}>
                  {season.trang_thai}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  // Render USER LIST view
  const renderUserListView = () => (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <button onClick={handleBackFromUser} className="p-2 hover:bg-gray-200 rounded-lg">
          <FaArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl text-green-600 font-bold">Danh sách Người dùng - {selectedSeason?.ten_mua_vu} ({selectedSeason?.nam})</h2>
          <p className="text-sm text-gray-500 mt-1">Xem người dùng dưới dạng bảng và tìm nhanh theo tên hoặc email.</p>
        </div>
      </div>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
        <input
          type="text"
          value={userSearchTerm}
          onChange={(e) => setUserSearchTerm(e.target.value)}
          placeholder="Tìm theo tên hoặc email..."
          className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-200"
        />
        <span className="whitespace-nowrap text-sm text-gray-500">{filteredUsers.length} người dùng</span>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Người dùng</th>
              <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Email</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Số vườn</th>
              <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Tổng chi phí</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {sortedFilteredUsers.length > 0 ? (
              sortedFilteredUsers.map((user) => (
                <tr
                  key={user._id}
                  onClick={() => handleSelectUser(user)}
                  className="cursor-pointer transition hover:bg-green-50"
                >
                  <td className="px-6 py-4">
                    <div className="font-semibold text-gray-900">{user._displayName}</div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{user.email}</td>
                  <td className="px-6 py-4 text-center text-gray-900">{user._gardenCount}</td>
                  <td className="px-6 py-4 text-center font-semibold text-green-600">{user._totalSeasonExpense.toLocaleString('vi-VN')} đ</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
                  Không tìm thấy người dùng phù hợp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // Render GARDENS LIST view
  const renderGardensListView = () => {
    const filteredGardens = getGardensForUserInSeason();
    const userName = users.find(u => u._id === selectedUser)?.ten || users.find(u => u._id === selectedUser)?.ho_ten;
    const searchedGardens = filteredGardens.filter((garden) => {
      const query = gardenSearchTerm.toLowerCase();
      return (
        garden.ten_vuon?.toLowerCase().includes(query) ||
        garden.dia_diem?.toLowerCase().includes(query)
      );
    });

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleBackFromGardens} className="p-2 hover:bg-gray-200 rounded-lg">
            <FaArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl text-green-600 font-bold">Danh sách Vườn - {userName}</h2>
            <p className="text-sm text-gray-500 mt-1">Xem danh sách vườn dưới dạng bảng và tìm nhanh theo tên vườn hoặc địa điểm.</p>
          </div>
        </div>
        <div className="mb-4 flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <input
            type="text"
            value={gardenSearchTerm}
            onChange={(e) => setGardenSearchTerm(e.target.value)}
            placeholder="Tìm theo tên vườn hoặc địa điểm..."
            className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-200"
          />
          <span className="whitespace-nowrap text-sm text-gray-500">{searchedGardens.length} vườn</span>
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Tên vườn</th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">Địa chỉ</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Số chi phí</th>
                <th className="px-6 py-3 text-center text-xs font-semibold uppercase tracking-wide text-gray-600">Tổng chi phí</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {searchedGardens.length > 0 ? (
                searchedGardens.map((garden) => {
                  const gardenExpenses = expenses.filter((e) => {
                    const gardenMatch = e.garden_id?._id === garden._id || e.garden_id === garden._id;
                    const seasonMatch = e.season_id?._id === selectedSeason._id || e.season_id === selectedSeason._id;
                    return gardenMatch && seasonMatch;
                  });
                  const total = gardenExpenses.reduce((sum, e) => sum + (e.so_tien || 0), 0);

                  return (
                    <tr
                      key={garden._id}
                      onClick={() => handleSelectGarden(garden)}
                      className="cursor-pointer transition hover:bg-purple-50"
                    >
                      <td className="px-6 py-4">
                        <div className="font-semibold text-gray-900">{garden.ten_vuon}</div>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{garden.dia_chi || 'Chưa có địa chỉ'}</td>
                      <td className="px-6 py-4 text-center text-gray-900">{gardenExpenses.length}</td>
                      <td className="px-6 py-4 text-center font-semibold text-purple-600">{total.toLocaleString('vi-VN')} đ</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="4" className="px-6 py-10 text-center text-gray-500">
                    Không tìm thấy vườn phù hợp
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  // Render EXPENSES TABLE view with split layout
  const renderExpensesView = () => {
    const expensesList = getExpensesForGarden();
    const gardenName = gardens.find(g => g._id === selectedGarden)?.ten_vuon;
    const totalAmount = expensesList.reduce((sum, expense) => sum + (expense.so_tien || 0), 0);

    return (
      <div>
        <div className="flex items-center gap-3 mb-6">
          <button onClick={handleBackFromExpenses} className="p-2 hover:bg-green-600 rounded-lg transition">
            <FaArrowLeft size={20} />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-green-600">Chi Phí - {gardenName}</h2>
            <p className="text-sm text-gray-500">Xem danh sách khoản chi và chi tiết từng mục hàng.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="text-sm text-gray-500">Số khoản chi</div>
            <div className="mt-2 text-2xl font-bold text-green-600">{expensesList.length}</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="text-sm text-gray-500">Tổng chi phí</div>
            <div className="mt-2 text-2xl font-bold text-emerald-600">{formatCurrency(totalAmount)} đ</div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
            <div className="text-sm text-gray-500">Chi phí đang xem</div>
            <div className="mt-2 text-2xl font-bold text-green-600">{selectedExpense ? selectedExpense.loai_chi_phi : 'Chưa chọn'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-start">
          {/* LEFT: Expense List */}
          <div className="lg:col-span-3 bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-green-600">Danh sách chi phí</h3>
                <p className="text-sm text-gray-500">Chọn một dòng để xem chi tiết mặt hàng ở khung bên phải.</p>
              </div>
              <span className="text-sm text-gray-500">{expensesList.length} bản ghi</span>
            </div>

            <div className="divide-y divide-gray-100">
              {expensesList.length > 0 ? (
                expensesList.map((expense) => {
                  const isSelected = selectedExpense?._id === expense._id;
                  return (
                    <button
                      key={expense._id}
                      type="button"
                      onClick={() => handleSelectExpense(expense)}
                      className={`w-full text-left p-4 transition-all ${
                        isSelected ? 'bg-emerald-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${getExpenseTypeColor(expense.loai_chi_phi)}`}>
                              {expense.loai_chi_phi}
                            </span>
                            <span className="text-xs text-gray-500">{formatDate(expense.ngay)}</span>
                          </div>
                          <div className="text-sm text-gray-600 truncate">
                            {expense.garden_id?.ten_vuon || 'Không xác định'}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="text-lg font-bold text-gray-900">{formatCurrency(expense.so_tien)} đ</div>
                          <div className="text-xs text-gray-500">{expense.items?.length || 0} mặt hàng</div>
                        </div>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="p-8 text-center text-gray-500">
                  Không có chi phí nào cho vườn này.
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Item Details */}
          <div className="lg:col-span-2 flex flex-col">
            {selectedExpense ? (
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full sticky top-4">
                {/* Header */}
                <div className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white p-3.5 flex justify-between items-start gap-2">
                  <div>
                    <div className="text-[11px] uppercase tracking-wider text-emerald-50/90 mb-0.5">Chi tiết chi phí</div>
                    <h3 className="text-base font-bold leading-tight">{selectedExpense.loai_chi_phi}</h3>
                    <p className="text-[11px] text-emerald-50/90 mt-0.5">{formatDate(selectedExpense.ngay)} · {selectedExpense.items?.length || 0} mặt hàng</p>
                  </div>
                  <button
                    onClick={() => setSelectedExpense(null)}
                    className="text-white hover:text-emerald-100 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Items List with Scrolling */}
                <div className="flex-1 overflow-y-auto p-3">
                  {selectedExpense.items && selectedExpense.items.length > 0 ? (
                    <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1">
                      {selectedExpense.items.map((item, idx) => (
                        <div key={idx} className="rounded-xl border border-gray-200 p-2.5 hover:border-emerald-300 hover:bg-emerald-50/50 transition">
                          <div className="flex items-start justify-between gap-2 mb-1.5">
                            <div className="font-semibold text-gray-900 text-sm leading-tight">{item.ten_hang || item.ten_mat_hang}</div>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-sm">
                            <div className="rounded-lg bg-gray-50 p-2">
                              <div className="text-xs text-gray-500">Số lượng</div>
                              <div className="font-semibold text-gray-900 mt-0.5 text-sm">{item.so_luong} {item.don_vi || ''}</div>
                            </div>
                            <div className="rounded-lg bg-gray-50 p-2">
                              <div className="text-xs text-gray-500">Đơn giá</div>
                              <div className="font-semibold text-gray-900 mt-0.5 text-sm">{formatCurrency(item.don_gia || item.gia_tien || 0)} đ</div>
                            </div>
                          </div>
                          <div className="mt-1.5 pt-1.5 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-gray-500">Tổng tiền</span>
                            <p className="text-base font-bold text-emerald-600">
                              {formatCurrency(item.tong_tien || (item.so_luong * (item.don_gia || item.gia_tien || 0)))} đ
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-5 text-gray-500 text-sm">Không có mặt hàng</div>
                  )}
                </div>

                {/* Total Amount */}
                <div className="border-t border-gray-100 bg-gray-50 p-3">
                  <div className="flex justify-between items-start rounded-xl bg-emerald-50 border border-emerald-200 p-3">
                    <div className="text-x tracking-wider text-700 mb-1">Tổng chi phí</div>
                    <div className="text-xl font-bold text-emerald-700 leading-tight">
                      {formatCurrency(selectedExpense.so_tien)} đ
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-dashed border-gray-300 flex items-center justify-center min-h-[420px] shadow-sm">
                <div className="text-center p-8 max-w-sm">
                  <p className="text-gray-700 font-medium">Chọn một chi phí để xem chi tiết mặt hàng</p>
                  <p className="text-sm text-gray-500 mt-2">Thông tin chi tiết sẽ hiển thị ở khung bên phải theo đúng phong cách các trang admin khác.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="text-center py-12">
          <div className="inline-block animate-spin">
            <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full"></div>
          </div>
          <p className="mt-4 text-gray-600">Đang tải dữ liệu...</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="">
        {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                  <h1 className="text-3xl font-bold text-green-600">Xem Chi Phí</h1>
                </div>

        <div className="bg-white p-6 rounded-lg shadow-md">
          {viewMode === 'season' && renderSeasonListView()}
          {viewMode === 'user' && renderUserListView()}
          {viewMode === 'gardens' && renderGardensListView()}
          {viewMode === 'expenses' && renderExpensesView()}
        </div>
      </div>
    </AdminLayout>
  );
};

export default ExpensesPage;
