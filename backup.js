const fs = require('fs');
const path = require('path');
const BACKUP_DIR = path.join(__dirname, 'backups');
if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR);

function generateId() {
  return Math.random().toString(36).substring(2, 10);
}

// ----------------- CREATE BACKUP -----------------
async function createBackup(guild) {
  const backupId = generateId();
  const data = {
    id: backupId,
    guildId: guild.id,
    name: guild.name,
    createdAt: Date.now(),
    roles: guild.roles.cache
      .filter(r => r.id !== guild.id)
      .map(r => ({
        name: r.name,
        color: r.color,
        hoist: r.hoist,
        permissions: r.permissions.bitfield,
        mentionable: r.mentionable,
      })),
    channels: guild.channels.cache.map(c => ({
      name: c.name,
      type: c.type,
      parent: c.parent?.name || null,
      position: c.rawPosition,
      topic: c.topic || null,
      nsfw: c.nsfw || false,
      bitrate: c.bitrate || null,
      userLimit: c.userLimit || null,
      rateLimitPerUser: c.rateLimitPerUser || 0,
    })),
    settings: {
      afkChannel: guild.afkChannel?.name || null,
      afkTimeout: guild.afkTimeout,
      verificationLevel: guild.verificationLevel,
      explicitContentFilter: guild.explicitContentFilter,
      defaultMessageNotifications: guild.defaultMessageNotifications,
    }
  };

  fs.writeFileSync(path.join(BACKUP_DIR, `${backupId}.json`), JSON.stringify(data, null, 2));
  return backupId;
}

// ----------------- LOAD BACKUP -----------------
async function loadBackup(guild, backupId, options = { roles: true, channels: true, settings: true }) {
  const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
  if (!fs.existsSync(filePath)) throw new Error('Backup not found.');
  const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

  if (options.roles) {
    for (const role of data.roles) {
      await guild.roles.create({
        name: role.name,
        color: role.color,
        hoist: role.hoist,
        permissions: role.permissions,
        mentionable: role.mentionable,
      }).catch(() => {});
    }
  }

  if (options.channels) {
    for (const channel of data.channels.sort((a, b) => a.position - b.position)) {
      await guild.channels.create({
        name: channel.name,
        type: channel.type,
        topic: channel.topic,
        nsfw: channel.nsfw,
        rateLimitPerUser: channel.rateLimitPerUser,
      }).catch(() => {});
    }
  }

  if (options.settings) {
    await guild.setAFKTimeout(data.settings.afkTimeout).catch(() => {});
    // More settings can be restored if needed
  }

  return true;
}

// ----------------- LIST BACKUPS -----------------
function listBackups() {
  return fs.readdirSync(BACKUP_DIR).map(file =>
    JSON.parse(fs.readFileSync(path.join(BACKUP_DIR, file), 'utf8'))
  );
}

// ----------------- DELETE BACKUP -----------------
function deleteBackup(backupId) {
  const filePath = path.join(BACKUP_DIR, `${backupId}.json`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
    return true;
  }
  return false;
}

module.exports = { createBackup, loadBackup, listBackups, deleteBackup };
