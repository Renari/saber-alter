import anidb from './anidb';
import Discord from 'discord.js';
import * as gm from './graphicsmagick';
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
    this.discordClient.login(process.env.DISCORD_TOKEN).catch(err => {
      SaberAlter.log.error(err);
    });
  }

  private ready(): void {
    SaberAlter.log.info('discord connection successful');
    this.discordClient.on('message', message => this.messageHandler(message));
    this.discordClient.on('messageUpdate', message => this.embedChecker(message));
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
    if (message.author.equals(this.discordClient.user)) return;
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
    /**
     * Pixiv Embeds
     */
    const pixivIllustMatches = [
      ...message.content.matchAll(/https?:\/\/(?:www\.)?pixiv.net\/(?:\w+\/)*artworks\/(\d+)/gi),
    ];
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
          this.pixivClient
            .getImage(imageMetadata)
            .then(buffer => {
              // 8MB
              if (buffer.length > 8388608) {
                return gm
                  .scaleImageToSize(
                    buffer,
                    fileName,
                    imageMetadata.illust.width,
                    imageMetadata.illust.height,
                    8388608,
                  )
                  .then(buffer => {
                    return {
                      resized: true,
                      image: buffer,
                    };
                  });
              } else {
                return { resized: false, image: buffer };
              }
            })
            .then(imageData => {
              return this.pixivClient.getAvatar(imageMetadata).then(avatar => {
                const description = imageMetadata.illust.caption
                  .replace(/<a[^>]*href=["|']([^"']*)[^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
                  .replace(/<br\s*\/?>/gi, '\n');
                const embedFileName = imageData.resized ? match[0] + '.png' : fileName;
                const embed = new Discord.RichEmbed()
                  .setTitle(imageMetadata.illust.title)
                  .setDescription(description)
                  .attachFiles([
                    new Discord.Attachment(imageData.image, embedFileName),
                    new Discord.Attachment(avatar, 'avatar.jpg'),
                  ])
                  .setAuthor('Pixiv', 'https://s.pximg.net/common/images/apple-touch-icon.png')
                  .setImage('attachment://' + embedFileName)
                  .setFooter(
                    imageMetadata.illust.user.name +
                      ' | ' +
                      (imageData.resized ? 'Resized' : 'Original'),
                    'attachment://avatar.jpg',
                  );
                return message.channel.send(embed);
              });
            });
        })
        .catch(err => {
          SaberAlter.log.error(err);
        });
    });
  }
}

new SaberAlter();
