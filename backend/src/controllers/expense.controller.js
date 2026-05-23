const Expense = require('../models/Expense');
const Garden = require('../models/Garden');
const Season = require('../models/Season');
const User = require('../models/User');
const Plot = require('../models/Plot');

const normalizePlotIds = (plotIds) => {
  if (!plotIds) return [];
  if (Array.isArray(plotIds)) return plotIds.filter(Boolean).map(String);
  return [String(plotIds)].filter(Boolean);
};

const validateGardenPlots = async (gardenId, plotIds) => {
  const normalizedPlotIds = normalizePlotIds(plotIds);
  if (normalizedPlotIds.length === 0) return [];

  const plots = await Plot.find({
    _id: { $in: normalizedPlotIds },
    garden_id: gardenId,
  }).select('_id');

  if (plots.length !== normalizedPlotIds.length) {
    return null;
  }

  return normalizedPlotIds;
};

const normalizeExpenseItem = (item) => ({
  ten_mat_hang: String(item?.ten_mat_hang || '').trim(),
  so_luong: Number(item?.so_luong),
  don_vi: String(item?.don_vi || '').trim(),
  gia_tien: Number(item?.gia_tien),
});

const getSeasonIdFromGarden = (garden) => garden?.season_id?._id || garden?.season_id || null;

// Tạo chi phí mới
const createExpense = async (req, res) => {
  try {
    const { garden_id, plot_ids, loai_chi_phi, items, ngay, don_vi } = req.body;

    // Validate items array
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Chi phí phải có ít nhất 1 mặt hàng trong items',
      });
    }

    // Kiểm tra vườn tồn tại
    const garden = await Garden.findById(garden_id);
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Kiểm tra quyền
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    if (user.vai_tro !== 'admin' && String(garden.user_id || '') !== String(req.userId || '')) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền thêm chi phí cho vườn này',
      });
    }

    const currentSeasonId = getSeasonIdFromGarden(garden);
    if (!currentSeasonId) {
      return res.status(404).json({
        success: false,
        message: 'Vườn này chưa có mùa vụ hiện tại',
      });
    }

    const validPlotIds = await validateGardenPlots(garden_id, plot_ids);
    if (validPlotIds === null) {
      return res.status(400).json({
        success: false,
        message: 'Mẫu đất không thuộc vườn này',
      });
    }

    const normalizedItems = items.map(normalizeExpenseItem);

    // Validate items có dữ liệu hợp lệ
    for (const item of normalizedItems) {
      if (!item.ten_mat_hang || !Number.isFinite(item.so_luong) || !item.don_vi || !Number.isFinite(item.gia_tien)) {
        return res.status(400).json({
          success: false,
          message: 'Mỗi mặt hàng phải có: tên, số lượng, đơn vị, và giá tiền',
        });
      }
      if (item.so_luong <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Số lượng phải lớn hơn 0',
        });
      }
      if (item.gia_tien < 0) {
        return res.status(400).json({
          success: false,
          message: 'Giá tiền không được âm',
        });
      }
    }

    // Tạo chi phí
    const expense = new Expense({
      garden_id,
      season_id: currentSeasonId,
      plot_ids: validPlotIds,
      loai_chi_phi,
      items: normalizedItems.map((item) => ({
        ten_mat_hang: item.ten_mat_hang,
        so_luong: item.so_luong,
        don_vi: item.don_vi,
        gia_tien: item.gia_tien,
        tong_tien: 0, // Sẽ được tính trong middleware
      })),
      ngay: ngay || new Date(),
      don_vi: don_vi || 'vnđ',
    });

    await expense.save();
    
    // Populate thông tin sau khi save
    await expense.populate('plot_ids', 'name area tree_type status');
    await expense.populate('season_id', 'ten_mua_vu nam');
    
    console.log('✓ Tạo chi phí:', loai_chi_phi, '- Tổng:', expense.so_tien);

    res.status(201).json({
      success: true,
      message: 'Tạo chi phí thành công',
      data: expense,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo chi phí:', error.message);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy chi phí theo vườn
const getExpensesByGarden = async (req, res) => {
  try {
    const { garden_id } = req.params;
    const { season_id } = req.query; // Có thể filter theo mùa vụ

    // Kiểm tra vườn tồn tại
    const garden = await Garden.findById(garden_id);
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Kiểm tra quyền
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    if (user.vai_tro !== 'admin' && garden.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem chi phí này',
      });
    }

    // Tạo query filter
    let query = { garden_id };
    if (season_id) {
      query.season_id = season_id;
    }

    // Lấy chi phí và populate thông tin mùa vụ
    const expenses = await Expense.find(query)
      .populate('season_id', 'ten_mua_vu nam thang_bat_dau thang_ket_thuc')
      .sort({ ngay: -1 });

    // Tính tổng chi phí
    const tongChiPhi = expenses.reduce((sum, e) => sum + e.so_tien, 0);

    console.log('✓ Lấy chi phí:', expenses.length);

    res.json({
      success: true,
      count: expenses.length,
      tong_chi_phi: tongChiPhi,
      data: expenses,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi phí:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật chi phí
const updateExpense = async (req, res) => {
  try {
    const { garden_id, plot_ids, loai_chi_phi, items, ngay, don_vi } = req.body;
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Chi phí không tồn tại',
      });
    }

    // Kiểm tra quyền
    const garden = await Garden.findById(expense.garden_id);
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Check if user is admin or owner of the garden
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    if (user.vai_tro !== 'admin' && String(garden.user_id || '') !== String(req.userId || '')) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật chi phí này',
      });
    }

    const targetGardenId = garden_id || expense.garden_id;
    const targetGarden = garden_id ? await Garden.findById(garden_id) : garden;
    const currentSeasonId = getSeasonIdFromGarden(targetGarden);
    if (!currentSeasonId) {
      return res.status(404).json({
        success: false,
        message: 'Vườn này chưa có mùa vụ hiện tại',
      });
    }

    expense.garden_id = targetGardenId;
    expense.season_id = currentSeasonId;

    if (plot_ids !== undefined) {
      const validPlotIds = await validateGardenPlots(expense.garden_id, plot_ids);
      if (validPlotIds === null) {
        return res.status(400).json({
          success: false,
          message: 'Mẫu đất không thuộc vườn này',
        });
      }
      expense.plot_ids = validPlotIds;
    }

    // Validate items nếu được gửi
    if (items && Array.isArray(items)) {
      if (items.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Chi phí phải có ít nhất 1 mặt hàng',
        });
      }

      const normalizedItems = items.map(normalizeExpenseItem);

      for (const item of normalizedItems) {
        if (!item.ten_mat_hang || !Number.isFinite(item.so_luong) || !item.don_vi || !Number.isFinite(item.gia_tien)) {
          return res.status(400).json({
            success: false,
            message: 'Mỗi mặt hàng phải có: tên, số lượng, đơn vị, và giá tiền',
          });
        }
        if (item.so_luong <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Số lượng phải lớn hơn 0',
          });
        }
        if (item.gia_tien < 0) {
          return res.status(400).json({
            success: false,
            message: 'Giá tiền không được âm',
          });
        }
      }

      // Cập nhật items
      expense.items = normalizedItems.map((item) => ({
        ten_mat_hang: item.ten_mat_hang,
        so_luong: item.so_luong,
        don_vi: item.don_vi,
        gia_tien: item.gia_tien,
        tong_tien: 0, // Sẽ được tính trong middleware
      }));
    }

    // Cập nhật các field khác
    if (loai_chi_phi) expense.loai_chi_phi = loai_chi_phi;
    if (ngay) expense.ngay = ngay;
    if (don_vi !== undefined) expense.don_vi = don_vi;

    await expense.save();
    
    // Populate thông tin mùa vụ trước khi trả kết quả
    await expense.populate('plot_ids', 'name area tree_type status');
    await expense.populate('season_id', 'ten_mua_vu nam');
    
    console.log('✓ Cập nhật chi phí - Tổng:', expense.so_tien);

    res.json({
      success: true,
      message: 'Cập nhật chi phí thành công',
      data: expense,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật chi phí:', error.message);
    if (error.name === 'ValidationError' || error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy chi phí theo mùa vụ
const getExpensesBySeason = async (req, res) => {
  try {
    const { season_id } = req.params;
    const { garden_id } = req.query; // Optional: filter theo vườn cụ thể

    // Get user to check role
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    // Tạo query filter
    let query = { season_id };

    if (garden_id) {
      // Nếu có garden_id, kiểm tra quyền vườn đó
      const garden = await Garden.findById(garden_id);
      if (!garden) {
        return res.status(404).json({
          success: false,
          message: 'Vườn không tồn tại',
        });
      }

      if (user.vai_tro !== 'admin' && garden.user_id.toString() !== req.userId) {
        return res.status(403).json({
          success: false,
          message: 'Bạn không có quyền xem chi phí này',
        });
      }

      query.garden_id = garden_id;
    } else {
      // Nếu không có garden_id
      if (user.vai_tro === 'admin') {
        // Admin có thể xem tất cả
        // Query sẽ chỉ có season_id
      } else {
        // Lấy tất cả vườn của user
        const gardens = await Garden.find({ user_id: req.userId });
        const gardenIds = gardens.map((g) => g._id);
        query.garden_id = { $in: gardenIds };
      }
    }

    // Lấy chi phí và populate thông tin
    const expenses = await Expense.find(query)
      .populate('garden_id', 'ten_vuon')
      .populate('plot_ids', 'name area tree_type status')
      .populate('season_id', 'ten_mua_vu nam thang_bat_dau thang_ket_thuc')
      .sort({ ngay: -1 });

    // Tính tổng chi phí
    const tongChiPhi = expenses.reduce((sum, e) => sum + e.so_tien, 0);

    console.log('✓ Lấy chi phí theo mùa vụ:', expenses.length);

    res.json({
      success: true,
      count: expenses.length,
      tong_chi_phi: tongChiPhi,
      data: expenses,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi phí theo mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa chi phí
const deleteExpense = async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({
        success: false,
        message: 'Chi phí không tồn tại',
      });
    }

    // Kiểm tra quyền
    const garden = await Garden.findById(expense.garden_id);
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Check if user is admin or owner of the garden
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    if (user.vai_tro !== 'admin' && garden.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa chi phí này',
      });
    }

    await Expense.findByIdAndDelete(req.params.id);
    console.log('✓ Xóa chi phí');

    res.json({
      success: true,
      message: 'Xóa chi phí thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa chi phí:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Admin: Lấy tất cả chi phí
const getAllExpensesByAdmin = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    const user = await User.findById(req.userId);
    if (!user || user.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem tất cả chi phí',
      });
    }

    const expenses = await Expense.find()
      .populate('garden_id', 'ten_vuon')
      .populate('season_id', 'ten_mua_vu nam')
      .sort({ ngay: -1 });

    console.log('✓ Admin lấy danh sách chi phí:', expenses.length);

    res.json({
      success:true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi phí:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy tất cả chi phí của người dùng hiện tại (từ tất cả vườn của họ)
const getAllExpensesForUser = async (req, res) => {
  try {
    // Lấy tất cả vườn của người dùng
    const gardens = await Garden.find({ user_id: req.userId });
    const gardenIds = gardens.map(g => g._id);

    // Lấy tất cả chi phí từ các vườn này
    const expenses = await Expense.find({ garden_id: { $in: gardenIds } })
      .populate('garden_id', 'ten_vuon')
      .populate('season_id', 'ten_mua_vu nam')
      .sort({ ngay: -1 });

    console.log('✓ Người dùng lấy danh sách chi phí:', expenses.length);

    res.json({
      success: true,
      count: expenses.length,
      data: expenses,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi phí user:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createExpense,
  getExpensesByGarden,
  getExpensesBySeason,
  getAllExpensesByAdmin,
  getAllExpensesForUser,
  updateExpense,
  deleteExpense,
};
