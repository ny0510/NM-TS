import {type CommandInteraction, type InteractionDeferReplyOptions, type InteractionEditReplyOptions, type InteractionReplyOptions, type Message, type MessageComponentInteraction, MessageFlags, MessagePayload} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';
import {getClient} from '@/shared/discord/client';
import {toError} from '@/shared/errors';
import {checkAndMarkInteraction} from './interactionManager';

type ReplyInteraction = CommandInteraction | MessageComponentInteraction;

const hasDiscordCode = (value: unknown): value is {code: number} => {
  if (typeof value !== 'object' || value === null || !('code' in value)) return false;
  return typeof value.code === 'number';
};

const logInteractionError = (interaction: ReplyInteraction, action: string, error: unknown): void => {
  const client = getClient(interaction);

  if (hasDiscordCode(error) && error.code === RESTJSONErrorCodes.UnknownInteraction) {
    const name = 'commandName' in interaction ? interaction.commandName : interaction.customId;
    client.logger.warn(`Interaction expired before ${action}: id=${interaction.id} name=${name} ageMs=${Date.now() - interaction.createdTimestamp}`);
  } else if (hasDiscordCode(error) && error.code === RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged) {
    client.logger.debug(`Interaction already acknowledged before ${action}: id=${interaction.id}`);
  } else if (hasDiscordCode(error) && error.code === RESTJSONErrorCodes.UnknownMessage) {
    const name = 'commandName' in interaction ? interaction.commandName : interaction.customId;
    client.logger.warn(`Interaction response no longer exists before ${action}: id=${interaction.id} name=${name}`);
  } else {
    client.logger.error(toError(error, `Failed to ${action} for interaction ${interaction.id}`));
  }
};

export async function safeReply(interaction: ReplyInteraction, content: string | InteractionReplyOptions, options?: InteractionReplyOptions): Promise<void> {
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

    if (interaction.deferred && typeof interaction.ephemeral === 'boolean') {
      const payload = MessagePayload.create(interaction.webhook, replyOptions).resolveBody();
      const body = payload.body;
      const ephemeral = replyOptions.ephemeral ?? Boolean(body && 'flags' in body && (body.flags ?? 0) & MessageFlags.Ephemeral);
      if (interaction.ephemeral === ephemeral) {
        if (body && 'flags' in body) body.flags = (body.flags ?? 0) & (MessageFlags.SuppressEmbeds | MessageFlags.IsComponentsV2);
        await interaction.editReply(payload);
      } else {
        await interaction.editReply({content: '처리 결과를 별도로 안내할게요.'});
        await interaction.followUp(replyOptions);
        await interaction.deleteReply();
      }
    } else if (interaction.deferred) {
      await interaction.followUp(replyOptions);
    } else {
      await interaction.reply(replyOptions);
    }
  } catch (error) {
    logInteractionError(interaction, 'reply', error);

    if (hasDiscordCode(error) && (error.code === RESTJSONErrorCodes.UnknownInteraction || error.code === RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged)) return;

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

export async function safeDeferReply(interaction: ReplyInteraction, options?: InteractionDeferReplyOptions): Promise<boolean> {
  if (interaction.replied) return false;
  if (interaction.deferred) return true;
  try {
    await interaction.deferReply(options);
    return true;
  } catch (error) {
    logInteractionError(interaction, 'defer reply', error);
    return false;
  }
}

export async function safeFollowUp(interaction: ReplyInteraction, options: InteractionReplyOptions): Promise<Message | undefined> {
  try {
    return await interaction.followUp(options);
  } catch (error) {
    logInteractionError(interaction, 'send follow-up', error);
    return undefined;
  }
}

export async function safeDeferUpdate(interaction: MessageComponentInteraction): Promise<boolean> {
  if (interaction.replied) return false;
  if (interaction.deferred) return true;
  try {
    await interaction.deferUpdate();
    return true;
  } catch (error) {
    logInteractionError(interaction, 'defer update', error);
    return false;
  }
}

export async function safeEditReply(interaction: ReplyInteraction, options: string | InteractionEditReplyOptions): Promise<boolean> {
  try {
    await interaction.editReply(options);
    return true;
  } catch (error) {
    logInteractionError(interaction, 'edit reply', error);
    return false;
  }
}
