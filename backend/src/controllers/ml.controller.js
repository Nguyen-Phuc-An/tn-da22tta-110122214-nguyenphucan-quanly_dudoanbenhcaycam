const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// ===== CONSTANTS =====
const TRAINING_IMAGES_DIR = path.resolve(__dirname, '../../uploads/training');
const ORGANIZED_DATASET_DIR = path.resolve(__dirname, '../../../ml/organized_dataset');
const MODEL_PATH = path.resolve(__dirname, '../../../ml/model.h5');
const RETRAIN_SCRIPT = path.resolve(__dirname, '../../scripts/retrain_model.py');
const PYTHON_EXE = path.resolve(__dirname, '../../../ml/venv/Scripts/python.exe');

// ===== PROGRESS TRACKING =====
let trainingProgress = {
  isTraining: false,
  progress: 0,
  status: 'Waiting...',
  error: null,
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

    const { disease_name } = req.body;
    if (!disease_name) {
      return res.status(400).json({
        success: false,
        message: 'Disease name required',
      });
    }

    // Validate disease_name (alphanumeric + underscore)
    if (!/^[a-z0-9_]+$/.test(disease_name)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid disease name format',
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
    console.log(`  ORGANIZED_DATASET_DIR: ${ORGANIZED_DATASET_DIR}`);
    console.log(`  Exists: ${fs.existsSync(ORGANIZED_DATASET_DIR)}`);
    console.log(`  TRAINING_IMAGES_DIR: ${TRAINING_IMAGES_DIR}`);
    console.log(`  Exists: ${fs.existsSync(TRAINING_IMAGES_DIR)}`);

    // Get 9 original diseases
    const original_diseases = [
      'black_spot',
      'canker',
      'deficiency',
      'greasy_spot',
      'greening',
      'healthy',
      'leafminer',
      'melanose',
      'multiple',
    ];

    const status = {};
    let total_original = 0;
    let total_training = 0;

    // Count original dataset
    original_diseases.forEach((disease) => {
      const disease_path = path.join(ORGANIZED_DATASET_DIR, disease);
      const count = fs.existsSync(disease_path)
        ? fs.readdirSync(disease_path).filter((f) => /\.(jpg|png|jpeg)$/i.test(f)).length
        : 0;
      status[disease] = {
        count,
        source: 'original',
        new_images: 0,
      };
      total_original += count;
      console.log(`  ${disease}: ${count} ảnh từ ${disease_path}`);
    });

    // Count training uploads
    if (fs.existsSync(TRAINING_IMAGES_DIR)) {
      fs.readdirSync(TRAINING_IMAGES_DIR).forEach((disease) => {
        const training_path = path.join(TRAINING_IMAGES_DIR, disease);
        if (fs.statSync(training_path).isDirectory()) {
          const count = fs.readdirSync(training_path)
            .filter((f) => /\.(jpg|png|jpeg)$/i.test(f)).length;

          if (status[disease]) {
            status[disease].new_images = count;
            status[disease].total = status[disease].count + count;
          } else {
            // Bệnh mới
            status[disease] = {
              count: 0,
              source: 'new',
              new_images: count,
              total: count,
            };
          }
          total_training += count;
        }
      });
    }

    res.json({
      success: true,
      data: {
        status,
        summary: {
          total_diseases: Object.keys(status).length,
          original_images: total_original,
          training_images: total_training,
          total_images: total_original + total_training,
        },
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
