/**
 * Fertilizer Controller
 * 
 * Ghi chú:
 * - Quản lý CRUD cho phân bón
 * - Chỉ admin được phép thêm/sửa/xóa
 */

const Fertilizer = require('../models/Fertilizer');

// ===== GET: Lấy danh sách tất cả phân bón =====
const getAllFertilizers = async (req, res) => {
  try {
    const fertilizers = await Fertilizer.find().sort({ ten_phan_bon: 1 });

    console.log('✓ Lấy danh sách phân bón:', fertilizers.length);

    res.json({
      success: true,
      count: fertilizers.length,
      data: fertilizers,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách phân bón:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== GET: Lấy chi tiết 1 phân bón =====
const getFertilizerById = async (req, res) => {
  try {
    const fertilizer = await Fertilizer.findById(req.params.id);

    if (!fertilizer) {
      return res.status(404).json({
        success: false,
        message: 'Phân bón không tồn tại',
      });
    }

    res.json({
      success: true,
      data: fertilizer,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết phân bón:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== POST: Tạo phân bón mới (Admin only) =====
const createFertilizer = async (req, res) => {
  try {
    // ✅ Kiểm tra admin role
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới được phép thêm phân bón',
      });
    }

    const { ten_phan_bon, mo_ta, thanh_phan, cong_dung, gia_tien, cach_su_dung, don_vi } = req.body;

    // Validate input
    if (!ten_phan_bon || !thanh_phan || !cong_dung || gia_tien === undefined) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc',
      });
    }

    // Kiểm tra trùng lặp
    const existingFertilizer = await Fertilizer.findOne({ ten_phan_bon });
    if (existingFertilizer) {
      return res.status(400).json({
        success: false,
        message: 'Tên phân bón này đã tồn tại',
      });
    }

    const fertilizer = new Fertilizer({
      ten_phan_bon,
      mo_ta,
      thanh_phan,
      cong_dung,
      gia_tien: Number(gia_tien),
      cach_su_dung: cach_su_dung || '',
      don_vi: don_vi || 'kg',
    });

    await fertilizer.save();

    console.log('✅ Tạo phân bón mới:', ten_phan_bon);

    res.status(201).json({
      success: true,
      message: 'Tạo phân bón thành công',
      data: fertilizer,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo phân bón:', error.message);

    // Xử lý lỗi duplicate key
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field === 'ten_phan_bon' ? 'Tên phân bón' : field} đã tồn tại`,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== PUT: Cập nhật phân bón (Admin only) =====
const updateFertilizer = async (req, res) => {
  try {
    // ✅ Kiểm tra admin role
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới được phép sửa phân bón',
      });
    }

    const { ten_phan_bon, mo_ta, thanh_phan, cong_dung, gia_tien, cach_su_dung, don_vi } = req.body;

    const fertilizer = await Fertilizer.findById(req.params.id);
    if (!fertilizer) {
      return res.status(404).json({
        success: false,
        message: 'Phân bón không tồn tại',
      });
    }

    // Cập nhật các trường
    if (ten_phan_bon) fertilizer.ten_phan_bon = ten_phan_bon;
    if (mo_ta !== undefined) fertilizer.mo_ta = mo_ta;
    if (thanh_phan) fertilizer.thanh_phan = thanh_phan;
    if (cong_dung) fertilizer.cong_dung = cong_dung;
    if (gia_tien !== undefined) fertilizer.gia_tien = Number(gia_tien);
    if (cach_su_dung !== undefined) fertilizer.cach_su_dung = cach_su_dung;
    if (don_vi) fertilizer.don_vi = don_vi;
    
    fertilizer.ngay_cap_nhat = new Date();

    await fertilizer.save();

    console.log('✅ Cập nhật phân bón:', ten_phan_bon || fertilizer.ten_phan_bon);

    res.json({
      success: true,
      message: 'Cập nhật phân bón thành công',
      data: fertilizer,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật phân bón:', error.message);

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field === 'ten_phan_bon' ? 'Tên phân bón' : field} đã tồn tại`,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== DELETE: Xóa phân bón (Admin only) =====
const deleteFertilizer = async (req, res) => {
  try {
    // ✅ Kiểm tra admin role
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới được phép xóa phân bón',
      });
    }

    const fertilizer = await Fertilizer.findById(req.params.id);
    if (!fertilizer) {
      return res.status(404).json({
        success: false,
        message: 'Phân bón không tồn tại',
      });
    }

    await Fertilizer.findByIdAndDelete(req.params.id);

    console.log('✅ Xóa phân bón:', fertilizer.ten_phan_bon);

    res.json({
      success: true,
      message: 'Xóa phân bón thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa phân bón:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllFertilizers,
  getFertilizerById,
  createFertilizer,
  updateFertilizer,
  deleteFertilizer,
};
