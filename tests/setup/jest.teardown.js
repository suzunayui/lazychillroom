// Jest グローバルティアダウン
const TestHelper = require('../helpers/TestHelper');

module.exports = async () => {
  console.log('🧹 Running global teardown...');
  
  try {
    // 全ての接続をクローズ
    await TestHelper.globalCleanup();
    console.log('✅ Global teardown completed');
  } catch (error) {
    console.error('❌ Global teardown failed:', error);
  }
};
