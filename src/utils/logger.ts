import chalk from 'chalk';
import {type ColorResolvable, EmbedBuilder, Guild, WebhookClient, type WebhookMessageCreateOptions, userMention} from 'discord.js';
import {DateTime} from 'luxon';

import type {NMClient} from '@/client/Client';
import type {ILogger, LogLevel} from '@/types/logger';
import {truncateWithEllipsis} from '@/utils/formatting';

export type {LogLevel, ILogger} from '@/types/logger';

export class Logger implements ILogger {
  private readonly _prefix?: string;
  private _level: LogLevel = 'info';
  private _webhook?: WebhookClient;
  private _client?: NMClient;

  public constructor(prefix: string, level?: LogLevel, webhookUrl?: string) {
    this._prefix = chalk.yellowBright(`(${prefix})`);
    this._level = level ?? (process.env.NODE_ENV === 'development' ? 'debug' : 'info');

    if (webhookUrl) {
      try {
        this._webhook = new WebhookClient({url: webhookUrl});
      } catch (error) {
        console.error('Failed to initialize Discord webhook:', error);
      }
    }
  }

  public setClient(client: NMClient): void {
    this._client = client;
  }

  private get currentDateTime() {
    return DateTime.now().toFormat('MM/dd HH:mm:ss');
  }

  private get prefix() {
    if (this._prefix != null) {
      return `${chalk.gray(`[${this.currentDateTime}]`)} ${this._prefix}`;
    } else {
      return chalk.gray(`[${this.currentDateTime}]`);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error'];
    const currentLevelIndex = levels.indexOf(this._level);
    const messageLevelIndex = levels.indexOf(level);
    return messageLevelIndex >= currentLevelIndex;
  }

  private createWebhookOptions(embeds: EmbedBuilder[]): WebhookMessageCreateOptions {
    const options: WebhookMessageCreateOptions = {embeds};

    if (this._client?.user) {
      options.username = `${this._client.user.displayName || this._client.user.username} - Logger`;
      options.avatarURL = this._client.user.displayAvatarURL();
    }

    return options;
  }

  private async sendErrorToDiscord(message: string, error?: unknown): Promise<void> {
    if (!this._webhook) return;

    try {
      const color = this._client?.config?.EMBED_COLOR_ERROR ?? '#ff3333';
      const safeMessage = message ?? 'An error occurred';

      const embed = new EmbedBuilder()
        .setTimestamp()
        .setTitle('An error occurred')
        .setColor((typeof color === 'string' || typeof color === 'number' ? color : '#ff3333') as ColorResolvable)
        .addFields({name: 'Message', value: safeMessage});

      if (error instanceof Error && error.stack) {
        const stackLines = error.stack.split('\n');
        const stackText = stackLines.slice(1).join('\n');
        embed.addFields({name: 'Stack', value: `\`\`\`${stackText}\`\`\``});
      }

      if (typeof Bun !== 'undefined' && error) {
        try {
          const detailedError = Bun.inspect(error, {colors: false, sorted: true});
          const truncatedError = truncateWithEllipsis(detailedError, 1024);
          embed.addFields({name: 'Detailed Error', value: `\`\`\`${truncatedError}\`\`\``});
        } catch {}
      }

      const webhookOptions = this.createWebhookOptions([embed]);
      await this._webhook.send(webhookOptions);
    } catch (error) {
      console.error('Failed to send log to Discord:', error);
    }
  }

  public setLevel(level: LogLevel): void {
    this._level = level;
  }

  public info(message: string): void {
    if (this.shouldLog('info')) {
      console.log(`${this.prefix} ${message}`);
    }
  }

  public warn(message: string): void {
    if (this.shouldLog('warn')) {
      console.warn(`${this.prefix} ${chalk.yellowBright('WARN')} ${chalk.yellowBright(message)}`);
    }
  }

  public error(error: unknown): void {
    if (this.shouldLog('error')) {
      const message = error instanceof Error ? error.message : 'An error occurred';
      if (typeof Bun !== 'undefined') {
        console.error(`${this.prefix} ${chalk.redBright('ERROR')} ${chalk.redBright(message)} > ${Bun.inspect(error, {colors: true, sorted: true})}`);
      } else {
        console.error(`${this.prefix} ${chalk.redBright('ERROR')} ${chalk.redBright(message)}`);
        console.error(error);
      }
      this.sendErrorToDiscord(message, error);
    }
  }

  public debug(message: string): void {
    if (this.shouldLog('debug')) {
      console.debug(`${this.prefix} ${chalk.gray('DEBUG')} ${chalk.gray(message)}`);
    }
  }

  public guildJoined(guild: Guild, client?: NMClient): void {
    if (this._webhook && client) {
      this.sendGuildEventToDiscord('joined', guild, client);
    }
  }

  public guildLeft(guild: Guild, client?: NMClient): void {
    if (this._webhook && client) {
      this.sendGuildEventToDiscord('left', guild, client);
    }
  }

  private async sendGuildEventToDiscord(type: 'joined' | 'left', guild: Guild, client: NMClient): Promise<void> {
    if (!this._webhook) return;

    try {
      let currentGuildCount = client.guilds.cache.size;
      let currentUserCount = client.guilds.cache.reduce((acc: number, guild: Guild) => acc + (guild.memberCount || 0), 0);

      let currentGuildOwner = '알 수 없음';
      try {
        if (type === 'joined' || guild.available) {
          const owner = await guild.fetchOwner();
          currentGuildOwner = owner.user.id;
        } else {
          currentGuildOwner = guild.ownerId || '알 수 없음';
        }
      } catch (error) {
        currentGuildOwner = guild.ownerId || '알 수 없음';
      }

      const guildChange = type === 'joined' ? '+1' : '-1';
      const userChange = `${type === 'joined' ? '+' : '-'}${guild.memberCount}`;
      const guildName = truncateWithEllipsis(guild.name, 256);

      const embed = new EmbedBuilder()
        .setTimestamp()
        .addFields({name: '서버 소유자', value: `👑 ${userMention(currentGuildOwner)} (${currentGuildOwner})`}, {name: '현재 서버 수', value: `📊 ${currentGuildCount}개 (${guildChange})`, inline: true}, {name: '현재 사용자 수', value: `👥 ${currentUserCount.toLocaleString()}명 (${userChange})`, inline: true})
        .setDescription(`${guildName} (${guild.id})`)
        .setColor(type === 'joined' ? client.config.EMBED_COLOR_NORMAL : client.config.EMBED_COLOR_ERROR)
        .setTitle(type === 'joined' ? '새로운 서버에 추가됨' : '서버에서 제거됨');

      const webhookOptions = this.createWebhookOptions([embed]);
      await this._webhook.send(webhookOptions);
    } catch (error) {
      console.error('Failed to send guild event to Discord:', error);
    }
  }
}
