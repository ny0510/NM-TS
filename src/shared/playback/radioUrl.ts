const RADIO_URL_PATTERN = /^https:\/\/radio\.bsod\.kr\/stream\?stn=[a-z]+(?:&ch=[a-z0-9]+)?(?:&city=[a-z0-9]+)?$/;

// Classification only: playback authorization must check the catalog allowlist.
export const isRadioUrl = (url: string | null | undefined): boolean => typeof url === 'string' && RADIO_URL_PATTERN.test(url);

export const isRadioTrack = (track: {readonly info: {readonly uri?: string | null}} | null | undefined): boolean => isRadioUrl(track?.info.uri);
