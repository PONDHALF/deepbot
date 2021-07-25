require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();

client.commands = new Discord.Collection();
client.events = new Discord.Collection();

['command_handler', 'event_handler'].forEach(handler => {
    require(`./handlers/${handler}`)(client, Discord);
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}!`);
    //client.user.setActivity('@PONDHALF').catch(console.error);
    client.user.setStatus('dnd');
    client.user.setPresence({
        activity: {
            name: '@PONDHALF',
            type: 'WATCHING'
        }
    })
});

// Token2 is token for test product discord bot
client.login(process.env.TOKEN2);