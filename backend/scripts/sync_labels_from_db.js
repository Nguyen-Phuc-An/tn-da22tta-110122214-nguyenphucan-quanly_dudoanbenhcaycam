require('dotenv').config({ path: require('path').resolve(__dirname, '..', '.env') });
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('MONGO_URI not found in .env');
  process.exit(1);
}

const diseaseModelPath = path.resolve(__dirname, '..', 'src', 'models', 'Disease.js');
const Disease = require(diseaseModelPath);

async function main() {
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  const modelLabelsPath = path.resolve(__dirname, '..', '..', 'ml', 'model_labels.json');
  const outPath = path.resolve(__dirname, '..', '..', 'ml', 'disease_labels.json');

  if (!fs.existsSync(modelLabelsPath)) {
    console.error('model_labels.json not found at', modelLabelsPath);
    process.exit(1);
  }

  const modelLabels = JSON.parse(fs.readFileSync(modelLabelsPath, 'utf8'));
  // modelLabels is mapping index->key
  const classes = Object.keys(modelLabels).sort((a,b) => Number(a) - Number(b)).map(i => modelLabels[i]);

  // Query DB for each ten_benh_en -> ten_benh
  const class_vi = {};
  for (const key of classes) {
    const doc = await Disease.findOne({ ten_benh_en: key }).lean().exec();
    if (doc && doc.ten_benh) {
      class_vi[key] = doc.ten_benh;
    } else {
      class_vi[key] = key; // fallback to english key
    }
  }

  const class_indices = {};
  classes.forEach((k, idx) => { class_indices[k] = idx; });

  const out = {
    classes: classes,
    class_indices: class_indices,
    class_vi: class_vi,
    num_classes: classes.length,
  };

  fs.writeFileSync(outPath, JSON.stringify(out, null, 2), 'utf8');
  console.log('Wrote', outPath);
  await mongoose.disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
