import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, MessageComponentInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Queue} from '@/structures/Queue';
import type {Command} from '@/types/client';
import type {QueueTrack} from '@/types/music';
import {slashCommandMention} from '@/utils/discord';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {safeReply} from '@/utils/discord/interactions';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/utils/formatting';
import {ensurePlaying} from '@/utils/music';

const TRACKS_PER_PAGE = 10;

function buildQueueEmbed(client: NMClient, queue: Queue, page: number) {
  const start = (page - 1) * TRACKS_PER_PAGE;
  const end = start + TRACKS_PER_PAGE;
  const tracks = queue.getSlice(start, end);
  const currentTrack = queue.getCurrent();
  const totalTracks = queue.size();
  const totalPages = Math.max(1, Math.ceil(totalTracks / TRACKS_PER_PAGE));
  const queueDuration = queue.duration();
  const footer = totalPages > 1 ? `${page}/${totalPages} 페이지\n+${Math.max(0, totalTracks - page * TRACKS_PER_PAGE)}곡` : ' ';

  const trackList = tracks.map((track: QueueTrack, i: number) => ({
    name: `${start + i + 1}. ${truncateWithEllipsis(track.info.title, 50)}`,
    value: `┕ ${track.info.isStream ? '실시간 스트리밍' : msToTime(track.info.length)} | ${typeof track.requester === 'string' ? track.requester : track.requester?.id ? `<@${track.requester.id}>` : '알 수 없음'}`,
  }));

  return new EmbedBuilder()
    .setTitle(`📋 현재 대기열 (${msToTime(queueDuration)})`)
    .setDescription(currentTrack ? hyperlink(truncateWithEllipsis(`⏵ ${currentTrack.info.title}`, 50), currentTrack.info.uri ?? '') : '현재 재생중인 음악이 없어요.')
    .addFields(trackList)
    .setFooter({text: footer})
    .setColor(client.config.EMBED_COLOR_NORMAL);
}

function buildQueueButtons(page: number, totalPages: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('queue_previous')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId('queue_next')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId('queue_refresh').setLabel('새로고침').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('대기열을 확인해요.')
    .addNumberOption(option => option.setName('page').setDescription('페이지를 선택해 주세요.').setMinValue(1)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);

    if (!(await ensurePlaying(interaction))) return;
    if (!queue) return;

    const totalTracks = queue.size();
    const totalPages = Math.max(1, Math.ceil(totalTracks / TRACKS_PER_PAGE));
    let page = interaction.options.getNumber('page') ?? 1;
    page = Math.max(1, Math.min(page, totalPages));

    if (totalTracks === 0) {
      return await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '대기열이 비어있어요.')],
        flags: MessageFlags.Ephemeral,
      });
    }

    const embed = buildQueueEmbed(client, queue, page);
    const row = buildQueueButtons(page, totalPages);

    await safeReply(interaction, {
      embeds: [embed],
      components: [row],
    });

    const filter = async (i: MessageComponentInteraction) => {
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

    const reply = await interaction.fetchReply();
    if (!reply) {
      client.logger.warn('Failed to fetch reply');
      return;
    }

    const collector = reply.createMessageComponentCollector({filter, time: 60 * 1000 * 60});

    const disableComponents = async () => {
      try {
        const message = await interaction.fetchReply().catch(() => null);
        if (message) {
          await message.edit({
            embeds: [new EmbedBuilder().setTitle(`만료된 인터렉션이에요. ${await slashCommandMention(interaction, 'queue')} 명령어를 사용해 다시 확인해 주세요.`)],
            components: [],
          });
        }
      } catch (error) {
        const code = (error as {code?: number})?.code;
        if (code === 10008 || code === 50001) {
          client.logger.debug(`Failed to edit message (known error ${code}): ${error}`);
        } else {
          client.logger.error(error instanceof Error ? error : new Error(`Failed to edit message: ${error}`));
        }
      } finally {
        if (!collector.ended) collector.stop();
      }
    };

    collector.on('collect', async i => {
      if (!i.isButton()) return;

      try {
        if (i.replied || i.deferred) {
          client.logger.warn('Interaction already handled, skipping...');
          return;
        }

        const currentQueue = client.queues.get(interaction.guildId!);
        if (!currentQueue) {
          await i.reply({
            embeds: [createErrorEmbed(client, '플레이어를 찾을 수 없어요.', '음악 재생이 중단되었거나 봇이 음성 채널에서 나갔어요.')],
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

        if (i.customId === 'queue_previous' && page > 1) page--;
        else if (i.customId === 'queue_next' && page < currentTotalPages) page++;
        else if (i.customId === 'queue_refresh') {
          page = Math.max(1, Math.min(page, currentTotalPages));
        }

        await i.editReply({
          embeds: [buildQueueEmbed(client, currentQueue, page)],
          components: [buildQueueButtons(page, currentTotalPages)],
        });
      } catch (error) {
        client.logger.error(error instanceof Error ? error : new Error(`Error handling queue interaction: ${error}`));

        if (error && typeof error === 'object' && 'code' in error) {
          const discordError = error as {code: number};

          if (discordError.code === 10062) {
            client.logger.warn('Unknown interaction, stopping collector');
            collector.stop();
            return;
          } else if (discordError.code === 40060) {
            client.logger.debug('Interaction already acknowledged');
            return;
          } else if (discordError.code === 10008) {
            client.logger.warn('Message was deleted, stopping collector');
            collector.stop();
            return;
          } else if (discordError.code === 50001) {
            client.logger.debug('Missing access to edit message, stopping collector');
            collector.stop();
            return;
          }
        }

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
    });

    collector.on('end', (collected, reason) => {
      client.logger.debug(`Queue collector ended. Reason: ${reason}, Collected: ${collected.size}`);
      disableComponents();
    });

    collector.on('error', error => {
      client.logger.error(error instanceof Error ? error : new Error(`Queue collector error: ${error}`));
      disableComponents();
    });
  },
} satisfies Command;
