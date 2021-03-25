import Discord from 'discord.js';
import notificationHandler from './notification-handler';
import cron from 'node-cron';

export default class genshinNotification extends notificationHandler {
  constructor(discordClient: Discord.Client, channelId: string) {
    super(discordClient);
    cron.schedule(
      '0 12 * * 4',
      () => {
        this.sendDiscordMessage(
          channelId,
          "<@&674550059093983262> Don't forget to buy your arifacts today! (also bug Arimil to make this better)",
        );
      },
      {
        timezone: 'America/New_York',
      },
    );
  }
}
