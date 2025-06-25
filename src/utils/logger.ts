import chalk from 'chalk';
import {DateTime} from 'luxon';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface ILogger {
  info(message: string): void;
  warn(message: string): void;
  error(error: unknown): void;
  debug(message: string): void;
  setLevel(level: LogLevel): void;
}

export class Logger implements ILogger {
  private readonly _prefix?: string;
  private _level: LogLevel = 'info';

  public constructor(prefix: string, level: LogLevel = 'info') {
    this._prefix = chalk.yellowBright(`(${prefix})`);
    this._level = level;
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
    }
  }

  public debug(message: string): void {
    if (this.shouldLog('debug')) {
      console.debug(`${this.prefix} ${chalk.gray('DEBUG')} ${chalk.gray(message)}`);
    }
  }
}
