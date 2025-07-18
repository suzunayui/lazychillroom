// Jest セットアップファイル
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, 'test.env') });

// テスト用のタイムアウト設定
jest.setTimeout(30000);

// テストヘルパーをインポート
const TestHelper = require('../helpers/TestHelper');

// グローバルな前処理
beforeAll(async () => {
  console.log('🧪 テスト環境を初期化中...');
  // プロセス終了時のハンドラーを設定
  process.on('exit', async () => {
    await TestHelper.globalCleanup();
  });
});

// グローバルな後処理
afterAll(async () => {
  console.log('🧹 テスト環境をクリーンアップ中...');
  // 各テストスイート終了時にもクリーンアップを実行
  try {
    await TestHelper.globalCleanup();
  } catch (error) {
    console.error('Cleanup error:', error);
  }
});

// 各テストファイル前処理
beforeEach(() => {
  // ログ出力を抑制（テスト時のノイズ削減）
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'info').mockImplementation(() => {});
});

// 各テストファイル後処理
afterEach(() => {
  // モックをクリア
  jest.clearAllMocks();
  jest.restoreAllMocks();
});
