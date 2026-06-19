const Garden = require('../models/Garden');
const Season = require('../models/Season');
const User = require('../models/User');
const Plot = require('../models/Plot');
const Log = require('../models/Log');

const getGardenPlotTotalArea = async (gardenId, excludePlotId = null) => {
  const filter = { garden_id: gardenId };
  if (excludePlotId) {
    filter._id = { $ne: excludePlotId };
  }

  const plots = await Plot.find(filter).select('area');
  return plots.reduce((sum, plot) => sum + Number(plot.area || 0), 0);
};

const getCurrentSeasonId = async () => {
  const seasons = await Season.find().sort({ nam: -1, thang_bat_dau: 1 });
  const now = new Date();

  const activeSeason = seasons.find((season) => {
    if (!season.nam || !season.thang_bat_dau || !season.thang_ket_thuc) {
      return season.trang_thai === 'Đang diễn ra';
    }

    const startDate = new Date(Number(season.nam), Number(season.thang_bat_dau) - 1, 1, 0, 0, 0, 0);
    const endDate = new Date(Number(season.nam), Number(season.thang_ket_thuc), 0, 23, 59, 59, 999);
    return now >= startDate && now <= endDate;
  });

  if (activeSeason) {
    return activeSeason._id;
  }

  const fallbackSeason = seasons.find((season) => season.trang_thai === 'Đang diễn ra');
  return fallbackSeason?._id || null;
};

// Tạo vườn mới
const createGarden = async (req, res) => {
  try {
    const { ten_vuon, dien_tich, dia_chi, so_cay, don_vi, user_id, trang_thai } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!ten_vuon || !dien_tich || !dia_chi) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đủ thông tin bắt buộc',
      });
    }

    // Lấy thông tin user hiện tại
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại. Vui lòng đăng nhập lại.',
      });
    }
    let gardenUserId = req.userId;

    // Nếu admin cung cấp user_id khác, kiểm tra quyền
    if (user_id && user_id !== req.userId) {
      if (currentUser.vai_tro !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Chỉ admin mới có thể tạo garden cho user khác',
        });
      }
      // Kiểm tra user tồn tại
      const targetUser = await User.findById(user_id);
      if (!targetUser) {
        return res.status(404).json({
          success: false,
          message: 'User không tồn tại',
        });
      }
      gardenUserId = user_id;
    }

    const gardenSeasonId = await getCurrentSeasonId();

    // Tạo vườn mới
    const garden = new Garden({
      user_id: gardenUserId,
      season_id: gardenSeasonId,
      ten_vuon,
      dien_tich,
      dia_chi,
      so_cay: so_cay || 0,
      don_vi: don_vi || 'm²',
      trang_thai: trang_thai || 'Đang hoạt động',
    });

    await garden.save();
    await garden.populate([
      { path: 'user_id', select: 'ho_ten email' },
      { path: 'season_id', select: 'ten_mua_vu nam trang_thai' }
    ]);
    
    console.log('✓ Tạo vườn:', ten_vuon);

    res.status(201).json({
      success: true,
      message: 'Tạo vườn thành công',
      data: garden,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo vườn:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy danh sách vườn
const getGardensByUser = async (req, res) => {
  try {
    // Lấy thông tin user hiện tại
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại. Vui lòng đăng nhập lại.',
      });
    }
    let filter = {};

    /**
     * 🔐 RBAC ALGORITHM (Role-Based Access Control)
     * 
     * LOGIC:
     *   if (user.vai_tro === "admin")
     *     → filter = {} (không lọc, lấy TẤT CẢ vườn)
     *   else (vai_tro === "user")
     *     → filter = {user_id: currentUserId} (chỉ lấy vườn của họ)
     * 
     * VÍ DỤ:
     *   Admin: getAllGardens() ← 100 vườn từ 50 user
     *   User: getGardens(userId=123) ← 5 vườn của họ
     */
    
    // Nếu user thường -> chỉ lấy vườn của họ
    // Nếu admin -> lấy tất cả vườn
    if (currentUser.vai_tro !== 'admin') {
      filter = { user_id: req.userId };
    }

    const gardens = await Garden.find(filter)
      .populate('user_id', 'ho_ten email')
      .populate('season_id', 'ten_mua_vu nam trang_thai')
      .sort({ ngay_tao: -1 });

    console.log('✓ Lấy danh sách vườn:', gardens.length);

    res.json({
      success: true,
      count: gardens.length,
      data: gardens,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách vườn:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy chi tiết 1 vườn
const getGardenById = async (req, res) => {
  try {
    const garden = await Garden.findById(req.params.id)
      .populate('user_id', 'ho_ten email')
      .populate('season_id', 'ten_mua_vu nam trang_thai')
      .populate({
        path: 'plots',
        options: { sort: { created_at: -1 } },
      });

    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Kiểm tra quyền
    /**
     * 🔐 OWNERSHIP VERIFICATION
     * 
     * LOGIC:
     *   if (admin || owner)
     *     → cho phép
     *   else
     *     → 403 Forbidden
     * 
     * BẢNG QUYỀN:
     *   User A: Garden {user_id: A}
     *     ✓ User A xem → owner
     *     ✓ Admin xem → admin
     *     ✗ User B xem → 403
     * 
     * KIỂM TRA:
     *   isAdmin = currentUser.vai_tro === "admin"
     *   isOwner = garden.user_id._id.toString() === req.userId
     *   if (isAdmin || isOwner) → 200 OK
     *   else → 403 Forbidden
     */
    
    const currentUser = await User.findById(req.userId);
    if (!currentUser) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại. Vui lòng đăng nhập lại.',
      });
    }
    if (currentUser.vai_tro !== 'admin' && garden.user_id._id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem vườn này',
      });
    }

    res.json({
      success: true,
      data: garden,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết vườn:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const getSprayProgress = async (req, res) => {
  try {
    const garden = await Garden.findById(req.params.id).populate('user_id', 'ho_ten email');
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    if (user.vai_tro !== 'admin' && String(garden.user_id?._id || garden.user_id) !== String(req.userId)) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem tiến độ này',
      });
    }

    const plots = await Plot.find({ garden_id: req.params.id }).sort({ created_at: 1 });
    const logs = await Log.find({ garden_id: req.params.id, is_completed: true })
      .select('plot_id plot_ids is_completed');

    const sprayedPlotIdSet = new Set();
    for (const log of logs) {
      if (log.plot_id) sprayedPlotIdSet.add(String(log.plot_id));
      if (Array.isArray(log.plot_ids)) {
        log.plot_ids.forEach((plotId) => sprayedPlotIdSet.add(String(plotId)));
      }
    }

    const daXitPlots = plots.filter((plot) => sprayedPlotIdSet.has(String(plot._id)));
    const chuaXitPlots = plots.filter((plot) => !sprayedPlotIdSet.has(String(plot._id)));
    const tongMau = plots.length;
    const daXit = daXitPlots.length;
    const chuaXit = chuaXitPlots.length;
    const phanTram = tongMau > 0 ? Math.round((daXit / tongMau) * 100) : 0;

    res.json({
      success: true,
      data: {
        tong_mau: tongMau,
        da_xit: daXit,
        chua_xit: chuaXit,
        phan_tram: phanTram,
        da_xit_plots: daXitPlots,
        chua_xit_plots: chuaXitPlots,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi lấy tiến độ xịt thuốc:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật vườn
const updateGarden = async (req, res) => {
  try {
    const { ten_vuon, dien_tich, dia_chi, so_cay, don_vi, trang_thai } = req.body;

    // Kiểm tra vườn tồn tại
    const garden = await Garden.findById(req.params.id);
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Kiểm tra quyền
    const currentUser = await User.findById(req.userId);
    if (currentUser.vai_tro !== 'admin' && garden.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền cập nhật vườn này',
      });
    }

    // Cập nhật dữ liệu
    if (ten_vuon) garden.ten_vuon = ten_vuon;
    if (dien_tich) garden.dien_tich = dien_tich;
    if (dia_chi) garden.dia_chi = dia_chi;
    if (so_cay !== undefined) garden.so_cay = so_cay;
    if (don_vi) garden.don_vi = don_vi;
    if (trang_thai) garden.trang_thai = trang_thai;

    if (dien_tich !== undefined) {
      const totalPlotArea = await getGardenPlotTotalArea(garden._id);
      if (Number(dien_tich) < totalPlotArea) {
        return res.status(400).json({
          success: false,
          message: 'Diện tích vườn không được nhỏ hơn tổng diện tích các mẫu đất',
        });
      }
    }

    garden.ngay_cap_nhat = new Date();

    await garden.save();
    await garden.populate([
      { path: 'user_id', select: 'ho_ten email' },
      { path: 'season_id', select: 'ten_mua_vu nam trang_thai' }
    ]);
    
    console.log('✓ Cập nhật vườn:', ten_vuon || garden.ten_vuon);

    res.json({
      success: true,
      message: 'Cập nhật vườn thành công',
      data: garden,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật vườn:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Chuyển mùa vụ cho vườn
const changeSeasonForGarden = async (req, res) => {
  try {
    const { season_id } = req.body;
    const gardenId = req.params.id;

    if (!season_id) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mùa vụ',
      });
    }

    // Kiểm tra vườn tồn tại
    const garden = await Garden.findById(gardenId);
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Kiểm tra quyền
    const currentUser = await User.findById(req.userId);
    if (currentUser.vai_tro !== 'admin' && garden.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền chuyển mùa vụ cho vườn này',
      });
    }

    // Kiểm tra mùa vụ tồn tại
    const season = await Season.findById(season_id);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Mùa vụ không tồn tại',
      });
    }

    // Không cho chọn mùa vụ đã kết thúc
    if (season.trang_thai === 'Đã kết thúc') {
      return res.status(400).json({
        success: false,
        message: 'Không thể chuyển sang mùa vụ đã kết thúc',
      });
    }

    garden.season_id = season_id;
    garden.ngay_cap_nhat = new Date();
    await garden.save();
    await garden.populate([
      { path: 'user_id', select: 'ho_ten email' },
      { path: 'season_id', select: 'ten_mua_vu nam trang_thai' }
    ]);

    console.log('✓ Chuyển mùa vụ vườn:', garden.ten_vuon);

    res.json({
      success: true,
      message: 'Chuyển mùa vụ thành công',
      data: garden,
    });
  } catch (error) {
    console.error('❌ Lỗi chuyển mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa vườn
const deleteGarden = async (req, res) => {
  try {
    const garden = await Garden.findById(req.params.id);

    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Kiểm tra quyền
    const currentUser = await User.findById(req.userId);
    if (currentUser.vai_tro !== 'admin' && garden.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa vườn này',
      });
    }

    await Garden.findByIdAndDelete(req.params.id);
    await Plot.deleteMany({ garden_id: req.params.id });
    console.log('✓ Xóa vườn:', garden.ten_vuon);

    res.json({
      success: true,
      message: 'Xóa vườn thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa vườn:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  createGarden,
  getGardensByUser,
  getGardenById,
  updateGarden,
  changeSeasonForGarden,
  deleteGarden,
  getSprayProgress,
};
