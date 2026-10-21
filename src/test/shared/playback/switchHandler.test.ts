import {afterEach, describe, expect, mock, spyOn, test} from 'bun:test';
import {ButtonInteraction, ChatInputCommandInteraction, Client, type Guild, type GuildMember, type InteractionReplyOptions, PermissionFlagsBits, PermissionsBitField, type TextChannel, type VoiceChannel} from 'discord.js';
import type {PlaybackInteraction} from '@/shared/playback/sessionGuard';
import {handlePlaybackSwitch, requestPlaybackAction} from '@/shared/playback/switchHandler';
import type {CreateQueueOptions} from '@/types/music';
import type {PlaybackSession, SessionMutation} from '@/types/playback';

afterEach(() => mock.restore());
let sequence = 0;

function fixture() {
  const id = ++sequence;
  const originalSession: PlaybackSession = Object.assign(Object.create(null), {mode: 'radio', sessionId: `radio-${id}`, guildId: `guild-${id}`, voiceChannelId: 'voice'});
  const state: {current: PlaybackSession | undefined; voiceId: string; canSpeak: boolean; destroySucceeds: boolean; beforeLock?: () => void; beforeFetch?: () => void} = {current: originalSession, voiceId: 'voice', canSpeak: true, destroySucceeds: true};
  const events: string[] = [];
  const destroy = mock(async (sessionId: string) => {
    if (!state.destroySucceeds || state.current?.sessionId !== sessionId) return false;
    events.push('destroy');
    state.current = undefined;
    return true;
  });
  const context: SessionMutation = Object.assign(Object.create(null), {getSession: () => state.current, destroySession: destroy});
  const client = Object.assign(new Client({intents: []}), {
    config: {DEFAULT_VOLUME: 20},
    logger: {warn: mock(), error: mock(), debug: mock()},
    services: {
      lavalinkManager: {
        getSession: () => state.current,
        runWithSessionLock: async <T>(_guildId: string, execute: (context: SessionMutation) => Promise<T>): Promise<T> => {
          state.beforeLock?.();
          return execute(context);
        },
      },
    },
  });
  const voice: VoiceChannel = Object.assign(Object.create(null), {permissionsFor: () => new PermissionsBitField(state.canSpeak ? [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak] : [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])});
  Object.defineProperty(voice, 'id', {get: () => state.voiceId});
  const member: GuildMember = Object.assign(Object.create(null), {voice: {}});
  Object.defineProperty(member.voice, 'channel', {get: () => (state.voiceId ? voice : null)});
  const guild: Guild = Object.assign(Object.create(null), {
    id: originalSession.guildId,
    shardId: 0,
    members: {
      me: {communicationDisabledUntil: null},
      fetch: mock(async () => {
        state.beforeFetch?.();
        return member;
      }),
    },
  });
  client.guilds.cache.set(guild.id, guild);
  const text: TextChannel = Object.assign(Object.create(null), {id: 'text', isDMBased: () => false, permissionsFor: () => new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages])});
  client.channels.cache.set(text.id, text);
  const makeInteraction = (buttonId?: string, userId = `user-${id}`) => {
    const interaction: ButtonInteraction = Object.assign(Object.create(buttonId ? ButtonInteraction.prototype : ChatInputCommandInteraction.prototype), {
      id: `switch-test-${++sequence}`,
      guildId: guild.id,
      channelId: 'text',
      user: {id: userId},
      client,
      customId: buttonId,
      replied: false,
      deferred: false,
    });
    const reply = mock(async (_payload: InteractionReplyOptions) => {
      interaction.replied = true;
    });
    const followUp = mock(async (_payload: InteractionReplyOptions) => {});
    const deferUpdate = mock(async () => {
      interaction.deferred = true;
    });
    const editReply = mock(async () => {});
    const deleteReply = mock(async () => {});
    Object.assign(interaction, {reply, followUp, deferUpdate, editReply, deleteReply});
    return {interaction, reply, followUp, deferUpdate, editReply, deleteReply};
  };
  const original = makeInteraction();
  const prepared = {encoded: 'already-resolved-song'};
  const execute = mock(async (_interaction: PlaybackInteraction, _context: SessionMutation, _options: CreateQueueOptions) => {
    events.push(prepared.encoded);
  });
  const prompt = async (isCurrent?: () => boolean) => {
    expect(await requestPlaybackAction(original.interaction, 'music', execute, isCurrent)).toBe(false);
    const customId = JSON.stringify(original.reply.mock.calls).match(/playback:switch:[a-z0-9-]+/)?.[0];
    if (!customId) throw new Error('No switch confirmation button');
    return customId;
  };
  return {state, originalSession, events, destroy, context, client, original, execute, prompt, makeInteraction, prepared};
}

describe('mode switch confirmation', () => {
  test('cancelling preserves playback and leaves the cancellation message without buttons', async () => {
    const f = fixture();
    const customId = await f.prompt();
    const cancelId = customId.replace('playback:switch:', 'playback:switch:cancel:');
    const confirmation = f.makeInteraction(cancelId);
    await handlePlaybackSwitch(confirmation.interaction);
    expect(f.destroy).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
    expect(f.state.current).toBe(f.originalSession);
    expect(JSON.stringify(confirmation.editReply.mock.calls)).toContain('전환을 취소했어요.');
    expect(JSON.stringify(confirmation.editReply.mock.calls)).toContain('"components":[]');
    expect(confirmation.deleteReply).not.toHaveBeenCalled();
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.destroy).not.toHaveBeenCalled();
  });

  test('another user cannot cancel the pending switch', async () => {
    const f = fixture();
    const customId = await f.prompt();
    await handlePlaybackSwitch(f.makeInteraction(customId.replace('playback:switch:', 'playback:switch:cancel:'), 'outsider').interaction);
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  test.each(['radio', 'music'] as const)('successful switch to %s replaces the confirmation embed and removes its button', async target => {
    const f = fixture();
    const from = target === 'radio' ? '음악' : '라디오';
    const to = target === 'radio' ? '라디오' : '음악';
    f.state.current = Object.assign(Object.create(null), {...f.originalSession, mode: target === 'radio' ? 'music' : 'radio'});
    await requestPlaybackAction(f.original.interaction, target, f.execute);
    expect(f.original.reply.mock.calls[0]?.[0].flags).toBeUndefined();
    const customId = JSON.stringify(f.original.reply.mock.calls).match(/playback:switch:[a-z0-9-]+/)?.[0];
    if (!customId) throw new Error('Missing switch confirmation');
    const confirmation = f.makeInteraction(customId);
    await handlePlaybackSwitch(confirmation.interaction);
    expect(confirmation.editReply).toHaveBeenCalledTimes(1);
    const payload = JSON.stringify(confirmation.editReply.mock.calls);
    expect(payload).toContain(`${from}${target === 'radio' ? '을' : '를'} 종료하고 ${to} 모드로 전환했어요.`);
    expect(payload).toContain('"components":[]');
    expect(payload).not.toContain('시작할 수 없어요');
  });

  test('music-to-radio switch also preserves music until the explicit button click', async () => {
    const f = fixture();
    f.state.current = Object.assign(Object.create(null), {...f.originalSession, mode: 'music'});
    expect(await requestPlaybackAction(f.original.interaction, 'radio', f.execute)).toBe(false);
    expect(f.destroy).not.toHaveBeenCalled();
    const customId = JSON.stringify(f.original.reply.mock.calls).match(/playback:switch:[a-z0-9-]+/)?.[0];
    if (!customId) throw new Error('No radio switch confirmation button');
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.destroy).toHaveBeenCalledTimes(1);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  test('simultaneous duplicate clicks execute the prepared action only once', async () => {
    const f = fixture();
    const customId = await f.prompt();
    await Promise.all([handlePlaybackSwitch(f.makeInteraction(customId).interaction), handlePlaybackSwitch(f.makeInteraction(customId).interaction)]);
    expect(f.destroy).toHaveBeenCalledTimes(1);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  test('keeps current radio until confirmation, then executes the exact prepared action once', async () => {
    const f = fixture();
    const customId = await f.prompt();
    expect(f.state.current).toBe(f.originalSession);
    expect(f.destroy).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
    const confirmation = f.makeInteraction(customId);
    await handlePlaybackSwitch(confirmation.interaction);
    expect(f.destroy).toHaveBeenCalledWith(f.originalSession.sessionId);
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(f.execute.mock.calls[0]?.[0]).toBe(confirmation.interaction);
    expect(f.execute.mock.calls[0]?.[1]).toBe(f.context);
    expect(f.execute.mock.calls[0]?.[2]).toMatchObject({guildId: f.originalSession.guildId, voiceChannelId: 'voice'});
    expect(f.events).toEqual(['destroy', f.prepared.encoded]);
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.destroy).toHaveBeenCalledTimes(1);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  test('foreign user cannot consume another user confirmation', async () => {
    const f = fixture();
    const customId = await f.prompt();
    const foreign = f.makeInteraction(customId, 'someone-else');
    await handlePlaybackSwitch(foreign.interaction);
    expect(JSON.stringify(foreign.reply.mock.calls)).toContain('다른 사용자의 전환 요청');
    expect(f.destroy).not.toHaveBeenCalled();
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  test('foreign guild cannot consume a confirmation', async () => {
    const f = fixture();
    const customId = await f.prompt();
    const foreign = f.makeInteraction(customId);
    Object.assign(foreign.interaction, {guildId: 'other-guild'});
    await handlePlaybackSwitch(foreign.interaction);
    expect(f.destroy).not.toHaveBeenCalled();
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });

  test('expires requests after two minutes without stopping current audio', async () => {
    const f = fixture();
    const customId = await f.prompt();
    const now = Date.now();
    spyOn(Date, 'now').mockReturnValue(now + 120_001);
    const confirmation = f.makeInteraction(customId);
    await handlePlaybackSwitch(confirmation.interaction);
    expect(f.destroy).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
    expect(JSON.stringify(confirmation.reply.mock.calls)).toContain('만료');
  });

  test.each(['voice', 'permission', 'session', 'obsolete-action'])('rejects changed %s at confirmation', async change => {
    const f = fixture();
    let current = true;
    const customId = await f.prompt(() => current);
    switch (change) {
      case 'voice':
        f.state.voiceId = 'new-voice';
        break;
      case 'permission':
        f.state.canSpeak = false;
        break;
      case 'session':
        f.state.current = Object.assign(Object.create(null), {...f.originalSession, sessionId: 'replacement'});
        break;
      case 'obsolete-action':
        current = false;
        break;
    }
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.destroy).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
  });

  test.each(['voice', 'permission', 'expiry'])('rechecks %s after waiting for the guild lock', async change => {
    const f = fixture();
    const customId = await f.prompt();
    const now = Date.now();
    f.state.beforeLock = () => {
      switch (change) {
        case 'voice':
          f.state.voiceId = 'new-voice';
          break;
        case 'permission':
          f.state.canSpeak = false;
          break;
        case 'expiry':
          spyOn(Date, 'now').mockReturnValue(now + 120_001);
          break;
      }
    };
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.destroy).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
  });

  test('does not execute a prepared action when identity-aware destruction fails', async () => {
    const f = fixture();
    const customId = await f.prompt();
    f.state.destroySucceeds = false;
    await handlePlaybackSwitch(f.makeInteraction(customId).interaction);
    expect(f.destroy).toHaveBeenCalledTimes(1);
    expect(f.execute).not.toHaveBeenCalled();
  });

  test('replacing a user pending request invalidates its earlier button', async () => {
    const f = fixture();
    const oldId = await f.prompt();
    const second = f.makeInteraction();
    await requestPlaybackAction(second.interaction, 'music', f.execute);
    const newId = JSON.stringify(second.reply.mock.calls).match(/playback:switch:[a-z0-9-]+/)?.[0];
    if (!newId) throw new Error('No replacement confirmation button');
    await handlePlaybackSwitch(f.makeInteraction(oldId).interaction);
    expect(f.destroy).not.toHaveBeenCalled();
    await handlePlaybackSwitch(f.makeInteraction(newId).interaction);
    expect(f.execute).toHaveBeenCalledTimes(1);
  });
});

describe('direct playback actions', () => {
  test.each(['empty', 'same-mode'])('executes %s action without stopping playback', async scenario => {
    const f = fixture();
    if (scenario === 'empty') f.state.current = undefined;
    else f.state.current = Object.assign(Object.create(null), {...f.originalSession, mode: 'music'});
    expect(await requestPlaybackAction(f.original.interaction, 'music', f.execute)).toBe(true);
    expect(f.execute).toHaveBeenCalledTimes(1);
    expect(f.destroy).not.toHaveBeenCalled();
  });

  test('checks fresh permissions after waiting for the lock', async () => {
    const f = fixture();
    f.state.current = undefined;
    f.state.beforeLock = () => {
      f.state.canSpeak = false;
    };
    expect(await requestPlaybackAction(f.original.interaction, 'music', f.execute)).toBe(false);
    expect(f.execute).not.toHaveBeenCalled();
  });

  test('obsolete action never runs or prompts', async () => {
    const f = fixture();
    expect(await requestPlaybackAction(f.original.interaction, 'music', f.execute, () => false)).toBe(false);
    expect(f.original.reply).not.toHaveBeenCalled();
    expect(f.destroy).not.toHaveBeenCalled();
    expect(f.execute).not.toHaveBeenCalled();
  });

  test('rechecks action validity after asynchronous member fetch', async () => {
    const f = fixture();
    f.state.current = undefined;
    let current = true;
    f.state.beforeFetch = () => {
      current = false;
    };
    expect(await requestPlaybackAction(f.original.interaction, 'music', f.execute, () => current)).toBe(false);
    expect(f.execute).not.toHaveBeenCalled();
  });
});
