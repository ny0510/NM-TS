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
});
