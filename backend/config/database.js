const { Pool } = require('pg');
const Redis = require('ioredis');

// PostgreSQL設定
const isTestEnv = process.env.NODE_ENV === 'test';
const pgConfig = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT) || 5432,
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'lazychill',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};

// デバッグ用：設定値をログ出力
console.log('🔧 PostgreSQL Configuration:');
console.log('Host:', pgConfig.host);
console.log('Port:', pgConfig.port);
console.log('User:', pgConfig.user);
console.log('Database:', pgConfig.database);
console.log('Password length:', pgConfig.password ? pgConfig.password.length : 0);

// Redis設定
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  retryDelayOnFailover: 100,
  maxRetriesPerRequest: 3,
};

// Create connection pools
const pgPool = new Pool(pgConfig);

// Redis接続を作成
let redis = null;
if (process.env.NODE_ENV === 'test') {
  // テスト環境では lazyConnect を使用
  redis = new Redis({
    ...redisConfig,
    lazyConnect: true,
    enableAutoPipelining: false,
    enableOfflineQueue: false
  });
  
  // テスト環境でのエラーハンドリング
  redis.on('error', (err) => {
    if (err.code !== 'ECONNREFUSED') {
      console.warn('Redis error in test environment:', err.message);
    }
  });
} else {
  redis = new Redis(redisConfig);
}

// Test PostgreSQL connection
async function testPgConnection() {
  try {
    const client = await pgPool.connect();
    console.log('✅ PostgreSQL connected successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ PostgreSQL connection failed:', error.message);
    return false;
  }
}

// Test Redis connection
async function testRedisConnection() {
  try {
    await redis.ping();
    console.log('✅ Redis connected successfully');
    return true;
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    return false;
  }
}

// Get PostgreSQL connection from pool
async function getPgConnection() {
  try {
    return await pgPool.connect();
  } catch (error) {
    console.error('PostgreSQL connection error:', error);
    throw error;
  }
}

// Execute PostgreSQL query with automatic connection management
async function query(sql, params = []) {
  const client = await getPgConnection();
  try {
    const result = await client.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error('❌ Query execution failed:');
    console.error('SQL:', sql);
    console.error('Parameters:', params);
    console.error('Error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Execute PostgreSQL transaction
async function transaction(callback) {
  const client = await getPgConnection();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  pgPool,
  redis,
  testPgConnection,
  testRedisConnection,
  getPgConnection,
  query,
  transaction
};
