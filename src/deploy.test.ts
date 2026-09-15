import {describe, expect, test} from 'bun:test';

import {mergeCommands} from './deploy';

describe('mergeCommands', () => {
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
