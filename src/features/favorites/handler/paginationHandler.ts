import {ButtonInteraction, MessageFlags} from 'discord.js';

import {safeDeferUpdate, safeReply} from '@/shared/discord';
import {getClient} from '@/shared/discord/client';
import {createErrorEmbed} from '@/shared/discord/embeds';

import {updateFavoritesList} from './listUpdater';

export async function handleFavoritesRefresh(interaction: ButtonInteraction): Promise<void> {
  const deferred = await safeDeferUpdate(interaction);
  if (!deferred) return;

  await updateFavoritesList(interaction, interaction.user.id, 0);
}

export async function handleFavoritesPageNavigation(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);

  const deferred = await safeDeferUpdate(interaction);
  if (!deferred) return;

  const pageMatch = interaction.customId.match(/fav_page_(-?\d+)_/);
  if (!pageMatch || !pageMatch[1]) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '잘못된 페이지 요청이에요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const page = parseInt(pageMatch[1], 10);
  await updateFavoritesList(interaction, interaction.user.id, page);
}
