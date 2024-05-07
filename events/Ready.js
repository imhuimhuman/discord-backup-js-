const { Events } = require('discord.js');
const colors = require('colors');


module.exports = {
    name: Events.ClientReady,
    once: false,
    execute(client) {

      console.log(colors.blue(`\n${client.user.tag} is now online!\n\n/---------------------------------/\n`));
      console.log(colors.white(`Bot is now online!`));
      console.log(colors.white(`Server Count: `) + colors.green(`${client.guilds.cache.size}.`));
      console.log(colors.white(`Member Count: `) + colors.green(`${client.users.cache.size}.`));
      console.log(colors.magenta(`Bot version: 0.0.1`) + colors.red(` | (UNDER HEAVY DEVELOPMENT)\n`)); 
      
        
    },
};
