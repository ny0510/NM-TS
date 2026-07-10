import {ButtonInteraction, EmbedBuilder, type HexColorString, MessageFlags} from 'discord.js';
import getImageColors from 'get-image-colors';

import type {QueueTrack} from '@/types/music';
import {safeDeferUpdate, safeReply, slashCommandMention} from '@/shared/discord';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {truncateWithEllipsis} from '@/shared/formatting';
import {ensurePlaying, ensureSameVoiceChannel} from '@/features/music/guard';
import {addFavorite, isFavorited, removeFavoriteByIdentifier} from '@/features/favorites/service';

export async function handleFavToggleButton(interaction: ButtonInteraction): Promise<void> {
  const client = getClient(interaction);
  const queue = client.queues.get(interaction.guildId!);

  if (!queue) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '현재 재생 중인 음악이 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (!(await ensurePlaying(interaction))) return;
  if (!(await ensureSameVoiceChannel(interaction))) return;

  const currentTrack = queue.getCurrent();
  if (!currentTrack) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '현재 재생 중인 음악이 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const embedUrl = interaction.message.embeds[0]?.url;
  if (embedUrl && embedUrl !== currentTrack.info.uri) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '만료된 컨트롤러에요.', '현재 재생 중인 음악의 컨트롤러를 사용해 주세요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const deferred = await safeDeferUpdate(interaction);
  if (!deferred) return;

  const userId = interaction.user.id;
  const source = currentTrack.info.sourceName ?? 'unknown';
  const identifier = currentTrack.info.identifier;

  if (!identifier) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '트랙 정보를 가져오지 못했어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const alreadyFavorited = await isFavorited(userId, source, identifier);
  const colors = currentTrack?.info.artworkUrl ? await getImageColors(currentTrack.info.artworkUrl.replace('webp', 'png'), {count: 1}) : [];

  if (alreadyFavorited) {
    const success = await removeFavoriteByIdentifier(userId, source, identifier);
    if (success) {
      await interaction.followUp({
        embeds: [new EmbedBuilder().setTitle(truncateWithEllipsis(`🗑️ ${currentTrack.info.title}`, 50)).setColor(COLORS.error)],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '즐겨찾기 제거에 실패했어요.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  } else {
    const success = await addFavorite(userId, currentTrack);
    if (success) {
      await interaction.followUp({
        embeds: [new EmbedBuilder().setTitle(truncateWithEllipsis(`⭐️ ${currentTrack.info.title}`, 50)).setColor((colors[0]?.hex?.() ?? COLORS.normal) as HexColorString)],
        flags: MessageFlags.Ephemeral,
      });
    } else {
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '즐겨찾기 추가에 실패했어요.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  }
}

export async function getFavoritedState(userId: string, track: QueueTrack['info']): Promise<boolean> {
  const source = track.sourceName ?? 'unknown';
  const identifier = track.identifier;
  if (!identifier) return false;
  return await isFavorited(userId, source, identifier);
}
