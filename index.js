require('dotenv').config();
const fs = require('fs');
const { 
    Client, 
    GatewayIntentBits, 
    Collection, 
    REST, 
    Routes, 
    Events, 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle 
} = require('discord.js');

// ----------------- BOT SETUP -----------------
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const prefixes = ['s', 'S', '!']; // Allowed prefixes
client.commands = new Collection();

const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));
const slashCommands = [];

// ----------------- COMMAND LOADING -----------------
for (const file of commandFiles) {
    const command = require(`./commands/${file}`);
    client.commands.set(command.name, command);

    // For slash registration
    if (command.data) slashCommands.push(command.data.toJSON());
}

// ----------------- READY EVENT -----------------
client.once('ready', async () => {
    console.log(`✅ Logged in as ${client.user.tag}`);
    client.user.setStatus('dnd'); 
    client.user.setActivity('Hide and seek with offenders ⚔️', { type: 0 });

    // Register slash commands globally
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: slashCommands });
        console.log('✅ Slash commands registered.');
    } catch (err) {
        console.error('❌ Error registering slash commands:', err);
    }
});

// ----------------- PREFIX COMMAND HANDLER -----------------
client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;

    // --- If the bot is mentioned ---
    if (message.mentions.has(client.user)) {
        const embed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setDescription(
                "**Get Started with Sentrix! Here are some quick actions to help you out!**\n" +
                "-# Looking for commands? Here are some quick actions to help you out!\n\n" +
                "**Need Assistance?**\n" +
                "Use `shelp` to explore the complete list of commands, or join our [Support Server](https://discord.gg/whFeaukwNq).\n\n" +
                "**Unlock More Power**\n" +
                "Upgrade to **Sentrix Premium** for next-level protection: advanced AntiNuke, smarter AutoMod, priority security patches, round-the-clock defense, and powerful all-in-one tools — everything you need to keep your server unstoppable.\n\n" +
                "Developed with ❤️ by @shaurya.sgx"
            );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setLabel('Support')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.gg/whFeaukwNq'),
            new ButtonBuilder()
                .setLabel('Invite Sentrix')
                .setStyle(ButtonStyle.Link)
                .setURL('https://discord.com/oauth2/authorize?client_id=1373589843547783298&permissions=8&integration_type=0&scope=bot')
        );

        return message.reply({ embeds: [embed], components: [row] });
    }

    // --- If no prefix is used, ignore ---
    if (!prefixes.some(p => message.content.startsWith(p))) return;

    const prefixUsed = prefixes.find(p => message.content.startsWith(p));
    const args = message.content.slice(prefixUsed.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();
    const command = client.commands.get(commandName);
    if (!command) return;

    try {
        if (command.executePrefix) {
            await command.executePrefix(message, args, client);
        } else if (command.execute) {
            await command.execute(message, args, client);
        }
    } catch (err) {
        console.error(err);
        message.reply('❌ There was an error executing that command.');
    }
});

// ----------------- SLASH COMMAND + BACKUP HANDLER -----------------
client.on(Events.InteractionCreate, async interaction => {
    // --- Slash Commands ---
    if (interaction.isChatInputCommand()) {
        const command = client.commands.get(interaction.commandName);
        if (!command || !command.executeSlash) return;

        try {
            await command.executeSlash(interaction);
        } catch (err) {
            console.error(err);
            interaction.reply({ content: '❌ Error executing command.', ephemeral: true });
        }
    }

    // --- Custom interaction handlers inside commands ---
    for (const [, cmd] of client.commands) {
        if (cmd.handleInteraction) await cmd.handleInteraction(interaction);
    }

    // --- Backup Select Menu ---
    if (interaction.isStringSelectMenu()) {
        if (interaction.customId.startsWith('backup-options-')) {
            const backupId = interaction.customId.split('backup-options-')[1];
            interaction.client.backupOptions = interaction.client.backupOptions || {};
            interaction.client.backupOptions[backupId] = interaction.values;
            return interaction.reply({ content: `✅ Options selected: ${interaction.values.join(', ')}`, ephemeral: true });
        }
    }

    // --- Backup Buttons ---
    if (interaction.isButton()) {
        if (interaction.customId.startsWith('backup-confirm-')) {
            const backupId = interaction.customId.split('backup-confirm-')[1];
            const options = interaction.client.backupOptions?.[backupId] || [];

            // Map options
            const loadOptions = {
                roles: options.includes('roles'),
                channels: options.includes('channels'),
                settings: options.includes('settings'),
            };

            if (options.includes('delete_roles')) {
                for (const role of interaction.guild.roles.cache.filter(r => r.id !== interaction.guild.id).values()) {
                    await role.delete().catch(() => {});
                }
            }

            if (options.includes('delete_channels')) {
                for (const channel of interaction.guild.channels.cache.values()) {
                    await channel.delete().catch(() => {});
                }
            }

            try {
                const { loadBackup } = require('./backup.js');
                await loadBackup(interaction.guild, backupId, loadOptions);
                return interaction.reply(`✅ Backup \`${backupId}\` successfully loaded!`);
            } catch (err) {
                console.error(err);
                return interaction.reply(`❌ Failed to load backup: ${err.message}`);
            }
        }

        if (interaction.customId.startsWith('backup-cancel-')) {
            return interaction.reply('❌ Backup load cancelled.');
        }
    }
});

// ----------------- BOT LOGIN -----------------
client.login(process.env.TOKEN);
