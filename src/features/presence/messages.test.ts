import {describe, expect, test} from 'bun:test';

import {buildPresenceMessages} from './messages';

const templates = {
  PRESENCE_UPDATE_INTERVAL_MS: 10_000,
  PRESENCE_INITIAL_MESSAGE: '초기화 중',
  PRESENCE_MESSAGES: ['서버 {guilds}개 · 사용자 {users}명', '차트 안내', '즐겨찾기 안내', '재생 서버 {players}개'],
};

describe('buildPresenceMessages', () => {
  test('renders configured templates with current statistics', () => {
    // Given: configured presence templates and active player statistics
    const stats = {guilds: 12, users: 345, activePlayers: 6, memoryUsage: 0, cpuUsage: 0};

    // When: the rotating presence messages are built
    const messages = buildPresenceMessages(templates, stats);

    // Then: placeholders are replaced and the active-player message is included
    expect(messages).toEqual(['서버 12개 · 사용자 345명', '차트 안내', '즐겨찾기 안내', '재생 서버 6개']);
  });

  test('omits the active-player message when nothing is playing', () => {
    // Given: configured presence templates with no active players
    const stats = {guilds: 12, users: 345, activePlayers: 0, memoryUsage: 0, cpuUsage: 0};

    // When: the rotating presence messages are built
    const messages = buildPresenceMessages(templates, stats);

    // Then: only the always-visible configured messages remain
    expect(messages).toEqual(['서버 12개 · 사용자 345명', '차트 안내', '즐겨찾기 안내']);
  });

  test('keeps at least one message when every template depends on active players', () => {
    // Given: templates that all include the active-player placeholder
    const playerOnlyTemplates = {...templates, PRESENCE_MESSAGES: ['재생 서버 {players}개']};
    const stats = {guilds: 12, users: 345, activePlayers: 0, memoryUsage: 0, cpuUsage: 0};

    // When: rotating messages are built with no active players
    const messages = buildPresenceMessages(playerOnlyTemplates, stats);

    // Then: a valid fallback message is still produced
    expect(messages).toEqual(['재생 서버 0개']);
  });
});
