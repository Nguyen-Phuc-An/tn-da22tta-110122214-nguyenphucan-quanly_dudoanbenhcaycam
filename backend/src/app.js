require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/db');
const User = require('./models/User');
const jwt = require('jsonwebtoken');
const { readSiteState } = require('./utils/siteState');

// Import routes
const userRoutes = require('./routes/user.routes');
const gardenRoutes = require('./routes/garden.routes');
const plotRoutes = require('./routes/plot.routes');
const logRoutes = require('./routes/log.routes');
const expenseRoutes = require('./routes/expense.routes');
const predictionRoutes = require('./routes/prediction.routes');
const diseaseRoutes = require('./routes/disease.routes');
const seasonRoutes = require('./routes/season.routes');
const taskRoutes = require('./routes/task.routes');
const notificationRoutes = require('./routes/notification.routes');
const systemRoutes = require('./routes/system.routes');
// ===== CẬP NHẬT: Thêm Fertilizer & Pesticide routes =====
const fertilizerRoutes = require('./routes/fertilizer.routes');
const pesticideRoutes = require('./routes/pesticide.routes');
// ===== CẬP NHẬT: Thêm ML routes =====
const mlRoutes = require('./routes/ml.routes');

// Khởi tạo Express
const app = express();

// Kết nối Database
connectDB();

// ============================================================================
// TẠO ADMIN USER NẾU CHƯA CÓ
// ============================================================================

const initializeAdminUser = async () => {
  try {
    // Kiểm tra admin có tồn tại không
    const adminExists = await User.findOne({ email: 'admin@gmail.com' });

    if (adminExists) {
      console.log('✓ Admin user đã tồn tại');
      return;
    }

    // Tạo admin user
    const adminUser = new User({
      ho_ten: 'Cán bộ Quản trị',
      email: 'admin@gmail.com',
      mat_khau: 'admin123',
      vai_tro: 'admin',
    });

    await adminUser.save();
    console.log('✓ Tạo admin user thành công');
    console.log('  Email: admin@gmail.com');
    console.log('  Password: admin123');
    console.log('  Role: admin');
  } catch (error) {
    if (error.code !== 11000) {
      // Bỏ qua lỗi uniqueness, chỉ log lỗi khác
      console.error('❌ Lỗi khởi tạo admin user:', error.message);
    }
  }
};

// Gọi hàm tạo admin user sau 1 giây (đợi db kết nối)
setTimeout(initializeAdminUser, 1000);

// Middleware
// CORS - điều này PHẢI ở trước các routes
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  credentials: true,
  optionsSuccessStatus: 200,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const getTokenFromRequest = (req) => {
  const authHeader = req.headers.authorization;
  let token = authHeader && authHeader.split(' ')[1];

  if (!token && req.query.token) {
    token = req.query.token;
  }

  return token;
};

const maintenanceGuard = async (req, res, next) => {
  const state = readSiteState();

  if (!state.maintenanceMode) {
    return next();
  }

  const publicPaths = [
    '/api/system/maintenance',
    '/api/auth/login',
    '/api/auth/register',
    '/health',
  ];

  if (publicPaths.includes(req.originalUrl) || publicPaths.some((prefix) => req.originalUrl.startsWith(prefix))) {
    return next();
  }

  const token = getTokenFromRequest(req);

  if (!token) {
    return res.status(503).json({
      success: false,
      maintenanceMode: true,
      message: 'Hệ thống đang bảo trì',
    });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret123');
    const user = await User.findById(decoded.userId);

    if (user && user.vai_tro === 'admin') {
      return next();
    }
  } catch (error) {
    // Không cho qua nếu token lỗi
  }

  return res.status(503).json({
    success: false,
    maintenanceMode: true,
    message: 'Hệ thống đang bảo trì',
  });
};

app.use(maintenanceGuard);

// Serve static files (cho uploads)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use('/disease-dataset', express.static(path.join(__dirname, '../../ml/organized_dataset')));

// Routes
app.get('/', (req, res) => {
  res.json({
    message: 'Chào mừng đến Quản lý Vườn Cây',
    version: '1.0.0',
    status: '✓ Server đang chạy',
    note: 'API endpoints moved to /api/* path',
    endpoints: {
      auth: '/api/auth',
      users: '/api/users',
      gardens: '/api/gardens',
      plots: '/api/plots',
      logs: '/api/logs',
      expenses: '/api/expenses',
      predictions: '/api/predictions',
      diseases: '/api/diseases',
      seasons: '/api/seasons',
      tasks: '/api/tasks',
      notifications: '/api/notifications',
    },
  });
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// Kết nối tất cả routes
app.use('/api/auth', userRoutes);
app.use('/api/users', userRoutes);  // Tương tự auth routes nhưng endpoint /api/users
app.use('/api/gardens', gardenRoutes);
app.use('/api/plots', plotRoutes);
app.use('/api/logs', logRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/predictions', predictionRoutes);
app.use('/api/diseases', diseaseRoutes);
app.use('/api/seasons', seasonRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/system', systemRoutes);
// ===== CẬP NHẬT: Đăng ký Fertilizer & Pesticide routes =====
app.use('/api/fertilizers', fertilizerRoutes);
app.use('/api/pesticides', pesticideRoutes);
// ===== CẬP NHẬT: Đăng ký ML routes =====
app.use('/api/ml', mlRoutes);

// Xử lý route không tồn tại
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'API endpoint không tồn tại',
    path: req.originalUrl,
  });
});

// Xử lý lỗi chung
app.use((error, req, res, next) => {
  console.error('❌ Lỗi:', error.message);
  res.status(error.status || 500).json({
    success: false,
    message: error.message || 'Lỗi server',
    error: process.env.NODE_ENV === 'development' ? error : {},
  });
});

// Khởi động server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`✓ Server chạy trên http://localhost:${PORT}`);
  console.log(`✓ Môi trường: ${process.env.NODE_ENV || 'development'}`);
  console.log(`✓ API Documentation: http://localhost:${PORT}/`);
  console.log(`${'='.repeat(50)}\n`);
  console.log(`✓ Môi trường: ${process.env.NODE_ENV || 'development'}`);
  console.log(`${'='.repeat(50)}\n`);
});

module.exports = app;
