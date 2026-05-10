/**
 * Pesticide Controller
 * 
 * Ghi chú:
 * - Quản lý CRUD cho thuốc
 * - Chỉ admin được phép thêm/sửa/xóa
 */

const Pesticide = require('../models/Pesticide');

// ===== GET: Lấy danh sách tất cả thuốc =====
const getAllPesticides = async (req, res) => {
  try {
    const pesticides = await Pesticide.find().sort({ ten_thuoc: 1 });

    console.log('✓ Lấy danh sách thuốc:', pesticides.length);

    res.json({
      success: true,
      count: pesticides.length,
      data: pesticides,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách thuốc:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== GET: Lấy chi tiết 1 thuốc =====
const getPesticideById = async (req, res) => {
  try {
    const pesticide = await Pesticide.findById(req.params.id);

    if (!pesticide) {
      return res.status(404).json({
        success: false,
        message: 'Thuốc không tồn tại',
      });
    }

    res.json({
      success: true,
      data: pesticide,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết thuốc:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== POST: Tạo thuốc mới (Admin only) =====
const createPesticide = async (req, res) => {
  try {
    // ✅ Kiểm tra admin role
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới được phép thêm thuốc',
      });
    }

    const { ten_thuoc, mo_ta, loai, hoat_chat, gia_tien, cach_su_dung, muc_do_doc_hai } = req.body;

    // Validate input
    if (!ten_thuoc || !loai || !hoat_chat || gia_tien === undefined || !muc_do_doc_hai) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng điền đầy đủ thông tin bắt buộc',
      });
    }

    // Kiểm tra trùng lặp
    const existingPesticide = await Pesticide.findOne({ ten_thuoc });
    if (existingPesticide) {
      return res.status(400).json({
        success: false,
        message: 'Tên thuốc này đã tồn tại',
      });
    }

    const pesticide = new Pesticide({
      ten_thuoc,
      mo_ta,
      loai,
      hoat_chat,
      gia_tien: Number(gia_tien),
      cach_su_dung: cach_su_dung || '',
      muc_do_doc_hai,
    });

    await pesticide.save();

    console.log('✅ Tạo thuốc mới:', ten_thuoc);

    res.status(201).json({
      success: true,
      message: 'Tạo thuốc thành công',
      data: pesticide,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo thuốc:', error.message);

    // Xử lý lỗi duplicate key
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field === 'ten_thuoc' ? 'Tên thuốc' : field} đã tồn tại`,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== PUT: Cập nhật thuốc (Admin only) =====
const updatePesticide = async (req, res) => {
  try {
    // ✅ Kiểm tra admin role
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới được phép sửa thuốc',
      });
    }

    const { ten_thuoc, mo_ta, loai, hoat_chat, gia_tien, cach_su_dung, muc_do_doc_hai } = req.body;

    const pesticide = await Pesticide.findById(req.params.id);
    if (!pesticide) {
      return res.status(404).json({
        success: false,
        message: 'Thuốc không tồn tại',
      });
    }

    // Cập nhật các trường
    if (ten_thuoc) pesticide.ten_thuoc = ten_thuoc;
    if (mo_ta !== undefined) pesticide.mo_ta = mo_ta;
    if (loai) pesticide.loai = loai;
    if (hoat_chat) pesticide.hoat_chat = hoat_chat;
    if (gia_tien !== undefined) pesticide.gia_tien = Number(gia_tien);
    if (cach_su_dung !== undefined) pesticide.cach_su_dung = cach_su_dung;
    if (muc_do_doc_hai) pesticide.muc_do_doc_hai = muc_do_doc_hai;
    
    pesticide.ngay_cap_nhat = new Date();

    await pesticide.save();

    console.log('✅ Cập nhật thuốc:', ten_thuoc || pesticide.ten_thuoc);

    res.json({
      success: true,
      message: 'Cập nhật thuốc thành công',
      data: pesticide,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật thuốc:', error.message);

    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      return res.status(400).json({
        success: false,
        message: `${field === 'ten_thuoc' ? 'Tên thuốc' : field} đã tồn tại`,
      });
    }

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== DELETE: Xóa thuốc (Admin only) =====
const deletePesticide = async (req, res) => {
  try {
    // ✅ Kiểm tra admin role
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới được phép xóa thuốc',
      });
    }

    const pesticide = await Pesticide.findById(req.params.id);
    if (!pesticide) {
      return res.status(404).json({
        success: false,
        message: 'Thuốc không tồn tại',
      });
    }

    await Pesticide.findByIdAndDelete(req.params.id);

    console.log('✅ Xóa thuốc:', pesticide.ten_thuoc);

    res.json({
      success: true,
      message: 'Xóa thuốc thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa thuốc:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllPesticides,
  getPesticideById,
  createPesticide,
  updatePesticide,
  deletePesticide,
};
