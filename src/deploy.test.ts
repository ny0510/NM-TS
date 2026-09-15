import {describe, expect, spyOn, test} from 'bun:test';
import {REST} from 'discord.js';

import {deployCommands, mergeCommands} from './deploy';

describe('mergeCommands', () => {
  test('strips localized response-only fields from preserved commands', () => {
    // Given: a command response with requester-specific translations
    const remote = [{id: 'id', name: 'remote', type: 1, description: 'Remote', name_localized: '원격', description_localized: '원격 설명'}];
    // When: the response is prepared for writing
    const merged = mergeCommands(remote, []);
    // Then: response-only translations are omitted
    expect(merged).toEqual([{name: 'remote', type: 1, description: 'Remote'}]);
  });
  test('removes server-managed fields from preserved remote commands', () => {
    // Given: a Discord REST command response with read-only server fields
    const remote = [{id: 'remote-id', application_id: 'app-id', version: 'version-id', name: 'launch', description: 'Launch activity', options: [], type: 4}];

    // When: remote-only commands are merged for a bulk overwrite
    const merged = mergeCommands(remote, []);

    // Then: only writable command fields are retained
    expect(merged).toEqual([{name: 'launch', description: 'Launch activity', options: [], type: 4}]);
  });

  test('uses the local definition when a command name already exists remotely', () => {
    // Given: remote and local definitions with the same name
    const remote = [{id: 'remote-id', name: 'ping', description: 'Old', options: [], type: 1}];
    const local = [{name: 'ping', description: 'New', options: [], type: 1}];

    // When: commands are merged
    const merged = mergeCommands(remote, local);

    // Then: the local writable definition wins
    expect(merged).toEqual(local);
  });

  test('preserves writable remote fields required for Discord command contracts', () => {
    // Given: a remote command that includes writable fields beyond name/description/options
    const remote = [{id: 'remote-id', version: 'version-id', application_id: 'app-id', name: 'stats', description: '통계', type: 1, contexts: [0, 1, 2], integration_types: [0], default_member_permissions: '8', dm_permission: false, name_localizations: {ko: '통계'}, description_localizations: {ko: '통계 보기'}}];

    // When: remote commands are prepared for bulk overwrite
    const merged = mergeCommands(remote, []);

    // Then: writable fields are preserved while server-managed fields are dropped
    expect(merged).toEqual([
      {
        name: 'stats',
        description: '통계',
        type: 1,
        contexts: [0, 1, 2],
        integration_types: [0],
        default_member_permissions: '8',
        dm_permission: false,
        name_localizations: {ko: '통계'},
        description_localizations: {ko: '통계 보기'},
      },
    ]);
  });

  test('keeps commands with the same name when command types differ', () => {
    // Given: remote commands sharing a name but using different Discord command types
    const remote = [
      {name: 'info', description: '채팅 입력', type: 1},
      {name: 'info', type: 2},
    ];

    // When: commands are merged without local overrides
    const merged = mergeCommands(remote, []);

    // Then: both command entries are retained
    expect(merged).toEqual([
      {name: 'info', description: '채팅 입력', type: 1},
      {name: 'info', type: 2},
    ]);
  });
});

describe('deployCommands localization round trip', () => {
  test.each(['global', 'guild'] as const)('requests and preserves full localization dictionaries for %s commands', async scope => {
    // Given: Discord only supplies full dictionaries when requested
    const localizedCommand = {name: 'remote-localized', type: 1, description: 'Remote', name_localizations: {ko: '원격'}, description_localizations: {ko: '원격 설명'}, options: [{type: 3, name: 'value', description: 'Value', name_localizations: {ko: '값'}, description_localizations: {ko: '값 설명'}}]};
    const get = spyOn(REST.prototype, 'get').mockImplementation(async (_route, options) => (options?.query?.get('with_localizations') === 'true' ? [localizedCommand] : [{name: 'remote-localized', type: 1, description: 'Remote'}]));
    const put = spyOn(REST.prototype, 'put').mockResolvedValue([]);
    try {
      // When: the real deployment path fetches, merges and overwrites commands
      await deployCommands({scope, preserveRemoteCommands: true});
      // Then: the outgoing command retains command and option translations
      expect(put.mock.calls[0]?.[1]?.body).toContainEqual(localizedCommand);
    } finally {
      get.mockRestore();
      put.mockRestore();
    }
  });
});
