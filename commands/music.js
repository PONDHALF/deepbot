require('dotenv').config()
const ytdl = require('ytdl-core');
const ytSearch = require('yt-search');

// Playlist
const ytpl = require('ytpl');

const queue = new Map();

var axios = require("axios").default;

module.exports = {
    name: 'play',
    aliases: ['p','skip', 's', 'stop', 'loop', 'lyrics', 'queue', 'remove', 'loopqueue'],
    cooldown: 0,
    description: 'Advance music bot',
    async execute(message, args, cmd, client, Discord) {
        const voice_channel = message.member.voice.channel;
        const IsSameChannel = client.voice.connections.some(
            (connection) => connection.channel.id === voice_channel.id
        )
        if (!voice_channel) return message.channel.send('You need to be in a channel to execute this command!');
        const permissions = voice_channel.permissionsFor(message.client.user);
        if (!permissions.has('CONNECT')) return message.channel.send('You dont have the correct permissions');
        if (!permissions.has('SPEAK')) return message.channel.send('You dont have the correct permissions');

        const server_queue = queue.get(message.guild.id);
        
        client.on('voiceStateUpdate', (state) => {

            if (state.member.id === client.user.id) {
                if (!state.member.voice.channel) {
                    
                    queue.delete(message.guild.id);
                } 
            }
        }); 

        if (cmd === 'play' || cmd === 'p') {
            if (!args.length) return message.channel.send('You need to send the second argument');
            let song = {};
            let list = [];

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
                    const playlist = await ytpl(args[0].replace("https://www.youtube.com/playlist?list=", ""));
                    if (playlist) {
                        for (let i = 0; i<playlist.items.length; i++) {
                            song = { title: playlist.items[i]['title'], url: playlist.items[i]['url'] };
                            list.push(song);
                        }
                    } else {
                        message.channel.send('Error finding video.')
                        return;
                    }
                }
            }

            if (!server_queue) {
                const queue_constructor = {
                    voice_channel: voice_channel,
                    text_channel: message.channel,
                    loop: false,
                    loopqueue: false,
                    connection: null,
                    songs: []
                }
                queue.set(message.guild.id, queue_constructor);
                if (list.length === 0) {
                    queue_constructor.songs.push(song);
                } else {
                    for (let i = 0; i < list.length; i++) {
                        queue_constructor.songs.push(list[i]);
                    }
                    message.channel.send("👍🏼 **Playlist** will play!");
                }

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
                if (list.length > 0) {
                    for (let i = 0; i < list.length; i++) {
                       server_queue.songs.push(list[i]);
                    }
                    return message.channel.send("👍🏼 **Playlist** has added to queue!");
                }
                server_queue.songs.push(song);
                return message.channel.send("👍🏼 **`${song.title}`** added to queue!".replace("${song.title}", `${song.title}`))
            }
        }

        else if (cmd === 'skip' || cmd === 's') {
            if (!IsSameChannel) return message.channel.send("❌ **You aren't connected to the same voice channel as I am.**");
            skip_song(message, server_queue);
        }
        else if (cmd === 'stop') {
            if (!IsSameChannel) return message.channel.send("❌ **You aren't connected to the same voice channel as I am.**");
            if (!message.member.voice.channel) return message.channel.send('You need to be in a channel to execute this command!');
            if (!server_queue || !server_queue.songs) return message.channel.send("❌ **I am not playing any music.** Type `{prefix}play` to play music".replace("{prefix}", process.env.PREFIX));
            server_queue.connection.dispatcher.end();
            server_queue.voice_channel.leave();
            queue.delete(message.guild.id);
            return message.channel.send("**Stopped!**");
        }
        else if (cmd === 'loop') {
            if (!IsSameChannel) return message.channel.send("❌ **You aren't connected to the same voice channel as I am.**");
            loop(message, server_queue);
        }
        else if (cmd === 'loopqueue') {
            if (!IsSameChannel) return message.channel.send("❌ **You aren't connected to the same voice channel as I am.**");
            loopqueue(message, server_queue);
        }
        else if (cmd == 'lyrics') {
            if (!IsSameChannel) return message.channel.send("❌ **You aren't connected to the same voice channel as I am.**");
            perform_lyrics(message, server_queue, Discord);
        }
        else if (cmd === 'remove') {
            if (!IsSameChannel) return message.channel.send("❌ **You aren't connected to the same voice channel as I am.**");
            if (!server_queue) return message.channel.send("❌ **I am not playing any music.** Type `{prefix}play` to play music".replace("{prefix}", process.env.PREFIX));
            if (!args.length) return message.channel.send('❌ Type: `{prefix}remove [index / indices]`\n✅ Example: `{prefix}remove 1`'.replace("{prefix}", process.env.PREFIX).replace("{prefix}", process.env.PREFIX));
            if (isNaN(args[0])) message.channel.send('❌ Type: `{prefix}remove [index / indices]`\n✅ Example: `{prefix}remove 1`'.replace("{prefix}", process.env.PREFIX).replace("{prefix}", process.env.PREFIX));
            remove(message, server_queue, parseInt(args[0]));
        }
        else if (cmd === 'queue') {
            if (!server_queue) return message.channel.send("❌ **I am not playing any music.** Type `{prefix}play` to play music".replace("{prefix}", process.env.PREFIX));
            let pages = [];
            let page = 1;
            let songs_page = [];
        
            for (let i = 0; i < server_queue.songs.length; i++) {
                if (server_queue.songs.length === 1) {
                    songs_page.push("**Playing:**" + " " + i + ")" + " " + server_queue.songs[i]['title'] + "\n");
                    pages.push(songs_page);
                    break;
                } 
                if (i === 0) {
                    songs_page.push("**Playing:**" + " " + i + ")" + " " + server_queue.songs[i]['title'] + "\n");
                    continue;
                } 
                songs_page.push(i + ")" + " " + server_queue.songs[i]['title']);

                if (server_queue.songs.length > 5) {
                    if (songs_page.length === 5) {
                        pages.push(songs_page);
                        songs_page = []
                    } 
                } 
                else {
                    pages.push(songs_page);
                    songs_page = []
                    break;
                }
            }
            // ❌ ✅
            let embed;

            if (server_queue.loop === false
            && server_queue.loopqueue === false) {
                embed = new Discord.MessageEmbed()
                    .setTitle("**Queue Songs**")
                    .setColor(0xffffff)
                    .setFooter(`Page ${page}/${pages.length} | Loop: ❌ | Queue Loop: ❌`)
                    .setDescription(pages[page-1])
            }
            else if (server_queue.loop === true && server_queue.loopqueue === false) {
                embed = new Discord.MessageEmbed()
                    .setTitle("**Queue Songs**")
                    .setColor(0xffffff)
                    .setFooter(`Page ${page}/${pages.length} | Loop: ✅ | Queue Loop: ❌`)
                    .setDescription(pages[page-1])
            }
            else if (server_queue.loop === false && server_queue.loopqueue === true) {
                embed = new Discord.MessageEmbed()
                    .setTitle("**Queue Songs**")
                    .setColor(0xffffff)
                    .setFooter(`Page ${page}/${pages.length} | Loop: ❌ | Queue Loop: ✅`)
                    .setDescription(pages[page-1])
            }
            
            message.channel.send(embed).then(msg => {
                msg.react('⏪').then(r => {
                    msg.react('⏩')
        
                    // Filters
                    const BackwardFilter = (reaction, user) => reaction.emoji.name === '⏪' && user.id === message.author.id;
                    const ForwardFilter = (reaction, user) => reaction.emoji.name === '⏩' && user.id === message.author.id;
        
                    const backwards = msg.createReactionCollector(BackwardFilter, { time: 60000 });
                    const forwards = msg.createReactionCollector(ForwardFilter, { time: 60000 });
        
                    backwards.on('collect', r => {
                        if (page === 1) return;
                        page--;
                        embed.setDescription(pages[page-1]);
                        if (server_queue.loop === false && server_queue.loopqueue === false) {
                            embed.setFooter(`Page ${page}/${pages.length} | Loop: ❌ | Queue Loop: ❌`);
                        } 
                        else if (server_queue.loop === true && server_queue.loopqueue === false) {
                            embed.setFooter(`Page ${page}/${pages.length} | Loop: ✅ | Queue Loop: ❌`);
                        }
                        else if (server_queue.loop === false && server_queue.loopqueue === true) {
                            embed.setFooter(`Page ${page}/${pages.length} | Loop: ❌ | Queue Loop: ✅`);
                        }

                        msg.edit(embed);
                    })
        
                    forwards.on('collect', r => {
                        if (page === pages.length) return;
                        page++;
                        embed.setDescription(pages[page-1]);
                        if (server_queue.loop === false && server_queue.loopqueue === false) {
                            embed.setFooter(`Page ${page}/${pages.length} | Loop: ❌ | Queue Loop: ❌`);
                        } 
                        else if (server_queue.loop === true && server_queue.loopqueue === false) {
                            embed.setFooter(`Page ${page}/${pages.length} | Loop: ✅ | Queue Loop: ❌`);
                        }
                        else if (server_queue.loop === false && server_queue.loopqueue === true) {
                            embed.setFooter(`Page ${page}/${pages.length} | Loop: ❌ | Queue Loop: ✅`);
                        }
                        msg.edit(embed);
                    })
                })
            })
        }
    }

}

const remove = (message, server_queue, arg) => {
    if (arg > server_queue.songs.length) {
        message.channel.send('❌ Not found!');
        return;
    }
    if (arg < 0) {
        message.channel.send('❌ Not found!');
        return;
    }
    if (arg === 0) {
        message.channel.send("👍🏼 **Removed**" + " " + "`" + server_queue.songs[arg]['title'] + "`");
        server_queue.connection.dispatcher.end();
        return;
    }
    message.channel.send("👍🏼 **Removed**" + " " + "`" + server_queue.songs[arg]['title'] + "`");
    server_queue.songs.splice(arg, 1);
}

const loop = (message, server_queue) => {
    if (!server_queue) return message.channel.send("❌ **I am not playing any music.** Type `{prefix}play` to play music".replace("{prefix}", process.env.PREFIX));
    if (server_queue.loop === false) {
        server_queue.loop = true;
        server_queue.loopqueue = false;
        return message.channel.send("**🔂 Enabled!**");
    } else {
        server_queue.loop = false;
        server_queue.loopqueue = false;
        return message.channel.send("**🔂 Disabled!**");
    }
}

const loopqueue = (message, server_queue) => {
    if (!server_queue) return message.channel.send("❌ **I am not playing any music.** Type `{prefix}play` to play music".replace("{prefix}", process.env.PREFIX));
    if (server_queue.songs.length <= 1) return message.channel.send("❌ **Add song to queue!** I need more songs to loop queue"); 
    if (server_queue.loopqueue === false) {
        server_queue.loopqueue = true;
        server_queue.loop = false;
        return message.channel.send("**🔂 Queue Enabled!**");
    } else {
        server_queue.loopqueue = false;
        server_queue.loop = false;
        return message.channel.send("**🔂 Queue Disabled!**");
    } 
}

const video_player = async (guild, song) => {
    const song_queue = queue.get(guild.id);

    if (!song) {
        queue.delete(guild.id);
        setTimeout(function() {
            let now_song = queue.get(guild.id);
            if (!(now_song)) {
                song_queue.voice_channel.leave();
                return;
            } else {
                return;
            }
        }, 1000 * 60);
        return;
    }

    const stream = ytdl(song.url, { filter: 'audioonly' });
    song_queue.connection.play(stream, { seek: 0, volume: 0.5 })
    .on('finish', () => {
        if (song_queue.loop === false && song_queue.loopqueue === false) {
            song_queue.songs.shift();
            video_player(guild, song_queue.songs[0]);
        } else {
            if (song_queue.loop === true) {
                video_player(guild, song_queue.songs[0]);
            }
            if (song_queue.loopqueue === true) {
                song_queue.songs.push(song_queue.songs.shift());
                video_player(guild, song_queue.songs[0]);
            }
        }
    });
    song_queue.connection.on('disconnect', () => {
        song_queue.text_channel.send("👋 **Good bye**");
        queue.delete(guild.id);
    })
    await song_queue.text_channel.send("📣 Now playing **`${song.title}`**".replace("${song.title}", `${song.title}`))
}

const skip_song = (message, server_queue) => {
    if (!message.member.voice.channel) return message.channel.send('You need to be in a channel to execute this command!');
    if (!server_queue) {
        return message.channel.send(`**There are no songs in queue** 😔`)
    }
    if (server_queue.loop === false && server_queue.loopqueue === false) {
        if (server_queue.connection.dispatcher !== null) {
            server_queue.connection.dispatcher.end();
            return message.channel.send("**Skipped the song!**");
        } else {
            server_queue.voice_channel.leave();
            queue.delete(message.guild.id);
            return message.channel.send("**Somethings was wrong!**");
        }
    } 
    else if (server_queue.loop === true) {   
        server_queue.songs.shift();
        message.channel.send("**Skipped the song!**");
        video_player(message.guild, server_queue.songs[0]);
    }
    else if (server_queue.loopqueue === true) {
        server_queue.songs.push(server_queue.songs.shift());
        message.channel.send("**Skipped the song!**");
        video_player(message.guild, server_queue.songs[0]);
    }
}

const perform_lyrics = (message, server_queue, Discord) => {
    if (!server_queue) return message.channel.send("❌ **I am not playing any music.** Type `{prefix}play` to play music".replace("{prefix}", process.env.PREFIX));

    const search = {
        method: 'GET',
        url: 'https://shazam.p.rapidapi.com/search',
        headers: {
            'x-rapidapi-host': 'shazam.p.rapidapi.com',
            'x-rapidapi-key': '7a67c3f121msh8d08e67ac97da5cp1a9f51jsnd8b55e0bdc4c'
        }
    };

    search.params = {term: server_queue.songs[0]['title']
        .replace("(Official Audio)", "")
        .replace("[Official Audio]", "")
        .replace("(Official Video)", "")
        .replace("[Official Video]", "")
        .replace("(Official Music Video)", "")
        .replace("[Official Music Video]", "")
        .replace(" (Official Audio)", "")
        .replace(" [Official Audio]", "")
        .replace(" (Official Video)", "")
        .replace(" [Official Video]", "")
        .replace(" (Official Music Video)", "")
        .replace(" [Official Music Video]", "")
        .replace("(Lyrics)", "")
        .replace("[Lyrics]", "")
        .replace(" (Lyrics)", "")
        .replace(" [Lyrics]", "")
        .replace("[Official MV]", "")
        .replace(" [Official MV]", "")
        .replace("(Official MV)", "")
        .replace(" (Official MV)", "")
        .replace("Official MV", "")
        .replace(" Official MV", "")
        , locale: 'en-US', offset: '0', limit: '1'};

    const lyrics = {
        method: 'GET',
        url: 'https://shazam.p.rapidapi.com/songs/get-details',
        headers: {
          'x-rapidapi-host': 'shazam.p.rapidapi.com',
          'x-rapidapi-key': '7a67c3f121msh8d08e67ac97da5cp1a9f51jsnd8b55e0bdc4c'
        }
    };

    axios.request(search).then(function (response) {

        lyrics.params = { key: response.data['tracks']['hits'][0]['track']['key'], locale: 'en-US' };
        
        axios.request(lyrics).then(function (res) {
            const lyrics_embed = new Discord.MessageEmbed()
                .setColor('#3B4281')
                .setTitle( response.data['tracks']['hits'][0]['track']['title'])
                .setDescription(res.data['sections'][1]['text'])
            /*for (let i = 0; i < res.data['sections'][1]['text'].length; i++) {
                message.channel.send(res.data['sections'][1]['text'][i]);
            }*/
            message.channel.send(lyrics_embed);
        }).catch(function (err) {
            message.channel.send("❌ **Don't have lyrics!**");
            console.error(err);
            return;
        });

    }).catch(function (error) {
        message.channel.send("❌ **Don't have lyrics!**");
        console.error(error);
        return;
    });

}
