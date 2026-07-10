import {ButtonInteraction, LabelBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {MODAL_SUBMIT_TIMEOUT} from '@/shared/discord/constants';
import {createErrorEmbed} from '@/shared/discord/embeds';

import {buildQueueButtons} from './buttonBuilder';
import {buildQueueEmbed} from './embedBuilder';
import {TRACKS_PER_PAGE} from './embedBuilder';

/**
 * Handles prev/next page navigation.
 * Returns the new page number for the given customId, or the current page unchanged.
 */
export function calculateQueuePage(customId: string, currentPage: number, totalPages: number): number {
  if (customId === 'queue_previous' && currentPage > 1) return currentPage - 1;
  if (customId === 'queue_next' && currentPage < totalPages) return currentPage + 1;
  return currentPage;
}

/**
 * Handles the "queue_page" button — shows a modal for page jump,
 * awaits the modal submit, validates the input, and updates the message.
 * Returns the new page on success, or undefined if the flow errored/timed out.
 */
export async function handleQueuePageJump(interaction: ButtonInteraction, client: NMClient, guildId: string): Promise<number | undefined> {
  const totalPages = Math.max(1, Math.ceil((client.queues.get(guildId)?.size() ?? 0) / TRACKS_PER_PAGE));
  const modalId = `queue_page_modal_${interaction.id}`;
  const modal = new ModalBuilder().setCustomId(modalId).setTitle('페이지 이동');
  const pageInput = new TextInputBuilder()
    .setCustomId('queue_page_input')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`1 ~ ${totalPages}`)
    .setRequired(true);
  const pageLabel = new LabelBuilder().setLabel('이동할 페이지 번호를 입력해 주세요.').setTextInputComponent(pageInput);
  modal.addLabelComponents(pageLabel);
  await interaction.showModal(modal);

  try {
    const modalInteraction = await interaction.awaitModalSubmit({time: MODAL_SUBMIT_TIMEOUT, filter: mi => mi.customId === modalId});
    await modalInteraction.deferUpdate();

    const currentQueue = client.queues.get(guildId);
    if (!currentQueue || currentQueue.size() === 0) {
      await modalInteraction.editReply({
        embeds: [createErrorEmbed(client, '대기열이 비어있어요.', '더 이상 재생할 음악이 없어요.')],
        components: [],
      });
      return;
    }

    const currentTotalPages = Math.max(1, Math.ceil(currentQueue.size() / TRACKS_PER_PAGE));
    const inputValue = parseInt(modalInteraction.fields.getTextInputValue('queue_page_input'), 10);
    if (isNaN(inputValue) || inputValue < 1 || inputValue > currentTotalPages) {
      await modalInteraction.followUp({
        embeds: [createErrorEmbed(client, '유효하지 않은 페이지 번호예요.', `1 ~ ${currentTotalPages} 사이의 번호를 입력해 주세요.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await modalInteraction.editReply({
      embeds: [buildQueueEmbed(client, currentQueue, inputValue)],
      components: [buildQueueButtons(inputValue, currentTotalPages)],
    });

    return inputValue;
  } catch {
    return;
  }
}
