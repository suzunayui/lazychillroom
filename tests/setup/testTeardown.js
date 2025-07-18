// テストデータベースクリーンアップスクリプト
const { query } = require('../../backend/config/database');

async function teardownTestDatabase() {
  try {
    console.log('🧹 テストデータベースをクリーンアップ中...');
    
    // テスト用データベースの削除
    await query(`DROP DATABASE IF EXISTS lazychillroom_test`);
    
    console.log('✅ テストデータベースクリーンアップ完了');
  } catch (error) {
    console.error('❌ テストデータベースクリーンアップエラー:', error);
  }
}

if (require.main === module) {
  teardownTestDatabase();
}

module.exports = teardownTestDatabase;
