import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, EmbedBuilder, MessageFlags} from 'discord.js';

import {buildFavoritesComponents} from '@/features/favorites/componentBuilder';
import {getUserFavorites, removeFavorite} from '@/features/favorites/service';
import {safeDeferUpdate, safeEditReply, safeReply} from '@/shared/discord';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {toError} from '@/shared/errors';
import {truncateWithEllipsis} from '@/shared/formatting';
import {Logger} from '@/shared/logger';
import {RESTJSONErrorCodes} from 'discord-api-types/v10';

const logger = new Logger('FavoritesList');

const EPHEMERAL_TIMEOUT_MS = 3000;

export async function handleFavoritesDeleteConfirm(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);
  const userId = interaction.user.id;
  const customId = interaction.customId;

  const match = customId.match(/^fav_remove_confirm_(-?\d+)_(-?\d+)_(.+)$/);
  if (!match?.[1] || !match[2] || !match[3]) return;

  const page = Number.parseInt(match[1], 10);
  const trackId = Number.parseInt(match[2], 10);
  const nonce = match[3];
  const favMsgId = interaction.message.id;
  const favorites = await getUserFavorites(userId);
  const track = favorites.find(f => f.trackId === trackId);
  const trackTitle = track ? truncateWithEllipsis(track.title, 40) : null;
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`fav_remove_exec_${favMsgId}_${page}_${trackId}_${nonce}`).setLabel('삭제').setEmoji({name: '🗑️'}).setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('fav_remove_cancel').setLabel('취소').setEmoji({name: '✖️'}).setStyle(ButtonStyle.Primary),
  );
  await safeReply(interaction, {
    embeds: [
      new EmbedBuilder()
        .setColor(COLORS.normal)
        .setTitle(trackTitle ? trackTitle : '즐겨찾기 삭제 확인')
        .setDescription('정말로 즐겨찾기에서 삭제하시겠어요?\n삭제하면 되돌릴 수 없어요.'),
    ],
    components: [row],
    flags: MessageFlags.Ephemeral,
  });
}

export async function handleFavoritesDeleteExec(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);
  const userId = interaction.user.id;
  const customId = interaction.customId;

  const match = customId.match(/^fav_remove_exec_(\d+)_(-?\d+)_(-?\d+)_(.+)$/);
  if (!match?.[1] || !match[2] || !match[3] || !match[4]) return;

  const favMsgId = match[1];
  const page = Number.parseInt(match[2], 10);
  const trackId = Number.parseInt(match[3], 10);

  const deferred = await safeDeferUpdate(interaction);
  if (!deferred) return;

  const removed = await removeFavorite(userId, trackId);
  if (!removed) {
    await safeEditReply(interaction, {embeds: [createErrorEmbed(client, '즐겨찾기를 제거하지 못했어요.')], components: []});
    return;
  }

  await safeEditReply(interaction, {
    embeds: [new EmbedBuilder().setColor(COLORS.normal).setDescription('🗑️ 즐겨찾기에서 삭제했어요.')],
    components: [],
  });

  const favorites = await getUserFavorites(userId);
  const channel = interaction.channel;
  if (channel?.isTextBased()) {
    try {
      const favMessage = await channel.messages.fetch(favMsgId);
      if (favMessage) {
        await favMessage.edit({components: buildFavoritesComponents(favorites, page)});
      }
    } catch (error) {
      const code = (error as {code?: number})?.code;
      if (code === RESTJSONErrorCodes.UnknownMessage) {
        logger.debug(`Favorites list message ${favMsgId} no longer exists: ${error}`);
      } else {
        logger.error(toError(error, 'Failed to refresh favorites list after delete'));
      }
    }
  }

  setTimeout(() => {
    interaction.deleteReply().catch((err: unknown) => {
      const code = (err as {code?: number})?.code;
      if (code === RESTJSONErrorCodes.UnknownMessage) return;
      logger.debug(`Auto-delete ephemeral after delete failed: ${err}`);
    });
  }, EPHEMERAL_TIMEOUT_MS);
}

export async function handleFavoritesDeleteCancel(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);

  try {
    await interaction.update({
      embeds: [new EmbedBuilder().setColor(COLORS.normal).setDescription('❌ 삭제를 취소했어요.')],
      components: [],
    });
    setTimeout(() => {
      interaction.deleteReply().catch((err: unknown) => {
        const code = (err as {code?: number})?.code;
        if (code === RESTJSONErrorCodes.UnknownMessage) return;
        logger.debug(`Auto-delete ephemeral after cancel failed: ${err}`);
      });
    }, EPHEMERAL_TIMEOUT_MS);
  } catch (error) {
    logger.debug(`Failed to update cancelled ephemeral: ${error}`);
  }
}
