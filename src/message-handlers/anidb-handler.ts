import anidb from '../anidb';
import Discord, { EmbedBuilder } from 'discord.js';
import messageHandler from './message-handler';
import SaberAlter from '../index';

export default class anidbHandler extends messageHandler {
  private readonly anidbClient: anidb;

  constructor() {
    super();
    this.anidbClient = new anidb();
  }

  private static formatDiscordMessage(message: string): string {
    // escape all markdown symbols
    message = message.replace(/([*`_~>])/gm, '\\$1');
    // replace anidb syntax with markdown link syntax
    message = message.replace(/(https?:\/\/(?:www\.)?anidb\.net\/\S+) \[(.+?(?=]))]/gm, '[$2]($1)');
    // italics [i] [/i] to *
    message = message.replace(/\[\/?i]/gm, '*');
    return message;
  }

  handle(message: Discord.Message): void {
    const anidbAnimeMatches = this.match(message.content);
    anidbAnimeMatches.forEach((match) => {
      this.anidbClient
        .getShowData(match[1])
        .then((data) => {
          const embed = new EmbedBuilder()
            .setTitle(data.anime.titles[0].title[0]._)
            .setAuthor({
              name: data.anime.url[0],
              url: data.anime.url[0],
              iconURL: 'https://cdn.anidb.net/css/icons/touch/favicon-32x32.png',
            })
            .setDescription(anidbHandler.formatDiscordMessage(data.anime.description[0]))
            .setThumbnail('https://cdn.anidb.net/images/main/' + data.anime.picture)
            .setURL(match[0])
            .addFields({
              name: 'Episodes',
              value: data.anime.episodecount[0],
            });
          return message.reply({
            embeds: [embed],
            allowedMentions: { repliedUser: false },
          });
        })
        .catch(SaberAlter.log.error);
    });
  }

  protected match(message: string): RegExpMatchArray[] {
    return [...message.matchAll(/https?:\/\/(?:www\.)?anidb\.net\/a(?:nime\/)?(\d+)/gi)];
  }
}
