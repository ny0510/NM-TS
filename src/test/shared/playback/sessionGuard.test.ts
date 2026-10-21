import {afterEach, describe, expect, mock, test} from 'bun:test';
import {ChatInputCommandInteraction, Client, type Guild, type GuildMember, PermissionFlagsBits, PermissionsBitField, type TextChannel, type VoiceChannel} from 'discord.js';

import {getPlaybackOptions} from '@/shared/playback/sessionGuard';
import type {PlaybackSession} from '@/types/playback';

afterEach(() => mock.restore());

let sequence = 0;

function fixture() {
  const state = {
    voiceId: 'voice',
    memberAvailable: true,
    botAvailable: true,
    timeout: null as Date | null,
    textAvailable: true,
    voicePermissions: new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak]),
    textPermissions: new PermissionsBitField([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages]),
    current: undefined as PlaybackSession | undefined,
  };
  const client = Object.assign(new Client({intents: []}), {
    config: {DEFAULT_VOLUME: 23},
    logger: {warn: mock(), error: mock(), debug: mock()},
    services: {lavalinkManager: {getSession: () => state.current}},
  });
  const voice: VoiceChannel = Object.assign(Object.create(null), {
    get id() {
      return state.voiceId;
    },
    permissionsFor: () => state.voicePermissions,
  });
  Object.defineProperty(voice, 'id', {get: () => state.voiceId});
  const bot: GuildMember = Object.create(null);
  Object.defineProperty(bot, 'communicationDisabledUntil', {get: () => state.timeout});
  const member: GuildMember = Object.assign(Object.create(null), {voice: {}});
  Object.defineProperty(member.voice, 'channel', {get: () => (state.voiceId ? voice : null)});
  const fetchMember = mock(async () => {
    if (!state.memberAvailable) throw new Error('member left');
    return member;
  });
  const members = {fetch: fetchMember};
  Object.defineProperty(members, 'me', {get: () => (state.botAvailable ? bot : null)});
  const guild: Guild = Object.assign(Object.create(null), {id: 'guild', shardId: 2, members});
  client.guilds.cache.set(guild.id, guild);
  const text: TextChannel = Object.assign(Object.create(null), {id: 'text', isDMBased: () => false, permissionsFor: () => state.textPermissions});
  client.channels.cache.set(text.id, text);
  const interaction: ChatInputCommandInteraction = Object.assign(Object.create(ChatInputCommandInteraction.prototype), {
    id: `session-guard-${++sequence}`,
    client,
    guildId: 'guild',
    channelId: 'text',
    user: {id: 'user'},
    member: {voice: {channel: {id: 'stale-interaction-channel'}}},
    deferred: false,
    replied: false,
  });
  const reply = mock(async () => {
    interaction.replied = true;
  });
  Object.assign(interaction, {reply});
  return {state, client, interaction, reply, fetchMember};
}

describe('fresh playback authorization', () => {
  test('fetches the current member and uses current voice instead of interaction snapshot', async () => {
    const {interaction, fetchMember, reply} = fixture();
    expect(await getPlaybackOptions(interaction)).toEqual({guildId: 'guild', voiceChannelId: 'voice', textChannelId: 'text', shardId: 2, volume: 23, deaf: true, mute: false});
    expect(fetchMember).toHaveBeenCalledWith('user');
    expect(reply).not.toHaveBeenCalled();
  });

  test.each(['disconnected', 'left-guild'])('rejects a member who is now %s', async scenario => {
    const {state, interaction, reply} = fixture();
    if (scenario === 'disconnected') state.voiceId = '';
    else state.memberAvailable = false;
    expect(await getPlaybackOptions(interaction)).toBeUndefined();
    expect(JSON.stringify(reply.mock.calls)).toContain('음성 채널에 먼저 들어가 주세요.');
  });

  test('rejects a current session in another voice channel', async () => {
    const {state, interaction, reply} = fixture();
    state.current = Object.assign(Object.create(null), {voiceChannelId: 'other-voice'});
    expect(await getPlaybackOptions(interaction)).toBeUndefined();
    expect(JSON.stringify(reply.mock.calls)).toContain('봇과 같은 음성 채널에 있어야 해요.');
  });

  test.each(['missing-bot', 'timed-out'])('rejects a %s bot', async scenario => {
    const {state, interaction, reply} = fixture();
    if (scenario === 'missing-bot') state.botAvailable = false;
    else state.timeout = new Date(Date.now() + 60_000);
    expect(await getPlaybackOptions(interaction)).toBeUndefined();
    expect(JSON.stringify(reply.mock.calls)).toContain('봇의 타임아웃 상태');
  });

  test.each(['view-voice', 'connect', 'speak', 'view-text', 'send', 'missing-text'])('checks current %s permission', async scenario => {
    const {state, client, interaction, reply} = fixture();
    switch (scenario) {
      case 'view-voice':
        state.voicePermissions.remove(PermissionFlagsBits.ViewChannel);
        break;
      case 'connect':
        state.voicePermissions.remove(PermissionFlagsBits.Connect);
        break;
      case 'speak':
        state.voicePermissions.remove(PermissionFlagsBits.Speak);
        break;
      case 'view-text':
        state.textPermissions.remove(PermissionFlagsBits.ViewChannel);
        break;
      case 'send':
        state.textPermissions.remove(PermissionFlagsBits.SendMessages);
        break;
      case 'missing-text':
        client.channels.cache.delete('text');
        break;
    }
    expect(await getPlaybackOptions(interaction)).toBeUndefined();
    expect(JSON.stringify(reply.mock.calls)).toContain('권한이 부족해요.');
  });
});
