import Discord from 'discord.js';
import { Database } from 'better-sqlite3';
import messageHandler from './message-handler';
import SaberAlter from '../index';

interface role {
  name: string;
  emoji: string;
}

export default class roleHandler extends messageHandler {
  private readonly discordClient: Discord.Client;
  private readonly database: Database;
  private readonly dbTableName: string = 'roles';

  constructor(discordClient: Discord.Client, database: Database) {
    super();

    // make sure our database table exists
    // table does not exist so create it
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${this.dbTableName} (name TEXT NOT NULL, emoji TEXT NOT NULL);`,
      )
      .run();

    this.discordClient = discordClient;
    this.database = database;

    this.discordClient.on('messageReactionAdd', this.reactionHandler.bind(this));
  }

  public findRole(name: string): Promise<role | null> {
    return new Promise<role>((resolve, reject) => {
      const row = this.database
        .prepare(`SELECT * FROM ${this.dbTableName} WHERE name = ?;`)
        .get(name);
      if (row !== undefined) {
        resolve({
          name: row.name,
          emoji: row.emoji,
        });
      } else {
        reject(`Could not find role ${name}`);
      }
    });
  }

  public getRoles(): Promise<role[]> {
    return new Promise<role[]>((resolve) => {
      const rows = this.database.prepare(`SELECT name, emoji FROM ${this.dbTableName}`).all();

      const roles: role[] = [];
      for (const row of rows) {
        roles.push({
          name: row.name,
          emoji: row.emoji,
        });
      }
      resolve(roles);
    });
  }

  private reactionHandler(
    messageReaction: Discord.MessageReaction | Discord.PartialMessageReaction,
    user: Discord.User | Discord.PartialUser,
  ): void {
    if (messageReaction.message.guild === null) return; // ignore reactions in dm
    if (user.id === this.discordClient.user?.id) return; // ignore Saber's reactions

    const guild = messageReaction.message.guild;

    if (
      this.discordClient.user !== null &&
      // was this a reaction to one of Sabers messages
      this.discordClient.user.id === messageReaction.message.author?.id &&
      // was this a reaction placed by Saber
      messageReaction.users.cache.has(this.discordClient.user.id)
    ) {
      this.getRoles()
        .then((roles) => {
          for (const role of roles) {
            if (messageReaction.emoji === this.discordClient.emojis.cache.get(role.emoji)) {
              // get the discord role to apply
              const discordRole = this.getDiscordRole(guild, role.name);
              if (discordRole) {
                user.fetch().then((completeUser) => {
                  // give the user this role and remove their reaction
                  guild.members.fetch(completeUser).then((member) => {
                    if (member?.roles.cache.has(discordRole.id)) {
                      // if they already have the role remove it
                      member.roles.remove(discordRole).then(() => {
                        messageReaction.message.channel.send(
                          `<@${completeUser.id}> removed you from ${role.name}`,
                        );
                      });
                    } else {
                      // else give them the role
                      member?.roles.add(discordRole).then(() => {
                        messageReaction.message.channel.send(
                          `<@${completeUser.id}> added you to ${role.name}`,
                        );
                      });
                    }
                    // remove their reaction
                    messageReaction.users.remove(completeUser).catch(SaberAlter.log.error);
                  });
                });
              } else {
                // the role was deleted?
                this.deleteRole(guild, role.name);
                messageReaction.message.channel
                  .send('That role was deleted.')
                  .catch(SaberAlter.log.error);
              }
            }
          }
        })
        .catch(SaberAlter.log.error);
    }
  }

  private static isAdmin(user: Discord.GuildMember): boolean {
    return user.permissions.has(Discord.Permissions.FLAGS.ADMINISTRATOR);
  }

  private upsertRole(name: string, emoji: string): void {
    this.database
      .prepare(`UPDATE ${this.dbTableName} SET name = ?, emoji = ? WHERE name = ?;`)
      .run(name, emoji, name);
    this.database
      .prepare(
        `INSERT INTO ${this.dbTableName} (name, emoji) SELECT ?, ? WHERE (SELECT Changes() = 0)`,
      )
      .run(name, emoji);
  }

  private deleteRole(guild: Discord.Guild, name: string): void {
    this.getDiscordRole(guild, name)?.delete().catch(SaberAlter.log.error);
    this.database.prepare(`DELETE FROM ${this.dbTableName} WHERE name = ?`).run(name);
  }

  private getDiscordRole(guild: Discord.Guild, name: string): Discord.Role | undefined {
    return guild.roles.cache
      .filter((role) => {
        return role.name.toLowerCase() === name.toLowerCase();
      })
      .first();
  }

  private static parseArgs(command: string): string[] {
    const split = [...command.matchAll(/[^\s"']+|"([^"]*)"|'([^']*)'/g)];
    const args = [];
    for (const arg of split) {
      if (arg[1]) {
        // we had a quoted argument
        args.push(arg[1]);
      } else {
        // we had an unquoted parameter
        args.push(arg[0]);
      }
    }
    return args;
  }

  handle(message: Discord.Message): void {
    if (message.guild === null) return; // roles don't exist in dm
    const match = this.match(message.content);
    if (match.length !== 1) return;

    const guild = message.guild;
    const command = match[0][1];
    const args = match[0][2] ? roleHandler.parseArgs(match[0][2]) : '';

    switch (command) {
      case '!roles':
        this.getRoles()
          .then((roles) => {
            if (roles.length === 0) {
              message.channel.send('There are currently no roles.');
              return;
            }
            const roleEmoji: Discord.GuildEmoji[] = [];
            let roleMessage = '>>> ';
            for (const role of roles) {
              const emoji = this.discordClient.emojis.cache.get(role.emoji);
              if (emoji) {
                roleEmoji.push(emoji);
                roleMessage += `${emoji}: ${role.name}\n`;
              } else {
                message.channel.send(role.name + ' has an invalid emoji.');
                return;
              }
            }
            message.channel.send(roleMessage).then(async (roleMessage) => {
              for (const emoji of roleEmoji) {
                await roleMessage.react(emoji).catch(SaberAlter.log.error);
              }
            });
          })
          .catch(SaberAlter.log.error);
        break;
      case '!roleadd':
        if (message.member === null) return;
        else if (!roleHandler.isAdmin(message.member)) {
          message.channel
            .send("You don't seem strong enough for this command.")
            .catch(SaberAlter.log.error);
          return;
        } else if (args.length !== 2) {
          message.channel.send('Syntax: !roleadd <role> <emoji>').catch(SaberAlter.log.error);
          return;
        }
        // get the discord role instance
        const role = this.getDiscordRole(guild, args[0]);
        // role doesn't exist so create it
        if (!role) {
          guild.roles
            .create({
              name: args[0],
              mentionable: true,
            })
            .catch(SaberAlter.log.error);
        }
        // update the data in our data store
        this.upsertRole(args[0], args[1]);
        message.react('✅').catch(SaberAlter.log.error);
        break;
      case '!roleremove':
        if (args.length !== 1) {
          message.channel.send('Syntax: !roleremove <role>').catch(SaberAlter.log.error);
          return;
        }
        this.findRole(args[0])
          .then((role) => {
            if (role) {
              this.deleteRole(guild, role.name);
              message.react('✅');
            } else {
              message.channel.send("That role doesn't exist.");
            }
          })
          .catch(SaberAlter.log.error);
        break;
      default:
        SaberAlter.log.info('Unknown command: ' + command);
        break;
    }
  }

  protected match(message: string): RegExpMatchArray[] {
    const match = message.match(/^(!(?:(?:roleadd)|(?:roles)|(?:roleremove)))\s?(.+)?$/i);
    return match ? [match] : [];
  }
}
