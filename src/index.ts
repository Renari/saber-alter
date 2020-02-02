import anidbHandler from './message-handlers/anidb-handler';
import Discord from 'discord.js';
import logger from './logger';
import messageHandler from './message-handlers/message-handler';
import pixivHandler from './message-handlers/pixiv-handler';

export default class SaberAlter {
  private readonly discordClient: Discord.Client;
  private readonly messageHandlers: messageHandler[] = [];

  public static readonly log = logger({
    timestamp: 'mm/dd/yy HH:MM:ss',
    debug: process.env.NODE_ENV !== 'production',
  });

  constructor() {
    this.discordClient = new Discord.Client();

    this.discordClient.once('ready', () => this.ready());

    // connect to discord
    this.discordClient.login(process.env.DISCORD_TOKEN).catch(SaberAlter.log.error);
  }

  private static partialHandler(
    message: Discord.Message | Discord.PartialMessage,
    callback: (message: Discord.Message) => void,
  ): void {
    if (message.partial) {
      message
        .fetch()
        .then(callback)
        .catch(SaberAlter.log.error);
    } else {
      callback(message);
    }
  }

  private ready(): void {
    SaberAlter.log.info('discord connection successful');

    // which message handlers we're loading
    this.messageHandlers.push(new anidbHandler());
    this.messageHandlers.push(new pixivHandler(this.discordClient));

    this.discordClient.on('message', message =>
      SaberAlter.partialHandler(message, this.messageHandler),
    );
  }

  private messageHandler(message: Discord.Message): void {
    // ignore own messages
    if (this.discordClient.user && message.author.equals(this.discordClient.user)) return;
    // run the message through each message handler
    this.messageHandlers.forEach(handler => {
      handler.handle(message);
    });
  }
}

new SaberAlter();
