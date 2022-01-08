import Discord, { ClientOptions, Intents } from 'discord.js';
import logger from './logger';
import Database from 'better-sqlite3';

// message handlers
import anidbHandler from './message-handlers/anidb-handler';
import messageHandler from './message-handlers/message-handler';
import roleHandler from './message-handlers/role-handler';

export default class SaberAlter {
  private readonly discordClient: Discord.Client;
  private readonly messageHandlers: messageHandler[] = [];
  private readonly datastore: Database.Database;

  public static readonly log = logger({
    timestamp: 'mm/dd/yy HH:MM:ss',
    debug: process.env.NODE_ENV !== 'production',
  });

  constructor() {
    this.datastore = new Database('database.db', {});
    this.discordClient = new Discord.Client({
      intents: [
        Intents.FLAGS.GUILDS,
        Intents.FLAGS.GUILD_MESSAGES,
        Intents.FLAGS.GUILD_MESSAGE_REACTIONS,
      ],
    } as ClientOptions);

    this.discordClient.once('ready', () => this.ready());

    // connect to discord
    this.discordClient.login(process.env.DISCORD_TOKEN).catch(SaberAlter.log.error);
  }

  private ready(): void {
    SaberAlter.log.info('discord connection successful');

    // which message handlers we're loading
    this.messageHandlers.push(new anidbHandler());
    this.messageHandlers.push(new roleHandler(this.discordClient, this.datastore));

    this.discordClient.on('messageCreate', this.messageHandler.bind(this));

    // automatically assign the Phuzed Sekai role to new members
    this.discordClient.on('guildMemberAdd', (member) => {
      const role = member.guild.roles.cache.find((role) => role.name === 'Phuzed Sekai');
      if (role) member.roles.add(role).catch(SaberAlter.log.error);
    });
  }

  private messageHandler(message: Discord.Message): void {
    // ignore own messages
    if (this.discordClient.user && message.author.equals(this.discordClient.user)) return;
    // run the message through each message handler
    this.messageHandlers.forEach((handler) => {
      handler.handle(message);
    });
  }

  private shutdown(code = 0): void {
    this.discordClient.destroy();
    process.exit(code);
  }
}

new SaberAlter();
