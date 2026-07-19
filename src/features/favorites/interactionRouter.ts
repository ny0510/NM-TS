import {ButtonInteraction} from 'discord.js';

import {handleFavoritesDeleteCancel, handleFavoritesDeleteConfirm, handleFavoritesDeleteExec} from './handlers/deleteConfirm';
import {handleFavoritesPageJump} from './handlers/pageJump';
import {handleFavoritesPageNavigation, handleFavoritesRefresh} from './handlers/pagination';

export {handleFavoritesSelectMenu} from './handlers/selectMenu';

export async function handleFavoritesPagination(interaction: ButtonInteraction): Promise<void> {
  const {customId} = interaction;

  // Delete confirmation flow
  if (customId.startsWith('fav_remove_confirm_')) {
    await handleFavoritesDeleteConfirm(interaction);
    return;
  }

  if (customId.startsWith('fav_remove_exec_')) {
    await handleFavoritesDeleteExec(interaction);
    return;
  }

  if (customId === 'fav_remove_cancel') {
    await handleFavoritesDeleteCancel(interaction);
    return;
  }

  // Page jump modal
  if (customId.startsWith('fav_page_jump_')) {
    await handleFavoritesPageJump(interaction);
    return;
  }

  // Refresh
  if (customId.startsWith('fav_refresh_')) {
    await handleFavoritesRefresh(interaction);
    return;
  }

  // Page navigation (fallback)
  await handleFavoritesPageNavigation(interaction);
}
