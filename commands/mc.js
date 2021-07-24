const util = require('minecraft-server-util');

module.exports = {
    name: 'status',
    description: 'get information about a minecraft server',
    execute(message, args, cmd, client, Discord) {
        util.status("mc-cupid.com", {port: 25565}).then((response) => {
            const embed = new Discord.MessageEmbed()
            .setColor('#BFCDEB')
            .setTitle('Server Status')
            .addFields(
                {name: 'Server IP', value: response.host},
                {name: 'Online Players', value: response.onlinePlayers},
                {name: 'Max Players', value: response.maxPlayers}
            )
            .setFooter('Bot by @PONDHALF');

            message.channel.send(embed); 
        })
        .catch ((error) => {
            message.channel.send('Server is offline!');
            throw error;
        })
    }
}