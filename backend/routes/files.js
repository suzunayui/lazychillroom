// 最適化されたファイルAPI（モジュラー構造）
const express = require('express');
const router = express.Router();

// サブルートをインポート
const filesUpload = require('./files/filesUpload');
const filesServe = require('./files/filesServe');

// サブルートをマウント
router.use('/', filesUpload);  // アップロード機能
router.use('/', filesServe);   // 配信・取得機能

module.exports = router;
