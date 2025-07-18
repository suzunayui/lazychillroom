// PostgreSQL + Redis ギルド・チャンネル機能テスト
const request = require('supertest');
const express = require('express');

// テスト用ギルド・チャンネルアプリ（PostgreSQL + Redis風）
function createGuildTestApp() {
  const app = express();
  app.use(express.json());
  
  // モックデータ
  const mockUsers = {
    1: { id: 1, userid: 'owner', nickname: 'Guild Owner', is_admin: false },
    2: { id: 2, userid: 'member', nickname: 'Guild Member', is_admin: false },
    3: { id: 3, userid: 'admin', nickname: 'Admin User', is_admin: true }
  };
  
  let mockGuilds = {
    1: {
      id: 1,
      name: 'Test Guild',
      description: 'Test guild for PostgreSQL',
      owner_id: 1,
      icon_url: null,
      is_public: true,
      max_members: 100,
      member_count: 2,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
  
  let mockChannels = {
    1: {
      id: 1,
      guild_id: 1,
      name: 'general',
      description: 'General discussion',
      channel_type: 'text',
      position: 0,
      is_default: true,
      is_private: false,
      slow_mode: 0,
      topic: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    2: {
      id: 2,
      guild_id: 1,
      name: 'voice-chat',
      description: 'Voice channel',
      channel_type: 'voice',
      position: 1,
      is_default: false,
      is_private: false,
      user_limit: 10,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  };
  
  const mockGuildMembers = {
    '1:1': { guild_id: 1, user_id: 1, role: 'owner', joined_at: new Date().toISOString() },
    '1:2': { guild_id: 1, user_id: 2, role: 'member', joined_at: new Date().toISOString() }
  };
  
  const mockGuildRoles = {
    1: {
      id: 1,
      guild_id: 1,
      name: '@everyone',
      color: '#000000',
      position: 0,
      permissions: 104857600, // 基本権限
      is_default: true
    },
    2: {
      id: 2,
      guild_id: 1,
      name: 'Moderator',
      color: '#3498db',
      position: 1,
      permissions: 268435456, // モデレーター権限
      is_default: false
    }
  };
  
  const mockInvites = {};
  const mockGuildCache = {}; // Redis キャッシュ
  
  // 認証ミドルウェア
  const mockAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: '認証が必要です' });
    }
    
    const token = authHeader.split(' ')[1];
    
    // 特定のトークンを最初にチェック
    if (token === 'owner-token') req.user = mockUsers[1];
    else if (token === 'member-token') req.user = mockUsers[2];
    else if (token === 'admin-token') req.user = mockUsers[3];
    else {
      // 動的にユーザーを探す
      const user = Object.values(mockUsers).find(user => {
        const expectedToken = `user${user.id}-token`;
        return token === expectedToken;
      });
      
      if (user) {
        req.user = user;
      } else {
        return res.status(401).json({ success: false, message: '無効なトークン' });
      }
    }
    
    next();
  };
  
  // ギルド作成
  app.post('/api/guilds', mockAuth, (req, res) => {
    const { name, description = null, isPublic = true } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'ギルド名は必須です'
      });
    }
    
    if (name.length > 100) {
      return res.status(400).json({
        success: false,
        message: 'ギルド名は100文字以内で入力してください'
      });
    }
    
    // 新しいギルドID
    const guildId = Object.keys(mockGuilds).length + 1;
    const now = new Date().toISOString();
    
    const newGuild = {
      id: guildId,
      name: name.trim(),
      description: description,
      owner_id: req.user.id,
      icon_url: null,
      is_public: isPublic,
      max_members: 100,
      member_count: 1,
      created_at: now,
      updated_at: now
    };
    
    mockGuilds[guildId] = newGuild;
    
    // オーナーをメンバーに追加
    mockGuildMembers[`${guildId}:${req.user.id}`] = {
      guild_id: guildId,
      user_id: req.user.id,
      role: 'owner',
      joined_at: now
    };
    
    // デフォルトチャンネル作成
    const channelId = Object.keys(mockChannels).length + 1;
    mockChannels[channelId] = {
      id: channelId,
      guild_id: guildId,
      name: 'general',
      description: 'General discussion',
      channel_type: 'text',
      position: 0,
      is_default: true,
      is_private: false,
      slow_mode: 0,
      topic: null,
      created_at: now,
      updated_at: now
    };
    
    // Redis キャッシュ更新
    mockGuildCache[`guild:${guildId}`] = JSON.stringify({
      ...newGuild,
      owner: {
        id: req.user.id,
        userid: req.user.userid,
        nickname: req.user.nickname
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'ギルドを作成しました',
      guild: {
        ...newGuild,
        owner: {
          id: req.user.id,
          userid: req.user.userid,
          nickname: req.user.nickname
        },
        default_channel_id: channelId
      }
    });
  });
  
  // ギルド一覧取得
  app.get('/api/guilds', mockAuth, (req, res) => {
    const { page = 1, limit = 20, search = '' } = req.query;
    
    // ユーザーが参加しているギルド
    const userGuilds = Object.values(mockGuildMembers)
      .filter(member => member.user_id === req.user.id)
      .map(member => member.guild_id);
    
    let guilds = userGuilds.map(guildId => {
      const guild = mockGuilds[guildId];
      const owner = mockUsers[guild.owner_id];
      
      return {
        ...guild,
        owner: {
          id: owner.id,
          userid: owner.userid,
          nickname: owner.nickname
        }
      };
    });
    
    // 検索フィルタ
    if (search.trim()) {
      const searchTerm = search.trim().toLowerCase();
      guilds = guilds.filter(guild => 
        guild.name.toLowerCase().includes(searchTerm) ||
        (guild.description && guild.description.toLowerCase().includes(searchTerm))
      );
    }
    
    // ページネーション
    const startIndex = (parseInt(page) - 1) * parseInt(limit);
    const endIndex = startIndex + parseInt(limit);
    const paginatedGuilds = guilds.slice(startIndex, endIndex);
    
    res.json({
      success: true,
      guilds: paginatedGuilds,
      pagination: {
        current_page: parseInt(page),
        total_pages: Math.ceil(guilds.length / parseInt(limit)),
        total_count: guilds.length,
        has_more: endIndex < guilds.length
      }
    });
  });
  
  // ギルド詳細取得
  app.get('/api/guilds/:guildId', mockAuth, (req, res) => {
    const guildId = parseInt(req.params.guildId);
    
    const guild = mockGuilds[guildId];
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'ギルドが見つかりません'
      });
    }
    
    // メンバーシップ確認
    const memberKey = `${guildId}:${req.user.id}`;
    const isMember = mockGuildMembers[memberKey];
    
    if (!isMember && !guild.is_public) {
      return res.status(403).json({
        success: false,
        message: 'このギルドにアクセスする権限がありません'
      });
    }
    
    // Redis キャッシュから取得を試行
    const cacheKey = `guild:${guildId}`;
    let guildData;
    
    if (mockGuildCache[cacheKey]) {
      guildData = JSON.parse(mockGuildCache[cacheKey]);
    } else {
      const owner = mockUsers[guild.owner_id];
      guildData = {
        ...guild,
        owner: {
          id: owner.id,
          userid: owner.userid,
          nickname: owner.nickname
        }
      };
      
      // キャッシュに保存
      mockGuildCache[cacheKey] = JSON.stringify(guildData);
    }
    
    // チャンネル一覧
    const channels = Object.values(mockChannels)
      .filter(channel => channel.guild_id === guildId)
      .sort((a, b) => a.position - b.position);
    
    res.json({
      success: true,
      guild: {
        ...guildData,
        channels: channels,
        user_role: isMember ? isMember.role : null,
        is_member: !!isMember
      }
    });
  });
  
  // チャンネル作成
  app.post('/api/guilds/:guildId/channels', mockAuth, (req, res) => {
    const guildId = parseInt(req.params.guildId);
    const { 
      name, 
      description = null, 
      channelType = 'text',
      isPrivate = false,
      slowMode = 0,
      userLimit = null 
    } = req.body;
    
    const guild = mockGuilds[guildId];
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'ギルドが見つかりません'
      });
    }
    
    // 権限チェック（オーナーまたは管理者）
    const memberKey = `${guildId}:${req.user.id}`;
    const member = mockGuildMembers[memberKey];
    
    if (!member || (member.role !== 'owner' && member.role !== 'admin' && !req.user.is_admin)) {
      return res.status(403).json({
        success: false,
        message: 'チャンネルを作成する権限がありません'
      });
    }
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'チャンネル名は必須です'
      });
    }
    
    // チャンネル名の重複チェック
    const existingChannel = Object.values(mockChannels).find(
      channel => channel.guild_id === guildId && channel.name.toLowerCase() === name.trim().toLowerCase()
    );
    
    if (existingChannel) {
      return res.status(400).json({
        success: false,
        message: 'このチャンネル名は既に使用されています'
      });
    }
    
    // 新しいチャンネルID
    const channelId = Object.keys(mockChannels).length + 1;
    const now = new Date().toISOString();
    
    // ポジション計算
    const guildChannels = Object.values(mockChannels).filter(c => c.guild_id === guildId);
    const maxPosition = Math.max(...guildChannels.map(c => c.position), -1);
    
    const newChannel = {
      id: channelId,
      guild_id: guildId,
      name: name.trim().toLowerCase().replace(/\s+/g, '-'),
      description: description,
      channel_type: channelType,
      position: maxPosition + 1,
      is_default: false,
      is_private: isPrivate,
      slow_mode: channelType === 'text' ? slowMode : 0,
      user_limit: channelType === 'voice' ? userLimit : null,
      topic: null,
      created_at: now,
      updated_at: now
    };
    
    mockChannels[channelId] = newChannel;
    
    res.status(201).json({
      success: true,
      message: 'チャンネルを作成しました',
      channel: newChannel
    });
  });
  
  // チャンネル一覧取得
  app.get('/api/guilds/:guildId/channels', mockAuth, (req, res) => {
    const guildId = parseInt(req.params.guildId);
    
    const guild = mockGuilds[guildId];
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'ギルドが見つかりません'
      });
    }
    
    // メンバーシップ確認
    const memberKey = `${guildId}:${req.user.id}`;
    const isMember = mockGuildMembers[memberKey];
    
    if (!isMember) {
      return res.status(403).json({
        success: false,
        message: 'このギルドのチャンネルにアクセスする権限がありません'
      });
    }
    
    const channels = Object.values(mockChannels)
      .filter(channel => channel.guild_id === guildId)
      .filter(channel => !channel.is_private || isMember.role === 'owner' || isMember.role === 'admin')
      .sort((a, b) => a.position - b.position);
    
    res.json({
      success: true,
      channels: channels
    });
  });
  
  // ギルド参加
  app.post('/api/guilds/:guildId/join', mockAuth, (req, res) => {
    const guildId = parseInt(req.params.guildId);
    const { inviteCode = null } = req.body;
    
    const guild = mockGuilds[guildId];
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'ギルドが見つかりません'
      });
    }
    
    // 既にメンバーかチェック
    const memberKey = `${guildId}:${req.user.id}`;
    if (mockGuildMembers[memberKey]) {
      return res.status(400).json({
        success: false,
        message: '既にこのギルドのメンバーです'
      });
    }
    
    // 招待制ギルドの場合、招待コードが必要
    if (!guild.is_public && !inviteCode) {
      return res.status(400).json({
        success: false,
        message: '招待コードが必要です'
      });
    }
    
    // メンバー数制限チェック
    const currentMemberCount = Object.values(mockGuildMembers)
      .filter(member => member.guild_id === guildId).length;
    
    if (currentMemberCount >= guild.max_members) {
      return res.status(400).json({
        success: false,
        message: 'ギルドのメンバー数が上限に達しています'
      });
    }
    
    // メンバー追加
    mockGuildMembers[memberKey] = {
      guild_id: guildId,
      user_id: req.user.id,
      role: 'member',
      joined_at: new Date().toISOString()
    };
    
    // ギルドのメンバー数更新
    mockGuilds[guildId].member_count = currentMemberCount + 1;
    
    // キャッシュクリア
    delete mockGuildCache[`guild:${guildId}`];
    
    res.json({
      success: true,
      message: 'ギルドに参加しました',
      guild: {
        id: guild.id,
        name: guild.name,
        description: guild.description,
        member_count: guild.member_count
      }
    });
  });
  
  // ギルド脱退
  app.delete('/api/guilds/:guildId/leave', mockAuth, (req, res) => {
    const guildId = parseInt(req.params.guildId);
    
    const guild = mockGuilds[guildId];
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'ギルドが見つかりません'
      });
    }
    
    const memberKey = `${guildId}:${req.user.id}`;
    const member = mockGuildMembers[memberKey];
    
    if (!member) {
      return res.status(400).json({
        success: false,
        message: 'このギルドのメンバーではありません'
      });
    }
    
    // オーナーは脱退不可
    if (member.role === 'owner') {
      return res.status(400).json({
        success: false,
        message: 'ギルドオーナーは脱退できません'
      });
    }
    
    // メンバーから削除
    delete mockGuildMembers[memberKey];
    
    // ギルドのメンバー数更新
    mockGuilds[guildId].member_count -= 1;
    
    // キャッシュクリア
    delete mockGuildCache[`guild:${guildId}`];
    
    res.json({
      success: true,
      message: 'ギルドから脱退しました'
    });
  });
  
  // ギルド更新
  app.put('/api/guilds/:guildId', mockAuth, (req, res) => {
    const guildId = parseInt(req.params.guildId);
    const { name, description, isPublic, maxMembers } = req.body;
    
    const guild = mockGuilds[guildId];
    if (!guild) {
      return res.status(404).json({
        success: false,
        message: 'ギルドが見つかりません'
      });
    }
    
    // オーナーまたは管理者権限チェック
    const memberKey = `${guildId}:${req.user.id}`;
    const member = mockGuildMembers[memberKey];
    
    if (!member || (member.role !== 'owner' && !req.user.is_admin)) {
      return res.status(403).json({
        success: false,
        message: 'ギルドを編集する権限がありません'
      });
    }
    
    // 更新
    if (name !== undefined) guild.name = name.trim();
    if (description !== undefined) guild.description = description;
    if (isPublic !== undefined) guild.is_public = isPublic;
    if (maxMembers !== undefined) guild.max_members = maxMembers;
    guild.updated_at = new Date().toISOString();
    
    // キャッシュクリア
    delete mockGuildCache[`guild:${guildId}`];
    
    res.json({
      success: true,
      message: 'ギルドを更新しました',
      guild: guild
    });
  });
  
  return app;
}

describe('PostgreSQL + Redis ギルド・チャンネル機能テスト', () => {
  let app;

  beforeAll(() => {
    app = createGuildTestApp();
  });

  afterAll(async () => {
    // 非同期処理のクリーンアップ
    await new Promise(resolve => setTimeout(resolve, 100));
  });

  afterAll(async () => {
    // テスト後のクリーンアップ
    if (app && app.close) {
      await app.close();
    }
  });

  describe('ギルド作成', () => {
    test('正常なギルド作成', async () => {
      const response = await request(app)
        .post('/api/guilds')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: 'New Test Guild',
          description: 'A guild for testing PostgreSQL',
          isPublic: true
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.guild.name).toBe('New Test Guild');
      expect(response.body.guild.owner.userid).toBe('owner');
      expect(response.body.guild.default_channel_id).toBeDefined();
    });

    test('空のギルド名でのエラー', async () => {
      const response = await request(app)
        .post('/api/guilds')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: '   ',
          description: 'Test guild'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
    });

    test('長すぎるギルド名でのエラー', async () => {
      const longName = 'a'.repeat(101);
      
      const response = await request(app)
        .post('/api/guilds')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: longName
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('100文字以内');
    });
  });

  describe('ギルド取得', () => {
    test('ユーザーのギルド一覧取得', async () => {
      const response = await request(app)
        .get('/api/guilds')
        .set('Authorization', 'Bearer owner-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.guilds)).toBe(true);
      expect(response.body.pagination).toBeDefined();
    });

    test('ギルド詳細取得（メンバー）', async () => {
      const response = await request(app)
        .get('/api/guilds/1')
        .set('Authorization', 'Bearer owner-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.guild.id).toBe(1);
      expect(response.body.guild.channels).toBeDefined();
      expect(response.body.guild.user_role).toBe('owner');
      expect(response.body.guild.is_member).toBe(true);
    });

    test('存在しないギルド取得エラー', async () => {
      const response = await request(app)
        .get('/api/guilds/999')
        .set('Authorization', 'Bearer owner-token');

      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('チャンネル管理', () => {
    test('テキストチャンネル作成', async () => {
      const response = await request(app)
        .post('/api/guilds/1/channels')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: 'New Text Channel',
          description: 'A new text channel',
          channelType: 'text',
          slowMode: 5
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.channel.name).toBe('new-text-channel'); // 自動変換
      expect(response.body.channel.channel_type).toBe('text');
      expect(response.body.channel.slow_mode).toBe(5);
    });

    test('ボイスチャンネル作成', async () => {
      const response = await request(app)
        .post('/api/guilds/1/channels')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: 'Voice Chat',
          channelType: 'voice',
          userLimit: 5
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.channel.channel_type).toBe('voice');
      expect(response.body.channel.user_limit).toBe(5);
    });

    test('チャンネル名重複エラー', async () => {
      const response = await request(app)
        .post('/api/guilds/1/channels')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: 'general'
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('既に使用されています');
    });

    test('権限不足でのチャンネル作成エラー', async () => {
      const response = await request(app)
        .post('/api/guilds/1/channels')
        .set('Authorization', 'Bearer member-token')
        .send({
          name: 'unauthorized-channel'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });

    test('ギルドのチャンネル一覧取得', async () => {
      const response = await request(app)
        .get('/api/guilds/1/channels')
        .set('Authorization', 'Bearer owner-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.channels)).toBe(true);
      expect(response.body.channels.length).toBeGreaterThan(0);
    });
  });

  describe('ギルド参加・脱退', () => {
    test('パブリックギルドへの参加', async () => {
      const response = await request(app)
        .post('/api/guilds/1/join')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.guild.member_count).toBeGreaterThan(0);
    });

    test('既にメンバーの場合の参加エラー', async () => {
      const response = await request(app)
        .post('/api/guilds/1/join')
        .set('Authorization', 'Bearer owner-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('既にこのギルドのメンバー');
    });

    test('ギルドからの脱退', async () => {
      const response = await request(app)
        .delete('/api/guilds/1/leave')
        .set('Authorization', 'Bearer member-token');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('オーナーの脱退エラー', async () => {
      const response = await request(app)
        .delete('/api/guilds/1/leave')
        .set('Authorization', 'Bearer owner-token');

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('オーナーは脱退できません');
    });
  });

  describe('ギルド更新', () => {
    test('ギルド情報更新（オーナー）', async () => {
      const response = await request(app)
        .put('/api/guilds/1')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: 'Updated Guild Name',
          description: 'Updated description',
          isPublic: false,
          maxMembers: 150
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.guild.name).toBe('Updated Guild Name');
      expect(response.body.guild.is_public).toBe(false);
      expect(response.body.guild.max_members).toBe(150);
    });

    test('権限不足でのギルド更新エラー', async () => {
      const response = await request(app)
        .put('/api/guilds/1')
        .set('Authorization', 'Bearer member-token')
        .send({
          name: 'Unauthorized Update'
        });

      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('Redis キャッシュ統合', () => {
    test('ギルド詳細のキャッシュ動作確認', async () => {
      // 最初のリクエスト（キャッシュなし）
      const response1 = await request(app)
        .get('/api/guilds/1')
        .set('Authorization', 'Bearer owner-token');

      expect(response1.status).toBe(200);

      // 二回目のリクエスト（キャッシュあり）
      const response2 = await request(app)
        .get('/api/guilds/1')
        .set('Authorization', 'Bearer owner-token');

      expect(response2.status).toBe(200);
      expect(response2.body.guild.id).toBe(response1.body.guild.id);
    });

    test('ギルド更新後のキャッシュクリア確認', async () => {
      // ギルド更新
      await request(app)
        .put('/api/guilds/1')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: 'Cache Test Guild'
        });

      // 更新後の取得（新しいキャッシュ）
      const response = await request(app)
        .get('/api/guilds/1')
        .set('Authorization', 'Bearer owner-token');

      expect(response.status).toBe(200);
      expect(response.body.guild.name).toBe('Cache Test Guild');
    });
  });

  describe('統合シナリオ', () => {
    test('ギルド作成 → チャンネル作成 → メンバー参加 → 脱退', async () => {
      // 1. ギルド作成
      const createGuildResponse = await request(app)
        .post('/api/guilds')
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: 'Integration Test Guild',
          description: 'Full integration test',
          isPublic: true
        });

      expect(createGuildResponse.status).toBe(201);
      const guildId = createGuildResponse.body.guild.id;

      // 2. チャンネル作成
      const createChannelResponse = await request(app)
        .post(`/api/guilds/${guildId}/channels`)
        .set('Authorization', 'Bearer owner-token')
        .send({
          name: 'integration-test',
          description: 'Test channel for integration',
          channelType: 'text'
        });

      expect(createChannelResponse.status).toBe(201);

      // 3. 他ユーザーの参加
      const joinResponse = await request(app)
        .post(`/api/guilds/${guildId}/join`)
        .set('Authorization', 'Bearer member-token');

      expect(joinResponse.status).toBe(200);

      // 4. チャンネル一覧確認
      const channelsResponse = await request(app)
        .get(`/api/guilds/${guildId}/channels`)
        .set('Authorization', 'Bearer member-token');

      expect(channelsResponse.status).toBe(200);
      expect(channelsResponse.body.channels.length).toBeGreaterThan(1);

      // 5. メンバーの脱退
      const leaveResponse = await request(app)
        .delete(`/api/guilds/${guildId}/leave`)
        .set('Authorization', 'Bearer member-token');

      expect(leaveResponse.status).toBe(200);
    });
  });
});
