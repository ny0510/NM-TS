import getImageColors from 'get-image-colors';

export async function getAlbumColors(artworkUrl: string | null | undefined) {
  if (!artworkUrl) return [];
  return getImageColors(artworkUrl.replace('webp', 'png'), {count: 1});
}
