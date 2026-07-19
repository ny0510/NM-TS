import {ButtonInteraction} from 'discord.js';

import {safeEditReply} from '@/shared/discord';
import {getUserFavorites} from '@/features/favorites/service';
import {buildFavoritesComponents} from '@/features/favorites/componentBuilder';

export async function updateFavoritesList(interaction: ButtonInteraction, userId: string, page: number): Promise<void> {
  const favorites = await getUserFavorites(userId);

  await safeEditReply(interaction, {
    components: buildFavoritesComponents(favorites, page),
  });
}
