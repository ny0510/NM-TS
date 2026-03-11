import {EmbedBuilder, Message, codeBlock} from 'discord.js';
import type {TrackEndEvent, TrackExceptionEvent, TrackStartEvent, TrackStuckEvent, WebSocketClosedEvent} from 'shoukaku';

import type {NMClient} from '@/client/Client';
import type {Queue, QueueTrack} from '@/structures/Queue';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {hyperlink, truncateWithEllipsis} from '@/utils/formatting';
import {Logger} from '@/utils/logger';
import {createPlayerControls} from '@/utils/music/buttons/controlsButton';
import {createQuickAddButton} from '@/utils/music/buttons/quickAddButton';
import {getEmbedMeta} from '@/utils/music/playerUtils';

const logger = new Logger('Lavalink');

const MAX_AUTOPLAY_RETRIES = 3;

function destroyQueueSafely(queue: Queue, client: NMClient, reason?: string): void {
  try {
    client.services.lavalinkManager.destroyQueue(queue.guildId);
    if (reason) {
      logger.info(`Queue destroyed: ${reason}`);
    }
  } catch (error) {
    logger.error(`Failed to destroy queue: ${error}`);
  }
}

export const registerLavalinkEvents = (client: NMClient) => {
  const shoukaku = client.services.lavalinkManager.getShoukaku();

  shoukaku.on('ready', (name, lavalinkResume, libraryResume) => {
    logger.info(`Node ${name} connected (lavalinkResume: ${lavalinkResume}, libraryResume: ${libraryResume})`);
  });

  shoukaku.on('error', (name, error) => logger.error(`Node ${name} error: ${error}`));
  shoukaku.on('close', (name, code, reason) => logger.warn(`Node ${name} closed (code: ${code}, reason: ${reason})`));
  shoukaku.on('disconnect', (name, count) => logger.warn(`Node ${name} disconnected (${count} players affected)`));
  shoukaku.on('reconnecting', (name, reconnectsLeft, interval) => logger.info(`Node ${name} reconnecting... (${reconnectsLeft} tries left, interval: ${interval}s)`));
  shoukaku.on('debug', (name, info) => logger.debug(`[${name}] ${info}`));
};

export const registerPlayerEvents = (queue: Queue, client: NMClient) => {
  const {player, guildId} = queue;
  const guildName = client.guilds.cache.get(guildId)?.name ?? guildId;

  logger.info(`Player ${guildName} (${guildId}) created`);

  player.on('start', async (data: TrackStartEvent) => {
    const track = data.track as QueueTrack;
    logger.info(`Player ${guildName} (${guildId}) track start. Track: ${track.info.title}`);

    const channel = client.channels.cache.get(queue.textChannelId);
    const isTrackRepeating = queue.trackRepeat;

    if (!channel?.isSendable() || isTrackRepeating) return;

    try {
      const lastMessageId = queue.get<string>('lastMessageId');
      if (lastMessageId && channel.isSendable()) {
        try {
          const lastMessage = await channel.messages.fetch(lastMessageId);
          if (lastMessage?.editable) {
            await lastMessage.edit({components: [createQuickAddButton()]});
          }
        } catch {
          // 메시지가 삭제되었거나 권한이 없는 경우 무시
        }
      }

      const trackMeta = await getEmbedMeta(track, false, queue, 'play');

      const message = await channel.send({
        embeds: [
          new EmbedBuilder()
            .setDescription(`♪ ${hyperlink(truncateWithEllipsis(track.info.title, 50), track.info.uri ?? '')}`)
            .setURL(track.info.uri ?? null)
            .setFooter({text: trackMeta.footerText})
            .setColor(client.config.EMBED_COLOR_NORMAL),
        ],
        components: [createPlayerControls(queue, track.info.uri ?? '')],
      });

      queue.set('lastMessageId', message.id);
    } catch (error) {
      logger.warn(`Failed to send track start message: ${error}`);
    }
  });

  player.on('end', async (data: TrackEndEvent) => {
    const track = data.track as QueueTrack;
    logger.info(`Player ${guildName} (${guildId}) track end. Track: ${track.info.title} (reason: ${data.reason})`);

    if (data.reason === 'replaced') return;

    // 트랙 반복
    if (queue.trackRepeat && data.reason === 'finished') {
      await queue.player.playTrack({track: {encoded: track.encoded}});
      return;
    }

    if (queue.queueRepeat && data.reason === 'finished') {
      const currentTrack = queue.getCurrent();
      if (currentTrack) queue.add(currentTrack);
    }

    // 현재 트랙을 이전 트랙 목록에 추가 (자동 재생 시드용)
    if (track) {
      queue.addToPrevious(track);
    }

    // 대기열에 트랙이 남아있으면 다음 재생
    if (queue.size() > 0) {
      await queue.play();
      return;
    }

    // 자동 재생 시도
    if (queue.isAutoplay && data.reason === 'finished') {
      const autoplaySuccess = await handleAutoplay(queue, client);
      if (autoplaySuccess) return;
    }

    // 대기열 종료 처리
    await handleQueueEnd(queue, client);
  });

  player.on('stuck', async (data: TrackStuckEvent) => {
    logger.warn(`Player ${guildName} (${guildId}) track stuck. Threshold: ${data.thresholdMs}ms`);

    const channel = client.channels.cache.get(queue.textChannelId);
    if (!channel?.isSendable()) return;

    try {
      await channel.send({
        embeds: [
          new EmbedBuilder()
            .setTitle(`음악이 ${data.thresholdMs / 1000}초 동안 재생되지 않았어요.`)
            .setDescription('다음 음악으로 넘어갈게요.')
            .setColor(client.config.EMBED_COLOR_ERROR),
        ],
      });
    } catch (sendError) {
      logger.error(`Failed to send track stuck message: ${sendError}`);
    }

    await queue.stop();
  });

  player.on('exception', async (data: TrackExceptionEvent) => {
    const {exception} = data;
    const errorMessage = exception.message ?? 'Unknown Error';
    logger.error(`Player ${guildName} (${guildId}) track exception [${exception.severity}]: ${errorMessage}`);

    const channel = client.channels.cache.get(queue.textChannelId);
    if (!channel?.isSendable()) return;

    const isPlaybackRestricted = exception.severity !== 'fault';

    try {
      await channel.send({
        embeds: [isPlaybackRestricted ? createErrorEmbed(client, '재생이 불가능한 영상이에요.', '유튜브 정책에 의해 재생이 제한된 영상이에요.\n연령 제한, 지역 제한 등이 원인일 수 있어요.') : createErrorEmbed(client, '음악 재생 중 오류가 발생했어요.', codeBlock('js', errorMessage))],
      });
    } catch (sendError) {
      logger.error(`Failed to send track error message: ${sendError}`);
    }
  });

  player.on('closed', async (data: WebSocketClosedEvent) => {
    if (data.code === 1000) {
      logger.debug(`Player ${guildName} (${guildId}) websocket closed normally (code: 1000)`);
      return;
    }
    logger.warn(`Player ${guildName} (${guildId}) websocket closed (code: ${data.code}, reason: ${data.reason})`);
  });
};

async function handleAutoplay(queue: Queue, client: NMClient): Promise<boolean> {
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
      const autoplayTrack: QueueTrack = {...picked, requester: queue.getAutoplayRequester()};

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

async function handleQueueEnd(queue: Queue, client: NMClient): Promise<void> {
  const channel = client.channels.cache.get(queue.textChannelId);

  queue.playing = false;
  queue.setCurrent(null);

  if (!channel?.isSendable()) return;
  if (queue.get('stoppedByCommand')) return;

  if (queue.isAutoplay) {
    logger.warn(`Autoplay enabled but queue ended for ${queue.guildId}`);
    try {
      await channel.send({
        embeds: [createErrorEmbed(client, '자동 재생할 곡을 찾지 못했어요.', '비슷한 곡을 찾을 수 없어 재생을 종료할게요.')],
      });
    } catch (e) {
      logger.warn(`Failed to send autoplay failure message: ${e}`);
    }
    queue.setAutoplay(false);
  }

  const embed = new EmbedBuilder().setTitle('대기열에 있는 음악을 모두 재생했어요. 30초 후에 자동으로 연결을 종료해요.').setColor(client.config.EMBED_COLOR_NORMAL);
  let message: Message | undefined;

  try {
    message = await channel.send({embeds: [embed]});
  } catch (sendError) {
    logger.warn(`Failed to send queue end message: ${sendError}`);
  }

  setTimeout(async () => {
    try {
      if (!queue.playing && queue.size() === 0) {
        destroyQueueSafely(queue, client, `Queue destroyed after 30 seconds of inactivity (${queue.guildId})`);

        if (message?.editable) {
          await message.edit({embeds: [embed.setDescription('30초가 지나 자동으로 연결을 종료했어요.')]});
        }
      }
    } catch (error) {
      logger.warn(`Failed to edit queue end message: ${error}`);
    }
  }, 30_000);
}
