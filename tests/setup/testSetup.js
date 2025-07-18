// テストデータベースセットアップスクリプト
const { query } = require('../../backend/config/database');

async function setupTestDatabase() {
  try {
    console.log('🔧 テストデータベースをセットアップ中...');
    
    // テスト用データベースの作成
    await query(`CREATE DATABASE IF NOT EXISTS lazychillroom_test`);
    console.log('✅ テストデータベース作成完了');
    
    // テーブルの初期化
    const initScript = require('../../migrations/initDatabase');
    await initScript.initializeDatabase();
    
    console.log('✅ テストデータベースセットアップ完了');
  } catch (error) {
    console.error('❌ テストデータベースセットアップエラー:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  setupTestDatabase();
}

module.exports = setupTestDatabase;
