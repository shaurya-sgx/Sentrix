const { ChannelType, PermissionFlagsBits } = require("discord.js");

const MAINTENANCE_CHANNEL_NAME = "🔧-maintenance";
let hiddenChannels = new Map(); // guildId → [channelIds]
let maintenanceStatus = new Map(); // guildId → true/false

async function enableMaintenance(guild) {
  console.log("⚙️ Enabling maintenance...");
  hiddenChannels.set(guild.id, []);
  maintenanceStatus.set(guild.id, true);

  guild.channels.cache.forEach(channel => {
    if (channel.type === ChannelType.GuildText || channel.type === ChannelType.GuildVoice) {
      if (channel.name !== MAINTENANCE_CHANNEL_NAME) {
        hiddenChannels.get(guild.id).push(channel.id);
        channel.permissionOverwrites.edit(guild.roles.everyone, {
          ViewChannel: false
        }).catch(console.error);
      }
    }
  });

  let maintenanceChannel = guild.channels.cache.find(c => c.name === MAINTENANCE_CHANNEL_NAME);
  if (!maintenanceChannel) {
    maintenanceChannel = await guild.channels.create({
      name: MAINTENANCE_CHANNEL_NAME,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          allow: [PermissionFlagsBits.ViewChannel],
        }
      ]
    });
    await maintenanceChannel.send("🚧 The server is currently under **maintenance**. Please wait!");
  }
}

async function disableMaintenance(guild) {
  console.log("⚙️ Disabling maintenance...");
  maintenanceStatus.set(guild.id, false);

  const stored = hiddenChannels.get(guild.id);
  if (stored) {
    for (const channelId of stored) {
      const channel = guild.channels.cache.get(channelId);
      if (channel) {
        channel.permissionOverwrites.edit(guild.roles.everyone, {
          ViewChannel: true
        }).catch(console.error);
      }
    }
  }

  const maintenanceChannel = guild.channels.cache.find(c => c.name === MAINTENANCE_CHANNEL_NAME);
  if (maintenanceChannel) {
    await maintenanceChannel.delete().catch(console.error);
  }

  hiddenChannels.delete(guild.id);
}

function getMaintenanceStatus(guildId) {
  return maintenanceStatus.get(guildId) || false;
}

module.exports = { enableMaintenance, disableMaintenance, getMaintenanceStatus };
