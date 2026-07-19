import {ButtonInteraction, LabelBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle} from 'discord.js';

import {getClient} from '@/shared/discord/client';
import {MODAL_SUBMIT_TIMEOUT} from '@/shared/discord/constants';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {FAVORITES_PER_PAGE, buildFavoritesComponents} from '@/features/favorites/componentBuilder';
import {getUserFavorites} from '@/features/favorites/service';

export async function handleFavoritesPageJump(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);
  const userId = interaction.user.id;

  const favorites = await getUserFavorites(userId);
  const totalPages = Math.max(1, Math.ceil(favorites.length / FAVORITES_PER_PAGE));
  const modalId = `fav_page_modal_${interaction.id}`;
  const modal = new ModalBuilder().setCustomId(modalId).setTitle('페이지 이동');
  const pageInput = new TextInputBuilder().setCustomId('fav_page_input').setStyle(TextInputStyle.Short).setPlaceholder(`1 ~ ${totalPages}`).setRequired(true);
  const pageLabel = new LabelBuilder().setLabel('이동할 페이지 번호를 입력해 주세요.').setTextInputComponent(pageInput);
  modal.addLabelComponents(pageLabel);
  await interaction.showModal(modal);

  try {
    const submitted = await interaction.awaitModalSubmit({time: MODAL_SUBMIT_TIMEOUT, filter: mi => mi.customId === modalId});
    await submitted.deferUpdate();
    const currentFavorites = await getUserFavorites(userId);
    if (currentFavorites.length === 0) {
      await submitted.editReply({
        embeds: [createErrorEmbed(client, '즐겨찾기에 추가된 곡이 없어요.')],
        components: [],
      });
      return;
    }
    const currentTotalPages = Math.max(1, Math.ceil(currentFavorites.length / FAVORITES_PER_PAGE));
    const inputValue = parseInt(submitted.fields.getTextInputValue('fav_page_input'), 10);
    if (Number.isNaN(inputValue) || inputValue < 1 || inputValue > currentTotalPages) {
      await submitted.followUp({
        embeds: [createErrorEmbed(client, '유효하지 않은 페이지 번호예요.', `1 ~ ${currentTotalPages} 사이의 번호를 입력해 주세요.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    const newPage = inputValue - 1;
    await submitted.editReply({
      components: buildFavoritesComponents(currentFavorites, newPage),
    });
  } catch {
    return;
  }
}
