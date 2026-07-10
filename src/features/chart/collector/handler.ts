import {type MessageComponentInteraction, ModalBuilder, TextInputBuilder, TextInputStyle, LabelBuilder, MessageFlags} from 'discord.js';

import type {NMClient} from '@/client/Client';
import {MODAL_SUBMIT_TIMEOUT} from '@/shared/discord/constants';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {getChartRanking} from '@/features/chart/data';
import {TRACKS_PER_PAGE, buildChartEmbed, buildChartButtons} from '@/features/chart/embed';
import type {MutablePage, MutableRanking, MutableTotalPages} from './types';

export async function handleChartCollect(
  i: MessageComponentInteraction,
  client: NMClient,
  collector: {stop: () => void; ended: boolean},
  pageRef: MutablePage,
  rankingRef: MutableRanking,
  totalPagesRef: MutableTotalPages,
  month: Date,
  monthLabel: string,
  isGlobal: boolean,
  guildName: string | null,
  guildId: string,
): Promise<void> {
  if (i.replied || i.deferred) {
    client.logger.warn('Interaction already handled, skipping...');
    return;
  }

  /* 페이지 이동 버튼 → 모달 표시 + awaitModalSubmit */
  if (i.isButton() && i.customId === 'chart_page') {
    const modalId = `chart_page_modal_${i.id}`;
    const modal = new ModalBuilder().setCustomId(modalId).setTitle('페이지 이동');
    const pageInput = new TextInputBuilder()
      .setCustomId('chart_page_input')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder(`1 ~ ${totalPagesRef.value}`)
      .setRequired(true);
    const pageLabel = new LabelBuilder()
      .setLabel('이동할 페이지 번호를 입력해 주세요.')
      .setTextInputComponent(pageInput);
    modal.addLabelComponents(pageLabel);
    await i.showModal(modal);

    try {
      const modalInteraction = await i.awaitModalSubmit({time: MODAL_SUBMIT_TIMEOUT, filter: mi => mi.customId === modalId});
      await modalInteraction.deferUpdate();

      const inputValue = parseInt(modalInteraction.fields.getTextInputValue('chart_page_input'), 10);
      if (isNaN(inputValue) || inputValue < 1 || inputValue > totalPagesRef.value) {
        await modalInteraction.followUp({
          embeds: [createErrorEmbed(client, '유효하지 않은 페이지 번호예요.', `1 ~ ${totalPagesRef.value} 사이의 번호를 입력해 주세요.`)],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }
      pageRef.value = inputValue;
      await modalInteraction.editReply({
        embeds: [buildChartEmbed(client, rankingRef.value, pageRef.value, totalPagesRef.value, monthLabel, isGlobal, guildName)],
        components: [buildChartButtons(pageRef.value, totalPagesRef.value)],
      });
    } catch {
      /* 모달 시간 초과 무시 */
    }
    return;
  }

  if (!i.isButton()) return;

  await i.deferUpdate();

  if (i.customId === 'chart_previous' && pageRef.value > 1) {
    pageRef.value--;
  } else if (i.customId === 'chart_next' && pageRef.value < totalPagesRef.value) {
    pageRef.value++;
  } else if (i.customId === 'chart_refresh') {
    rankingRef.value = await getChartRanking(month, isGlobal ? null : guildId);
    totalPagesRef.value = Math.max(1, Math.ceil(rankingRef.value.length / TRACKS_PER_PAGE));
    if (pageRef.value > totalPagesRef.value) pageRef.value = totalPagesRef.value;
    if (pageRef.value < 1) pageRef.value = 1;
  }

  if (rankingRef.value.length === 0) {
    await i.editReply({
      embeds: [createErrorEmbed(client, '아직 재생 기록이 없어요.', '음악을 재생한 후 다시 확인해 주세요.')],
      components: [],
    });
    collector.stop();
    return;
  }

  await i.editReply({
    embeds: [buildChartEmbed(client, rankingRef.value, pageRef.value, totalPagesRef.value, monthLabel, isGlobal, guildName)],
    components: [buildChartButtons(pageRef.value, totalPagesRef.value)],
  });
}
