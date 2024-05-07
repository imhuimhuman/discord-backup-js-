const { Events, Collection } = require('discord.js');
const Level = require('../schemas/level');
const RoleConfig = require('../schemas/role');
const blackChannels = require('../schemas/blackChannels');
const calculateLevelXp =  require('../utils/calculateLevelXp');




function getRandomXp(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

module.exports = {
  name: Events.MessageCreate,
  async execute(message) {
    if (!message.guild || message.author.bot || await isBlacklistedChannel(message.channel)) return;

    const xpToGive = getRandomXp(10, 20);

    const query = {
      userId: message.author.id,
      guildId: message.guild.id,
    };

    try {
      let level = await Level.findOne(query);

      if (level) {
        level.xp += xpToGive;

        if (level.xp > calculateLevelXp(level.level)) {
          level.xp = 0;
          level.level += 1;

          const guildConfig = await RoleConfig.findOne({ guildId: message.guild.id });
          if (guildConfig) {
            const role = guildConfig.levels.get(level.level.toString());
            if (role) {
              try {
                await message.member.roles.add(role);
                const levelUpChannelId = guildConfig.levelUpChannel || message.channel;
                const levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
                if (levelUpChannel) {
                  
                  await levelUpChannel.send(`${message.member} you have leveled up to **level ${level.level}** and received the <@&${role}> role!`);
                } else {
                  console.log(`Error: Level-up channel not found`);
                }
              } catch (error) {
                console.error(`Error assigning role: ${error}`);
              }
            } else {
              
              const levelUpChannelId = guildConfig.levelUpChannel || message.channel;
              const levelUpChannel = message.guild.channels.cache.get(levelUpChannelId);
              if (levelUpChannel) {
                await levelUpChannel.send(`${message.member} you have leveled up to **level ${level.level}**!`);
              } else {
                console.log(`Error: Level-up channel not found`);
              }
            }
          }
        }

        await level.save();
      } else {
        const newLevel = new Level({
          userId: message.author.id,
          guildId: message.guild.id,
          xp: xpToGive,
        });

        await newLevel.save();
      }
    } catch (error) {
      console.error(`Error giving xp: ${error}`);
    }
  },
};


async function isBlacklistedChannel(channel) {
  const guildConfig = await blackChannels.findOne({ guildId: channel.guild.id });
  return guildConfig && guildConfig.blacklistedChannels.includes(channel.id);
}
