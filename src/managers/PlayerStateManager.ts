import {type Client} from 'discord.js';

import {saveAllPlayerStates} from '@/managers/playerState/serializer';
import {clearAllPlayerStates, restoreAllPlayerStates} from '@/managers/playerState/restorer';
import type {ILogger} from '@/shared/logger';

export class PlayerStateManager {
  private readonly client: Client;
  private readonly logger: ILogger;

  constructor(client: Client, logger: ILogger) {
    this.client = client;
    this.logger = logger;
  }

  public async saveAll(): Promise<void> {
    await saveAllPlayerStates(this.client, this.logger);
  }

  public async restoreAll(): Promise<{restored: number; total: number; failed: number}> {
    return await restoreAllPlayerStates(this.client, this.logger);
  }

  public async clearSnapshot(): Promise<void> {
    await clearAllPlayerStates();
  }
}
