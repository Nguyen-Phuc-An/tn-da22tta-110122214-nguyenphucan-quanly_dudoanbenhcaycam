const Disease = require('../models/Disease');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

const ORGANIZED_DATASET_DIR = path.resolve(__dirname, '../../../ml/organized_dataset');
const SAMPLE_IMAGE_LIMIT = 12;
const EXCLUDED_DISEASE_EN = new Set(['melanose']);

const diseaseFolderMapping = {
  'Bệnh đốm đen': 'black_spot',
  'Bệnh loét': 'canker',
  'Thiếu dinh dưỡng': 'deficiency',
  'Bệnh đốm dầu': 'greasy_spot',
  'Bệnh vàng lá gân xanh': 'greening',
  'Lá khỏe mạnh': 'healthy',
  'Sâu vẽ bùa': 'leafminer',
  'Bệnh nấm melanose': 'melanose',
  'Nhiều bệnh': 'multiple',
};

const getDiseaseFolderName = (disease) => {
  if (!disease) return '';
  if (disease.ten_benh_en && diseaseFolderMapping[disease.ten_benh_en]) {
    return disease.ten_benh_en;
  }
  if (disease.ten_benh && diseaseFolderMapping[disease.ten_benh]) {
    return diseaseFolderMapping[disease.ten_benh];
  }
  return disease.ten_benh_en || disease.ten_benh || '';
};

const getSampleImagesForDisease = (folderName) => {
  if (!folderName) return [];

  const folderPath = path.join(ORGANIZED_DATASET_DIR, folderName);
  if (!fs.existsSync(folderPath)) return [];

  return fs
    .readdirSync(folderPath)
    .filter((file) => /\.(jpg|jpeg|png|webp)$/i.test(file))
    .sort((a, b) => a.localeCompare(b))
    .slice(0, SAMPLE_IMAGE_LIMIT)
    .map((file) => ({
      name: file,
      url: `/disease-dataset/${folderName}/${file}`,
    }));
};

// ===== CẬP NHẬT: Populate Fertilizer & Pesticide =====
// Lấy danh sách tất cả bệnh
const getAllDiseases = async (req, res) => {
  try {
    const diseases = await Disease.find()
      .populate('goi_y_phan_bon', 'ten_phan_bon thanh_phan')
      .populate('goi_y_thuoc', 'ten_thuoc loai hoat_chat')
      .sort({ ten_benh: 1 });

    const visibleDiseases = diseases.filter((disease) => !EXCLUDED_DISEASE_EN.has(disease.ten_benh_en));

    console.log('✓ Lấy danh sách bệnh:', visibleDiseases.length);

    res.json({
      success: true,
      count: visibleDiseases.length,
      data: visibleDiseases,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách bệnh:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== CẬP NHẬT: Populate Fertilizer & Pesticide =====
// Lấy chi tiết 1 bệnh
const getDiseaseById = async (req, res) => {
  try {
    const disease = await Disease.findById(req.params.id)
      .populate('goi_y_phan_bon')
      .populate('goi_y_thuoc');

    if (!disease) {
      return res.status(404).json({
        success: false,
        message: 'Bệnh không tồn tại',
      });
    }

    res.json({
      success: true,
      data: disease,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy chi tiết bệnh:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy thư viện bệnh kèm ảnh mẫu gốc từ organized_dataset
const getDiseaseLibrary = async (req, res) => {
  try {
    const diseases = await Disease.find()
      .sort({ ten_benh: 1 })
      .lean();

    const visibleDiseases = diseases.filter((disease) => !EXCLUDED_DISEASE_EN.has(disease.ten_benh_en));

    const library = visibleDiseases.map((disease) => {
      const folderName = getDiseaseFolderName(disease);
      const sampleImages = getSampleImagesForDisease(folderName);

      return {
        ...disease,
        folder_name: folderName,
        sample_images: sampleImages,
        sample_image_count: sampleImages.length,
      };
    });

    res.json({
      success: true,
      count: library.length,
      data: library,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy thư viện bệnh:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Tạo bệnh mới (Admin)
const createDisease = async (req, res) => {
  try {
    // Kiểm tra quyền Admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới có thể tạo bệnh',
      });
    }

    const {
      ten_benh,
      ten_benh_en,
      mo_ta,
      nguyen_nhan,
      trieu_chung,
      huong_xu_ly,
      loai_cay_bi_anh_huong,
      muc_do_nguy_hiem,
      goi_y_phan_bon,
      goi_y_thuoc,
    } = req.body;

    // Kiểm tra dữ liệu bắt buộc
    if (!ten_benh_en) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập tên bệnh tiếng Anh (ten_benh_en)',
      });
    }

    if (EXCLUDED_DISEASE_EN.has(String(ten_benh_en).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Bệnh này đã được loại khỏi danh sách hiển thị',
      });
    }

    // Kiểm tra bệnh đã tồn tại (theo ten_benh hoặc ten_benh_en)
    const existingDisease = await Disease.findOne({ $or: [{ ten_benh }, { ten_benh_en }] });
    if (existingDisease) {
      return res.status(400).json({
        success: false,
        message: 'Bệnh này đã tồn tại',
      });
    }

    // Xử lý goi_y_phan_bon: đảm bảo luôn là array, nếu không có → []
    const validatedGoiYPhanBon = Array.isArray(goi_y_phan_bon) ? goi_y_phan_bon : [];

    // Xử lý goi_y_thuoc: đảm bảo luôn là array, nếu không có → []
    const validatedGoiYThuoc = Array.isArray(goi_y_thuoc) ? goi_y_thuoc : [];

    const disease = new Disease({
      ten_benh,
      ten_benh_en,
      mo_ta,
      nguyen_nhan: nguyen_nhan || '',
      trieu_chung: trieu_chung || '',
      huong_xu_ly,
      loai_cay_bi_anh_huong: loai_cay_bi_anh_huong || [],
      muc_do_nguy_hiem: muc_do_nguy_hiem || 'Trung bình',
      goi_y_phan_bon: validatedGoiYPhanBon,
      goi_y_thuoc: validatedGoiYThuoc,
    });

    await disease.save();
    console.log('✓ Tạo bệnh:', ten_benh);

    res.status(201).json({
      success: true,
      message: 'Tạo bệnh thành công',
      data: disease,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo bệnh:', error.message);
    
    // Xử lý lỗi duplicate key (ten_benh hoặc ten_benh_en đã tồn tại)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      console.error(`❌ Giá trị ${field} đã tồn tại:`, error.keyValue[field]);
      return res.status(400).json({
        success: false,
        message: `${field === 'ten_benh' ? 'Tên bệnh' : 'Tên tiếng Anh'} đã tồn tại trong hệ thống`,
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật bệnh (Admin)
const updateDisease = async (req, res) => {
  try {
    // Kiểm tra quyền Admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới có thể cập nhật bệnh',
      });
    }

    const disease = await Disease.findById(req.params.id);
    if (!disease) {
      return res.status(404).json({
        success: false,
        message: 'Bệnh không tồn tại',
      });
    }

    const {
      ten_benh,
      ten_benh_en,
      mo_ta,
      nguyen_nhan,
      trieu_chung,
      huong_xu_ly,
      loai_cay_bi_anh_huong,
      muc_do_nguy_hiem,
      goi_y_phan_bon,
      goi_y_thuoc,
    } = req.body;

    // Cập nhật các field cơ bản
    if (ten_benh) disease.ten_benh = ten_benh;
    if (ten_benh_en) disease.ten_benh_en = ten_benh_en;
    if (ten_benh_en && EXCLUDED_DISEASE_EN.has(String(ten_benh_en).trim())) {
      return res.status(400).json({
        success: false,
        message: 'Bệnh này đã được loại khỏi danh sách hiển thị',
      });
    }
    if (mo_ta) disease.mo_ta = mo_ta;
    if (nguyen_nhan) disease.nguyen_nhan = nguyen_nhan;
    if (trieu_chung) disease.trieu_chung = trieu_chung;
    if (huong_xu_ly) disease.huong_xu_ly = huong_xu_ly;
    if (loai_cay_bi_anh_huong) disease.loai_cay_bi_anh_huong = loai_cay_bi_anh_huong;
    if (muc_do_nguy_hiem) disease.muc_do_nguy_hiem = muc_do_nguy_hiem;

    // Cập nhật goi_y_phan_bon: đảm bảo là array
    if (goi_y_phan_bon !== undefined) {
      disease.goi_y_phan_bon = Array.isArray(goi_y_phan_bon) ? goi_y_phan_bon : [];
    }

    // Cập nhật goi_y_thuoc: đảm bảo là array
    if (goi_y_thuoc !== undefined) {
      disease.goi_y_thuoc = Array.isArray(goi_y_thuoc) ? goi_y_thuoc : [];
    }

    await disease.save();
    console.log('✓ Cập nhật bệnh:', ten_benh || disease.ten_benh);

    res.json({
      success: true,
      message: 'Cập nhật bệnh thành công',
      data: disease,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật bệnh:', error.message);
    
    // Xử lý lỗi duplicate key (ten_benh hoặc ten_benh_en đã tồn tại)
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue)[0];
      console.error(`❌ Giá trị ${field} đã tồn tại:`, error.keyValue[field]);
      return res.status(400).json({
        success: false,
        message: `${field === 'ten_benh' ? 'Tên bệnh' : 'Tên tiếng Anh'} đã tồn tại trong hệ thống`,
      });
    }
    
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa bệnh (Admin)
const deleteDisease = async (req, res) => {
  try {
    // Kiểm tra quyền Admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới có thể xóa bệnh',
      });
    }

    const disease = await Disease.findById(req.params.id);
    if (!disease) {
      return res.status(404).json({
        success: false,
        message: 'Bệnh không tồn tại',
      });
    }

    await Disease.findByIdAndDelete(req.params.id);
    console.log('✓ Xóa bệnh:', disease.ten_benh);

    res.json({
      success: true,
      message: 'Xóa bệnh thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa bệnh:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Migration API: Cập nhật ten_benh_en từ mapping
const migrateEnFields = async (req, res) => {
  try {
    // Kiểm tra quyền Admin
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Chỉ Admin mới có thể thực hiện migration',
      });
    }

    // Mapping tiếng Việt → Tiếng Anh
    const mapping = {
      'Bệnh đốm đen': 'black_spot',
      'Bệnh loét': 'canker',
      'Thiếu dinh dưỡng': 'deficiency',
      'Bệnh đốm dầu': 'greasy_spot',
      'Bệnh vàng lá gân xanh': 'greening',
      'Lá khỏe mạnh': 'healthy',
      'Sâu vẽ bùa': 'leafminer',
      'Bệnh nấm melanose': 'melanose',
      'Nhiều bệnh': 'multiple',
    };

    let updatedCount = 0;
    let skippedCount = 0;

    // Lấy tất cả bệnh
    const diseases = await Disease.find();

    for (const disease of diseases) {
      const enName = mapping[disease.ten_benh];

      if (!enName) {
        console.log(`⚠️ Không tìm thấy mapping cho: ${disease.ten_benh}`);
        skippedCount++;
        continue;
      }

      // Cập nhật ten_benh_en
      disease.ten_benh_en = enName;
      await disease.save();
      updatedCount++;
      console.log(`✓ Cập nhật: ${disease.ten_benh} → ${enName}`);
    }

    res.json({
      success: true,
      message: 'Migration hoàn thành',
      data: {
        total_processed: updatedCount + skippedCount,
        updated: updatedCount,
        skipped: skippedCount,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi migration:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// API tìm bệnh theo ten_benh_en (từ ML API)
const getDiseaseByEnName = async (req, res) => {
  try {
    const { en_name } = req.params;

    if (!en_name) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp tên bệnh tiếng Anh',
      });
    }

    const disease = await Disease.findOne({ ten_benh_en: en_name });

    if (!disease) {
      return res.status(404).json({
        success: false,
        message: `Không tìm thấy bệnh: ${en_name}`,
      });
    }

    res.json({
      success: true,
      data: disease,
    });
  } catch (error) {
    console.error('❌ Lỗi tìm bệnh:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  getAllDiseases,
  getDiseaseById,
  getDiseaseLibrary,
  getDiseaseByEnName,
  createDisease,
  updateDisease,
  deleteDisease,
  migrateEnFields,
};
