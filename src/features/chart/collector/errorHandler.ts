import {MessageFlags, type MessageComponentInteraction} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';

import type {NMClient} from '@/client/Client';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {toError} from '@/shared/errors';

export async function handleChartCollectError(
  error: unknown,
  i: MessageComponentInteraction,
  client: NMClient,
  collector: {stop: () => void},
): Promise<void> {
  if (error && typeof error === 'object' && 'code' in error) {
    const discordError = error as {code: number};

    if (discordError.code === RESTJSONErrorCodes.UnknownInteraction) {
      client.logger.warn('Unknown interaction, stopping collector');
      collector.stop();
      return;
    } else if (discordError.code === RESTJSONErrorCodes.InteractionHasAlreadyBeenAcknowledged) {
      client.logger.debug('Interaction already acknowledged');
      return;
    } else if (discordError.code === RESTJSONErrorCodes.UnknownMessage) {
      client.logger.warn('Message was deleted, stopping collector');
      collector.stop();
      return;
    } else if (discordError.code === RESTJSONErrorCodes.MissingAccess) {
      client.logger.debug('Missing access to edit message, stopping collector');
      collector.stop();
      return;
    }
  }

  client.logger.error(toError(error, 'Error handling chart interaction'));

  try {
    if (!i.replied && !i.deferred) {
      await i.reply({
        embeds: [createErrorEmbed(client, '오류가 발생했어요.', '잠시 후 다시 시도해 주세요.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  } catch (replyError) {
    client.logger.error(replyError instanceof Error ? replyError : new Error(`Failed to send error reply: ${replyError}`));
  }
}
