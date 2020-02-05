import Discord, { Partialize } from 'discord.js';
import logger from './logger';
import nedb from 'nedb';
import path from 'path';

// message handlers
import anidbHandler from './message-handlers/anidb-handler';
import messageHandler from './message-handlers/message-handler';
import pixivHandler from './message-handlers/pixiv-handler';
import roleHandler from './message-handlers/role-handler';

export default class SaberAlter {
  private readonly discordClient: Discord.Client;
  private readonly messageHandlers: messageHandler[] = [];
  private readonly datastore: nedb;

  public static readonly log = logger({
    timestamp: 'mm/dd/yy HH:MM:ss',
    debug: process.env.NODE_ENV !== 'production',
  });

  constructor() {
    this.datastore = new nedb({
      filename: path.resolve('database.db'),
      autoload: true,
    });
    this.discordClient = new Discord.Client();

    this.discordClient.once('ready', () => this.ready());

    // connect to discord
    this.discordClient.login(process.env.DISCORD_TOKEN).catch(SaberAlter.log.error);
  }

  public static partialHandler<T extends { partial: false }, P extends Partialize<T>>(
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
    this.messageHandlers.push(new roleHandler(this.discordClient, this.datastore));

    this.discordClient.on('message', message =>
      SaberAlter.partialHandler<Discord.Message, Discord.PartialMessage>(
        message,
        this.messageHandler.bind(this),
      ),
    );

    // automatically assign the Phuzed Sekai role to new members
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

  private shutdown(code = 0): void {
    this.discordClient.destroy();
    process.exit(code);
  }
}

new SaberAlter();
