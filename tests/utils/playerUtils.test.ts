import {beforeEach, describe, expect, it, mock} from 'bun:test';

import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music/playerUtils';

// Mock interactionManager to avoid caching issues
mock.module('@/utils/discord/interactions/interactionManager', () => ({
  checkAndMarkInteraction: mock(() => false),
}));

const mockReply = mock(() => Promise.resolve());

const mockClient = {
  config: {
    EMBED_COLOR_ERROR: '#FF0000',
  },
  manager: {
    players: {
      get: mock(guildId => null),
    },
  },
  logger: {
    warn: mock(() => {}),
    error: mock(() => {}),
  },
};

const mockInteraction = {
  client: mockClient,
  member: {
    voice: {
      channel: null,
    },
  },
  guildId: 'guild-1',
  id: 'interaction-1',
  reply: mockReply,
  followUp: mockReply,
  deferred: false,
  replied: false,
};

describe('Player Utils', () => {
  beforeEach(() => {
    mockReply.mockClear();
    mockClient.manager.players.get.mockClear();
    // @ts-ignore
    mockInteraction.member.voice.channel = null;
    mockInteraction.replied = false;
    mockInteraction.deferred = false;
    mockInteraction.id = `interaction-${Math.random()}`; // Unique ID
  });

  describe('ensureVoiceChannel', () => {
    it('should return false and reply if member is not in a voice channel', async () => {
      // @ts-ignore
      mockInteraction.member.voice.channel = null;

      // @ts-ignore
      const result = await ensureVoiceChannel(mockInteraction);

      expect(result).toBe(false);
      expect(mockReply).toHaveBeenCalled();
      const callArg = mockReply.mock.calls[0]?.[0] as any;
      expect(callArg?.embeds[0].data.title).toContain('음성 채널에 먼저 들어가 주세요');
    });

    it('should return true if member is in a voice channel', async () => {
      // @ts-ignore
      mockInteraction.member.voice.channel = {id: 'voice-1'};

      // @ts-ignore
      const result = await ensureVoiceChannel(mockInteraction);

      expect(result).toBe(true);
      expect(mockReply).not.toHaveBeenCalled();
    });
  });

  describe('ensureSameVoiceChannel', () => {
    it('should return true if no player exists', async () => {
      mockClient.manager.players.get.mockReturnValue(null);
      // @ts-ignore
      mockInteraction.member.voice.channel = {id: 'voice-1'};

      // @ts-ignore
      const result = await ensureSameVoiceChannel(mockInteraction);

      expect(result).toBe(true);
    });

    it('should return false if member is in different voice channel', async () => {
      // @ts-ignore
      mockClient.manager.players.get.mockReturnValue({voiceChannelId: 'voice-2'});
      // @ts-ignore
      mockInteraction.member.voice.channel = {id: 'voice-1'};

      // @ts-ignore
      const result = await ensureSameVoiceChannel(mockInteraction);

      expect(result).toBe(false);
      expect(mockReply).toHaveBeenCalled();
    });

    it('should return true if member is in same voice channel', async () => {
      // @ts-ignore
      mockClient.manager.players.get.mockReturnValue({voiceChannelId: 'voice-1'});
      // @ts-ignore
      mockInteraction.member.voice.channel = {id: 'voice-1'};

      // @ts-ignore
      const result = await ensureSameVoiceChannel(mockInteraction);

      expect(result).toBe(true);
    });
  });

  describe('ensurePlaying', () => {
    it('should return false if no player exists', async () => {
      mockClient.manager.players.get.mockReturnValue(null);

      // @ts-ignore
      const result = await ensurePlaying(mockInteraction);

      expect(result).toBe(false);
      expect(mockReply).toHaveBeenCalled();
    });

    it('should return false if player is not playing', async () => {
      // @ts-ignore
      mockClient.manager.players.get.mockReturnValue({playing: false, queue: {getCurrent: async () => null}});

      // @ts-ignore
      const result = await ensurePlaying(mockInteraction);

      expect(result).toBe(false);
      expect(mockReply).toHaveBeenCalled();
    });

    it('should return true if player is playing and has track', async () => {
      // @ts-ignore
      mockClient.manager.players.get.mockReturnValue({playing: true, queue: {getCurrent: async () => ({title: 'Track'})}});

      // @ts-ignore
      const result = await ensurePlaying(mockInteraction);

      expect(result).toBe(true);
    });
  });
});
