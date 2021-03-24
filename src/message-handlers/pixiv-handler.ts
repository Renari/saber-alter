import pixiv from '../pixiv';
import Discord from 'discord.js';
import messageHandler from './message-handler';
import SaberAlter from '../index';

export default class pixivHandler extends messageHandler {
  private readonly pixivClient: pixiv;

  constructor(discordClient: Discord.Client) {
    super();
    this.pixivClient = new pixiv();

    // bind to update event handler to check for embeds
    discordClient.on('messageUpdate', pixivHandler.updateHandler);
  }

  /**
   * Called when a message gets updated, used to check if an embed was added.
   * @param oldMessage the message before being updated
   * @param newMessage the updated message
   */
  private static updateHandler(
    oldMessage: Discord.Message | Discord.PartialMessage,
    newMessage: Discord.Message | Discord.PartialMessage,
  ): void {
    if (newMessage.partial) {
      newMessage
        .fetch()
        .then((fullMessage) => {
          pixivHandler.embedChecker(fullMessage);
        })
        .catch(SaberAlter.log.error);
    } else {
      pixivHandler.embedChecker(newMessage);
    }
  }

  /**
   * Checks if a message has a pixiv link and an embed, if so disables embeds on the message.
   * @param message the message to be checked
   */
  private static embedChecker(message: Discord.Message): void {
    if (message.embeds.length) {
      // this message contains a pixiv link and a embed, so remove the embed
      const match = message.content.match(
        /https?:\/\/(?:www\.)?pixiv.net\/(?:\w+\/)*artworks\/(\d+)/gi,
      );
      if (match) {
        message.suppressEmbeds().catch((err) => SaberAlter.log.error(err));
      }
    }
  }

  handle(message: Discord.Message): void {
    const pixivIllustMatches = this.match(message.content);
    if (pixivIllustMatches.length > 0 && message.embeds.length) {
      /**
       * if this message is in discords cache the embed will be attached already
       * if it is not in discords cache it'll get added by a messageUpdate call
       */
      message.suppressEmbeds().catch(SaberAlter.log.error);
    }
    pixivIllustMatches.forEach((match) => {
      this.pixivClient
        .getImageDetail(parseInt(match[1]))
        .then((imageMetadata) => {
          const imageUrl = imageMetadata.illust.imageUrls.large
            ? imageMetadata.illust.imageUrls.large
            : imageMetadata.illust.imageUrls.medium;
          const extensionMatch = imageUrl.match(/\.[0-9a-z]+$/i);
          if (extensionMatch === null || extensionMatch.length !== 1)
            throw 'Failed to get extension for url ' + imageUrl;
          const fileName = match[1] + extensionMatch[0];
          this.pixivClient.getImage(imageMetadata).then((imageData) => {
            return this.pixivClient.getAvatar(imageMetadata).then((avatar) => {
              const description = imageMetadata.illust.caption
                .replace(/<a[^>]*href=["|']([^"']*)[^>]*>([^<]+)<\/a>/gi, '[$2]($1)')
                .replace(/<br\s*\/?>/gi, '\n')
                .replace(/<strong>([^<]+)<\/strong>/gi, '**$1**');
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

  protected match(message: string): RegExpMatchArray[] {
    return [...message.matchAll(/https?:\/\/(?:www\.)?pixiv.net\/(?:\w+\/)*artworks\/(\d+)/gi)];
  }
}
