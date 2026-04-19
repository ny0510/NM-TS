import type {NMClient} from '@/client/Client';
import type {Queue} from '@/structures/Queue';
import {config} from '@/utils/config';
import {msToTime} from '@/utils/formatting';

export const destroyQueueSafely = async (client: NMClient, guildId: string, reason?: string): Promise<void> => {
  try {
    await client.services.lavalinkManager.destroyQueue(guildId);
    if (reason) {
      client.logger.info(`Queue destroyed: ${reason}`);
    }
  } catch (error) {
    client.logger.error(error instanceof Error ? error : new Error(`Failed to destroy queue: ${error}`));
  }
};

export const createProgressBar = (
  queue: Queue,
  options?: {
    barLength?: number;
    useEmoji?: boolean;
  },
): string => {
  const track = queue.getCurrent();
  if (!track || track.info.isStream) return '';
  const total = track.info.length;
  const current = queue.position;
  const barLength = options?.barLength ?? 10;
  const useEmoji = options?.useEmoji ?? true;

  if (useEmoji) {
    const progress = Math.round((current / total) * barLength);
    let progressBar = '';

    for (let i = 0; i < barLength; i++) {
      if (i === 0) {
        progressBar += i < progress ? config.PROGRESS_FILLED_START : config.PROGRESS_CIRCLE_START;
      } else if (i === barLength - 1) {
        progressBar += i < progress ? config.PROGRESS_FILLED_MIDDLE : config.PROGRESS_UNFILLED_END;
      } else {
        if (i === progress) {
          progressBar += config.PROGRESS_CIRCLE_MIDDLE;
        } else if (i < progress) {
          progressBar += config.PROGRESS_FILLED_MIDDLE;
        } else {
          progressBar += config.PROGRESS_UNFILLED_MIDDLE;
        }
      }
    }

    return `${msToTime(current)} ${progressBar} ${msToTime(total)}`;
  } else {
    const progress = Math.round((current / total) * barLength);
    const barChar = '▬';
    const indicator = '🔘';
    const bar = barChar.repeat(barLength);
    return `${msToTime(current)} ${bar.substring(0, progress)}${indicator}${bar.substring(progress + 1)} ${msToTime(total)}`;
  }
};
