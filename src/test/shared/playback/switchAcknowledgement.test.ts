import {afterEach, expect, mock, spyOn, test} from 'bun:test';
import {ButtonInteraction, ChatInputCommandInteraction, Client, type InteractionReplyOptions} from 'discord.js';
import {safeReply} from '@/shared/discord/interactions';
import * as guard from '@/shared/playback/sessionGuard';
import {handlePlaybackSwitch, requestPlaybackAction} from '@/shared/playback/switchHandler';
import type {PlaybackSession, SessionMutation} from '@/types/playback';

afterEach(() => mock.restore());
let counter = 0;

test.each([false, true])('real Discord reply state preserves switch callback notification (throws=%s)', async throws => {
  const suffix = ++counter;
  const events: string[] = [];
  const session: PlaybackSession = Object.assign(Object.create(null), {mode: 'radio', sessionId: `ack-radio-${suffix}`, guildId: 'guild', voiceChannelId: 'voice'});
  let current: PlaybackSession | undefined = session;
  const context: SessionMutation = Object.assign(Object.create(null), {
    getSession: () => current,
    destroySession: async () => {
      current = undefined;
      return true;
    },
  });
  const client = Object.assign(new Client({intents: []}), {
    logger: {warn: mock(), error: mock(), debug: mock()},
    services: {lavalinkManager: {runWithSessionLock: async <T>(_guild: string, action: (context: SessionMutation) => Promise<T>) => action(context)}},
  });
  const post = spyOn(client.rest, 'post').mockResolvedValue({});
  spyOn(guard, 'getPlaybackOptions').mockResolvedValue({guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text', shardId: 0, volume: 20});
  const original: ChatInputCommandInteraction = Object.assign(Object.create(ChatInputCommandInteraction.prototype), {id: `ack-original-${suffix}`, client, guildId: 'guild', user: {id: 'user'}, applicationId: 'application', token: 'test-token', deferred: false, replied: false});
  await requestPlaybackAction(original, 'music', async interaction => {
    events.push('callback');
    if (throws) throw new Error('Playback failed');
    await safeReply(interaction, {content: '음악 재생을 시작했어요.'});
  });
  const customId = JSON.stringify(post.mock.calls).match(/playback:switch:[a-z0-9-]+/)?.[0];
  if (!customId) throw new Error('Missing confirmation button');
  const send = mock(async (_options: InteractionReplyOptions) => {
    events.push('visible-message');
    return {};
  });
  const editMessage = mock(async (_message: string, _options: unknown) => {
    events.push('clear-components');
    return {};
  });
  const confirmation: ButtonInteraction = Object.assign(Object.create(ButtonInteraction.prototype), {
    id: `ack-button-${suffix}`,
    client,
    guildId: 'guild',
    user: {id: 'user'},
    applicationId: 'application',
    token: 'test-token',
    customId,
    deferred: false,
    replied: false,
    webhook: {send, editMessage},
  });
  await handlePlaybackSwitch(confirmation);
  expect(send).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(send.mock.calls)).toContain(throws ? '전환하지 못했어요' : '음악 재생을 시작했어요.');
  expect(events.indexOf('visible-message')).toBeLessThan(events.indexOf('clear-components'));
  expect(editMessage).toHaveBeenCalledTimes(1);
  expect(JSON.stringify(editMessage.mock.calls).includes('라디오를 종료하고 음악 모드로 전환했어요.')).toBe(!throws);
});
