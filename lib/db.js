const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function getDb() {
  if (cachedDb) return cachedDb;

  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI chưa được cấu hình');

  cachedClient = new MongoClient(uri, {
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
  });

  await cachedClient.connect();
  cachedDb = cachedClient.db('vongquay');

  // Tạo index để đảm bảo id không bị trùng
  await cachedDb.collection('wheels').createIndex({ id: 1 }, { unique: true });

  return cachedDb;
}

module.exports = { getDb };
