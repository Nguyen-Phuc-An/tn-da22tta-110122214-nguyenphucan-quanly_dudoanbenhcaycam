const express = require('express');
const { authenticateToken } = require('../config/auth');
const {
  getPlotsByGarden,
  createPlot,
  updatePlot,
  deletePlot,
} = require('../controllers/plot.controller');

const router = express.Router();

router.use(authenticateToken);

router.get('/garden/:gardenId', getPlotsByGarden);
router.post('/', createPlot);
router.put('/:id', updatePlot);
router.delete('/:id', deletePlot);

module.exports = router;