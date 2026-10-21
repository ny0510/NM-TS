import type {NMClient} from '@/client';
import {clearAllPlayerStates, restoreAllPlayerStates} from '@/managers/playerState/restorer';
import {saveAllPlayerStates} from '@/managers/playerState/serializer';
import type {ILogger} from '@/shared/logger';

export class PlayerStateManager {
  private readonly client: NMClient;
  private readonly logger: ILogger;

  constructor(client: NMClient, logger: ILogger) {
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
