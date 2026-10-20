const MUSIC_URL_RULES = [
  {hosts: ['open.spotify.com'], path: /^\/(?:intl-[a-z]{2}\/)?(?:track|album|playlist|artist)\/[a-zA-Z0-9]+\/?$/},
  {hosts: ['soundcloud.com', 'www.soundcloud.com', 'm.soundcloud.com'], path: /^\/[\w-]+\/(?:[\w-]+|sets\/[\w-]+)(?:\/s-[\w-]+)?\/?$/},
  {hosts: ['twitch.tv', 'www.twitch.tv'], path: /^\/(?:[\w-]+|videos\/\d+|[\w-]+\/clip\/[\w-]+)\/?$/},
  {hosts: ['clips.twitch.tv'], path: /^\/[\w-]+\/?$/},
  {hosts: ['vimeo.com', 'www.vimeo.com', 'player.vimeo.com'], path: /^\/(?:video\/)?\d+\/?$/},
  {hosts: ['nicovideo.jp', 'www.nicovideo.jp'], path: /^\/watch\/(?:[a-z]{2})?\d+\/?$/},
  {hosts: ['nico.ms'], path: /^\/(?:[a-z]{2})?\d+\/?$/},
] as const;

const YOUTUBE_HOSTS = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be', 'www.youtu.be']);
const YOUTUBE_ID = /^[\w-]+$/;

function getYouTubeUrl(url: URL): string | undefined {
  let videoId: string | null = null;
  if (url.hostname.endsWith('youtu.be')) {
    videoId = url.pathname.slice(1);
  } else if (url.pathname === '/watch') {
    videoId = url.searchParams.get('v');
  } else {
    videoId = url.pathname.match(/^\/(?:shorts|live|embed)\/([\w-]+)\/?$/)?.[1] ?? null;
  }

  const playlistId = url.searchParams.get('list');
  if (url.pathname === '/playlist' && playlistId && YOUTUBE_ID.test(playlistId)) {
    return `https://www.youtube.com/playlist?list=${playlistId}`;
  }
  if (!videoId || !YOUTUBE_ID.test(videoId)) return;

  const canonical = new URL('https://www.youtube.com/watch');
  canonical.searchParams.set('v', videoId);
  if (playlistId && YOUTUBE_ID.test(playlistId)) canonical.searchParams.set('list', playlistId);
  const index = url.searchParams.get('index');
  if (index && /^\d+$/.test(index)) canonical.searchParams.set('index', index);
  return canonical.href;
}

export function getMusicResolveQuery(query: string, searchPrefix: string): string | undefined {
  const normalized = query.trim();
  if (!normalized) return;
  const search = normalized.match(/^(ytsearch|spsearch|scsearch):/i);
  if (search?.[1]) return `${search[1].toLowerCase()}:${normalized.slice(search[0].length)}`;

  const url = URL.parse(normalized);
  if (!url) return normalized.startsWith('//') ? undefined : `${searchPrefix}${normalized}`;
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) return;

  if (YOUTUBE_HOSTS.has(url.hostname)) return getYouTubeUrl(url);

  const approved = MUSIC_URL_RULES.some(rule => rule.hosts.some(host => host === url.hostname) && rule.path.test(url.pathname));
  const bandcamp = /^[\w-]+\.bandcamp\.com$/.test(url.hostname) && /^\/(?:track|album)\/[\w-]+\/?$/.test(url.pathname);
  if (approved || bandcamp) return `https://${url.hostname}${url.pathname}`;
}
