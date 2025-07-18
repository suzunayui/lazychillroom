const express = require('express');
const GuildController = require('./guildController');
const MemberController = require('./memberController');
const InviteController = require('./inviteController');
const RoleController = require('./roleController');
const IconController = require('./iconController');
const { guildSchema, inviteSchema, roleSchema } = require('./validation');

const router = express.Router();

// Guild basic operations
router.get('/', GuildController.getUserGuilds);
router.get('/my-server', GuildController.getPersonalServer);
router.get('/:guildId', GuildController.getGuildDetails);
router.post('/', validateGuild, GuildController.createGuild);
router.post('/create', validateGuild, GuildController.createGuild);
router.delete('/:guildId', GuildController.deleteGuild);

// Member operations
router.post('/join/:inviteCode', MemberController.joinGuild);
router.delete('/:guildId/leave', MemberController.leaveGuild);

// Invite operations
router.get('/:guildId/invites', InviteController.getInvites);
router.post('/invites', validateInvite, InviteController.createInvite);
router.delete('/invites', InviteController.deleteInvite);

// Role operations
router.get('/:guildId/roles', RoleController.getRoles);
router.post('/roles', validateRole, RoleController.createRole);
router.put('/roles', RoleController.updateRole);
router.delete('/roles', RoleController.deleteRole);

// Icon upload
const iconUpload = IconController.getIconUpload();
router.post('/upload-icon', iconUpload.single('icon'), IconController.uploadIcon);

// Validation middleware
function validateGuild(req, res, next) {
  const { error, value } = guildSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }
  req.body = value;
  next();
}

function validateInvite(req, res, next) {
  const { error, value } = inviteSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }
  req.body = value;
  next();
}

function validateRole(req, res, next) {
  const { error, value } = roleSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      success: false,
      message: error.details[0].message
    });
  }
  req.body = value;
  next();
}

module.exports = router;
