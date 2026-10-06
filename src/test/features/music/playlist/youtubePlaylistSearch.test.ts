import {describe, expect, test} from 'bun:test';
import {MockAgent} from 'undici/index.js';
import {z} from 'zod';

import {parseYouTubePlaylistSearch, searchYouTubePlaylists, YouTubePlaylistSearchError} from '@/features/music/playlist/youtubePlaylistSearch';

function searchResponse(items: readonly unknown[]) {
  return {contents: {twoColumnSearchResultsRenderer: {primaryContents: {sectionListRenderer: {contents: [{itemSectionRenderer: {contents: items}}, {continuationItemRenderer: {}}]}}}}};
}

function playlist(id: string, title = 'City pop', author = 'Music channel') {
  return {lockupViewModel: {contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST', contentId: id, metadata: {lockupMetadataViewModel: {title: {content: title}, metadata: {contentMetadataViewModel: {metadataRows: [{metadataParts: [{text: {content: author}}]}]}}}}}};
}

describe('parseYouTubePlaylistSearch', () => {
  test('extracts public YouTube playlists and ignores videos in the WEB response', () => {
    // Given: YouTube returns a public user playlist and a video
    const data = searchResponse([playlist('PL_vocaloid', '보카로 모음'), {lockupViewModel: {contentType: 'LOCKUP_CONTENT_TYPE_VIDEO', contentId: 'video'}}]);

    // When: the search response crosses the boundary
    const playlists = parseYouTubePlaylistSearch(data);

    // Then: only the public playlist is offered for queue selection
    expect<unknown>(playlists).toEqual([{id: 'PL_vocaloid', title: '보카로 모음', author: 'Music channel'}]);
  });

  test('supports legacy playlist renderers with title runs and no author', () => {
    // Given: a legacy renderer contains split title text
    const data = searchResponse([{playlistRenderer: {playlistId: 'PL_legacy', title: {runs: [{text: 'City '}, {text: 'pop'}]}}}]);

    // When: the API response is parsed
    const playlists = parseYouTubePlaylistSearch(data);

    // Then: metadata is usable even when the channel name is absent
    expect<unknown>(playlists).toEqual([{id: 'PL_legacy', title: 'City pop', author: ''}]);
  });

  test('deduplicates identities and caps results in original search order', () => {
    // Given: repeated playlists and more results than the dropdown should offer
    const items = [playlist('PL_0', 'First'), ...Array.from({length: 15}, (_, index) => playlist(`PL_${index}`, `Playlist ${index}`))];

    // When: the API response is parsed
    const playlists = parseYouTubePlaylistSearch(searchResponse(items));

    // Then: ten distinct results retain the first result metadata
    expect(playlists.map(playlist => String(playlist.id))).toEqual(Array.from({length: 10}, (_, index) => `PL_${index}`));
    expect(playlists[0]?.title).toBe('First');
  });

  test('returns an empty result for a valid search miss', () => {
    // Given: YouTube explicitly contains no matching results
    const data = searchResponse([{messageRenderer: {}}]);

    // When: the API response is parsed
    const playlists = parseYouTubePlaylistSearch(data);

    // Then: the caller receives a normal search miss
    expect(playlists).toEqual([]);
  });

  test.each(['PL_id&other=value', '', 'x'.repeat(65)])('rejects an unsafe playlist identity: %s', id => {
    // Given: metadata cannot produce a valid canonical playlist URL
    const data = searchResponse([playlist(id)]);

    // When / Then: the response is rejected instead of offering a broken queue request
    expect(() => parseYouTubePlaylistSearch(data)).toThrow(YouTubePlaylistSearchError);
  });

  test.each([{}, {contents: null}, searchResponse([{lockupViewModel: {contentType: 'LOCKUP_CONTENT_TYPE_PLAYLIST', contentId: 'PL_missing_metadata'}}])])('rejects malformed search responses: %j', data => {
    // Given: JSON which cannot satisfy the search response contract
    // When / Then: malformed data remains distinct from a normal search miss
    expect(() => parseYouTubePlaylistSearch(data)).toThrow(YouTubePlaylistSearchError);
  });
});

describe('searchYouTubePlaylists', () => {
  test('finds Korean public playlists through one YouTube.js API request without HTML or Lavalink search', async () => {
    // Given: only a playlist-filtered WEB API request can reach the fake server
    const agent = new MockAgent();
    agent.disableNetConnect();
    const requestSchema = z.object({query: z.literal('보카로'), params: z.literal('EgIQAw=='), context: z.object({client: z.object({clientName: z.literal('WEB'), hl: z.literal('ko'), gl: z.literal('KR')})})});
    agent
      .get('https://www.youtube.com')
      .intercept({method: 'POST', path: /^\/youtubei\/v1\/search(?:\?|$)/, body: body => requestSchema.safeParse(JSON.parse(body)).success})
      .reply(200, searchResponse([playlist('PL_vocaloid', '보카로 모음')]));

    try {
      // When: the keyword that missed in LavaSrc is searched
      const playlists = await searchYouTubePlaylists(' 보카로 ', agent);

      // Then: one WEB API request provides a public user playlist
      agent.assertNoPendingInterceptors();
      expect(playlists.map(playlist => String(playlist.id))).toEqual(['PL_vocaloid']);
    } finally {
      await agent.close();
    }
  });

  test('skips blank queries without any request', async () => {
    // Given: no network endpoint is available
    const agent = new MockAgent();
    agent.disableNetConnect();

    try {
      // When / Then: blank input produces no results without contacting a server
      expect(await searchYouTubePlaylists('  ', agent)).toEqual([]);
    } finally {
      await agent.close();
    }
  });

  test.each([404, 429, 503])('preserves upstream HTTP status %s rather than reporting no results', async status => {
    // Given: YouTube rejects the search request
    const agent = new MockAgent();
    agent.disableNetConnect();
    agent
      .get('https://www.youtube.com')
      .intercept({method: 'POST', path: /^\/youtubei\/v1\/search(?:\?|$)/})
      .reply(status, 'upstream failure');

    try {
      // When / Then: a rejected search preserves the HTTP status
      await expect(searchYouTubePlaylists('music', agent)).rejects.toMatchObject({kind: 'http', statusCode: status});
    } finally {
      await agent.close();
    }
  });

  test('reports invalid JSON as a response failure', async () => {
    // Given: the API returns malformed JSON
    const agent = new MockAgent();
    agent.disableNetConnect();
    agent
      .get('https://www.youtube.com')
      .intercept({method: 'POST', path: /^\/youtubei\/v1\/search(?:\?|$)/})
      .reply(200, '{invalid}');

    try {
      // When / Then: malformed JSON is classified at the response boundary
      await expect(searchYouTubePlaylists('music', agent)).rejects.toMatchObject({kind: 'response'});
    } finally {
      await agent.close();
    }
  });

  test('reports transport failures distinctly from a search miss', async () => {
    // Given: the API connection fails before a response arrives
    const agent = new MockAgent();
    agent.disableNetConnect();
    agent
      .get('https://www.youtube.com')
      .intercept({method: 'POST', path: /^\/youtubei\/v1\/search(?:\?|$)/})
      .replyWithError(new Error('connection refused'));

    try {
      // When / Then: the caller receives a transport error
      await expect(searchYouTubePlaylists('music', agent)).rejects.toMatchObject({kind: 'network'});
    } finally {
      await agent.close();
    }
  });
});
