const { SlashCommandBuilder, ChannelType, PermissionsBitField, EmbedBuilder, ButtonBuilder, ActionRowBuilder } = require('discord.js');
const BackupSchema = require('../../schemas/backup');
const maxStates = 5;

// This command is not complete and is only for demonstration purposes.
module.exports = {
    data: new SlashCommandBuilder()
        .setName('backup')
        .setDescription('Manage server backups')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Creates a backup of the server settings.')
                .addStringOption(option =>
                    option.setName('state').setDescription('The state to backup to (Default is latest).').setRequired(false))

        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('schedule').setDescription('Schedules a backup of the server settings.')
                .addStringOption(option =>
                    option.setName('time').setDescription('The time to schedule the backup at (1D, 1M, 1W, 1MO).').setRequired(true))
                
                .addStringOption(option =>
                    option.setName('state').setDescription('The state to backup to (Default is latest).').setRequired(false))
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('Lists all backups of the server settings.')
                .addStringOption(option =>
                    option.setName('state').setDescription('The state to list (Default is latest).').setRequired(false))

        )


        .addSubcommand(subcommand =>
            subcommand
                .setName('restore')
                .setDescription('Restores a backup of the server settings from states.')
                .addStringOption(option =>
                    option.setName('state').setDescription('The state to restore from.').setRequired(false))

        ),
    async execute(interaction) {
        try {
            if (!interaction.guild) {
                return interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
            }

            if (interaction.options.getSubcommand() === 'create') {
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && interaction.member.id !== interaction.guild.ownerId) {
                    return interaction.reply({ content: 'You must have the `Administrator` or `Manage Server` permission to use this command.', ephemeral: true });
                }

                const existingBackup = await BackupSchema.findOne({ guildId: interaction.guild.id, state: interaction.options.getString('state') || 'latest' });
                const serverInfo = new EmbedBuilder()
                    .setTitle('Server Backup')
                    .setDescription(`Created Backup: ${interaction.options.getString('state') || 'latest'}\n\n\u200b<:arrow:1227071946672574504> **Channels Stored:** ${interaction.guild.channels.cache.filter(channel => channel.type !== ChannelType.GuildCategory && channel.id !== interaction.guild.rulesChannelId && channel.id !== interaction.guild.publicUpdatesChannelId && channel.id !== interaction.guild.systemChannelId).size}\n<:arrow:1227071946672574504> **Roles Stored:** ${interaction.guild.roles.cache.filter(role => !role.managed && role.name !== '@everyone' && !role.permissions.has(PermissionsBitField.Flags.Administrator)).size}\n<:arrow:1227071946672574504> **Categories Stored:** ${interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildCategory).size}\n<:arrow:1227071946672574504> **Forum Channels Stored:** ${interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildForum).size}\n<:arrow:1227071946672574504>**Server Name: ** ${interaction.guild.name}\n<:curve:1227071949100810331>**Server Owner:** <@${interaction.guild.name}>\n<:curve:1227071949100810331>**Server ID:** ${interaction.guild.id}\n\u200b`) 
                    .setColor('#80b918')
                    .setTimestamp();

               
                const guildBackups = await BackupSchema.find({ guildId: interaction.guild.id });

                if (guildBackups.length >= maxStates) {
                const latestBackupIndex = guildBackups.findIndex(backup => backup.state === 'latest');
                const backupsToDelete = guildBackups.filter((backup, index) => index !== latestBackupIndex).slice(0, guildBackups.length - maxStates + 1);

                    for (const backupToDelete of backupsToDelete) {
                    await BackupSchema.findByIdAndDelete(backupToDelete._id);
                    }
                }
                const serverDataString = await createBackupData(interaction);


                if (existingBackup) {
                        await BackupSchema.updateOne({ guildId: interaction.guild.id, state: interaction.options.getString('state') || 'latest' }, { data: serverDataString });
                        console.log('Updated backup');

                } else {
                        await BackupSchema.create({ data: serverDataString, guildId: interaction.guild.id, state: interaction.options.getString('state') || 'latest' });
                }


                await interaction.reply({ content: 'Server backup created successfully!', embeds:[serverInfo], ephemeral: true });
                     

            } else if (interaction.options.getSubcommand() === 'restore') {
                const backup = await BackupSchema.findOne({ guildId: interaction.guild.id, state: interaction.options.getString('state') || 'latest' });
            
                if (!backup) {
                    return interaction.reply({ content: 'No backup found.', ephemeral: true });
                }
            
                interaction.deferReply({ ephemeral: true });
            
                try {
                    const serverData = JSON.parse(backup.data);
                    // Delete roles, channels, cats which can be deleted
                    for (const channel of interaction.guild.channels.cache.filter(channel => channel.type !== ChannelType.GuildCategory && channel.id !== interaction.guild.rulesChannelId && channel.id !== interaction.guild.publicUpdatesChannelId && channel.id !== interaction.guild.systemChannelId).values()) {
                        await channel.delete();
                    }

                    for (const role of interaction.guild.roles.cache.filter(role => !role.managed && role.name !== '@everyone' && !role.permissions.has(PermissionsBitField.Flags.Administrator)).values()) {
                        await role.delete();
                    }




                   
                    
                    // Restore categories
                    for (const categoryData of serverData.categories) {
                        await interaction.guild.channels.create({name:categoryData.name, type: ChannelType.GuildCategory });
                        
                    }
                    
                    

                    
                    // Restore channels
                    for (const channelData of serverData.channels) {
                        
                        const channelCategoryName = serverData.categories.find(category => category.channels.includes(channelData.name))?.name;
                        const channelCategory = interaction.guild.channels.cache.find(c => c.type === ChannelType.GuildCategory && c.name === channelCategoryName);
                        const permissions = channelData.permissions.map(permission => ({
                            id: interaction.guild.roles.cache.find(role => role.name === permission.id)?.id || interaction.guild.id,
                            allow: permission.allow,
                            deny: permission.deny
                        }));
            
                        const channel = await interaction.guild.channels.create({
                            name: channelData.name, 
                            type: channelData.type,
                            topic: channelData.description,
                            rateLimitPerUser: channelData.slowmode,
                            parent: channelCategory,
                            permissionOverwrites: permissions
                        });

                         // Restore guild info
                        await interaction.guild.setName(serverData.guildInfo.name);
                        await interaction.guild.setIcon(serverData.guildInfo.icon);
                        await interaction.guild.setBanner(serverData.guildInfo.banner);
                        await interaction.guild.setAFKTimeout(serverData.guildInfo.afkTimeout);
                        
                        await interaction.guild.setSystemChannelFlags(serverData.guildInfo.systemChannelFlags);
                        

                        if (channelData.type === ChannelType.GuildForum)
                        {
                            for (const forumChannelData of serverData.forumChannels) {
                        
                                await channel.setRateLimitPerUser(forumChannelData.settings.rateLimitPerUser);
                                await channel.setDefaultThreadRateLimitPerUser(forumChannelData.settings.defaultThreadRateLimitPerUser);
                                await channel.setDefaultAutoArchiveDuration(forumChannelData.settings.defaultAutoArchiveDuration);
                                await channel.setDefaultForumLayout(forumChannelData.settings.defaultForumLayout);
                                await channel.setAvailableTags(forumChannelData.settings.availableTags);
        
                            }
                        }

                         
                    }
                    
                    // Restore roles
                    for (const roleData of serverData.roles) {
                        const role = await interaction.guild.roles.create({
                            name: roleData.name,
                            color: roleData.color,
                            permissions: roleData.permissions,
                            hoist: roleData.hoist,
                            mentionable: roleData.mentionable
                        });
            
                        await role.setPosition(roleData.position);
                    }
            
                    await interaction.followUp({ content: 'Backup restored successfully.', ephemeral: true });
                } catch (error) {
                    console.error('Error restoring backup:', error);
                    await interaction.followUp({ content: 'An error occurred while restoring the backup.', ephemeral: true });
                }
            }
             else if (interaction.options.getSubcommand() === 'schedule') {
                await interaction.deferReply({ ephemeral: true });

            
                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageChannels) && !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) && interaction.member.id !== interaction.guild.ownerId) {
                    return interaction.reply({ content: 'You must have the `Manage Channels` or `Manage Server` permission to use this command.', ephemeral: true });
                }

                const isEnabled = interaction.options.getBoolean('isEnabled');

                if (isEnabled) {
                    const state = interaction.options.getString('state') || 'latest';
                    const time = interaction.options.getString('time');
                    const interval = getTime(time);

                    const guildBackups = await BackupSchema.find({ guildId: interaction.guild.id });

                    const createBackupAndScheduleNext = async () => {
                        try {
                            if (!isBackupSchedulingEnabled) return;

                            if (guildBackups.length >= maxStates) {
                                const latestBackupIndex = guildBackups.findIndex(backup => backup.state === 'latest');
                                const backupsToDelete = guildBackups.filter((backup, index) => index !== latestBackupIndex).slice(0, guildBackups.length - maxStates + 1);
                    
                                for (const backupToDelete of backupsToDelete) {
                                    await BackupSchema.findByIdAndDelete(backupToDelete._id);
                                }
                            } 
                            const serverDataString = await createBackupData(interaction);

                            await BackupSchema.findOneAndUpdate({ guildId: interaction.guild.id, state }, { data: serverDataString, scheduledTime: new Date() }, { upsert: true });

                            setTimeout(createBackupAndScheduleNext, interval);
                        } catch (error) {
                            console.error('Error creating backup:', error);
                            await interaction.reply({ content: 'An error occurred while scheduling the backup.', ephemeral: true });
                        }
                    };

                    createBackupAndScheduleNext();

                    const embed = new EmbedBuilder()
                        .setTitle('Backup Schedule')
                        .setDescription(`Server scheduled backup has been enabled and will run every ${time}.`)
                        .setColor('#80b918')
                        .setTimestamp();

                    await interaction.followUp({ embeds: [embed], ephemeral: true });
                } else {
                    const guildBackups = await BackupSchema.find({ guildId: interaction.guild.id, state: interaction.options.getString('state') || 'latest' }).enabled;
                    guildBackups.enabled = false;
                    await guildBackups.save();
                    const embed = new EmbedBuilder()
                        .setTitle('Backup Schedule')
                        .setDescription(`Server scheduled backup has been disabled.`)
                        .setColor('#80b918')
                        .setTimestamp();
                    await interaction.followUp({ embeds: [embed], ephemeral: true });
                    
                }

 
            } else if (interaction.options.getSubcommand() === 'list') {
                const state = interaction.options.getString('state') || 'latest';

                const guildBackups = await BackupSchema.findOne({ guildId: interaction.guild.id, state });

                if (!guildBackups) {
                    return interaction.reply({ content: 'No backups found.', ephemeral: true });

                }
                const backup = {
                    state: guildBackups.state,
                    date: guildBackups.createdAt ? guildBackups.createdAt.toLocaleString() : 'N/A',
                    channelsStored: guildBackups.data ? JSON.parse(guildBackups.data).channels.length : 'N/A',
                    rolesStored: guildBackups.data ? JSON.parse(guildBackups.data).roles.length : 'N/A',
                    categoriesStored: guildBackups.data ? JSON.parse(guildBackups.data).categories.length : 'N/A',
                    forumChannelsStored: guildBackups.data ? JSON.parse(guildBackups.data).forumChannels.length : 'N/A',
                }
               
                        
                const embed = new EmbedBuilder()
                    .setTitle('Server Backups')
                    .setDescription(`Server backups for ${interaction.guild.name}`)
                    .setColor('#80b918')
                    .setTimestamp()
                    .setFooter({ text: `Requested by ${interaction.user.tag}`})
                    .addFields({name: 'State', value: `${backup.state || 'latest'}`},{name: 'Date', value: `**${backup.date}**`, inline: false}, {name: 'Channels Stored', value: `**${backup.channelsStored}**`, inline: false}, {name: 'Roles Stored', value: `**${backup.rolesStored}**`, inline: false}, {name: 'Categories Stored', value: `**${backup.categoriesStored}**`, inline: false}, {name: 'Forum Channels Stored', value: `**${backup.forumChannelsStored}**`, inline: false})
                    .setThumbnail(interaction.guild.iconURL({ dynamic: true }));
                    

                await interaction.reply({ embeds: [embed], ephemeral: true });

           
            }


        } catch (error) {
            console.error(error);
            await interaction.followUp({ content: 'An error occurred while processing the command.', ephemeral: true });
        }
    },
};

function getTime(time) {
    const regex = /(\d+)([a-z]+)/i;
    const match = time.match(regex);

    if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];

        switch (unit) {
            case 's':
                return value * 1000;
            case 'm':
                return value * 60 * 1000;
            case 'h':
                return value * 60 * 60 * 1000;
            case 'd':
                return value * 24 * 60 * 60 * 1000;
            case 'w':
                return value * 7 * 24 * 60 * 60 * 1000;
            case 'mo':
                throw new Error('Parsing months is not supported.');
            case 'y':
                throw new Error('Parsing years is not supported.');
            default:
                throw new Error('Invalid time unit');
        }
    } else {
        throw new Error('Invalid time format. Please use format like "10s", "2h", "1d", or "1w"');
    }
}
async function createBackupData(interaction) {
    const onboarding = await interaction.guild.fetchOnboarding();

    const serverData = {
        guildInfo: {
            name: interaction.guild.name,
            ownerID: interaction.guild.ownerId,
            icon: interaction.guild.iconURL({ dynamic: true }),
            banner: interaction.guild.bannerURL({ dynamic: true }),
            afkChannel: interaction.guild.afkChannel?.name,
            afkTimeout: interaction.guild.afkTimeout,
            systemChannel: interaction.guild.systemChannel?.name,
            rulesChannel: interaction.guild.rulesChannel?.name,
            systemChannelFlags: interaction.guild.systemChannelFlags.toArray(),
        },


        categories: interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildCategory).map(category => ({
            name: category.name,
            rawPos: category.rawPosition,
            channels: interaction.guild.channels.cache.filter(channel => channel.parentId === category.id).map(channel => channel.name)
        })),
        channels: interaction.guild.channels.cache.filter(channel => channel.type !== ChannelType.GuildCategory && channel.id !== interaction.guild.rulesChannelId && channel.id !== interaction.guild.publicUpdatesChannelId && channel.id !== interaction.guild.systemChannelId).map(channel => ({
            name: channel.name,
            type: channel.type,
            description: channel.topic,
            slowmode: channel.rateLimitPerUser,
            autoArchiveDuration: channel.defaultAutoArchiveDuration,
            rawPos: channel.rawPosition,
            permissions: channel.permissionOverwrites.cache
             .filter(permission => permission.type === 0) 
             .map(permission => {
               const roleName = interaction.guild.roles.cache.get(permission.id)?.name || '@everyone';
               return {
                id: roleName,
                allow: permission.allow.toArray(),
                deny: permission.deny.toArray()
               };
            }),
           
        })),
        forumChannels: interaction.guild.channels.cache.filter(channel => channel.type === ChannelType.GuildForum).map(forumChannel => ({
            name: forumChannel.name,
            settings: {
                availableTags: forumChannel.availableTags,
                defaultAutoArchiveDuration: forumChannel.defaultAutoArchiveDuration,
                defaultForumLayout: forumChannel.defaultForumLayout,
                defaultReactionEmoji: forumChannel.defaultReactionEmoji,
                defaultSortOrder: forumChannel.defaultSortOrder,
                defaultThreadRateLimitPerUser: forumChannel.defaultThreadRateLimitPerUser,
                nsfw: forumChannel.nsfw,
                rateLimitPerUser: forumChannel.rateLimitPerUser,
                topic: forumChannel.topic,
            },
            permissions: forumChannel.permissionOverwrites.cache
             .filter(permission => permission.type === 0) 
             .map(permission => {
               const roleName = interaction.guild.roles.cache.get(permission.id)?.name || '@everyone';
               return {
                id: roleName,
                allow: permission.allow.toArray(),
                deny: permission.deny.toArray()
               }

             })



        })),
        roles: interaction.guild.roles.cache
            .filter(role => !role.managed && role.name !== '@everyone' && !role.permissions.has(PermissionsBitField.Flags.Administrator)) 
            .map(role => ({
                id: role.id,
                name: role.name,
                permissions: role.permissions.toArray(),
                color: role.color,
                hoist: role.hoist,
                mentionable: role.mentionable,
                icon: role.iconURL({ dynamic: true }),                             
                position: role.rawPosition
            }))
    };
    console.log(JSON.stringify(serverData.forumChannels))

    return JSON.stringify(serverData);
}
