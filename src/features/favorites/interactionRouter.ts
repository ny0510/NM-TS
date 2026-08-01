import {ButtonInteraction, StringSelectMenuInteraction} from 'discord.js';

import {handleFavToggleButton} from './favToggleHandler';
import {handleFavoritesAddAll} from './handler/addAllHandler';
import {handleFavoritesDeleteCancel, handleFavoritesDeleteConfirm, handleFavoritesDeleteExec} from './handler/deleteConfirmHandler';
import {handleFavoritesPageJump} from './handler/pageJumpHandler';
import {handleFavoritesPageNavigation, handleFavoritesRefresh} from './handler/paginationHandler';
import {handleFavoritesSelectMenu} from './handler/selectMenuHandler';

export {handleFavoritesSelectMenu};

export async function handleFavoritesInteraction(interaction: ButtonInteraction | StringSelectMenuInteraction): Promise<void> {
  if (interaction.isStringSelectMenu()) {
    await handleFavoritesSelectMenu(interaction);
    return;
  }

  const {customId} = interaction;

  if (customId === 'fav_toggle') {
    await handleFavToggleButton(interaction);
    return;
  }

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

  // Add all favorites to queue
  if (customId.startsWith('fav_add_all_')) {
    await handleFavoritesAddAll(interaction);
    return;
  }

  // Page navigation (fallback)
  await handleFavoritesPageNavigation(interaction);
}
