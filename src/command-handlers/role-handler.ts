import Discord, {
  APIApplicationCommandOptionChoice,
  ChatInputCommandInteraction,
  PermissionsBitField,
} from 'discord.js';
import { Database } from 'better-sqlite3';
import SaberAlter from '../index';
import { SlashCommandBuilder } from '@discordjs/builders';

interface role {
  name: string;
}

interface databaseRole extends role {
  guild: string;
}

export default class roleHandler {
  private readonly discordClient: Discord.Client;
  private readonly database: Database;
  private readonly dbTableName: string = 'roles';
  private readonly guild: Discord.Guild;

  constructor(discordClient: Discord.Client, database: Database, guild: Discord.Guild) {
    // make sure our database table exists
    // table does not exist so create it
    database
      .prepare(
        `CREATE TABLE IF NOT EXISTS ${this.dbTableName}
         (
             guild
             TEXT
             NOT
             NULL,
             name
             TEXT
             NOT
             NULL
         );`,
      )
      .run();

    this.discordClient = discordClient;
    this.database = database;
    this.guild = guild;

    this.discordClient.on('interactionCreate', this.interactionCreate.bind(this));

    this.registerCommands();
  }

  private interactionCreate(interaction: Discord.Interaction) {
    if (!interaction.isCommand() || this.guild !== interaction.guild) return;
    interaction = interaction as ChatInputCommandInteraction;

    switch (interaction.commandName) {
      case 'addrole': {
        const roleName = interaction.options.getString('role');
        let icon = interaction.options.getString('icon');
        if (icon !== null) {
          icon = icon.split(':')[2];
          icon = icon.substring(0, icon.length - 1);
          icon = `https://cdn.discordapp.com/emojis/${icon}.webp?quality=lossless`;
        }
        if (roleName) {
          this.upsertRole(roleName);
          this.guild.roles
            .create({
              name: roleName,
              mentionable: true,
              icon,
            })
            .catch(SaberAlter.log.error);
          this.registerCommands();
          interaction
            .reply({ content: 'Role Created', ephemeral: true })
            .catch(SaberAlter.log.error);
        } else {
          interaction
            .reply({ content: 'Please enter a valid role name.', ephemeral: true })
            .catch(SaberAlter.log.error);
        }
        break;
      }
      case 'removerole': {
        const roleName = interaction.options.getString('role');
        if (roleName) {
          this.deleteRole(roleName);
          interaction
            .reply({ content: 'Role removed.', ephemeral: true })
            .catch(SaberAlter.log.error);
          this.registerCommands();
        } else {
          interaction
            .reply({ content: 'Please provide a valid role name.', ephemeral: true })
            .catch(SaberAlter.log.error);
        }
        break;
      }
      case 'join': {
        const roleName = interaction.options.getString('role');
        if (!roleName) {
          interaction
            .reply({ content: 'Please provide a valid role name.', ephemeral: true })
            .catch(SaberAlter.log.error);
          return;
        }
        this.findRole(roleName).then((role) => {
          if (!role) {
            (interaction as ChatInputCommandInteraction)
              .reply({ content: 'That role does not exist or is not join-able.', ephemeral: true })
              .catch(SaberAlter.log.error);
            return;
          }
          this.guild.members.fetch(interaction.user).then((guildMember) => {
            const discordRole = this.getDiscordRole(role.name);
            if (discordRole) {
              guildMember.roles.add(discordRole).catch(SaberAlter.log.error);
              (interaction as ChatInputCommandInteraction)
                .reply({ content: `You've joined ${role.name}.`, ephemeral: true })
                .catch(SaberAlter.log.error);
            } else {
              // role was manually deleted?
              this.deleteRole(role.name);
              (interaction as ChatInputCommandInteraction)
                .reply({ content: `${role.name} doesn't exist anymore.`, ephemeral: true })
                .catch(SaberAlter.log.error);
            }
          });
        });
        break;
      }
      case 'leave': {
        const roleName = interaction.options.getString('role');
        if (!roleName) {
          interaction
            .reply({ content: 'Please provide a valid role name.', ephemeral: true })
            .catch(SaberAlter.log.error);
          return;
        }
        this.findRole(roleName).then((role) => {
          if (!role) {
            (interaction as ChatInputCommandInteraction)
              .reply({ content: 'That role does not exist or cannot be left.', ephemeral: true })
              .catch(SaberAlter.log.error);
            return;
          }
          this.guild.members.fetch(interaction.user).then((guildMember) => {
            const discordRole = this.getDiscordRole(role.name);
            if (discordRole) {
              guildMember.roles.remove(discordRole).catch(SaberAlter.log.error);
              (interaction as ChatInputCommandInteraction)
                .reply({ content: `You've left ${role.name}.`, ephemeral: true })
                .catch(SaberAlter.log.error);
            } else {
              // role was manually deleted?
              this.deleteRole(role.name);
              (interaction as ChatInputCommandInteraction)
                .reply({ content: `${role.name} doesn't exist anymore.`, ephemeral: true })
                .catch(SaberAlter.log.error);
            }
          });
        });
        break;
      }
      default:
        SaberAlter.log.info(interaction.commandName);
    }
  }

  public findRole(name: string): Promise<role | null> {
    return new Promise<role>((resolve, reject) => {
      const row = this.database
        .prepare(`SELECT * FROM ${this.dbTableName} WHERE name = ? AND guild = ?;`)
        .get(name, this.guild.id) as databaseRole;
      if (row !== undefined && row !== null) {
        resolve(row);
      } else {
        reject(`Could not find role ${name}`);
      }
    });
  }

  public getRoles(): Promise<role[]> {
    return new Promise<role[]>((resolve) => {
      const rows = this.database
        .prepare(`SELECT name FROM ${this.dbTableName} WHERE guild = ? ORDER BY name ASC`)
        .all(this.guild.id) as role[];

      resolve(rows);
    });
  }

  private upsertRole(name: string): void {
    this.database
      .prepare(`UPDATE ${this.dbTableName} SET guild = ?, name = ? WHERE guild = ? AND name = ?;`)
      .run(this.guild.id, name, this.guild.id, name);
    this.database
      .prepare(
        `INSERT INTO ${this.dbTableName} (guild, name) SELECT ?, ? WHERE (SELECT Changes() = 0)`,
      )
      .run(this.guild.id, name);
  }

  private deleteRole(name: string): void {
    this.getDiscordRole(name)?.delete().catch(SaberAlter.log.error);
    this.database
      .prepare(`DELETE FROM ${this.dbTableName} WHERE guild = ? AND name = ?`)
      .run(this.guild.id, name);
  }

  private getDiscordRole(name: string): Discord.Role | undefined {
    return this.guild.roles.cache
      .filter((role) => {
        return role.name.toLowerCase() === name.toLowerCase();
      })
      .first();
  }

  private registerCommands() {
    this.getRoles().then((roles) => {
      const roleChoices: APIApplicationCommandOptionChoice<string>[] = [];
      for (const role of roles) {
        roleChoices.push({
          name: role.name,
          value: role.name,
        });
      }
      // join command
      this.guild.commands
        .create(
          new SlashCommandBuilder()
            .setName('join')
            .setDescription('Join a role.')
            .addStringOption((option) => {
              return option
                .setName('role')
                .setDescription('Which role would you like to join?')
                .addChoices(...roleChoices)
                .setRequired(true);
            })
            .toJSON(),
        )
        .catch(SaberAlter.log.error);

      // leave command
      this.guild.commands
        .create(
          new SlashCommandBuilder()
            .setName('leave')
            .setDescription('Leave a role.')
            .addStringOption((option) => {
              return option
                .setName('role')
                .setDescription('Which role would you like to leave?')
                .addChoices(...roleChoices)
                .setRequired(true);
            })
            .toJSON(),
        )
        .catch(SaberAlter.log.error);

      // roleremove command
      this.guild.commands
        .create(
          new SlashCommandBuilder()
            .setName('removerole')
            .setDescription('Remove a joinable role.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
            .addStringOption((option) => {
              return option
                .setName('role')
                .setDescription('Which role would you like to remove?')
                .addChoices(...roleChoices)
                .setRequired(true);
            })
            .toJSON(),
        )
        .catch(SaberAlter.log.error);

      // roleadd command
      this.guild.commands
        .create(
          new SlashCommandBuilder()
            .setName('addrole')
            .setDescription('Add a joinable role.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
            .addStringOption((option) => {
              return option
                .setName('role')
                .setDescription('Which role would you like to add?')
                .setRequired(true);
            })
            // requires server boosts to function
            // .addStringOption((option) => {
            //   return option
            //     .setName('icon')
            //     .setDescription('Which icon should be used for this role?');
            // })
            .toJSON(),
        )
        .catch(SaberAlter.log.error);
    });
  }
}
