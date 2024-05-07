const { Events} = require('discord.js');
const disabledCmds = require('../schemas/blacklistCommands')
module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction) {
        if (!interaction.isCommand() && !interaction.isAutocomplete()) return;

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        const schema = await disabledCmds.findOne({ guildId: interaction.guild.id });
        
        if (!interaction.guildId === "1141001372188282970")
        {
            return;
        }

        if (interaction.isCommand()) {
 
            if (schema && schema.commands && schema.commands.includes(command.data.name)) {
                await interaction.reply({ content: 'This command is disabled!', ephemeral: true });
                return;
            }
    
        }




       
        try {
            if (interaction.isCommand()) {
                await command.execute(interaction);
            } else if (interaction.isAutocomplete()) {
                await command.autocomplete(interaction);
            }
        } catch (error) {
            console.error(error);
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};

