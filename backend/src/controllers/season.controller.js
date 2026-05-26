const Season = require('../models/Season');
const Garden = require('../models/Garden');
const User = require('../models/User');
const Expense = require('../models/Expense');
const Log = require('../models/Log');

const getSeasonDateRange = (season) => {
  if (!season?.nam || !season?.thang_bat_dau || !season?.thang_ket_thuc) {
    return null;
  }

  const startYear = Number(season.nam);
  const startMonth = Number(season.thang_bat_dau);
  const endMonth = Number(season.thang_ket_thuc);
  const endYear = endMonth < startMonth ? startYear + 1 : startYear;

  const startDate = new Date(startYear, startMonth - 1, 1, 0, 0, 0, 0);
  const endDate = new Date(endYear, endMonth, 0, 23, 59, 59, 999);

  return { startDate, endDate };
};

const seasonsOverlap = (firstRange, secondRange) => {
  if (!firstRange || !secondRange) {
    return false;
  }

  return firstRange.startDate <= secondRange.endDate && secondRange.startDate <= firstRange.endDate;
};

// Helper: Tự động đồng bộ trạng thái mùa vụ theo thời gian
const checkAndUpdateSeasonStatus = async (season) => {
  const dateRange = getSeasonDateRange(season);
  if (!dateRange) {
    return season;
  }

  const now = new Date();
  let nextStatus = 'Sắp diễn ra';

  if (now >= dateRange.startDate && now <= dateRange.endDate) {
    nextStatus = 'Đang diễn ra';
  } else if (now > dateRange.endDate) {
    nextStatus = 'Đã kết thúc';
  }

  if (season.trang_thai !== nextStatus) {
    season.trang_thai = nextStatus;
    await season.save();
  }

  return season;
};

const syncSeasonStatuses = async () => {
  const seasons = await Season.find();
  for (const season of seasons) {
    await checkAndUpdateSeasonStatus(season);
  }
};

const getCurrentActiveSeason = async () => {
  await syncSeasonStatuses();

  const activeSeason = await Season.findOne({ trang_thai: 'Đang diễn ra' }).sort({ nam: -1, thang_bat_dau: 1 });
  return activeSeason;
};

// Lấy tất cả mùa vụ
const getSeasons = async (req, res) => {
  try {
    let seasons = await Season.find()
      .sort({ nam: -1, thang_bat_dau: 1 });

    // Auto-check trang_thai
    await syncSeasonStatuses();

    // Re-fetch after updates
    seasons = await Season.find()
      .sort({ nam: -1, thang_bat_dau: 1 });

    console.log('✓ Lấy danh sách mùa vụ:', seasons.length);

    res.json({
      success: true,
      count: seasons.length,
      data: seasons,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Admin: Lấy tất cả mùa vụ (yêu cầu auth)
const getAllSeasonsByAdmin = async (req, res) => {
  try {
    // Kiểm tra quyền admin
    const user = await User.findById(req.userId);
    if (!user || user.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem tất cả mùa vụ',
      });
    }

    let seasons = await Season.find()
      .sort({ nam: -1, thang_bat_dau: 1 });

    // Auto-check trang_thai
    await syncSeasonStatuses();

    // Re-fetch after updates
    seasons = await Season.find()
      .sort({ nam: -1, thang_bat_dau: 1 });

    console.log('✓ Admin lấy danh sách mùa vụ:', seasons.length);

    res.json({
      success: true,
      count: seasons.length,
      data: seasons,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy chi tiết 1 mùa vụ
const getSeasonById = async (req, res) => {
  try {
    let season = await Season.findById(req.params.id);

    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Mùa vụ không tồn tại',
      });
    }

    // Auto-check trang_thai
    season = await checkAndUpdateSeasonStatus(season);

    res.json({
      success: true,
      data: season,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Tạo mùa vụ mới
const createSeason = async (req, res) => {
  try {
    const { ten_mua_vu, nam, thang_bat_dau, thang_ket_thuc, mo_ta } = req.body;
    const normalizedNam = Number(nam);
    const normalizedThangBatDau = thang_bat_dau !== undefined && thang_bat_dau !== '' ? Number(thang_bat_dau) : undefined;
    const normalizedThangKetThuc = thang_ket_thuc !== undefined && thang_ket_thuc !== '' ? Number(thang_ket_thuc) : undefined;

    // Kiểm tra dữ liệu bắt buộc
    if (!ten_mua_vu || !normalizedNam) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên mùa vụ và năm',
      });
    }

    const nextSeasonRange = getSeasonDateRange({ nam: normalizedNam, thang_bat_dau: normalizedThangBatDau, thang_ket_thuc: normalizedThangKetThuc });
    if (nextSeasonRange) {
      const existingSeasons = await Season.find();
      const hasOverlap = existingSeasons.some((existingSeason) => {
        const existingRange = getSeasonDateRange(existingSeason);
        return seasonsOverlap(nextSeasonRange, existingRange);
      });

      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message: 'Mùa vụ mới bị trùng với mùa vụ hiện có. Mùa tiếp theo phải bắt đầu sau khi mùa trước kết thúc.',
        });
      }
    }

    // Kiểm tra quyền admin
    const user = await User.findById(req.userId);
    if (!user || user.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể tạo mùa vụ',
      });
    }

    const season = new Season({
      ten_mua_vu,
      nam: normalizedNam,
      thang_bat_dau: normalizedThangBatDau,
      thang_ket_thuc: normalizedThangKetThuc,
      mo_ta: mo_ta || '',
      trang_thai: 'Sắp diễn ra',
    });

    await season.save();
    await checkAndUpdateSeasonStatus(season);
    
    console.log('✓ Tạo mùa vụ:', ten_mua_vu);

    res.status(201).json({
      success: true,
      message: 'Tạo mùa vụ thành công',
      data: season,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật mùa vụ
const updateSeason = async (req, res) => {
  try {
    const { ten_mua_vu, nam, thang_bat_dau, thang_ket_thuc, mo_ta, trang_thai } = req.body;
    const normalizedNam = nam !== undefined && nam !== '' ? Number(nam) : undefined;
    const normalizedThangBatDau = thang_bat_dau !== undefined && thang_bat_dau !== '' ? Number(thang_bat_dau) : undefined;
    const normalizedThangKetThuc = thang_ket_thuc !== undefined && thang_ket_thuc !== '' ? Number(thang_ket_thuc) : undefined;

    const season = await Season.findById(req.params.id);

    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Mùa vụ không tồn tại',
      });
    }

    // Kiểm tra quyền admin
    const user = await User.findById(req.userId);
    if (!user || user.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể cập nhật mùa vụ',
      });
    }

    const newThangBatDau = normalizedThangBatDau !== undefined ? normalizedThangBatDau : season.thang_bat_dau;
    const newThangKetThuc = normalizedThangKetThuc !== undefined ? normalizedThangKetThuc : season.thang_ket_thuc;

    const nextSeasonRange = getSeasonDateRange({
      nam: normalizedNam !== undefined ? normalizedNam : season.nam,
      thang_bat_dau: newThangBatDau,
      thang_ket_thuc: newThangKetThuc,
    });

    if (nextSeasonRange) {
      const existingSeasons = await Season.find({ _id: { $ne: season._id } });
      const hasOverlap = existingSeasons.some((existingSeason) => {
        const existingRange = getSeasonDateRange(existingSeason);
        return seasonsOverlap(nextSeasonRange, existingRange);
      });

      if (hasOverlap) {
        return res.status(400).json({
          success: false,
          message: 'Mùa vụ bị trùng với mùa vụ hiện có. Mùa tiếp theo phải bắt đầu sau khi mùa trước kết thúc.',
        });
      }
    }

    // Cập nhật dữ liệu
    if (ten_mua_vu) season.ten_mua_vu = ten_mua_vu;
    if (normalizedNam !== undefined) season.nam = normalizedNam;
    if (normalizedThangBatDau !== undefined) season.thang_bat_dau = normalizedThangBatDau;
    if (normalizedThangKetThuc !== undefined) season.thang_ket_thuc = normalizedThangKetThuc;
    if (mo_ta !== undefined) season.mo_ta = mo_ta;

    await season.save();
    await checkAndUpdateSeasonStatus(season);
    
    console.log('✓ Cập nhật mùa vụ:', ten_mua_vu || season.ten_mua_vu);

    res.json({
      success: true,
      message: 'Cập nhật mùa vụ thành công',
      data: season,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa mùa vụ
const deleteSeason = async (req, res) => {
  try {
    const season = await Season.findById(req.params.id);

    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Mùa vụ không tồn tại',
      });
    }

    // Kiểm tra quyền admin
    const user = await User.findById(req.userId);
    if (!user || user.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xóa mùa vụ',
      });
    }

    // Kiểm tra có Garden liên quan không
    const gardenCount = await Garden.countDocuments({ season_id: req.params.id });
    if (gardenCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa mùa vụ này. Có ${gardenCount} vườn liên quan`,
      });
    }

    // Kiểm tra có Expense liên quan không
    const expenseCount = await Expense.countDocuments({ season_id: req.params.id });
    if (expenseCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa mùa vụ này. Có ${expenseCount} bản ghi chi phí liên quan`,
      });
    }

    // Kiểm tra có Log liên quan không
    const logCount = await Log.countDocuments({ season_id: req.params.id });
    if (logCount > 0) {
      return res.status(400).json({
        success: false,
        message: `Không thể xóa mùa vụ này. Có ${logCount} bản ghi nhật ký liên quan`,
      });
    }

    await Season.findByIdAndDelete(req.params.id);
    console.log('✓ Xóa mùa vụ');

    res.json({
      success: true,
      message: 'Xóa mùa vụ thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Đồng bộ mùa vụ đang diễn ra cho tất cả vườn
const syncCurrentSeasonForAllGardens = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user || user.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể đồng bộ mùa vụ cho vườn',
      });
    }

    const activeSeason = await getCurrentActiveSeason();
    if (!activeSeason) {
      return res.status(400).json({
        success: false,
        message: 'Không tìm thấy mùa vụ đang diễn ra',
      });
    }

    const result = await Garden.updateMany(
      {},
      {
        season_id: activeSeason._id,
        ngay_cap_nhat: new Date(),
      }
    );

    console.log('✓ Đồng bộ mùa vụ cho tất cả vườn:', activeSeason.ten_mua_vu, result.modifiedCount || 0);

    res.json({
      success: true,
      message: `Đã cập nhật mùa vụ "${activeSeason.ten_mua_vu}" cho tất cả vườn`,
      data: {
        season: activeSeason,
        matchedCount: result.matchedCount || 0,
        modifiedCount: result.modifiedCount || 0,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi đồng bộ mùa vụ cho vườn:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getSeasons,
  getAllSeasonsByAdmin,
  getSeasonById,
  createSeason,
  updateSeason,
  deleteSeason,
  syncCurrentSeasonForAllGardens,
};
