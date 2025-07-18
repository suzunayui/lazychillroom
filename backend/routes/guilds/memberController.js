const { query } = require('../../config/database');

// Guild member management operations
class MemberController {
  // Join guild by invite code
  static async joinGuild(req, res) {
    try {
      const { inviteCode } = req.params;

      // Find valid invite
      const invites = await query(`
        SELECT i.guild_id, g.name as guild_name
        FROM invites i
        JOIN guilds g ON i.guild_id = g.id
        WHERE i.code = $1 AND (i.expires_at IS NULL OR i.expires_at > NOW()) AND i.is_active = true
      `, [inviteCode]);

      if (invites.length === 0) {
        return res.status(404).json({
          success: false,
          message: '無効または期限切れの招待コードです'
        });
      }

      const invite = invites[0];

      // Check if user is already a member
      const existingMember = await query(
        'SELECT id FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [invite.guild_id, req.user.id]
      );

      if (existingMember.length > 0) {
        return res.status(409).json({
          success: false,
          message: '既にこのサーバーのメンバーです'
        });
      }

      // Add user to guild
      await query(
        'INSERT INTO guild_members (guild_id, user_id, role, joined_at) VALUES ($1, $2, $3, NOW())',
        [invite.guild_id, req.user.id, 'member']
      );

      // Update invite usage
      await query(
        'UPDATE invites SET uses = uses + 1 WHERE code = $1',
        [inviteCode]
      );

      res.json({
        success: true,
        message: `${invite.guild_name}に参加しました`,
        guildId: invite.guild_id
      });

    } catch (error) {
      console.error('Join guild error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーへの参加に失敗しました'
      });
    }
  }

  // Leave guild
  static async leaveGuild(req, res) {
    try {
      const { guildId } = req.params;

      // Check if user is member of this guild
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guildId, req.user.id]
      );

      if (memberCheck.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'このサーバーのメンバーではありません'
        });
      }

      // Check if user is the owner (owners cannot leave their own guild)
      if (memberCheck[0].role === 'owner') {
        return res.status(403).json({
          success: false,
          message: 'サーバーの所有者は離脱できません。サーバーを削除するか、所有権を譲渡してください'
        });
      }

      // Remove user from guild
      await query(
        'UPDATE guild_members SET is_active = 0, left_at = NOW() WHERE guild_id = $1 AND user_id = $2',
        [guildId, req.user.id]
      );

      // Get guild name for response
      const guildInfo = await query(
        'SELECT name FROM guilds WHERE id = $1',
        [guildId]
      );

      res.json({
        success: true,
        message: `${guildInfo[0].name || 'サーバー'}から離脱しました`
      });

    } catch (error) {
      console.error('Leave guild error:', error);
      res.status(500).json({
        success: false,
        message: 'サーバーからの離脱に失敗しました'
      });
    }
  }
}

module.exports = MemberController;
