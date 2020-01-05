import Discord from 'discord.js';
import anidb from './anidb';
import logger from './logger';

export default class SaberAlter {
  private readonly anidbClient: anidb;
  private readonly discordClient: Discord.Client;

  public static readonly log = logger({
    timestamp: 'mm/dd/yy HH:MM:ss',
    debug: process.env.NODE_ENV !== 'production',
  });

  private static formatDiscordMessage(message: string): string {
    // escape all markdown symbols
    message = message.replace(/([*`_~>])/gm, '\\$1');
    // replace anidb syntax with markdown link syntax
    message = message.replace(/(https?:\/\/(?:www\.)?anidb\.net\/\S+) \[(.+?(?=]))]/gm, '[$2]($1)');
    // italics [i] [/i] to *
    message = message.replace(/\[\/?i]/gm, '*');
    return message;
  }

  constructor() {
    this.discordClient = new Discord.Client();
    this.anidbClient = new anidb();

    this.discordClient.once('ready', () => this.ready());

    // connect to discord
    this.discordClient.login(process.env.DISCORD_TOKEN).catch(err => {
      SaberAlter.log.error(err);
    });
  }

  private ready(): void {
    SaberAlter.log.info('discord connection successful');
    this.discordClient.on('message', message => this.messageHandler(message));
  }

  private messageHandler(message: Discord.Message): void {
    const matches = [
      ...message.content.matchAll(/https?:\/\/(?:www\.)?anidb\.net\/a(?:nime\/)?(\d+)/gi),
    ];
    matches.forEach(match => {
      this.anidbClient
        .getShowData(match[1])
        .then(data => {
          const embed = new Discord.RichEmbed();
          embed.setTitle(data.anime.titles[0].title[0]._);
          embed.setAuthor(
            data.anime.url[0],
            'https://cdn.anidb.net/css/icons/touch/favicon-32x32.png',
            data.anime.url[0],
          );
          embed.setDescription(SaberAlter.formatDiscordMessage(data.anime.description[0]));
          embed.setThumbnail('https://cdn.anidb.net/images/main/' + data.anime.picture);
          embed.setURL(match[0]);
          embed.addField('Episodes', data.anime.episodecount[0]);
          return message.channel.send(embed);
        })
        .catch(err => {
          SaberAlter.log.error(err);
        });
    });
  }
}

new SaberAlter();
