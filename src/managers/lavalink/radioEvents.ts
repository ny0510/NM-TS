import {EmbedBuilder} from 'discord.js';
import type {NMClient} from '@/client';
import type {RadioSession} from '@/features/radio/RadioSession';
import {COLORS} from '@/shared/discord/embedColors';

export function registerRadioEvents(session: RadioSession, client: NMClient): void {
  const manager = client.services.lavalinkManager;
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
    if ('track' in data && typeof data.track === 'object' && data.track !== null && 'encoded' in data.track && typeof data.track.encoded === 'string') void fail(data.track.encoded);
  });
  session.player.on('stuck', data => {
    void fail(data.track?.encoded);
  });
  session.player.on('end', data => {
    if (data.reason !== 'replaced' && data.reason !== 'stopped') void fail(data.track?.encoded);
  });
  session.player.on('closed', data => {
    if (data.code === 4014) void fail(undefined, true);
  });
}
