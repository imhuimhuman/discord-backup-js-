const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const welcomeschema = require('./schemas/welcome');
const roleschema = require('./schemas/autorole');
require('dotenv').config();
const { token, mongoDB} = require('./config.json');
const { default: mongoose } = require('mongoose');

 

const client = new Client({
	intents: [
		GatewayIntentBits.Guilds,
		GatewayIntentBits.GuildMessages,
		GatewayIntentBits.MessageContent,
		GatewayIntentBits.GuildMembers,
		GatewayIntentBits.GuildPresences,
	],
});
client.commands = new Collection();
client.cooldowns = new Collection();


const foldersPath = path.join(__dirname, 'commands');
const commandFolders = fs.readdirSync(foldersPath);

for (const folder of commandFolders) {
	const commandsPath = path.join(foldersPath, folder);
	const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const filePath = path.join(commandsPath, file);
		const command = require(filePath);
		if ('data' in command && 'execute' in command) {
			client.commands.set(command.data.name, command);
		} else {
			console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
		}
	}
}

const getAllFiles = (dir) => {
    const files = fs.readdirSync(dir);
    let allFiles = [];

    files.forEach(file => {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            const nestedFiles = getAllFiles(filePath);
            allFiles = allFiles.concat(nestedFiles);
        } else {
            if (file.endsWith('.js')) {
                allFiles.push(filePath);
            }
        }
    });

    return allFiles;
};

const eventsPath = path.join(__dirname, 'events');
const eventFiles = getAllFiles(eventsPath);

for (const file of eventFiles) {
    const event = require(file);
    if (event.once) {
        client.once(event.name, (...args) => event.execute(...args));
    } else {
        client.on(event.name, (...args) => event.execute(...args));
    }
}

(async() => {
	await mongoose.connect(mongoDB);
	console.log("Connected to main database...")

	client.login(token);

})();


client.on(Events.GuildMemberRemove, async (member, err) => {

    const leavedata = await welcomeschema.findOne({ Guild: member.guild.id });

    if (!leavedata) return;
    else {

        const channelID = leavedata.Channel;
        const channelwelcome = member.guild.channels.cache.get(channelID);

        const embedleave = new EmbedBuilder()
        .setColor("DarkBlue")
        .setTitle(`${member.user.username} has left`)
        .setDescription( `> ${member} has left the Server`)
        .setFooter({ text: `👋 Cast your goobyes`})
        .setTimestamp()
        .setAuthor({ name: `👋 Member Left`})

        const welmsg = await channelwelcome.send({ embeds: [embedleave]}).catch(err);
        welmsg.react('👋');
    }
})


client.on(Events.GuildMemberAdd, async (member, err) => {

    const welcomedata = await welcomeschema.findOne({ Guild: member.guild.id });

    if (!welcomedata) return;
    else {

        const channelID = welcomedata.Channel;
        const channelwelcome = member.guild.channels.cache.get(channelID)
        const roledata = await roleschema.findOne({ Guild: member.guild.id });

        if (roledata) {
            const giverole = await member.guild.roles.cache.get(roledata.Role)

            member.roles.add(giverole).catch(err => {
                console.log('Error received trying to give an auto role!');
            })
        }
        
        const embedwelcome = new EmbedBuilder()
         .setColor("DarkBlue")
         .setTitle(`${member.user.username} has arrived\nto the Server!`)
         .setDescription( `> Welcome ${member} to the Sevrer!`)
         .setFooter({ text: `👋 Get cozy and enjoy :)`})
         .setTimestamp()
         .setAuthor({ name: `👋 Welcome to the Server!`})
    
        const embedwelcomedm = new EmbedBuilder()
         .setColor("DarkBlue")
         .setTitle('Welcome Message')
         .setDescription( `> Welcome to ${member.guild.name}!`)
         .setFooter({ text: `👋 Get cozy and enjoy :)`})
         .setTimestamp()
         .setAuthor({ name: `👋 Welcome to the Server!`})
    
        const levmsg = await channelwelcome.send({ embeds: [embedwelcome]});
        levmsg.react('👋');
        member.send({ embeds: [embedwelcomedm]}).catch(err => console.log(`Welcome DM error: ${err}`))
    
    } 
})