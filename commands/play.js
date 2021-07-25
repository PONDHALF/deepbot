require('dotenv').config()
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

const queue = new Map();

module.exports = {
    name: 'play',
    aliases: ['p','skip', 's', 'stop', 'loop'],
    cooldown: 0,
    description: 'Advance music bot',
    async execute(message, args, cmd, client, Discord) {
        const voice_channel = message.member.voice.channel;
        if (!voice_channel) return message.channel.send('You need to be in a channel to execute this command!');
        const permissions = voice_channel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return message.channel.send('You dont have the correct permissions');
        if (!permissions.has('SPEAK')) return message.channel.send('You dont have the correct permissions');

        const server_queue = queue.get(message.guild.id);

        if (cmd === 'play' || cmd === 'p') {
            if (!args.length) return message.channel.send('You need to send the second argument');
            let song = {};
            
            if (ytdl.validateURL(args[0])) {
                const song_info = await ytdl.getInfo(args[0]);
                song = { title: song_info.videoDetails.title, url: song_info.videoDetails.video_url }
            } else {
                const video_finder = async (query) => {
                    const videoResult = await ytSearch(query);
                    return (videoResult.videos.length > 1) ? videoResult.videos[0] : null;
                }

                const video = await video_finder(args.join(' '));
                if (video) {
                    song = { title: video.title, url: video.url }
                } else {
                    message.channel.send('Error finding video.')
                }
            }

            if (!server_queue) {
                const queue_constructor = {
                    voice_channel: voice_channel,
                    text_channel: message.channel,
                    loop: false,
                    connection: null,
                    songs: []
                }
                queue.set(message.guild.id, queue_constructor);
                queue_constructor.songs.push(song);
                
                try {
                    const connection = await voice_channel.join();
                    queue_constructor.connection = connection;
                    video_player(message.guild, queue_constructor.songs[0]);
                } catch (err) {
                    queue.delete(message.guild.id);
                    message.channel.send('There was an error connection!');
                    throw err;
                }
            } else {
                server_queue.songs.push(song);
                return message.channel.send("👍🏼 **`${song.title}`** added to queue!".replace("${song.title}", `${song.title}`))
            }
        }

        else if (cmd === 'skip' || cmd === 's') {
            skip_song(message, server_queue);
        }
        else if (cmd === 'stop') {
            stop_song(message, server_queue);
            return message.channel.send("**Stopped!**");
        }
        else if (cmd === 'loop') {
            loop(message, server_queue);
        }
    }

}

const loop = (message, server_queue) => {
    if (!server_queue) return message.channel.send("❌ **I am not playing any music.** Type `{prefix}play` to play music".replace("{prefix}", process.env.PREFIX));
    if (server_queue.loop === false) {
        server_queue.loop = true;
        return message.channel.send("**🔂 Enabled!**");
    } else {
        server_queue.loop = false;
        return message.channel.send("**🔂 Disabled!**");
    }
}

const video_player = async (guild, song) => {
    const song_queue = queue.get(guild.id);

    if (!song) {
        song_queue.voice_channel.leave();
        queue.delete(guild.id);
        return;
    }

    const stream = ytdl(song.url, { filter: 'audioonly' });
    song_queue.connection.play(stream, { seek: 0, volume: 0.5 })
    .on('finish', () => {
        if (song_queue.loop === false) {
            song_queue.songs.shift();
            video_player(guild, song_queue.songs[0]);
        } else {
            video_player(guild, song_queue.songs[0]);
        }
    });
    await song_queue.text_channel.send("📣 Now playing **`${song.title}`**".replace("${song.title}", `${song.title}`))
}

const skip_song = (message, server_queue) => {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a channel to execute this command!');
    if (!server_queue) {
        return message.channel.send(`**There are no songs in queue** 😔`)
    }
    if (server_queue.loop === false) {
        if (server_queue.connection.dispatcher !== null) {
            server_queue.connection.dispatcher.end();
            return message.channel.send("**Skipped the song!**");
        } else {
            stop_song(message, server_queue);
            return message.channel.send("**Somethins was wrong!**");
        }
    } else {
        server_queue.songs.shift();
        message.channel.send("**Skipped the song!**");
        video_player(message.guild, server_queue.songs[0]);
    }
}

const stop_song = (message, server_queue) => {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a channel to execute this command!');
    server_queue.songs = [];
    if (server_queue.connection.dispatcher !== null) {
        server_queue.connection.dispatcher.end();
    }
}
