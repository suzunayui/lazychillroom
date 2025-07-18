const { query } = require('../../config/database');
const { v4: uuidv4 } = require('uuid');

// Guild invite management operations
class InviteController {
  // Get invites for a guild
  static async getInvites(req, res) {
    try {
      const { guildId } = req.params;

      // Check if user has permission to manage invites
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guildId, req.user.id]
      );

      if (memberCheck.length === 0 || !['owner', 'admin', 'moderator'].includes(memberCheck[0].role)) {
        return res.status(403).json({
          success: false,
          message: '招待を管理する権限がありません'
        });
      }

      const invites = await query(`
        SELECT 
          i.id,
          i.code,
          i.max_uses,
          i.uses,
          i.max_age,
          i.temporary,
          i.created_at,
          i.expires_at,
          u.userid as creator_userid,
          u.nickname as creator_nickname
        FROM invites i
        LEFT JOIN users u ON i.created_by = u.id
        WHERE i.guild_id = $1 AND (i.expires_at IS NULL OR i.expires_at > NOW())
        ORDER BY i.created_at DESC
      `, [guildId]);

      res.json({
        success: true,
        invites
      });

    } catch (error) {
      console.error('Get invites error:', error);
      res.status(500).json({
        success: false,
        message: '招待リストの取得に失敗しました'
      });
    }
  }

  // Create invite
  static async createInvite(req, res) {
    try {
      const { guild_id, max_age, max_uses, temporary } = req.body;

      // Check if user has permission to create invites
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guild_id, req.user.id]
      );

      if (memberCheck.length === 0 || !['owner', 'admin', 'moderator'].includes(memberCheck[0].role)) {
        return res.status(403).json({
          success: false,
          message: '招待を作成する権限がありません'
        });
      }

      // Generate unique invite code
      const code = uuidv4().substring(0, 8);

      // Calculate expiration date
      let expiresAt = null;
      if (max_age && max_age > 0) {
        const now = new Date();
        expiresAt = new Date(now.getTime() + (max_age * 1000));
      }

      const result = await query(
        'INSERT INTO invites (guild_id, code, created_by, max_uses, uses, max_age, temporary, expires_at, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())',
        [guild_id, code, req.user.id, max_uses || 0, 0, max_age || 0, temporary || false, expiresAt]
      );

      res.status(201).json({
        success: true,
        message: '招待を作成しました',
        invite: {
          id: result.rows[0].id,
          code,
          max_uses: max_uses || 0,
          uses: 0,
          max_age: max_age || 0,
          temporary: temporary || false,
          expires_at: expiresAt,
          created_at: new Date()
        }
      });

    } catch (error) {
      console.error('Create invite error:', error);
      res.status(500).json({
        success: false,
        message: '招待の作成に失敗しました'
      });
    }
  }

  // Delete invite
  static async deleteInvite(req, res) {
    try {
      const { invite_id } = req.body;

      // Get invite details
      const invites = await query(
        'SELECT guild_id FROM invites WHERE id = $1',
        [invite_id]
      );

      if (invites.length === 0) {
        return res.status(404).json({
          success: false,
          message: '招待が見つかりません'
        });
      }

      const guildId = invites[0].guild_id;

      // Check if user has permission to delete invites
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guildId, req.user.id]
      );

      if (memberCheck.length === 0 || !['owner', 'admin', 'moderator'].includes(memberCheck[0].role)) {
        return res.status(403).json({
          success: false,
          message: '招待を削除する権限がありません'
        });
      }

      await query('DELETE FROM invites WHERE id = $1', [invite_id]);

      res.json({
        success: true,
        message: '招待を削除しました'
      });

    } catch (error) {
      console.error('Delete invite error:', error);
      res.status(500).json({
        success: false,
        message: '招待の削除に失敗しました'
      });
    }
  }
}

module.exports = InviteController;
