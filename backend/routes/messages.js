// メッセージ関連のルートを統合するメインファイル
const express = require('express');
const router = express.Router();

// サブモジュールをインポート
const messagesCrud = require('./messages/messagesCrud');
const messagesQuery = require('./messages/messagesQuery');
const messagesStats = require('./messages/messagesStats');

// サブルートをマウント
router.use('/', messagesCrud);
router.use('/', messagesQuery);
router.use('/', messagesStats);

module.exports = router;
