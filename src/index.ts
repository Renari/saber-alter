import Discord from 'discord.js';
import anidb from './anidb';
import logger from './logger';

export default class SaberAlter {
  public static readonly log = logger({
    timestamp: 'HH:MM:ss',
    debug: process.env.NODE_ENV !== 'production',
  });

  private static escapeDiscordMessage(message: string): string {
    // escape all markdown symbols
    message = message.replace(/([*`_~>])/gm, '\\$1');
    // replace anidb syntax with markdown link syntax
    message = message.replace(
      /(https?:\/\/(?:www\.)?anidb\.net\/\S+) \[((?:\w+\s?)*)]/gm,
      '[$2]($1)',
    );
    return message;
  }

  constructor() {
    const client = new Discord.Client();
    const anidbClient = new anidb();

    client.once('ready', () => {
      SaberAlter.log.info('discord connection successful');
      client.on('message', message => {
        const match = message.content.match(/https?:\/\/(?:www\.)?anidb\.net\/anime\/(\d+)/);
        if (match) {
          anidbClient
            .getShowData(match[1])
            .then(data => {
              const embed = new Discord.RichEmbed();
              embed.setTitle(data.anime.titles[0].title[0]._);
              embed.setDescription(
                '**Episodes:** ' +
                  data.anime.episodecount[0] +
                  '\n' +
                  '**Description:** \n' +
                  '>>> ' +
                  SaberAlter.escapeDiscordMessage(data.anime.description[0]),
              );
              embed.setThumbnail('https://cdn.anidb.net/images/main/' + data.anime.picture);
              embed.setURL(data.anime.url[0]);
              return message.channel.send(embed);
            })
            .catch(err => {
              SaberAlter.log.error(err);
            });
        }
      });
    });

    client.login(process.env.DISCORD_TOKEN).catch(err => {
      SaberAlter.log.error(err);
    });
  }
}

new SaberAlter();
