const Joi = require('joi');

// Validation schemas for guild operations
const guildSchema = Joi.object({
  name: Joi.string().min(1).max(100).required(),
  description: Joi.string().max(500).optional(),
  is_public: Joi.boolean().default(false),
  icon_url: Joi.string().uri().optional().allow('')
});

const inviteSchema = Joi.object({
  guild_id: Joi.number().integer().positive().required(),
  max_age: Joi.number().integer().min(0).optional(),
  max_uses: Joi.number().integer().min(0).optional(),
  temporary: Joi.boolean().default(false)
});

const roleSchema = Joi.object({
  guild_id: Joi.number().integer().positive().required(),
  name: Joi.string().min(1).max(50).required(),
  color: Joi.string().pattern(/^#[0-9A-Fa-f]{6}$/).default('#000000'),
  permissions: Joi.number().integer().min(0).default(0),
  mentionable: Joi.boolean().default(false),
  hoist: Joi.boolean().default(false),
  position: Joi.number().integer().min(0).default(0)
});

module.exports = {
  guildSchema,
  inviteSchema,
  roleSchema
};
