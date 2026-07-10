import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';
import type {QueueTrack} from '@/types/music';
import {Logger} from '@/shared/logger';

const logger = new Logger('Lavalink');

const MAX_AUTOPLAY_RETRIES = 3;

export async function handleAutoplay(queue: Queue, client: NMClient): Promise<boolean> {
  const seed = queue.previous.at(-1);
  if (!seed) return false;

  const node = client.services.lavalinkManager.getNode();
  if (!node) return false;

  for (let attempt = 0; attempt < MAX_AUTOPLAY_RETRIES; attempt++) {
    try {
      const identifier = seed.info.identifier;
      const randomIndex = Math.floor(Math.random() * 23) + 2;
      const autoplayQuery = `https://youtube.com/watch?v=${identifier}&list=RD${identifier}&index=${randomIndex}`;

      const result = await node.rest.resolve(autoplayQuery);
      if (!result || result.loadType !== 'playlist') continue;

      const candidates = result.data.tracks.filter((t: {info: {identifier: string; uri?: string; title: string}}) => !isDuplicate(t as QueueTrack, queue.previous));
      if (candidates.length === 0) continue;

      const picked = candidates[Math.floor(Math.random() * candidates.length)]!;
      const autoplayTrack: QueueTrack = {...picked, requester: queue.getAutoplayRequester(), isAutoplay: true, playContext: {playContext: 'autoplay', requestChannelId: queue.textChannelId}};

      queue.add(autoplayTrack);
      await queue.play();
      return true;
    } catch (error) {
      logger.warn(`Autoplay attempt ${attempt + 1} failed: ${error}`);
    }
  }

  return false;
}

function isDuplicate(candidate: QueueTrack, previous: QueueTrack[]): boolean {
  return previous.some(prev => {
    if (prev.info.identifier === candidate.info.identifier) return true;
    if (prev.info.uri && prev.info.uri === candidate.info.uri) return true;
    if (normalizeTitle(prev.info.title) === normalizeTitle(candidate.info.title)) return true;
    return false;
  });
}

function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/\(.*?\)/g, '')
    .replace(/\[.*?\]/g, '')
    .replace(/official|music|video|lyrics|hd|mv|audio/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
