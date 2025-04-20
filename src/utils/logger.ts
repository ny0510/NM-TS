import chalk from 'chalk';
import {DateTime} from 'luxon';

export interface ILogger {
  info(message: string): void | Promise<void>;
  warn(message: string): void | Promise<void>;
  error(error: unknown): void | Promise<void>;
  debug(message: string): void | Promise<void>;
}

export class Logger implements ILogger {
  private readonly _prefix?: string;

  public constructor(prefix: string) {
    this._prefix = chalk.yellowBright(`(${prefix})`);
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

  public info(message: string) {
    console.log(`${this.prefix} ${message}`);
  }

  public warn(message: string) {
    console.warn(`${this.prefix} ${chalk.yellowBright(message)}`);
  }

  public error(error: unknown): void {
    const message = error instanceof Error ? error.message : 'An error occurred';
    if (typeof Bun !== 'undefined') {
      console.error(`${this.prefix} ${chalk.redBright(message)} > ${Bun.inspect(error, {colors: true, sorted: true})}`);
    } else {
      console.error(`${this.prefix} ${chalk.redBright(message)}`);
      console.error(error);
    }
  }

  public debug(message: string): void | Promise<void> {
    if (process.env.NODE_ENV === 'production') return;
    console.debug(`${this.prefix} ${chalk.gray(message)}`);
  }
}
