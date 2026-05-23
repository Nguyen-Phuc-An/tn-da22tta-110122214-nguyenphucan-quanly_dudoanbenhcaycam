const Plot = require('../models/Plot');
const Garden = require('../models/Garden');
const User = require('../models/User');

const getCurrentUser = async (userId) => User.findById(userId);

const hasGardenAccess = (currentUser, garden) => {
  if (!currentUser || !garden) return false;
  return currentUser.vai_tro === 'admin' || String(garden.user_id || '') === String(currentUser._id);
};

const getGardenTotalPlotArea = async (gardenId, excludePlotId = null) => {
  const filter = { garden_id: gardenId };
  if (excludePlotId) {
    filter._id = { $ne: excludePlotId };
  }

  const plots = await Plot.find(filter).select('area');
  return plots.reduce((sum, plot) => sum + Number(plot.area || 0), 0);
};

const getPlotsByGarden = async (req, res) => {
  try {
    const { gardenId } = req.params;

    const garden = await Garden.findById(gardenId);
    if (!garden) {
      return res.status(404).json({ success: false, message: 'Vườn không tồn tại' });
    }

    const currentUser = await getCurrentUser(req.userId);
    if (!hasGardenAccess(currentUser, garden)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xem mẫu đất của vườn này' });
    }

    const plots = await Plot.find({ garden_id: gardenId }).sort({ created_at: -1 });

    res.json({
      success: true,
      count: plots.length,
      data: plots,
    });
  } catch (error) {
    console.error('❌ Lỗi lấy danh sách mẫu đất:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const createPlot = async (req, res) => {
  try {
    const { name, garden_id, area, tree_type, location_description, status } = req.body;

    if (!name || !garden_id || area === undefined || !tree_type) {
      return res.status(400).json({
        success: false,
        message: 'Vui lòng nhập đủ thông tin bắt buộc',
      });
    }

    const garden = await Garden.findById(garden_id);
    if (!garden) {
      return res.status(404).json({ success: false, message: 'Vườn không tồn tại' });
    }

    const currentUser = await getCurrentUser(req.userId);
    if (!hasGardenAccess(currentUser, garden)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền thêm mẫu đất cho vườn này' });
    }

    const plotArea = Number(area);
    if (!Number.isFinite(plotArea) || plotArea <= 0) {
      return res.status(400).json({ success: false, message: 'Diện tích mẫu đất phải lớn hơn 0' });
    }

    const usedArea = await getGardenTotalPlotArea(garden_id);
    if (usedArea + plotArea > Number(garden.dien_tich || 0)) {
      return res.status(400).json({
        success: false,
        message: 'Tổng diện tích các mẫu đất không được vượt quá diện tích của vườn',
      });
    }

    const plot = new Plot({
      name,
      garden_id,
      area: plotArea,
      tree_type,
      location_description: location_description || '',
      status: status || 'đang sử dụng',
    });

    await plot.save();
    await plot.populate('garden_id', 'ten_vuon dien_tich');

    res.status(201).json({
      success: true,
      message: 'Tạo mẫu đất thành công',
      data: plot,
    });
  } catch (error) {
    console.error('❌ Lỗi tạo mẫu đất:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const updatePlot = async (req, res) => {
  try {
    const { name, area, tree_type, location_description, status } = req.body;

    const plot = await Plot.findById(req.params.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: 'Mẫu đất không tồn tại' });
    }

    const garden = await Garden.findById(plot.garden_id);
    if (!garden) {
      return res.status(404).json({ success: false, message: 'Vườn không tồn tại' });
    }

    const currentUser = await getCurrentUser(req.userId);
    if (!hasGardenAccess(currentUser, garden)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền cập nhật mẫu đất này' });
    }

    const nextArea = area !== undefined ? Number(area) : Number(plot.area || 0);
    if (!Number.isFinite(nextArea) || nextArea <= 0) {
      return res.status(400).json({ success: false, message: 'Diện tích mẫu đất phải lớn hơn 0' });
    }

    const usedArea = await getGardenTotalPlotArea(plot.garden_id, plot._id);
    if (usedArea + nextArea > Number(garden.dien_tich || 0)) {
      return res.status(400).json({
        success: false,
        message: 'Tổng diện tích các mẫu đất không được vượt quá diện tích của vườn',
      });
    }

    if (name !== undefined) plot.name = name;
    if (area !== undefined) plot.area = nextArea;
    if (tree_type !== undefined) plot.tree_type = tree_type;
    if (location_description !== undefined) plot.location_description = location_description;
    if (status !== undefined) plot.status = status;

    await plot.save();
    await plot.populate('garden_id', 'ten_vuon dien_tich');

    res.json({
      success: true,
      message: 'Cập nhật mẫu đất thành công',
      data: plot,
    });
  } catch (error) {
    console.error('❌ Lỗi cập nhật mẫu đất:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

const deletePlot = async (req, res) => {
  try {
    const plot = await Plot.findById(req.params.id);
    if (!plot) {
      return res.status(404).json({ success: false, message: 'Mẫu đất không tồn tại' });
    }

    const garden = await Garden.findById(plot.garden_id);
    if (!garden) {
      return res.status(404).json({ success: false, message: 'Vườn không tồn tại' });
    }

    const currentUser = await getCurrentUser(req.userId);
    if (!hasGardenAccess(currentUser, garden)) {
      return res.status(403).json({ success: false, message: 'Bạn không có quyền xóa mẫu đất này' });
    }

    await Plot.findByIdAndDelete(req.params.id);

    res.json({
      success: true,
      message: 'Xóa mẫu đất thành công',
    });
  } catch (error) {
    console.error('❌ Lỗi xóa mẫu đất:', error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports = {
  getPlotsByGarden,
  createPlot,
  updatePlot,
  deletePlot,
};