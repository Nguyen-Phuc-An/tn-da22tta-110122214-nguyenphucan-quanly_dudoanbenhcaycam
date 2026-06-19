import React, { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { createPortal } from 'react-dom';
import { FaPlus, FaEdit, FaTrash, FaCheck, FaTimes } from 'react-icons/fa';
import UserLayout from '../../components/User/UserLayout';
import apiClient from '../../services/apiClient';
import toast from 'react-hot-toast';
import { useForm } from 'react-hook-form';

const ExpensesPage = () => {
  const location = useLocation();
  const [expenses, setExpenses] = useState([]);
  const [gardens, setGardens] = useState([]);
  const [fertilizers, setFertilizers] = useState([]);
  const [pesticides, setPesticides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [plotOptions, setPlotOptions] = useState([]);
  const [selectedPlotIds, setSelectedPlotIds] = useState([]);
  const [editingGardenId, setEditingGardenId] = useState(null);
  const itemsPerPage = 8;
  
  // Form state
  const { register: formRegister, handleSubmit, reset, watch, setValue } = useForm({
    defaultValues: {
      garden_id: '',
      loai_chi_phi: '',
      ngay: getTodayDateString(),
      don_vi: 'vnđ',
      items: [],
    },
  });

  const [items, setItems] = useState([]);
  const itemInputRefs = useRef([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(null);
  const selectedGarden = watch('garden_id');
  const selectedExpenseType = watch('loai_chi_phi');
  const plotNameMap = new Map(
    plotOptions.map((plot) => [String(plot._id), plot.name || plot.ten || ''])
  );

  function getTodayDateString() {
    const today = new Date();
    return today.toISOString().split('T')[0];
  }

  // Auto-open form if accessing /new route
  useEffect(() => {
    if (location.pathname === '/user/expenses/new') {
      setShowForm(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const fetchPlots = async () => {
      if (!selectedGarden) {
        setPlotOptions([]);
        setSelectedPlotIds([]);
        return;
      }

      try {
        const res = await apiClient.get(`/plots/garden/${selectedGarden}`);
        const plots = res.data.data || [];
        setPlotOptions(plots);

        const plotIds = plots.map((plot) => plot._id);

        if (!editingId) {
          setSelectedPlotIds(plotIds);
          return;
        }

        if (editingGardenId && String(editingGardenId) === String(selectedGarden)) {
          setSelectedPlotIds((current) => current.filter((plotId) => plotIds.includes(plotId)));
        } else {
          setSelectedPlotIds(plotIds);
        }
      } catch (error) {
        console.error('❌ Error fetching plots:', error);
        setPlotOptions([]);
        setSelectedPlotIds([]);
      }
    };

    fetchPlots();
  }, [selectedGarden, editingId, editingGardenId]);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  useEffect(() => {
    fetchExpenses();
    fetchGardens();
    fetchSuggestionSources();
  }, []);

  const fetchSuggestionSources = async () => {
    try {
      const [fertilizerRes, pesticideRes] = await Promise.all([
        apiClient.get('/fertilizers'),
        apiClient.get('/pesticides'),
      ]);

      setFertilizers(fertilizerRes.data.data || []);
      setPesticides(pesticideRes.data.data || []);
    } catch (err) {
      console.error('❌ Error fetching expense suggestions:', err);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await apiClient.get('/expenses');
      console.log('✓ Expenses loaded:', res.data.data?.length || 0);
      setExpenses(res.data.data || []);
    } catch (err) {
      console.error('❌ Error fetch expenses:', err);
      toast.error('Không thể tải danh sách chi phí');
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

  // Handle item changes in the table
  const handleItemChange = (index, field, value) => {
    const updatedItems = [...items];
    updatedItems[index] = { ...updatedItems[index], [field]: value };
    
    // Auto-calculate tong_tien
    if (field === 'so_luong' || field === 'gia_tien') {
      const so_luong = Number(updatedItems[index].so_luong) || 0;
      const gia_tien = Number(updatedItems[index].gia_tien) || 0;
      updatedItems[index].tong_tien = so_luong * gia_tien;
    }
    
    setItems(updatedItems);
  };

  const getItemSuggestions = (keyword) => {
    const searchValue = (keyword || '').trim().toLowerCase();
    if (!searchValue) return [];

    if (selectedExpenseType === 'Phân bón') {
      return fertilizers
        .map((fertilizer) => fertilizer.ten_phan_bon)
        .filter((name) => name?.toLowerCase().includes(searchValue));
    }

    if (selectedExpenseType === 'Thuốc') {
      return pesticides
        .map((pesticide) => pesticide.ten_thuoc)
        .filter((name) => name?.toLowerCase().includes(searchValue));
    }

    return [];
  };

  const getSelectedItemSuggestion = (name) => {
    if (selectedExpenseType === 'Phân bón') {
      return fertilizers.find((fertilizer) => fertilizer.ten_phan_bon === name);
    }

    if (selectedExpenseType === 'Thuốc') {
      return pesticides.find((pesticide) => pesticide.ten_thuoc === name);
    }

    return null;
  };

  const applyItemSuggestion = (index, value) => {
    const suggestion = getSelectedItemSuggestion(value);
    setItems((prevItems) => {
      const updatedItems = [...prevItems];
      const currentItem = {
        ...updatedItems[index],
        ten_mat_hang: value,
      };

      if (suggestion) {
        currentItem.don_vi = suggestion.don_vi || '';
        currentItem.gia_tien = Number(suggestion.gia_tien) || 0;
      }

      const so_luong = Number(currentItem.so_luong) || 0;
      const gia_tien = Number(currentItem.gia_tien) || 0;
      currentItem.tong_tien = so_luong * gia_tien;

      updatedItems[index] = currentItem;
      return updatedItems;
    });
    setActiveSuggestionIndex(null);
  };

  // Add new empty item row
  const addItemRow = () => {
    setItems([
      ...items,
      {
        ten_mat_hang: '',
        so_luong: 1,
        don_vi: '',
        gia_tien: 0,
        tong_tien: 0,
      },
    ]);
  };

  // Remove item row
  const removeItemRow = (index) => {
    setItems(items.filter((_, i) => i !== index));
  };

  // Calculate total expense
  const calculateTotal = () => {
    return items.reduce((sum, item) => sum + (Number(item.tong_tien) || 0), 0);
  };

  const onSubmit = async (data) => {
    try {
      // Validate items
      if (items.length === 0) {
        toast.error('Vui lòng thêm ít nhất 1 mặt hàng');
        return;
      }

      // Check all items have required fields
      for (const item of items) {
        if (!item.ten_mat_hang || !item.don_vi || item.so_luong <= 0 || item.gia_tien < 0) {
          toast.error('Vui lòng điền đầy đủ thông tin các mặt hàng');
          return;
        }
      }

      const submitData = {
        ...data,
        plot_ids: selectedPlotIds,
        items: items,
      };

      if (editingId) {
        const res = await apiClient.put(`/expenses/${editingId}`, submitData);
        console.log('✓ Expense updated:', editingId);
        toast.success('Chi phí được cập nhật thành công');
        setExpenses(
          expenses.map((e) => (e._id === editingId ? res.data.data || e : e))
        );
      } else {
        const res = await apiClient.post('/expenses', submitData);
        console.log('✓ Expense created:', res.data.data);
        toast.success('Chi phí được tạo thành công');
        setExpenses([...expenses, res.data.data]);
      }
      
      reset();
      setItems([]);
      setSelectedPlotIds([]);
      setEditingGardenId(null);
      setShowForm(false);
      setEditingId(null);
    } catch (err) {
      console.error('Error saving expense:', err);
      toast.error(err.response?.data?.message || 'Không thể lưu chi phí');
    }
  };

  const handleEdit = (expense) => {
    setEditingId(expense._id);
    const expenseData = {
      garden_id: expense.garden_id?._id || expense.garden_id,
      loai_chi_phi: expense.loai_chi_phi,
      ngay: new Date(expense.ngay).toISOString().split('T')[0],
      don_vi: expense.don_vi,
    };
    reset(expenseData);
    setItems(expense.items || []);
    setSelectedPlotIds((expense.plot_ids || []).map((plot) => plot._id || plot));
    setEditingGardenId(expenseData.garden_id);
    setShowForm(true);
  };

  const handleToggleAllPlots = (checked) => {
    setSelectedPlotIds(checked ? plotOptions.map((plot) => plot._id) : []);
  };

  const handleTogglePlot = (plotId, checked) => {
    setSelectedPlotIds((current) =>
      checked ? [...current, plotId] : current.filter((currentId) => currentId !== plotId)
    );
  };

  const handleDeleteExpense = async (expenseId) => {
    try {
      await apiClient.delete(`/expenses/${expenseId}`);
      console.log('✓ Expense deleted:', expenseId);
      toast.success('Chi phí được xóa thành công');
      setExpenses(expenses.filter((e) => e._id !== expenseId));
      setShowDeleteConfirm(null);
    } catch (err) {
      console.error('❌ Error deleting expense:', err);
      toast.error(err.response?.data?.message || 'Không thể xóa chi phí');
    }
  };

  const filteredExpenses = expenses.filter(
    (expense) =>
      expense.garden_id?.ten_vuon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      expense.loai_chi_phi?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getGardenName = (garden) => {
    if (!garden) return '—';
    if (typeof garden === 'object') {
      return garden.ten_vuon || '—';
    }

    const matchedGarden = gardens.find((item) => item._id === garden);
    return matchedGarden?.ten_vuon || '—';
  };

  // Pagination
  const totalPages = Math.ceil(filteredExpenses.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedExpenses = filteredExpenses.slice(startIndex, endIndex);

  return (
    <UserLayout>
      <div>
        {/* Header */}
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold text-green-600">Quản Lý Chi Phí</h1>
          <button
            onClick={() => {
              setEditingId(null);
              reset({ 
                garden_id: '',
                loai_chi_phi: '',
                ngay: getTodayDateString(),
                don_vi: 'vnđ',
              });
              setItems([]);
              setSelectedPlotIds([]);
              setShowForm(!showForm);
            }}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
          >
            <FaPlus /> Thêm Chi Phí Mới
          </button>
        </div>

        {/* Form */}
        {showForm && (
          <div className="bg-white rounded-lg shadow p-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">
              {editingId ? <><FaEdit className="inline mr-2" /> Sửa Chi Phí</> : <><FaPlus className="inline mr-2" /> Ghi Nhận Chi Phí Mới</>}
            </h2>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              {/* Header Fields */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Vườn <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...formRegister('garden_id', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Chọn vườn</option>
                    {gardens.map((garden) => (
                      <option key={garden._id} value={garden._id}>
                        {garden.ten_vuon}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Loại Chi Phí <span className="text-red-600">*</span>
                  </label>
                  <select
                    {...formRegister('loai_chi_phi', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Chọn loại chi phí</option>
                    <option value="Phân bón">Phân bón</option>
                    <option value="Thuốc">Thuốc</option>
                    <option value="Nhân công">Nhân công</option>
                    <option value="Dụng cụ">Dụng cụ</option>
                    <option value="Điện nước">Điện nước</option>
                    <option value="Khác">Khác</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Ngày <span className="text-red-600">*</span>
                  </label>
                  <input
                    type="date"
                    {...formRegister('ngay', { required: 'Bắt buộc' })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  />
                </div>
              </div>

              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mẫu Đất
                </label>
                {!selectedGarden ? (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
                    Hãy chọn vườn trước để hiển thị danh sách mẫu đất.
                  </div>
                ) : plotOptions.length > 0 ? (
                  <>
                    <label className="flex items-center gap-2 text-sm font-semibold text-gray-800 mb-3">
                      <input
                        type="checkbox"
                        checked={plotOptions.length > 0 && selectedPlotIds.length === plotOptions.length}
                        onChange={(e) => handleToggleAllPlots(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      Tất cả
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-40 overflow-y-auto pr-1">
                      {plotOptions.map((plot) => (
                        <label
                          key={plot._id}
                          className="flex items-start gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm hover:border-green-300"
                        >
                          <input
                            type="checkbox"
                            checked={selectedPlotIds.includes(plot._id)}
                            onChange={(e) => handleTogglePlot(plot._id, e.target.checked)}
                            className="mt-1 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                          />
                          <span className="text-gray-800">
                            {plot.name}
                            <span className="ml-1 text-gray-500">({Number(plot.area || 0).toFixed(1)} m²)</span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border border-dashed border-gray-300 bg-white px-4 py-3 text-sm text-gray-500">
                    Vườn này chưa có mẫu đất nào.
                  </div>
                )}
              </div>

              {/* Items Table */}
              <div className="border-t pt-4">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-lg font-semibold text-gray-900">Chi Tiết Chi Phí</h3>
                  <button
                    type="button"
                    onClick={addItemRow}
                    className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition text-sm flex items-center gap-1"
                  >
                    <FaPlus /> Thêm dòng
                  </button>
                </div>

                {items.length === 0 ? (
                  <div className="text-center py-6 text-gray-500 border border-dashed rounded-lg">
                    Chưa có mặt hàng - Click "Thêm dòng" để bắt đầu
                  </div>
                ) : (
                  <div className="relative z-20 overflow-x-auto overflow-y-visible">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="bg-gray-50">
                          <th className="px-3 py-2 text-left font-medium text-gray-700 border">Tên mặt hàng</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700 border">Số lượng</th>
                          <th className="px-3 py-2 text-left font-medium text-gray-700 border">Đơn vị</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700 border">Giá tiền</th>
                          <th className="px-3 py-2 text-right font-medium text-gray-700 border">Tổng tiền</th>
                          <th className="px-3 py-2 text-center font-medium text-gray-700 border">Hành động</th>
                        </tr>
                      </thead>
                      <tbody>
                        {items.map((item, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            <td className="px-3 py-2 border">
                              <div className="relative">
                                <input
                                  ref={(el) => {
                                    itemInputRefs.current[index] = el;
                                  }}
                                  type="text"
                                  value={item.ten_mat_hang}
                                  onFocus={() => setActiveSuggestionIndex(index)}
                                  onBlur={() => {
                                    setTimeout(() => {
                                      setActiveSuggestionIndex((currentIndex) =>
                                        currentIndex === index ? null : currentIndex
                                      );
                                    }, 120);
                                  }}
                                  onChange={(e) => {
                                    handleItemChange(index, 'ten_mat_hang', e.target.value);
                                    setActiveSuggestionIndex(index);
                                  }}
                                  placeholder="Tên mặt hàng"
                                  className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                                />
                                {activeSuggestionIndex === index && ['Phân bón', 'Thuốc'].includes(selectedExpenseType) && item.ten_mat_hang?.trim() && (
                                  (() => {
                                    const anchor = itemInputRefs.current[index];
                                    if (!anchor) return null;

                                    const suggestions = getItemSuggestions(item.ten_mat_hang);
                                    const rect = anchor.getBoundingClientRect();

                                    return createPortal(
                                      <div
                                        className="fixed z-[9999] max-h-40 overflow-auto rounded-md border border-gray-200 bg-white shadow-lg"
                                        style={{
                                          top: rect.bottom + 4,
                                          left: rect.left,
                                          width: rect.width,
                                        }}
                                      >
                                        {suggestions.length > 0 ? (
                                          suggestions.map((suggestion) => (
                                            <button
                                              key={suggestion}
                                              type="button"
                                              onMouseDown={(event) => {
                                                event.preventDefault();
                                                applyItemSuggestion(index, suggestion);
                                              }}
                                              className="w-full px-3 py-2 text-left text-sm hover:bg-green-50 transition border-b last:border-b-0"
                                            >
                                              {suggestion}
                                            </button>
                                          ))
                                        ) : (
                                          <div className="px-3 py-2 text-sm text-gray-500">
                                            Không tìm thấy gợi ý phù hợp
                                          </div>
                                        )}
                                      </div>,
                                      document.body
                                    );
                                  })()
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="number"
                                value={item.so_luong}
                                onChange={(e) => handleItemChange(index, 'so_luong', e.target.value)}
                                placeholder="0"
                                step="0.01"
                                min="0"
                                className="w-full px-2 py-1 border rounded text-center focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="text"
                                value={item.don_vi}
                                onChange={(e) => handleItemChange(index, 'don_vi', e.target.value)}
                                placeholder="chai, kg, bộ..."
                                className="w-full px-2 py-1 border rounded focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            </td>
                            <td className="px-3 py-2 border">
                              <input
                                type="number"
                                value={item.gia_tien}
                                onChange={(e) => handleItemChange(index, 'gia_tien', e.target.value)}
                                placeholder="0"
                                min="0"
                                className="w-full px-2 py-1 border rounded text-right focus:outline-none focus:ring-1 focus:ring-green-500"
                              />
                            </td>
                            <td className="px-3 py-2 border text-right font-medium text-gray-900">
                              {new Intl.NumberFormat('vi-VN').format(item.tong_tien || 0)}
                            </td>
                            <td className="px-3 py-2 border text-center">
                              <button
                                type="button"
                                onClick={() => removeItemRow(index)}
                                className="px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200 transition"
                              >
                                <FaTrash />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Total Section */}
              {items.length > 0 && (
                <div className="relative z-10 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <span className="text-lg font-bold text-gray-900">Tổng cộng:</span>
                    <span className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('vi-VN').format(calculateTotal())} ₫
                    </span>
                  </div>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex gap-2 pt-4">
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center justify-center gap-2"
                >
                  {editingId ? <><FaCheck /> Cập Nhật</> : <><FaCheck /> Ghi Nhận</>}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    reset();
                    setItems([]);
                    setSelectedPlotIds([]);
                    setEditingGardenId(null);
                    setEditingId(null);
                  }}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400 transition flex items-center justify-center gap-2"
                >
                  <FaTimes /> Hủy
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Search */}
        <div className="mb-6">
          <input
            type="text"
            placeholder="Tìm kiếm theo vườn hoặc loại chi phí..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        {/* Table & Detail Panel */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Table */}
          <div className="lg:col-span-2 bg-white rounded-lg shadow overflow-hidden flex flex-col">
          {loading ? (
            <div className="p-8 text-center text-gray-600">Đang tải chi phí...</div>
          ) : filteredExpenses.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              {expenses.length === 0 ? (
                <>
                  <p className="mb-4">💰 Chưa ghi nhận chi phí nào</p>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      reset();
                      setItems([]);
                      setShowForm(true);
                    }}
                    className="text-green-600 font-semibold hover:text-green-700"
                  >
                    Ghi nhận chi phí đầu tiên →
                  </button>
                </>
              ) : (
                <p>Không tìm thấy chi phí phù hợp</p>
              )}
            </div>
          ) : (
            <div className="max-h-[240px] overflow-y-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Vườn
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-700 uppercase">
                      Mùa Vụ
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                      Loại Chi Phí
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                      Tổng Tiền
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-700 uppercase">
                      Ngày
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {paginatedExpenses.map((expense) => (
                    <tr 
                      key={expense._id} 
                      onClick={() => setSelectedExpense(expense)}
                      className={`cursor-pointer transition ${
                        selectedExpense?._id === expense._id 
                          ? 'bg-green-100' 
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-900 font-medium">{getGardenName(expense.garden_id)}</span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className="text-gray-900">{expense.season_id?.ten_mua_vu || '—'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                          {expense.loai_chi_phi}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="text-gray-900 font-bold text-green-600">
                          {new Intl.NumberFormat('vi-VN').format(expense.so_tien)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center whitespace-nowrap">
                        <span className="text-gray-600 text-sm">
                          {new Date(expense.ngay).toLocaleDateString('vi-VN')}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-gray-50 px-6 py-4 border-t flex items-center justify-between">
              <div className="text-sm text-gray-600">
                Trang <span className="font-semibold">{currentPage}</span> / <span className="font-semibold">{totalPages}</span> ({filteredExpenses.length} kết quả)
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-400 transition text-sm"
                >
                  ← Trước
                </button>
                <button
                  onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 bg-gray-300 text-gray-700 rounded disabled:opacity-50 hover:bg-gray-400 transition text-sm"
                >
                  Sau →
                </button>
              </div>
            </div>
          )}
          </div>

          {/* Detail Panel */}
          <div className="lg:col-span-1 flex flex-col">
            {selectedExpense ? (
              <div className="bg-white rounded-lg shadow overflow-hidden flex flex-col h-full">
                {/* Header */}
                <div className="bg-gradient-to-r from-green-500 to-green-600 text-white p-4 flex justify-between items-start">
                  <h3 className="text-lg font-bold">Danh sách mặt hàng({selectedExpense.items?.length || 0})</h3>
                  <button
                    onClick={() => setSelectedExpense(null)}
                    className="text-white hover:text-gray-200 text-2xl leading-none"
                  >
                    ×
                  </button>
                </div>

                {/* Items List with Scrolling */}
                <div className="flex-1 overflow-y-auto p-4">
                  <div className="mb-3">
                    <p className="text-xs font-semibold uppercase text-gray-600 mb-2">Mẫu đất</p>
                    {selectedExpense.plot_ids && selectedExpense.plot_ids.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {selectedExpense.plot_ids.map((plot) => (
                          <span
                            key={plot._id || plot}
                            className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700"
                          >
                            {plot.name || plot.ten || plotNameMap.get(String(plot._id || plot)) || 'Mẫu đất'}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-700">
                        Tất cả mẫu
                      </span>
                    )}
                  </div>

                  {selectedExpense.items && selectedExpense.items.length > 0 ? (
                    <div className="space-y-3 max-h-[240px] overflow-y-auto pr-2">
                      {selectedExpense.items.map((item, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50 transition">
                          <div className="font-semibold text-gray-900 mb-2">{item.ten_mat_hang}</div>
                          <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                            <div>
                              <span className="font-medium">Số lượng:</span>
                              <p className="text-gray-900">{item.so_luong} {item.don_vi}</p>
                            </div>
                            <div>
                              <span className="font-medium">Giá tiền:</span>
                              <p className="text-gray-900">{new Intl.NumberFormat('vi-VN').format(item.gia_tien)} ₫</p>
                            </div>
                          </div>
                          <div className="mt-2 pt-2 border-t border-gray-200">
                            <span className="text-xs font-medium text-gray-600">Tổng tiền:</span>
                            <p className="text-lg font-bold text-green-600">
                              {new Intl.NumberFormat('vi-VN').format(item.tong_tien || 0)} ₫
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-4 text-gray-500">Không có mặt hàng</div>
                  )}
                </div>

                {/* Total Amount & Actions */}
                <div className="border-t bg-gray-50 p-4 space-y-3">
                  <div className="bg-green-100 border-2 border-green-500 rounded-lg p-3">
                    <div className="text-xs text-gray-600 mb-1">Tổng chi phí</div>
                    <div className="text-2xl font-bold text-green-600">
                      {new Intl.NumberFormat('vi-VN').format(selectedExpense.so_tien)} ₫
                    </div>
                  </div>

                  <div className="space-y-2">
                  <button
                    onClick={() => handleEdit(selectedExpense)}
                    className="w-full px-4 py-2 bg-green-50 text-green-600 rounded-lg hover:bg-green-100 transition font-medium flex items-center justify-center gap-2"
                  >
                    <FaEdit /> Sửa
                  </button>
                  <button
                    onClick={() => {
                      setShowDeleteConfirm(selectedExpense._id);
                      setSelectedExpense(null);
                    }}
                    className="w-full px-4 py-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition font-medium flex items-center justify-center gap-2"
                  >
                    <FaTrash /> Xóa
                  </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-white rounded-lg shadow p-6 text-center text-gray-500 h-full flex items-center justify-center">
                <p className="text-lg">👈 Chọn một chi phí để xem chi tiết</p>
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-sm">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Xác Nhận Xóa
              </h3>
              <p className="text-gray-600 mb-6">
                Bạn có chắc chắn muốn xóa chi phí này không? Hành động này không thể hoàn tác.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowDeleteConfirm(null)}
                  className="flex-1 px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300 transition"
                >
                  Hủy
                </button>
                <button
                  onClick={() => handleDeleteExpense(showDeleteConfirm)}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
                >
                  Xóa
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </UserLayout>
  );
};

export default ExpensesPage;
