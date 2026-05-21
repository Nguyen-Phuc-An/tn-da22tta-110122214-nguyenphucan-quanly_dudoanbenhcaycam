const Log = require('../models/Log');
const Garden = require('../models/Garden');
const Task = require('../models/Task');
const Season = require('../models/Season');
const User = require('../models/User');

// Tạo nhật ký mới
const createLog = async (req, res) => {
  try {
    const { garden_id, season_id, task_id, ngay_lam, ghi_chu, nguoi_thuc_hien } = req.body;

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

    // Kiểm tra mùa vụ tồn tại
    const season = await Season.findById(season_id);
    if (!season) {
      return res.status(404).json({
        success: false,
        message: 'Mùa vụ không tồn tại',
      });
    }

    // Mùa vụ phải khớp với mùa hiện tại của vườn để tránh lệch dữ liệu
    const currentSeasonId = garden.season_id?._id || garden.season_id;
    if (currentSeasonId && String(season._id) !== String(currentSeasonId)) {
      return res.status(400).json({
        success: false,
        message: 'Mùa vụ không khớp với mùa vụ hiện tại của vườn',
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
      season_id,
      task_id,
      ngay_lam: ngay_lam || new Date(),
      ghi_chu: ghi_chu || '',
      nguoi_thuc_hien: nguoi_thuc_hien || '',
    });

    await log.save();
    
    // Populate thông tin công việc, mùa vụ, và vườn trước khi trả kết quả
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
    const { ngay_lam, season_id, task_id, ghi_chu, nguoi_thuc_hien } = req.body;
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

    // Nếu cập nhật season_id, kiểm tra mùa vụ tồn tại
    if (season_id) {
      const season = await Season.findById(season_id);
      if (!season) {
        return res.status(404).json({
          success: false,
          message: 'Mùa vụ không tồn tại',
        });
      }
      log.season_id = season_id;
    }

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

    // Cập nhật các field khác
    if (ngay_lam) log.ngay_lam = ngay_lam;
    if (ghi_chu !== undefined) log.ghi_chu = ghi_chu;
    if (nguoi_thuc_hien !== undefined) log.nguoi_thuc_hien = nguoi_thuc_hien;

    await log.save();
    
    // Populate thông tin trước khi trả kết quả
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

module.exports = {
  createLog,
  getLogsByGarden,
  getLogsBySeason,
  getLogById,
  getAllLogsForUser,
  getAllLogsByAdmin,
  updateLog,
  deleteLog,
};
