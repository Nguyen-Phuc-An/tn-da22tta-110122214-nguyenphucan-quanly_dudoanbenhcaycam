const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

// Tạo JWT token
const createToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'secret123', {
    expiresIn: '7d',
  });
};

// Middleware để lấy req.userId từ JWT token
// (được xử lý bởi authenticateToken middleware trong auth.js)

// Đăng ký người dùng
const register = async (req, res) => {
  try {
    const { ho_ten, email, mat_khau, vai_tro } = req.body;

    // Kiểm tra email đã tồn tại
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được đăng ký',
      });
    }

    // Tạo user mới
    const user = new User({
      ho_ten,
      email,
      mat_khau,
      vai_tro: vai_tro || 'user',
    });

    // Lưu user (bcrypt sẽ tự mã hóa trong pre('save'))
    await user.save();
    console.log('✓ Tạo user mới:', email);

    // Trả về token
    const token = createToken(user._id);
    res.status(201).json({
      success: true,
      message: 'Đăng ký thành công',
      token,
      user: {
        _id: user._id,
        ho_ten: user.ho_ten,
        email: user.email,
        vai_tro: user.vai_tro,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi đăng ký:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Đăng nhập
const login = async (req, res) => {
  try {
    const { email, mat_khau } = req.body;

    console.log(`\n🔐 Login attempt: ${email}`);

    // Kiểm tra email tồn tại
    const user = await User.findOne({ email }).select('+mat_khau');
    if (!user) {
      console.log(`❌ User not found: ${email}`);
      return res.status(400).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng',
      });
    }

    console.log(`✓ User found: ${user.ho_ten}`);
    console.log(`✓ Stored password hash: ${user.mat_khau ? 'exists' : 'UNDEFINED'}`);
    console.log(`✓ Input password: ${mat_khau ? 'exists' : 'UNDEFINED'}`);

    // Kiểm tra mật khẩu
    const isPasswordCorrect = await user.comparePassword(mat_khau);
    if (!isPasswordCorrect) {
      console.log(`❌ Password incorrect`);
      return res.status(400).json({
        success: false,
        message: 'Email hoặc mật khẩu không đúng',
      });
    }

    console.log(`✓ Password correct!`);

    // Tạo token
    const token = createToken(user._id);
    console.log('✓ Đăng nhập:', email);

    res.json({
      success: true,
      message: 'Đăng nhập thành công',
      token,
      user: {
        _id: user._id,
        ho_ten: user.ho_ten,
        email: user.email,
        vai_tro: user.vai_tro,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi đăng nhập:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy thông tin user hiện tại
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User không tồn tại',
      });
    }

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy profile:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Lấy danh sách tất cả user (chỉ admin)
const getAllUsers = async (req, res) => {
  try {
    console.log('👉 GET /api/users called');

    // Kiểm tra admin role
    const currentUser = await User.findById(req.userId);
    if (!currentUser || currentUser.vai_tro !== 'admin') {
      console.log('❌ Access denied - not admin');
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin only',
      });
    }

    console.log('✓ Admin access granted');

    // Lấy danh sách user (không trả về mật khẩu) sắp xếp theo ngày tạo giảm dần
    const users = await User.find()
      .select('-mat_khau')
      .sort({ ngay_tao: -1 })
      .limit(100)
      .lean();

    // Import Garden model để đếm vườn
    const Garden = require('../models/Garden');

    // Thêm số lượng vườn cho mỗi user
    const usersWithGardenCount = await Promise.all(
      users.map(async (user) => {
        const gardenCount = await Garden.countDocuments({ user_id: user._id });
        return {
          ...user,
          gardens: new Array(gardenCount), // Tạo array với length = gardenCount
        };
      })
    );

    console.log(`✓ Retrieved ${usersWithGardenCount.length} users`);

    res.json({
      success: true,
      data: usersWithGardenCount,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách user:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Khóa/Mở khóa tài khoản user (chỉ admin)
const lockUser = async (req, res) => {
  try {
    const { userId: targetUserId } = req.params;
    const { is_locked } = req.body;

    console.log(`👉 PATCH /api/users/${targetUserId}/lock called`);

    // Kiểm tra admin role
    const currentUser = await User.findById(req.userId);
    if (!currentUser || currentUser.vai_tro !== 'admin') {
      console.log('❌ Access denied - not admin');
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin only',
      });
    }

    // Không cho admin khóa admin user
    const targetUser = await User.findById(targetUserId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User không tồn tại',
      });
    }

    if (targetUser.vai_tro === 'admin' && currentUser._id.toString() !== targetUserId) {
      return res.status(403).json({
        success: false,
        message: 'Không thể khóa tài khoản admin',
      });
    }

    // Cập nhật trạng thái khóa
    targetUser.is_locked = is_locked || !targetUser.is_locked;
    await targetUser.save();

    console.log(`✓ User ${targetUserId} lock status: ${targetUser.is_locked}`);

    res.json({
      success: true,
      message: targetUser.is_locked ? 'User đã bị khóa' : 'User đã được mở khóa',
      data: {
        _id: targetUser._id,
        ho_ten: targetUser.ho_ten,
        email: targetUser.email,
        is_locked: targetUser.is_locked,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi khóa user:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Tạo user mới (chỉ admin)
const createUser = async (req, res) => {
  try {
    const { ho_ten, email, mat_khau, vai_tro = 'user', is_locked = false } = req.body;

    const currentUser = await User.findById(req.userId);
    if (!currentUser || currentUser.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin only',
      });
    }

    if (!ho_ten || !email || !mat_khau) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập họ tên, email và mật khẩu',
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Email đã được sử dụng',
      });
    }

    const user = new User({
      ho_ten: String(ho_ten).trim(),
      email: normalizedEmail,
      mat_khau,
      vai_tro: vai_tro === 'admin' ? 'admin' : 'user',
      is_locked: Boolean(is_locked),
    });

    await user.save();

    res.status(201).json({
      success: true,
      message: 'Tạo user thành công',
      data: {
        _id: user._id,
        ho_ten: user.ho_ten,
        email: user.email,
        vai_tro: user.vai_tro,
        is_locked: user.is_locked,
        ngay_tao: user.ngay_tao,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi tạo user:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Cập nhật user (chỉ admin)
const updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { ho_ten, email, mat_khau, vai_tro, is_locked } = req.body;

    const currentUser = await User.findById(req.userId);
    if (!currentUser || currentUser.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin only',
      });
    }

    const user = await User.findById(userId).select('+mat_khau');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User không tồn tại',
      });
    }

    if (ho_ten !== undefined) user.ho_ten = String(ho_ten).trim();

    if (email !== undefined) {
      const normalizedEmail = String(email).trim().toLowerCase();
      const existed = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } });
      if (existed) {
        return res.status(400).json({ success: false, message: 'Email đã được sử dụng' });
      }
      user.email = normalizedEmail;
    }

    if (vai_tro !== undefined) {
      user.vai_tro = vai_tro === 'admin' ? 'admin' : 'user';
    }

    if (is_locked !== undefined) {
      user.is_locked = Boolean(is_locked);
    }

    if (mat_khau) {
      user.mat_khau = mat_khau;
    }

    await user.save();

    res.json({
      success: true,
      message: 'Cập nhật user thành công',
      data: {
        _id: user._id,
        ho_ten: user.ho_ten,
        email: user.email,
        vai_tro: user.vai_tro,
        is_locked: user.is_locked,
        ngay_tao: user.ngay_tao,
      },
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật user:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Xóa user (chỉ admin)
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const currentUser = await User.findById(req.userId);
    if (!currentUser || currentUser.vai_tro !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied - Admin only',
      });
    }

    if (String(userId) === String(req.userId)) {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản đang đăng nhập',
      });
    }

    const targetUser = await User.findById(userId);
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User không tồn tại',
      });
    }

    if (targetUser.vai_tro === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Không thể xóa tài khoản admin',
      });
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'Xóa user thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa user:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// Đổi mật khẩu
const changePassword = async (req, res) => {
  try {
    const { mat_khau_cu, mat_khau_moi } = req.body;

    console.log(`👉 POST /api/users/change-password called for user ${req.userId}`);

    // Kiểm tra dữ liệu đầu vào
    if (!mat_khau_cu || !mat_khau_moi) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng cung cấp mật khẩu cũ và mật khẩu mới',
      });
    }

    if (mat_khau_moi.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu mới phải có ít nhất 6 ký tự',
      });
    }

    // Lấy user từ DB (cần select password field)
    const user = await User.findById(req.userId).select('+mat_khau');
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User không tồn tại',
      });
    }

    // Kiểm tra mật khẩu cũ
    const isPasswordCorrect = await user.comparePassword(mat_khau_cu);
    if (!isPasswordCorrect) {
      console.log('❌ Mật khẩu cũ không chính xác');
      return res.status(400).json({
        success: false,
        message: 'Mật khẩu cũ không chính xác',
      });
    }

    // Cập nhật mật khẩu mới
    user.mat_khau = mat_khau_moi;
    await user.save();

    console.log(`✓ Mật khẩu đã được đổi cho user ${user.email}`);

    res.json({
      success: true,
      message: 'Đổi mật khẩu thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi đổi mật khẩu:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  register,
  login,
  getProfile,
  getAllUsers,
  lockUser,
  createUser,
  updateUser,
  deleteUser,
  changePassword,
};
