// キャッシュ設定
const cacheConfig = {
  // メッセージキャッシュ設定
  messages: {
    ttl: 3600, // 1時間
    keyPrefix: 'messages:',
    maxItems: 100 // チャンネルあたり最大100件
  },
  
  // ユーザー情報キャッシュ
  users: {
    ttl: 1800, // 30分
    keyPrefix: 'users:',
    maxItems: 1000
  },
  
  // 画像メタデータキャッシュ
  images: {
    ttl: 86400, // 24時間
    keyPrefix: 'images:',
    maxItems: 500
  },
  
  // チャンネル情報キャッシュ
  channels: {
    ttl: 1800, // 30分
    keyPrefix: 'channels:',
    maxItems: 200
  },
  
  // セッション情報キャッシュ
  sessions: {
    ttl: 604800, // 7日
    keyPrefix: 'sessions:',
    maxItems: 10000
  },
  
  // プレゼンス情報キャッシュ
  presence: {
    ttl: 1800, // 30分
    keyPrefix: 'presence:',
    maxItems: 2000
  }
};

module.exports = {
  cacheConfig
};
