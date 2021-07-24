require('dotenv').config();
const Discord = require('discord.js');
const client = new Discord.Client();

const prefix = process.env.PREFIX;

const fs = require('fs');

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

client.login(process.env.TOKEN);