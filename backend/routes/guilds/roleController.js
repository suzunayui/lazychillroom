const { query } = require('../../config/database');

// Guild role management operations
class RoleController {
  // Get roles for a guild
  static async getRoles(req, res) {
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

      const roles = await query(`
        SELECT 
          id,
          name,
          color,
          permissions,
          mentionable,
          hoist,
          position,
          created_at
        FROM roles
        WHERE guild_id = $1
        ORDER BY position DESC, created_at ASC
      `, [guildId]);

      res.json({
        success: true,
        roles
      });

    } catch (error) {
      console.error('Get roles error:', error);
      res.status(500).json({
        success: false,
        message: 'ロールリストの取得に失敗しました'
      });
    }
  }

  // Create role
  static async createRole(req, res) {
    try {
      const { guild_id, name, color, permissions, mentionable, hoist, position } = req.body;

      // Check if user has permission to manage roles
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guild_id, req.user.id]
      );

      if (memberCheck.length === 0 || !['owner', 'admin'].includes(memberCheck[0].role)) {
        return res.status(403).json({
          success: false,
          message: 'ロールを管理する権限がありません'
        });
      }

      const result = await query(
        'INSERT INTO roles (guild_id, name, color, permissions, mentionable, hoist, position, created_at) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())',
        [guild_id, name, color || '#000000', permissions || 0, mentionable || false, hoist || false, position || 0]
      );

      res.status(201).json({
        success: true,
        message: 'ロールを作成しました',
        role: {
          id: result.rows[0].id,
          name,
          color: color || '#000000',
          permissions: permissions || 0,
          mentionable: mentionable || false,
          hoist: hoist || false,
          position: position || 0,
          created_at: new Date()
        }
      });

    } catch (error) {
      console.error('Create role error:', error);
      res.status(500).json({
        success: false,
        message: 'ロールの作成に失敗しました'
      });
    }
  }

  // Update role
  static async updateRole(req, res) {
    try {
      const { role_id, name, color, permissions, mentionable, hoist, position } = req.body;

      // Get role details
      const roles = await query(
        'SELECT guild_id FROM roles WHERE id = $1',
        [role_id]
      );

      if (roles.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ロールが見つかりません'
        });
      }

      const guildId = roles[0].guild_id;

      // Check if user has permission to manage roles
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guildId, req.user.id]
      );

      if (memberCheck.length === 0 || !['owner', 'admin'].includes(memberCheck[0].role)) {
        return res.status(403).json({
          success: false,
          message: 'ロールを管理する権限がありません'
        });
      }

      await query(
        'UPDATE roles SET name = $1, color = $2, permissions = $3, mentionable = $4, hoist = $5, position = $6 WHERE id = $7',
        [name, color, permissions, mentionable, hoist, position, role_id]
      );

      res.json({
        success: true,
        message: 'ロールを更新しました'
      });

    } catch (error) {
      console.error('Update role error:', error);
      res.status(500).json({
        success: false,
        message: 'ロールの更新に失敗しました'
      });
    }
  }

  // Delete role
  static async deleteRole(req, res) {
    try {
      const { role_id } = req.body;

      // Get role details
      const roles = await query(
        'SELECT guild_id FROM roles WHERE id = $1',
        [role_id]
      );

      if (roles.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'ロールが見つかりません'
        });
      }

      const guildId = roles[0].guild_id;

      // Check if user has permission to manage roles
      const memberCheck = await query(
        'SELECT role FROM guild_members WHERE guild_id = $1 AND user_id = $2',
        [guildId, req.user.id]
      );

      if (memberCheck.length === 0 || !['owner', 'admin'].includes(memberCheck[0].role)) {
        return res.status(403).json({
          success: false,
          message: 'ロールを管理する権限がありません'
        });
      }

      await query('DELETE FROM roles WHERE id = $1', [role_id]);

      res.json({
        success: true,
        message: 'ロールを削除しました'
      });

    } catch (error) {
      console.error('Delete role error:', error);
      res.status(500).json({
        success: false,
        message: 'ロールの削除に失敗しました'
      });
    }
  }
}

module.exports = RoleController;
