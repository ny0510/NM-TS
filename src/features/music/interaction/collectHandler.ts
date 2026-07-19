import {type ChatInputCommandInteraction, type MessageComponentInteraction, MessageFlags} from 'discord.js';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';

import type {NMClient} from '@/client/Client';
import {slashCommandMention} from '@/shared/discord';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {toError} from '@/shared/errors';

import {buildQueueButtons} from './buttonBuilder';
import {buildQueueEmbed, TRACKS_PER_PAGE} from './embedBuilder';
import {calculateQueuePage, handleQueuePageJump} from './paginationHandler';

function clampQueuePage(page: number, totalPages: number): number {
  return Math.max(1, Math.min(page, totalPages));
}

export function createQueueFilter(interaction: ChatInputCommandInteraction, client: NMClient) {
  return async (i: MessageComponentInteraction) => {
    if (!i.customId.startsWith('queue_')) return false;

    if (i.user.id !== interaction.user.id) {
      try {
        if (!i.replied && !i.deferred) {
          await i.reply({
            embeds: [createErrorEmbed(client, '다른 사용자의 인터렉션이에요.', `${await slashCommandMention(interaction, 'queue')} 명령어로 대기열을 확인할 수 있어요.`)],
            flags: MessageFlags.Ephemeral,
          });
        }
      } catch (error) {
        client.logger.warn(`Filter reply error: ${error}`);
      }
      return false;
    }

    return true;
  };
}

export async function handleQueueCollect(
  i: MessageComponentInteraction,
  client: NMClient,
  collector: {stop: () => void},
  pageRef: {value: number},
  guildId: string,
): Promise<void> {
  if (i.replied || i.deferred) {
    client.logger.warn('Interaction already handled, skipping...');
    return;
  }

  if (i.isButton() && i.customId === 'queue_page') {
    const newPage = await handleQueuePageJump(i, client, guildId);
    if (newPage !== undefined) pageRef.value = newPage;
    return;
  }

  if (!i.isButton()) return;

  const currentQueue = client.queues.get(guildId);
  if (!currentQueue) {
    await i.reply({
      embeds: [createErrorEmbed(client, '플레이어를 찾을 수 없어요.', '음악 재생이 중단되었거나 NM이 음성 채널에서 나갔어요.')],
      flags: MessageFlags.Ephemeral,
    });
    collector.stop();
    return;
  }

  await i.deferUpdate();

  const currentTotalTracks = currentQueue.size();
  const currentTotalPages = Math.max(1, Math.ceil(currentTotalTracks / TRACKS_PER_PAGE));

  if (currentTotalTracks === 0) {
    await i.editReply({
      embeds: [createErrorEmbed(client, '대기열이 비어있어요.', '더 이상 재생할 음악이 없어요.')],
      components: [],
    });
    return;
  }

  if (i.customId === 'queue_refresh') {
    pageRef.value = clampQueuePage(pageRef.value, currentTotalPages);
  } else {
    pageRef.value = calculateQueuePage(i.customId, pageRef.value, currentTotalPages);
  }

  await i.editReply({
    embeds: [buildQueueEmbed(client, currentQueue, pageRef.value)],
    components: [buildQueueButtons(pageRef.value, currentTotalPages)],
  });
}

export async function handleQueueCollectError(
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

  client.logger.error(toError(error, 'Error handling queue interaction'));

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
