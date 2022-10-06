import Database from 'better-sqlite3';
import Discord, { ClientOptions, GatewayIntentBits } from 'discord.js';
import logger from './logger';

// message handlers
import anidbHandler from './message-handlers/anidb-handler';
import messageHandler from './message-handlers/message-handler';
import roleHandler from './command-handlers/role-handler';

export default class SaberAlter {
  public readonly datastore: Database.Database = new Database('database.db', {});
  public readonly discordClient: Discord.Client = new Discord.Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMessageReactions,
    ],
  } as ClientOptions);

  private readonly messageHandlers: messageHandler[] = [];

  public static readonly log = logger({
    timestamp: 'mm/dd/yy HH:MM:ss',
    debug: process.env.NODE_ENV !== 'production',
  });

  constructor() {
    this.discordClient.once('ready', () => this.ready());

    // connect to discord
    if (process.env.DISCORD_TOKEN) {
      this.discordClient.login(process.env.DISCORD_TOKEN).catch(SaberAlter.log.error);
    }
  }

  private ready(): void {
    SaberAlter.log.info('discord connection successful');

    // which message handlers we're loading
    this.messageHandlers.push(new anidbHandler());

    // which command handlers we're loading
    this.discordClient.guilds.fetch().then((guilds) => {
      for (const [, oAuthGuild] of guilds) {
        oAuthGuild.fetch().then((guild) => {
          new roleHandler(this.discordClient, this.datastore, guild);
        });
      }
    });

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
