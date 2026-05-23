const Log = require('../models/Log');
const Garden = require('../models/Garden');
const Task = require('../models/Task');
const Season = require('../models/Season');
const User = require('../models/User');
const Plot = require('../models/Plot');
const NotificationTracking = require('../models/NotificationTracking');

const normalizePlotIds = (plotIds) => {
  if (!plotIds) return [];
  if (Array.isArray(plotIds)) return plotIds.filter(Boolean).map(String);
  return [String(plotIds)].filter(Boolean);
};

const normalizePlotId = (plotId, plotIds) => {
  if (plotId) return String(plotId);
  const normalizedPlotIds = normalizePlotIds(plotIds);
  return normalizedPlotIds[0] || null;
};

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null) return defaultValue;
  if (value === true || value === 'true' || value === 1 || value === '1' || value === 'on') return true;
  if (value === false || value === 'false' || value === 0 || value === '0') return false;
  return Boolean(value);
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

const validateGardenPlot = async (gardenId, plotId) => {
  if (!plotId) return null;

  const plot = await Plot.findOne({
    _id: plotId,
    garden_id: gardenId,
  }).select('_id');

  return plot ? String(plot._id) : null;
};

const getSeasonIdFromGarden = (garden) => garden?.season_id?._id || garden?.season_id || null;

// Tạo nhật ký mới
const createLog = async (req, res) => {
  try {
    const { garden_id, task_id, plot_id, plot_ids, notification_id, ngay_lam, ghi_chu, nguoi_thuc_hien, is_completed } = req.body;

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
        message: 'Bạn không có quyền thêm nhật ký cho vườn này',
      });
    }

    const currentSeasonId = getSeasonIdFromGarden(garden);
    if (!currentSeasonId) {
      return res.status(404).json({
        success: false,
        message: 'Vườn này chưa có mùa vụ hiện tại',
      });
    }

    const resolvedPlotId = normalizePlotId(plot_id, plot_ids);
    const validPlotId = await validateGardenPlot(garden_id, resolvedPlotId);
    if (!validPlotId) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng chọn một mẫu đất thuộc vườn này',
      });
    }

    // Kiểm tra công việc tồn tại
    const task = await Task.findById(task_id);
    if (!task) {
      return res.status(404).json({
        success: false,
        message: 'Công việc không tồn tại',
      });
    }

    // Tạo nhật ký
    const log = new Log({
      garden_id,
      season_id: currentSeasonId,
      notification_id: notification_id || null,
      task_id,
      plot_id: validPlotId,
      plot_ids: [validPlotId],
      ngay_lam: ngay_lam || new Date(),
      ghi_chu: ghi_chu || '',
      is_completed: parseBoolean(is_completed, false),
      nguoi_thuc_hien: nguoi_thuc_hien || '',
    });

    await log.save();
    
    // Populate thông tin công việc, mùa vụ, và vườn trước khi trả kết quả
    await log.populate('plot_id', 'name area tree_type status');
    await log.populate('plot_ids', 'name area tree_type status');
    await log.populate('task_id', 'ten_cong_viec mo_ta');
    await log.populate('season_id', 'ten_mua_vu nam');
    await log.populate('garden_id', 'ten_vuon');
    
    console.log('✓ Tạo nhật ký:', task.ten_cong_viec);

    res.status(201).json({
      success: true,
      message: 'Tạo nhật ký thành công',
      data: log,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo nhật ký:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy nhật ký theo vườn
const getLogsByGarden = async (req, res) => {
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
        message: 'Bạn không có quyền xem nhật ký này',
      });
    }

    // Tạo query filter
    let query = { garden_id };
    if (season_id) {
      query.season_id = season_id;
    }

    // Lấy nhật ký và populate thông tin công việc, mùa vụ, vườn
    const logs = await Log.find(query)
      .populate('garden_id', 'ten_vuon')
      .populate('plot_id', 'name area tree_type status')
      .populate('task_id', 'ten_cong_viec mo_ta')
      .populate('season_id', 'ten_mua_vu nam thang_bat_dau thang_ket_thuc')
      .sort({ ngay_lam: -1 });

    console.log('✓ Lấy nhật ký:', logs.length);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy nhật ký:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật nhật ký
const updateLog = async (req, res) => {
  try {
    const { garden_id, ngay_lam, task_id, plot_id, plot_ids, notification_id, ghi_chu, nguoi_thuc_hien, is_completed } = req.body;
    const log = await Log.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Nhật ký không tồn tại',
      });
    }

    // Kiểm tra quyền (kiểm tra vườn)
    const garden = await Garden.findById(log.garden_id);
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
        message: 'Bạn không có quyền cập nhật nhật ký này',
      });
    }

    const targetGardenId = garden_id || log.garden_id;
    const targetGarden = garden_id ? await Garden.findById(garden_id) : garden;
    const currentSeasonId = getSeasonIdFromGarden(targetGarden);
    if (!currentSeasonId) {
      return res.status(404).json({
        success: false,
        message: 'Vườn này chưa có mùa vụ hiện tại',
      });
    }

    log.garden_id = targetGardenId;
    log.season_id = currentSeasonId;

    // Nếu cập nhật task_id, kiểm tra công việc tồn tại
    if (task_id) {
      const task = await Task.findById(task_id);
      if (!task) {
        return res.status(404).json({
          success: false,
          message: 'Công việc không tồn tại',
        });
      }
      log.task_id = task_id;
    }

    const resolvedPlotId = normalizePlotId(plot_id, plot_ids);
    if (resolvedPlotId) {
      const validPlotId = await validateGardenPlot(log.garden_id, resolvedPlotId);
      if (!validPlotId) {
        return res.status(400).json({
          success: false,
          message: 'Mẫu đất không thuộc vườn này',
        });
      }
      log.plot_id = validPlotId;
      log.plot_ids = [validPlotId];
    }

    if (notification_id !== undefined) {
      log.notification_id = notification_id || null;
    }

    // Cập nhật các field khác
    if (ngay_lam) log.ngay_lam = ngay_lam;
    if (ghi_chu !== undefined) log.ghi_chu = ghi_chu;
    if (nguoi_thuc_hien !== undefined) log.nguoi_thuc_hien = nguoi_thuc_hien;
    if (is_completed !== undefined) log.is_completed = parseBoolean(is_completed, log.is_completed);

    await log.save();

    if (log.notification_id) {
      const gardenOwner = await User.findById(garden.user_id).select('_id');
      if (gardenOwner) {
        await NotificationTracking.updateOne(
          {
            notification_id: log.notification_id,
            user_id: gardenOwner._id,
            garden_id: log.garden_id,
            plot_id: log.plot_id,
          },
          {
            $set: {
              status: log.is_completed ? 'done' : 'pending',
              ngay_cap_nhat: new Date(),
            },
          }
        );
      }
    }
    
    // Populate thông tin trước khi trả kết quả
    await log.populate('plot_id', 'name area tree_type status');
    await log.populate('plot_ids', 'name area tree_type status');
    await log.populate('task_id', 'ten_cong_viec mo_ta');
    await log.populate('season_id', 'ten_mua_vu nam');
    
    console.log('✓ Cập nhật nhật ký');

    res.json({
      success: true,
      message: 'Cập nhật nhật ký thành công',
      data: log,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật nhật ký:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy nhật ký theo mùa vụ
const getLogsBySeason = async (req, res) => {
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
          message: 'Bạn không có quyền xem nhật ký này',
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

    // Lấy nhật ký và populate thông tin
    const logs = await Log.find(query)
      .populate('garden_id', 'ten_vuon')
      .populate('plot_id', 'name area tree_type status')
      .populate('plot_ids', 'name area tree_type status')
      .populate('task_id', 'ten_cong_viec mo_ta')
      .populate('season_id', 'ten_mua_vu nam thang_bat_dau thang_ket_thuc')
      .sort({ ngay_lam: -1 });

    console.log('✓ Lấy nhật ký theo mùa vụ:', logs.length);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy nhật ký theo mùa vụ:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa nhật ký
const deleteLog = async (req, res) => {
  try {
    const log = await Log.findById(req.params.id);

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Nhật ký không tồn tại',
      });
    }

    // Get user to check role
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Người dùng không tồn tại',
      });
    }

    // Kiểm tra quyền: Lấy garden để verify
    const garden = await Garden.findById(log.garden_id);
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }

    // Kiểm tra user có quyền xóa logs của vườn này không
    if (user.vai_tro !== 'admin' && garden.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xóa nhật ký này',
      });
    }

    await Log.findByIdAndDelete(req.params.id);
    console.log('✓ Xóa nhật ký');

    res.json({
      success: true,
      message: 'Xóa nhật ký thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa nhật ký:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy chi tiết 1 nhật ký
const getLogById = async (req, res) => {
  try {
    const log = await Log.findById(req.params.id)
      .populate('garden_id', 'ten_vuon')
      .populate('plot_id', 'name area tree_type status')
      .populate('plot_ids', 'name area tree_type status')
      .populate('season_id', 'ten_mua_vu nam')
      .populate('task_id', 'ten_cong_viec mo_ta');

    if (!log) {
      return res.status(404).json({
        success: false,
        message: 'Nhật ký không tồn tại',
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

    // Kiểm tra xem nhật ký có thuộc vườn của user hay không
    const garden = await Garden.findById(log.garden_id);
    if (!garden) {
      return res.status(404).json({
        success: false,
        message: 'Vườn không tồn tại',
      });
    }
    
    if (user.vai_tro !== 'admin' && garden.user_id.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        message: 'Bạn không có quyền xem nhật ký này',
      });
    }

    res.json({
      success: true,
      data: log,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy nhật ký:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy tất cả nhật ký của user hiện tại
// Logic: Lấy tất cả vườn của user => Lấy logs của những vườn đó
const getAllLogsForUser = async (req, res) => {
  try {
    const userId = req.userId;
    console.log('\n👤 [GET /logs] userId:', userId);

    // Bước 1: Lấy tất cả vườn thuộc user
    const gardens = await Garden.find({ user_id: userId });
    console.log('🌳 Gardens found:', gardens.length);

    // Nếu user không có vườn => không có logs
    if (gardens.length === 0) {
      console.log('⚠️  User has no gardens');
      return res.json({
        success: true,
        count: 0,
        data: [],
      });
    }

    // Bước 2: Lấy IDs của các vườn
    const gardenIds = gardens.map(g => g._id);
    console.log('🔍 Searching logs in gardenIds:', gardenIds.length);

    // Bước 3: Lấy logs từ các vườn này
    const logs = await Log.find({ garden_id: { $in: gardenIds } })
      .populate('garden_id', 'ten_vuon')
      .populate('plot_id', 'name area tree_type status')
      .populate('season_id', 'ten_mua_vu nam')
      .populate('task_id', 'ten_cong_viec mo_ta')
      .sort({ ngay_lam: -1 });

    console.log('✓ Found logs:', logs.length);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('❌ Error in getAllLogsForUser:', error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Admin: Lấy tất cả nhật ký
const getAllLogsByAdmin = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    // Kiểm tra quyền admin
    if (!user || user.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ admin mới có thể xem tất cả nhật ký',
      });
    }

    // Lấy tất cả nhật ký và populate thông tin
    const logs = await Log.find()
      .populate('garden_id', 'ten_vuon')
      .populate('plot_id', 'name area tree_type status')
      .populate('season_id', 'ten_mua_vu nam')
      .populate('task_id', 'ten_cong_viec')
      .sort({ ngay_lam: -1 });

    console.log('✓ Admin lấy tất cả nhật ký:', logs.length);

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy nhật ký:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

const isSprayTaskName = (taskName = '', note = '') => {
  const value = `${taskName} ${note}`.toLowerCase();
  return /xịt|phun|spray|thuốc|thuoc/.test(value);
};

const getLogsByPlot = async (req, res) => {
  try {
    const { id } = req.params;

    const plot = await Plot.findById(id).populate('garden_id', 'ten_vuon user_id season_id');
    if (!plot) {
      return res.status(404).json({ success: false, message: 'Mẫu đất không tồn tại' });
    }

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    if (user.vai_tro !== 'admin' && String(plot.garden_id?.user_id || '') !== String(req.userId)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem nhật ký này' });
    }

    const logs = await Log.find({
      $or: [{ plot_id: id }, { plot_ids: id }],
    })
      .populate('garden_id', 'ten_vuon')
      .populate('plot_id', 'name area tree_type status')
      .populate('task_id', 'ten_cong_viec mo_ta')
      .populate('season_id', 'ten_mua_vu nam')
      .sort({ ngay_lam: -1 });

    res.json({
      success: true,
      count: logs.length,
      data: logs,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy nhật ký theo mẫu đất:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  createLog,
  getLogsByGarden,
  getLogsByPlot,
  getLogsBySeason,
  getLogById,
  getAllLogsForUser,
  getAllLogsByAdmin,
  updateLog,
  deleteLog,
};
