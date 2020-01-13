import anidb from './anidb';
import Discord from 'discord.js';
import logger from './logger';
import pixiv from './pixiv';

export default class SaberAlter {
  private readonly anidbClient: anidb;
  private readonly discordClient: Discord.Client;
  private readonly pixivClient: pixiv;

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
    this.anidbClient = new anidb();
    this.discordClient = new Discord.Client();
    this.pixivClient = new pixiv();

    this.discordClient.once('ready', () => this.ready());

    // connect to discord
    this.discordClient.login(process.env.DISCORD_TOKEN).catch(SaberAlter.log.error);
  }

  private ready(): void {
    SaberAlter.log.info('discord connection successful');
    this.discordClient.on('message', message => {
      if (message.partial) {
        message
          .fetch()
          .then(fullMessage => {
            this.messageHandler(fullMessage);
          })
          .catch(err => SaberAlter.log.error(err));
      } else {
        this.messageHandler(message);
      }
    });

    this.discordClient.on('messageUpdate', (oldMessage, newMessage) => {
      if (newMessage.partial) {
        newMessage
          .fetch()
          .then(fullMessage => this.embedChecker(fullMessage))
          .catch(SaberAlter.log.error);
      } else {
        this.embedChecker(newMessage);
      }
    });
  }

  private embedChecker(message: Discord.Message): void {
    if (message.embeds.length) {
      // this message contains a pixiv link and a embed, so remove the embed
      const match = message.content.match(
        /https?:\/\/(?:www\.)?pixiv.net\/(?:\w+\/)*artworks\/(\d+)/gi,
      );
      if (match) {
        message.suppressEmbeds().catch(err => SaberAlter.log.error(err));
      }
    }
  }

  private messageHandler(message: Discord.Message): void {
    // ignore own messages
    if (this.discordClient.user && message.author.equals(this.discordClient.user)) return;
    /**
     * AniDB anime embed
     */
    const anidbAnimeMatches = [
      ...message.content.matchAll(/https?:\/\/(?:www\.)?anidb\.net\/a(?:nime\/)?(\d+)/gi),
    ];
    anidbAnimeMatches.forEach(match => {
      this.anidbClient
        .getShowData(match[1])
        .then(data => {
          const embed = new Discord.MessageEmbed()
            .setTitle(data.anime.titles[0].title[0]._)
            .setAuthor(
              data.anime.url[0],
              'https://cdn.anidb.net/css/icons/touch/favicon-32x32.png',
              data.anime.url[0],
            )
            .setDescription(SaberAlter.formatDiscordMessage(data.anime.description[0]))
            .setThumbnail('https://cdn.anidb.net/images/main/' + data.anime.picture)
            .setURL(match[0])
            .addField('Episodes', data.anime.episodecount[0]);
          return message.channel.send(embed);
        })
        .catch(SaberAlter.log.error);
    });
    /**
     * Pixiv Embeds
     */
    const pixivIllustMatches = [
      ...message.content.matchAll(/https?:\/\/(?:www\.)?pixiv.net\/(?:\w+\/)*artworks\/(\d+)/gi),
    ];
    if (pixivIllustMatches.length > 0 && message.embeds.length) {
      /**
       * if this message is in discords cache the embed will be attached already
       * if it is not in discords cache it'll get added by a messageUpdate call
       */
      message.suppressEmbeds().catch(SaberAlter.log.error);
    }
    pixivIllustMatches.forEach(match => {
      this.pixivClient
        .getImageDetail(parseInt(match[1]))
        .then(imageMetadata => {
          const imageUrl = imageMetadata.illust.imageUrls.large
            ? imageMetadata.illust.imageUrls.large
            : imageMetadata.illust.imageUrls.medium;
          const extensionMatch = imageUrl.match(/\.[0-9a-z]+$/i);
          if (extensionMatch === null || extensionMatch.length !== 1)
            throw 'Failed to get extension for url ' + imageUrl;
          const fileName = match[1] + extensionMatch[0];
          this.pixivClient.getImage(imageMetadata).then(imageData => {
            return this.pixivClient.getAvatar(imageMetadata).then(avatar => {
              const description = imageMetadata.illust.caption
                .replace(/<a[^>]*href=["|']([^"']*)[^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
                .replace(/<br\s*\/?>/gi, '\n');
              const embed = new Discord.MessageEmbed()
                .setTitle(imageMetadata.illust.title)
                .setDescription(description)
                .attachFiles([
                  new Discord.MessageAttachment(imageData, fileName),
                  new Discord.MessageAttachment(avatar, 'avatar.jpg'),
                ])
                .setAuthor('Pixiv', 'https://s.pximg.net/common/images/apple-touch-icon.png')
                .setImage('attachment://' + fileName)
                .setFooter(
                  imageMetadata.illust.user.name +
                    ' | ' +
                    (imageMetadata.illust.metaPages.length > 0
                      ? ' | 1 of ' + imageMetadata.illust.metaPages.length + ' images'
                      : ''),
                  'attachment://avatar.jpg',
                );
              return message.channel.send(embed);
            });
          });
        })
        .catch(SaberAlter.log.error);
    });
  }
}

new SaberAlter();
