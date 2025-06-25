import {ButtonInteraction, CommandInteraction, type InteractionReplyOptions, MessageFlags} from 'discord.js';

import {checkAndMarkInteraction} from './interactionManager';
import type {NMClient} from '@/client/Client';

export async function safeReply(interaction: CommandInteraction | ButtonInteraction, content: string | InteractionReplyOptions, options?: InteractionReplyOptions): Promise<void> {
  const client = interaction.client as NMClient;

  // 이미 처리된 인터랙션인지 확인 및 마킹
  if (checkAndMarkInteraction(interaction.id)) {
    client.logger.warn(`Attempted to reply to already processed interaction: ${interaction.id}`);
    return;
  }

  // 이미 응답되었는지 확인
  if (interaction.replied) {
    client.logger.warn(`Attempted to reply to already replied interaction: ${interaction.id}`);
    return;
  }

  try {
    let replyOptions: InteractionReplyOptions;
    if (typeof content === 'string') replyOptions = {content, ...options};
    else replyOptions = content;

    if (interaction.deferred) {
      await interaction.followUp(replyOptions);
    } else {
      await interaction.reply(replyOptions);
    }
  } catch (error) {
    client.logger.error(`Failed to reply to interaction ${interaction.id}: ${error}`);

    // 마지막 시도: 오류 메시지 전송 (단, 이미 응답되지 않은 경우만)
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: '오류가 발생했어요.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (finalError) {
        client.logger.error(`Final reply attempt failed for interaction ${interaction.id}: ${finalError}`);
      }
    }
  }
}
