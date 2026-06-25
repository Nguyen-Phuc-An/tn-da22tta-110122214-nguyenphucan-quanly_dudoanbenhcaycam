const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');
const Disease = require('../models/Disease');

// ===== CONSTANTS =====
const TRAINING_IMAGES_DIR = path.resolve(__dirname, '../../uploads/training');
const GOP_DATASET_DIR = path.resolve(__dirname, '../../../ml/gop_dataset');
const ORGANIZED_DATASET_DIR = path.resolve(__dirname, '../../../ml/organized_dataset');
const MODEL_PATH = path.resolve(__dirname, '../../../ml/model.h5');
const TRAINING_REPORT_PATH = path.resolve(__dirname, '../../../ml/training_report.json');
const RETRAIN_SCRIPT = path.resolve(__dirname, '../../scripts/retrain_model.py');
const PYTHON_EXE = path.resolve(__dirname, '../../../ml/venv/Scripts/python.exe');
const EXCLUDED_DISEASES = new Set(['melanose']);

// ===== PROGRESS TRACKING =====
let trainingProgress = {
  isTraining: false,
  progress: 0,
  status: 'Waiting...',
  error: null,
  metrics: null,
  trainingResults: null,
};

const progressClients = new Set(); // SSE clients listening to progress

// Helper: Broadcast progress to all SSE clients
const broadcastProgress = () => {
  const data = `data: ${JSON.stringify(trainingProgress)}\n\n`;
  progressClients.forEach((res) => {
    try {
      res.write(data);
    } catch (err) {
      progressClients.delete(res);
    }
  });
};

const readTrainingReportFromDisk = () => {
  try {
    if (!fs.existsSync(TRAINING_REPORT_PATH)) {
      return null;
    }

    const raw = fs.readFileSync(TRAINING_REPORT_PATH, 'utf-8');
    const parsed = JSON.parse(raw);

    return {
      trainingResults: parsed.trainingResults || null,
      evaluation: parsed.evaluation || null,
    };
  } catch (error) {
    console.error('⚠️ Failed to read training report:', error.message);
    return null;
  }
};

const isBenignStderrLine = (line) => {
  const trimmed = line.trim();

  if (!trimmed) return true;

  return (
    trimmed.startsWith('WARNING:') ||
    trimmed.includes('deprecated') ||
    trimmed.startsWith('I0000') ||
    trimmed.includes('cpu_feature_guard.cc:182') ||
    trimmed.includes('TensorFlow binary is optimized to use available CPU instructions') ||
    trimmed.includes('To enable the following instructions') ||
    trimmed.includes('SSE SSE2 SSE3 SSE4.1 SSE4.2 AVX2 AVX_VNNI FMA') ||
    trimmed.includes('oneDNN custom operations are on') ||
    trimmed.includes('absl::InitializeLog')
  );
};

const normalizeDiseaseKey = (value) => {
  if (!value) return '';

  return String(value)
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_');
};

const countImagesInDiseaseDir = (baseDir, diseaseKey) => {
  const diseasePath = path.join(baseDir, diseaseKey);

  if (!fs.existsSync(diseasePath) || !fs.statSync(diseasePath).isDirectory()) {
    return 0;
  }

  return fs.readdirSync(diseasePath).filter((file) => /\.(jpg|png|jpeg)$/i.test(file)).length;
};

const mergeEvaluationMetrics = (progressMetrics, diskMetrics) => {
  if (!progressMetrics && !diskMetrics) {
    return null;
  }

  const merged = {
    ...(progressMetrics || {}),
    ...(diskMetrics || {}),
  };

  if (diskMetrics?.test) {
    merged.test = diskMetrics.test;
  } else if (progressMetrics?.test) {
    merged.test = progressMetrics.test;
  }

  return merged;
};

// Khởi tạo folder
if (!fs.existsSync(TRAINING_IMAGES_DIR)) {
  fs.mkdirSync(TRAINING_IMAGES_DIR, { recursive: true });
}

// ===== API: Upload training images =====
const uploadTrainingImages = async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin only',
      });
    }

    const rawDiseaseName = req.body.disease_name || req.query.disease_name;
    const disease_name = normalizeDiseaseKey(rawDiseaseName);

    if (!disease_name) {
      return res.status(400).json({
        success: false,
        message: 'Disease name required',
      });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No images uploaded',
      });
    }

    // Tạo folder bệnh
    const disease_dir = path.join(TRAINING_IMAGES_DIR, disease_name);
    fs.mkdirSync(disease_dir, { recursive: true });

    // Di chuyển ảnh từ temp sang disease folder
    const uploaded_count = req.files.length;
    req.files.forEach((file) => {
      const dest = path.join(disease_dir, file.filename);
      fs.renameSync(file.path, dest);
    });

    console.log(`✓ Uploaded ${uploaded_count} images for ${disease_name}`);

    res.status(201).json({
      success: true,
      message: `${uploaded_count} images uploaded successfully`,
      data: {
        disease_name,
        count: uploaded_count,
      },
    });
  } catch (error) {
    console.error('❌ Upload error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== API: Get training status =====
const getTrainingStatus = async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin only',
      });
    }

    console.log('🔍 DEBUG getTrainingStatus:');
    console.log(`  __dirname: ${__dirname}`);
    console.log(`  GOP_DATASET_DIR: ${GOP_DATASET_DIR}`);
    console.log(`  Exists: ${fs.existsSync(GOP_DATASET_DIR)}`);
    console.log(`  ORGANIZED_DATASET_DIR: ${ORGANIZED_DATASET_DIR}`);
    console.log(`  Exists: ${fs.existsSync(ORGANIZED_DATASET_DIR)}`);
    console.log(`  TRAINING_IMAGES_DIR: ${TRAINING_IMAGES_DIR}`);
    console.log(`  Exists: ${fs.existsSync(TRAINING_IMAGES_DIR)}`);

    const diseaseDocs = await Disease.find({}, { ten_benh: 1, ten_benh_en: 1 }).lean();
    const diseaseMetaMap = diseaseDocs.reduce((accumulator, diseaseDoc) => {
      const uploadKey = normalizeDiseaseKey(diseaseDoc.ten_benh_en || diseaseDoc.ten_benh);
      if (!uploadKey) return accumulator;

      const existing = accumulator[uploadKey] || {};
      accumulator[uploadKey] = {
        ten_benh: existing.ten_benh || diseaseDoc.ten_benh || diseaseDoc.ten_benh_en,
        ten_benh_en: existing.ten_benh_en || diseaseDoc.ten_benh_en || uploadKey,
        upload_key: uploadKey,
      };
      return accumulator;
    }, {});

    const diseaseKeys = new Set();

    [GOP_DATASET_DIR, ORGANIZED_DATASET_DIR, TRAINING_IMAGES_DIR].forEach((baseDir) => {
      if (!fs.existsSync(baseDir)) return;

      fs.readdirSync(baseDir).forEach((entry) => {
        const entryPath = path.join(baseDir, entry);
        if (fs.statSync(entryPath).isDirectory() && !EXCLUDED_DISEASES.has(entry)) {
          diseaseKeys.add(entry);
        }
      });
    });

    diseaseDocs.forEach((diseaseDoc) => {
      const uploadKey = normalizeDiseaseKey(diseaseDoc.ten_benh_en || diseaseDoc.ten_benh);
      if (uploadKey && !EXCLUDED_DISEASES.has(uploadKey)) {
        diseaseKeys.add(uploadKey);
      }
    });

    const status = {};
    let total_original = 0;
    let total_organized = 0;
    let total_training = 0;

    Array.from(diseaseKeys).sort().forEach((disease) => {
      const originalCount = countImagesInDiseaseDir(GOP_DATASET_DIR, disease);
      const organizedCount = countImagesInDiseaseDir(ORGANIZED_DATASET_DIR, disease);
      const trainingCount = countImagesInDiseaseDir(TRAINING_IMAGES_DIR, disease);

      const diseaseMeta = diseaseMetaMap[disease] || {};

      status[disease] = {
        count: organizedCount,
        organized_count: organizedCount,
        original_count: originalCount,
        new_images: trainingCount,
        source_total: originalCount + trainingCount,
        total: organizedCount,
        source: originalCount > 0 ? 'original' : 'new',
        upload_key: disease,
        ...(diseaseMeta || {}),
      };

      total_original += originalCount;
      total_organized += organizedCount;
      total_training += trainingCount;

      console.log(`  ${disease}: original=${originalCount}, organized=${organizedCount}, new=${trainingCount}`);
    });

    const diskReport = readTrainingReportFromDisk();

    const evaluation = mergeEvaluationMetrics(trainingProgress.metrics, diskReport?.evaluation);
    const trainingResults = diskReport?.trainingResults || trainingProgress.trainingResults || null;

    res.json({
      success: true,
      data: {
        status,
        summary: {
          total_diseases: Object.keys(status).length,
          original_images: total_original,
          organized_images: total_organized,
          training_images: total_training,
          total_images: total_organized,
          train_images: Math.round(total_organized * 0.8),
          val_images: Math.round(total_organized * 0.1),
          test_images: total_organized - Math.round(total_organized * 0.8) - Math.round(total_organized * 0.1),
        },
        evaluation,
        trainingResults,
      },
    });
  } catch (error) {
    console.error('❌ Status error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== API: Trigger retrain =====
const triggerRetrain = async (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin only',
      });
    }

    // Check if retrain script exists
    if (!fs.existsSync(RETRAIN_SCRIPT)) {
      return res.status(500).json({
        success: false,
        message: 'Retrain script not found',
      });
    }

    // Reset progress
    trainingProgress = {
      isTraining: true,
      progress: 0,
      status: 'Initializing...',
      error: null,
      metrics: null,
      trainingResults: null,
    };
    broadcastProgress();

    console.log('🔄 Starting retrain process...');

    // Spawn Python process (non-blocking)
    const python_command = fs.existsSync(PYTHON_EXE) ? PYTHON_EXE : 'python';
    const python_process = spawn(python_command, [
      RETRAIN_SCRIPT,
      ORGANIZED_DATASET_DIR,
      TRAINING_IMAGES_DIR,
      MODEL_PATH,
    ], {
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
    });

    let stdout = '';
    let stderr = '';

    python_process.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(`[Retrain] ${output}`);

      // Parse PROGRESS messages
      const progressMatch = output.match(/PROGRESS:(\d+):(.+)/);
      if (progressMatch) {
        const [, progress, status] = progressMatch;
        trainingProgress.progress = parseInt(progress);
        trainingProgress.status = status;
        broadcastProgress();
      }

      const metricsMatch = output.match(/METRICS:(\{.*\})/);
      if (metricsMatch) {
        try {
          trainingProgress.metrics = JSON.parse(metricsMatch[1]);
          broadcastProgress();
        } catch (parseError) {
          console.error('⚠️ Failed to parse training metrics:', parseError.message);
        }
      }

      const testMetricsMatch = output.match(/METRICS_TEST:(\{.*\})/);
      if (testMetricsMatch) {
        try {
          const testMetrics = JSON.parse(testMetricsMatch[1]);
          trainingProgress.metrics = {
            ...(trainingProgress.metrics || {}),
            test: testMetrics,
          };
          broadcastProgress();
        } catch (parseError) {
          console.error('⚠️ Failed to parse test metrics:', parseError.message);
        }
      }

      const resultsMatch = output.match(/TRAIN_RESULTS:(\{.*\})/);
      if (resultsMatch) {
        try {
          trainingProgress.trainingResults = JSON.parse(resultsMatch[1]);
          broadcastProgress();
        } catch (parseError) {
          console.error('⚠️ Failed to parse training results:', parseError.message);
        }
      }
    });

    python_process.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(`[Retrain Error] ${error}`);

      if (!isBenignStderrLine(error)) {
        trainingProgress.error = error;
        broadcastProgress();
      }
    });

    python_process.on('close', async (code) => {
      if (code === 0) {
        console.log('✓ Retrain completed successfully');
        trainingProgress.isTraining = false;
        trainingProgress.progress = 100;
        trainingProgress.status = 'Completed!';
        broadcastProgress();
        
        // ===== CẬP NHẬT: Reload model trong ML service =====
        try {
          const axios = require('axios');
          await axios.post('http://localhost:5000/reload-model');
          console.log('✓ ML Model reloaded');
        } catch (error) {
          console.error('⚠️ Failed to reload ML model:', error.message);
          // Không fail toàn bộ retrain, chỉ warning
        }
      } else {
        console.error(`✗ Retrain failed with code ${code}`);
        trainingProgress.isTraining = false;
        trainingProgress.error = `Process exited with code ${code}`;
        broadcastProgress();
      }
    });

    // Immediate response (retrain happens in background)
    res.json({
      success: true,
      message: 'Retrain process started (running in background)',
      data: {
        status: 'training',
        estimated_time: '10-30 minutes',
      },
      trainingResults: trainingProgress.trainingResults,
    });
  } catch (error) {
    console.error('❌ Retrain trigger error:', error.message);
    trainingProgress.isTraining = false;
    trainingProgress.error = error.message;
    broadcastProgress();
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// ===== API: SSE Progress Stream =====
const streamTrainingProgress = (req, res) => {
  try {
    if (req.userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Admin only',
      });
    }

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Send initial state
    res.write(`data: ${JSON.stringify(trainingProgress)}\n\n`);

    // Add client to progress listeners
    progressClients.add(res);

    // Remove client on disconnect
    req.on('close', () => {
      progressClients.delete(res);
      res.end();
    });
  } catch (error) {
    console.error('❌ SSE error:', error.message);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

module.exports = {
  uploadTrainingImages,
  getTrainingStatus,
  triggerRetrain,
  streamTrainingProgress,
};
