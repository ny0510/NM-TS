import {type ButtonInteraction, MessageFlags} from 'discord.js';
import {getUserFavorites} from '@/features/favorites/service';
import {getClient} from '@/shared/discord/client';
import {createErrorEmbed} from '@/shared/discord/embeds';

import {addFavoritesToQueue} from './selectMenuHandler';

export async function handleFavoritesAddAll(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);
  const userId = interaction.user.id;

  const favorites = await getUserFavorites(userId);

  if (favorites.length === 0) {
    await interaction.reply({embeds: [createErrorEmbed(client, '즐겨찾기에 추가된 곡이 없어요.')], flags: MessageFlags.Ephemeral});
    return;
  }

  await addFavoritesToQueue(interaction, favorites, 0);
}
