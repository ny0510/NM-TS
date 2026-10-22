import {EmbedBuilder} from 'discord.js';
import type {NMClient} from '@/client';
import type {RadioSession} from '@/features/radio/RadioSession';
import {COLORS} from '@/shared/discord/embedColors';
import {type ILogger, Logger} from '@/shared/logger';
import type {QueueTrack} from '@/types/music';

const logger = new Logger('Lavalink');

export function registerRadioEvents(session: RadioSession, client: NMClient, eventLogger: ILogger = logger): void {
  const manager = client.services.lavalinkManager;
  const {guildId} = session;
  const guildName = client.guilds?.cache.get(guildId)?.name ?? guildId;
  const playerLabel = `Player ${guildName} (${guildId})`;
  let activeTrack: QueueTrack | null = null;
  eventLogger.info(`${playerLabel} created`);
  session.onCleanup(() => {
    if (activeTrack) eventLogger.info(`${playerLabel} track end. Track: ${activeTrack.info.title} (reason: stopped)`);
    activeTrack = null;
  });
  session.player.on('start', data => {
    if (manager.getSession(guildId) !== session) return;
    const current = session.getCurrent();
    activeTrack = current && (current.encoded === data.track.encoded || current.info.identifier === data.track.info.identifier) ? current : data.track;
    eventLogger.info(`${playerLabel} track start. Track: ${activeTrack.info.title}`);
  });
  const fail = async (encoded?: string, voiceDisconnected = false): Promise<void> => {
    const generation = session.getTuneGeneration();
    await manager
      .runWithSessionLock(session.guildId, async scope => {
        if (scope.getSession() !== session || generation !== session.getTuneGeneration() || session.get('failureReported')) return;
        if (encoded && encoded !== session.getCurrent()?.encoded) return;
        session.set('failureReported', true);
        const channel = client.channels.cache.get(session.textChannelId);
        await scope.destroySession(session.sessionId);
        if (channel?.isSendable())
          await channel.send({
            embeds: [
              new EmbedBuilder()
                .setColor(COLORS.error)
                .setTitle('라디오 연결이 끊겼어요.')
                .setDescription(voiceDisconnected ? '음성 채널 연결이 종료됐어요. /radio에서 다시 연결해 주세요.' : '방송국의 스트림을 계속 받지 못했어요. /radio에서 다시 연결하거나 다른 방송국을 선택해 주세요.'),
            ],
          });
      })
      .catch(error => client.logger.error(error instanceof Error ? error : new Error(String(error))));
  };
  session.player.on('exception', data => {
    if (manager.getSession(guildId) !== session) return;
    eventLogger.error(new Error(`${playerLabel} track exception [${data.exception.severity}]: ${data.exception.message ?? 'Unknown Error'}`));
    if ('track' in data && typeof data.track === 'object' && data.track !== null && 'encoded' in data.track && typeof data.track.encoded === 'string') void fail(data.track.encoded);
  });
  session.player.on('stuck', data => {
    if (manager.getSession(guildId) !== session) return;
    eventLogger.warn(`${playerLabel} track stuck. Threshold: ${data.thresholdMs}ms`);
    void fail(data.track?.encoded);
  });
  session.player.on('end', data => {
    if (manager.getSession(guildId) !== session) return;
    const track = activeTrack && (activeTrack.encoded === data.track.encoded || activeTrack.info.identifier === data.track.info.identifier || data.reason === 'replaced') ? activeTrack : data.track;
    eventLogger.info(`${playerLabel} track end. Track: ${track.info.title} (reason: ${data.reason})`);
    if (track === activeTrack) activeTrack = null;
    if (data.reason !== 'replaced' && data.reason !== 'stopped') void fail(data.track?.encoded);
  });
  session.player.on('closed', data => {
    if (manager.getSession(guildId) !== session) return;
    if (data.code === 1000) eventLogger.debug(`${playerLabel} websocket closed normally (code: 1000)`);
    else eventLogger.warn(`${playerLabel} websocket closed (code: ${data.code}, reason: ${data.reason})`);
    if (data.code === 4014) void fail(undefined, true);
  });
}
