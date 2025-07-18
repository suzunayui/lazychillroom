module.exports = {
  // テスト環境の設定
  testEnvironment: 'node',
  
  // テストファイルの検出パターン
  testMatch: [
    '**/tests/**/*.test.js',
    '**/tests/**/*.spec.js'
  ],
  
  // セットアップファイル
  setupFilesAfterEnv: ['<rootDir>/tests/setup/jest.setup.js'],
  
  // グローバルティアダウン
  globalTeardown: '<rootDir>/tests/setup/jest.teardown.js',
  
  // カバレッジ設定
  collectCoverageFrom: [
    'backend/routes/**/*.js',
    'backend/middleware/**/*.js',
    'backend/config/**/*.js',
    'backend/socket/**/*.js',
    '!**/node_modules/**',
    '!**/tests/**',
    '!**/migrations/**',
    '!backend/server.js'
  ],
  
  // カバレッジ閾値
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  
  // カバレッジレポート形式
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  
  // テストタイムアウト
  testTimeout: 30000,
  
  // テスト実行設定
  verbose: true,
  forceExit: true,
  detectOpenHandles: true,
  
  // 並列実行の無効化（データベーステストのため）
  maxWorkers: 1,
  
  // ファイル変更の監視から除外
  watchPathIgnorePatterns: [
    '/node_modules/',
    '/uploads/',
    '/coverage/'
  ],
  
  // グローバル変数の設定
  globals: {
    'NODE_ENV': 'test'
  },
  
  // モジュール名マッピング
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1'
  }
};
