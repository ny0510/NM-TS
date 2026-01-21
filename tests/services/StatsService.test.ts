import {afterEach, beforeEach, describe, expect, it, mock} from 'bun:test';
import {Events} from 'discord.js';

import {StatsService} from '@/services/StatsService';

// Mock dependencies
const mockLogger = {
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
};

const mockClient = {
  config: {
    KOREANBOTS_TOKEN: 'test-token',
    KOREANBOTS_CLIENT_ID: 'test-id',
    KOREANBOTS_UPDATE_INTERVAL: 1000,
  },
  guilds: {
    cache: {
      size: 10,
    },
  },
  shard: {
    count: 1,
  },
  once: mock((event, callback) => {
    if (event === Events.ClientReady) {
      callback();
    }
  }),
};

// Mock undici request
mock.module('undici', () => ({
  request: mock(() =>
    Promise.resolve({
      statusCode: 200,
    }),
  ),
}));

describe('StatsService', () => {
  let statsService: StatsService;

  beforeEach(() => {
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
    // @ts-ignore - Partial mock
    statsService = new StatsService(mockClient, mockLogger);
  });

  afterEach(() => {
    statsService.stop();
  });

  it('should start and schedule updates on ClientReady', () => {
    statsService.start();
    expect(mockClient.once).toHaveBeenCalledWith(Events.ClientReady, expect.any(Function));
  });

  it('should warn if token is missing', () => {
    const clientWithoutToken = {...mockClient, config: {...mockClient.config, KOREANBOTS_TOKEN: ''}};
    // @ts-ignore
    const service = new StatsService(clientWithoutToken, mockLogger);
    service.start();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('token not provided'));
  });

  it('should warn if client ID is missing', () => {
    const clientWithoutId = {...mockClient, config: {...mockClient.config, KOREANBOTS_CLIENT_ID: ''}};
    // @ts-ignore
    const service = new StatsService(clientWithoutId, mockLogger);
    service.start();
    expect(mockLogger.warn).toHaveBeenCalledWith(expect.stringContaining('client ID not provided'));
  });
});
