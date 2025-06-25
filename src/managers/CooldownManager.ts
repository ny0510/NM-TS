import {Collection, type Snowflake} from 'discord.js';
import {DateTime} from 'luxon';

export class CooldownManager {
  private readonly cooldowns: Collection<string, Collection<Snowflake, number>>;

  constructor() {
    this.cooldowns = new Collection();
  }

  public getCooldowns(): Collection<string, Collection<Snowflake, number>> {
    return this.cooldowns;
  }

  public checkCooldown(
    commandName: string,
    userId: Snowflake,
    cooldownSeconds: number = 1,
  ): {
    onCooldown: boolean;
    timeLeft?: number;
  } {
    if (!this.cooldowns.has(commandName)) {
      this.cooldowns.set(commandName, new Collection());
    }

    const now = DateTime.now().toMillis();
    const timestamps = this.cooldowns.get(commandName)!;
    const cooldownAmount = cooldownSeconds * 1000;
    const timestamp = timestamps.get(userId);

    if (timestamp) {
      const expirationTime = timestamp + cooldownAmount;

      if (now < expirationTime) {
        const timeLeft = expirationTime - now;
        return {
          onCooldown: true,
          timeLeft: Math.ceil(timeLeft / 1000),
        };
      }
    }

    // Set the cooldown
    timestamps.set(userId, now);
    setTimeout(() => timestamps.delete(userId), cooldownAmount);

    return {onCooldown: false};
  }

  public clearCooldown(commandName: string, userId: Snowflake): void {
    const timestamps = this.cooldowns.get(commandName);
    if (timestamps) {
      timestamps.delete(userId);
    }
  }

  public clearAllCooldowns(commandName?: string): void {
    if (commandName) {
      this.cooldowns.delete(commandName);
    } else {
      this.cooldowns.clear();
    }
  }
}
