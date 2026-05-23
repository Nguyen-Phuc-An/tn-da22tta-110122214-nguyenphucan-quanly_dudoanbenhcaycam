const mongoose = require('mongoose');
require('dotenv').config();

const Prediction = require('../src/models/Prediction');

const MONGO = process.env.MONGO_URI || 'mongodb://localhost:27017/yourdb';

async function run() {
  await mongoose.connect(MONGO, { useNewUrlParser: true, useUnifiedTopology: true });
  console.log('Connected to MongoDB');

  try {
    // Unset garden_id from all predictions
    const res = await Prediction.updateMany({}, { $unset: { garden_id: '' } });
    console.log('Unset garden_id on predictions:', res.modifiedCount);

    // Try to drop any index that includes garden_id
    const collection = mongoose.connection.collection('predictions');
    const indexes = await collection.indexes();
    console.log('Existing indexes:', indexes.map(i => i.name));

    for (const idx of indexes) {
      const keys = Object.keys(idx.key || {});
      if (keys.includes('garden_id')) {
        console.log('Dropping index:', idx.name);
        try {
          await collection.dropIndex(idx.name);
          console.log('Dropped index', idx.name);
        } catch (err) {
          console.error('Error dropping index', idx.name, err.message);
        }
      }
    }

    console.log('Migration completed');
  } catch (err) {
    console.error('Migration failed', err);
  } finally {
    await mongoose.disconnect();
  }
}

run();
