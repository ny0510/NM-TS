import {ButtonInteraction, CommandInteraction, type InteractionReplyOptions, MessageFlags} from 'discord.js';

import {checkAndMarkInteraction} from './interactionManager';
import {getClient} from '@/utils/discord/client';

const hasDiscordCode = (value: unknown): value is {code: number} => {
  if (typeof value !== 'object' || value === null || !('code' in value)) return false;
  return typeof (value as {code?: unknown}).code === 'number';
};

export async function safeReply(interaction: CommandInteraction | ButtonInteraction, content: string | InteractionReplyOptions, options?: InteractionReplyOptions): Promise<void> {
  const client = getClient(interaction);

  if (checkAndMarkInteraction(interaction.id)) {
    client.logger.warn(`Attempted to reply to already processed interaction: ${interaction.id}`);
    return;
  }

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
    if (hasDiscordCode(error) && error.code === 10062) {
      client.logger.debug(`Interaction ${interaction.id} expired/unknown before reply could be sent: ${error}`);
    } else {
      client.logger.error(error instanceof Error ? error : new Error(`Failed to reply to interaction ${interaction.id}: ${error}`));
    }

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: '오류가 발생했어요.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (finalError) {
        if (hasDiscordCode(finalError) && finalError.code === 10062) {
          client.logger.debug(`Final reply attempt failed for interaction ${interaction.id}: Unknown interaction`);
        } else {
          client.logger.error(finalError instanceof Error ? finalError : new Error(`Final reply attempt failed for interaction ${interaction.id}: ${finalError}`));
        }
      }
    }
  }
}
