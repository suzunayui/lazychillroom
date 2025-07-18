const express = require('express');
const { query, transaction } = require('../../config/database');

// Basic guild operations
class GuildController {
  // Get user's guilds (excluding personal servers)
  static async getUserGuilds(req, res) {
    try {
      const guilds = await query(`
        SELECT 
          g.id,
          g.name,
          g.description,
          g.icon_url,
          g.is_public,
          g.created_at,
          gm.role,
          gm.joined_at
        FROM guilds g
        JOIN guild_members gm ON g.id = gm.guild_id
        WHERE gm.user_id = $1 AND gm.is_active = true
        AND (g.is_personal_server = false OR g.is_personal_server IS NULL)
        ORDER BY gm.joined_at ASC
      `, [req.user.id]);

      res.json({
        success: true,
        guilds
      });

    } catch (error) {
      console.error('Get guilds error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーリストの取得に失敗しました'
      });
    }
  }

  // Get user's personal server (マイサーバー)
  static async getPersonalServer(req, res) {
    try {
      // マイサーバーを検索（is_personal_serverフラグで判別）
      let personalServers = await query(`
        SELECT 
          g.id,
          g.name,
          g.description,
          g.icon_url,
          g.is_public,
          g.created_at,
          gm.role,
          gm.joined_at
        FROM guilds g
        JOIN guild_members gm ON g.id = gm.guild_id
        WHERE gm.user_id = $1 AND gm.role = 'owner' AND gm.is_active = true
        AND g.owner_id = $1
        AND g.is_personal_server = true
        ORDER BY g.created_at DESC
        LIMIT 1
      `, [req.user.id]);

      // マイサーバーが見つからない場合は作成しない（新規登録時に作成されるはず）
      if (personalServers.length === 0) {
        console.log('マイサーバーが見つかりません。新規登録処理に問題がある可能性があります。');
        return res.status(404).json({
          success: false,
          message: 'マイサーバーが見つかりません'
        });
      }

      const personalServer = personalServers[0];

      // Get channels for personal server
      const channels = await query(`
        SELECT id, name, type, position, created_at
        FROM channels 
        WHERE guild_id = $1 
        ORDER BY position ASC, created_at ASC
      `, [personalServer.id]);

      res.json({
        success: true,
        server: {
          ...personalServer,
          channels,
          is_personal_server: true
        }
      });

    } catch (error) {
      console.error('Get personal server error:', error);
      res.status(500).json({
        success: false,
        message: 'マイサーバーの取得に失敗しました'
      });
    }
  }

  // Get guild details
  static async getGuildDetails(req, res) {
    try {
      const { guildId } = req.params;

      // Check if user is member of this guild
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guildId, req.user.id]
      );

      if (memberCheck.length === 0) {
        return res.status(403).json({
          success: false,
          message: 'このサーバーにアクセスする権限がありません'
        });
      }

      // Get guild info
      const guilds = await query(
        'SELECT id, name, description, icon_url, is_public, created_at FROM guilds WHERE id = $1',
        [guildId]
      );

      if (guilds.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'サーバーが見つかりません'
        });
      }

      // Get channels
      const channels = await query(`
        SELECT id, name, type, position, created_at
        FROM channels 
        WHERE guild_id = $1 
        ORDER BY position ASC, created_at ASC
      `, [guildId]);

      // Get members
      const members = await query(`
        SELECT 
          u.id,
          u.userid,
          u.nickname,
          u.avatar_url,
          gm.role,
          gm.joined_at
        FROM users u
        JOIN guild_members gm ON u.id = gm.user_id
        WHERE gm.guild_id = $1 AND gm.is_active = true
        ORDER BY gm.role DESC, u.nickname ASC
      `, [guildId]);

      res.json({
        success: true,
        guild: {
          ...guilds[0],
          channels,
          members,
          userRole: memberCheck[0].role
        }
      });

    } catch (error) {
      console.error('Get guild details error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバー情報の取得に失敗しました'
      });
    }
  }

  // Create new guild
  static async createGuild(req, res) {
    try {
      const { name, description, is_public, icon_url } = req.body;

      if (!name || name.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'サーバー名は必須です'
        });
      }

      // Create guild and add creator as owner in a transaction
      const result = await transaction(async (connection) => {
        // Create guild
        const guildResult = await connection.query(
          'INSERT INTO guilds (name, description, is_public, icon_url, owner_id, created_at) VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING id',
          [name.trim(), description || null, is_public || false, icon_url || null, req.user.id]
        );

        const guildId = guildResult.rows[0].id;        // Add creator as owner member
        await connection.query(
          'INSERT INTO guild_members (guild_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW())',
          [guildId, req.user.id, 'owner']
        );

        // Create default general channel
        await connection.query(
          'INSERT INTO channels (guild_id, name, type, position, created_at) VALUES ($1, $2, $3, $4, NOW())',
          [guildId, 'general', 'text', 0]
        );

        return guildId;
      });

      // Get the created guild with channels
      const guild = await query(`
        SELECT 
          g.id,
          g.name,
          g.description,
          g.icon_url,
          g.is_public,
          g.created_at
        FROM guilds g
        WHERE g.id = $1
      `, [result]);

      const channels = await query(
        'SELECT id, name, type, position, created_at FROM channels WHERE guild_id = $1 ORDER BY position ASC',
        [result]
      );

      res.status(201).json({
        success: true,
        message: 'サーバーを作成しました',
        guild: {
          ...guild[0],
          channels,
          members: [{
            id: req.user.id,
            userid: req.user.userid,
            nickname: req.user.nickname,
            avatar_url: req.user.avatar_url,
            role: 'owner',
            joined_at: new Date()
          }],
          userRole: 'owner'
        }
      });

    } catch (error) {
      console.error('Create guild error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーの作成に失敗しました'
      });
    }
  }

  // Delete guild (only for owners)
  static async deleteGuild(req, res) {
    try {
      const { guildId } = req.params;

      // Check if the guild exists and user is the owner
      const guild = await query(
        'SELECT owner_id FROM guilds WHERE id = $1',
        [guildId]
      );

      if (guild.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'サーバーが見つかりません'
        });
      }

      if (guild[0].owner_id !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: 'サーバーを削除する権限がありません。オーナーのみが削除できます。'
        });
      }

      // Delete the guild (CASCADE will handle related tables)
      await query('DELETE FROM guilds WHERE id = $1', [guildId]);

      res.json({
        success: true,
        message: 'サーバーが正常に削除されました'
      });

    } catch (error) {
      console.error('Delete guild error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーの削除に失敗しました'
      });
    }
  }
}

module.exports = GuildController;
