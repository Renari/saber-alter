import Discord from 'discord.js';

export default abstract class messageHandler {
  protected abstract match(message: string): RegExpMatchArray[];
  public abstract handle(message: Discord.Message): void;
}
