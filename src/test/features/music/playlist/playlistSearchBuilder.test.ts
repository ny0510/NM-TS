import {describe, expect, test} from 'bun:test';
import {ComponentType} from 'discord.js';

import {buildPlaylistSearchMessage} from '@/features/music/playlist/playlistSearchBuilder';
import {parseYouTubePlaylistSearch} from '@/features/music/playlist/youtubePlaylistSearch';

describe('buildPlaylistSearchMessage', () => {
  test('keeps the compact search dropdown within Discord limits and maps each option to its playlist', () => {
    // Given: ten playlists with long Korean titles and channel names
    const items = Array.from({length: 10}, (_, index) => ({playlistRenderer: {playlistId: `PL_${index}`, title: {simpleText: '한글 제목'.repeat(100)}, shortBylineText: {simpleText: '@everyone 채널'.repeat(100)}}}));
    const data = {contents: {twoColumnSearchResultsRenderer: {primaryContents: {sectionListRenderer: {contents: [{itemSectionRenderer: {contents: items}}]}}}}};
    const playlists = parseYouTubePlaylistSearch(data);
    const customId = 'search:playlist:1234567890123456789';

    // When: the search results are built for Discord
    const message = buildPlaylistSearchMessage(playlists, '검색어'.repeat(100), customId);
    const embed = message.embeds[0]?.toJSON();
    const rows = message.components.map(row => row.toJSON());

    // Then: one dropdown offers each playlist without a separate field list or button rows
    expect(rows.map(row => row.components.length)).toEqual([1]);
    const menu = rows[0]?.components[0];
    expect(menu?.type).toBe(ComponentType.StringSelect);
    if (menu?.type !== ComponentType.StringSelect) throw new TypeError('Expected a playlist dropdown');
    expect(menu.custom_id).toBe(customId);
    expect(menu.options.map(option => option.value)).toEqual(Array.from({length: 10}, (_, index) => `PL_${index}`));
    expect(menu.options.every(option => option.label.length <= 100 && (option.description?.length ?? 0) <= 100)).toBe(true);
    expect(menu.max_values).toBe(1);
    expect(embed?.title?.length).toBeLessThanOrEqual(256);
    expect(embed?.fields).toBeUndefined();
    expect(message.embeds.reduce((length, result) => length + result.length, 0)).toBeLessThanOrEqual(6000);
    expect(message.allowedMentions.parse).toEqual([]);
  });
});
