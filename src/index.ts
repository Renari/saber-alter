import anidbHandler from './message-handlers/anidb-handler';
import Discord, { Partialize } from 'discord.js';
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

  private static partialHandler<T extends { partial: false }, P extends Partialize<T>>(
    object: T | P,
    callback: (complete: T) => void,
  ): void {
    if (object.partial) {
      object
        .fetch()
        .then(callback)
        .catch(SaberAlter.log.error);
    } else {
      callback(object);
    }
  }

  private ready(): void {
    SaberAlter.log.info('discord connection successful');

    // which message handlers we're loading
    this.messageHandlers.push(new anidbHandler());
    this.messageHandlers.push(new pixivHandler(this.discordClient));

    this.discordClient.on('message', message =>
      SaberAlter.partialHandler<Discord.Message, Discord.PartialMessage>(
        message,
        this.messageHandler.bind(this),
      ),
    );
    this.discordClient.on('guildMemberAdd', member => {
      SaberAlter.partialHandler<Discord.GuildMember, Discord.PartialGuildMember>(member, member => {
        const role = member.guild.roles.find(role => role.name === 'Phuzed Sekai');
        if (role) member.roles.add(role).catch(SaberAlter.log.error);
      });
    });
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
