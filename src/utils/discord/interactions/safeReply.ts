import {ButtonInteraction, CommandInteraction, type InteractionDeferReplyOptions, type InteractionEditReplyOptions, type InteractionReplyOptions, MessageFlags} from 'discord.js';

import {checkAndMarkInteraction} from './interactionManager';
import {getClient} from '@/utils/discord/client';

const hasDiscordCode = (value: unknown): value is {code: number} => {
  if (typeof value !== 'object' || value === null || !('code' in value)) return false;
  return typeof (value as {code?: unknown}).code === 'number';
};

const logInteractionError = (interaction: CommandInteraction | ButtonInteraction, action: string, error: unknown): void => {
  const client = getClient(interaction);

  if (hasDiscordCode(error) && error.code === 10062) {
    client.logger.debug(`Interaction ${interaction.id} expired/unknown before ${action}: ${error}`);
  } else {
    client.logger.error(error instanceof Error ? error : new Error(`Failed to ${action} for interaction ${interaction.id}: ${error}`));
  }
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
    logInteractionError(interaction, 'reply', error);

    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({
          content: '오류가 발생했어요.',
          flags: MessageFlags.Ephemeral,
        });
      } catch (finalError) {
        logInteractionError(interaction, 'send final fallback reply', finalError);
      }
    }
  }
}

export async function safeDeferReply(interaction: CommandInteraction | ButtonInteraction, options?: InteractionDeferReplyOptions): Promise<boolean> {
  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    logInteractionError(interaction, 'defer reply', error);
    return false;
  }
}

export async function safeDeferUpdate(interaction: ButtonInteraction): Promise<boolean> {
  try {
    await interaction.deferUpdate();
    return true;
  } catch (error) {
    logInteractionError(interaction, 'defer update', error);
    return false;
  }
}

export async function safeEditReply(interaction: CommandInteraction | ButtonInteraction, options: string | InteractionEditReplyOptions): Promise<boolean> {
  try {
    await interaction.editReply(options);
    return true;
  } catch (error) {
    logInteractionError(interaction, 'edit reply', error);
    return false;
  }
}
