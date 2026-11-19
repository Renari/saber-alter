import axios from 'axios';
import Discord from 'discord.js';
import messageHandler from './message-handler';
import SaberAlter from '../index';

// channel that receives the followed (crossposted) twitter news announcements
const relayChannelId = '1318623773838147588';

export default class twitterRelayHandler extends messageHandler {
  // webhook url including ?thread_id= so posts land in the forum post
  constructor(private readonly webhook: string) {
    super();
  }

  protected match(message: string): RegExpMatchArray[] {
    return [...message.matchAll(/https:\/\/x\.com/gm)];
  }

  handle(message: Discord.Message): void {
    if (message.channelId !== relayChannelId || !message.content) return;
    axios
      .post(this.webhook, {
        content: message.content.replace(/https:\/\/x\.com/gm, 'https://vxtwitter.com'),
      })
      .catch(SaberAlter.log.error);
  }
}
