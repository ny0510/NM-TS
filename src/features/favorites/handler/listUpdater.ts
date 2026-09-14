import type {ButtonInteraction} from 'discord.js';
import {buildFavoritesComponents} from '@/features/favorites/componentBuilder';
import {getUserFavorites} from '@/features/favorites/service';
import {safeEditReply} from '@/shared/discord';

export async function updateFavoritesList(interaction: ButtonInteraction, userId: string, page: number): Promise<void> {
  const favorites = await getUserFavorites(userId);

  await safeEditReply(interaction, {
    components: buildFavoritesComponents(favorites, page),
  });
}
