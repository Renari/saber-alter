import SaberAlter from '..';
import Discord from 'discord.js';

export default class notificationHandler {
  protected readonly discordClient: Discord.Client;
  private readonly discordGuildId: string = '645064566664855552';

  constructor(discordClient: Discord.Client) {
    this.discordClient = discordClient;
  }

  protected sendDiscordMessage(channelId: string, message: string): void {
    const guild = this.discordClient.guilds.cache.get(this.discordGuildId);
    const channel = guild?.channels.cache.get(channelId);
    if (channel?.type === 'GUILD_TEXT' || channel?.type === 'GUILD_NEWS') {
      (channel as Discord.TextChannel).send(message).catch(SaberAlter.log.error);
    } else {
      SaberAlter.log.error('Unable to find channel');
    }
  }
}
