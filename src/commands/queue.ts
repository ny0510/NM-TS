import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, MessageComponentInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import type {Track} from 'magmastream';
import type {Player} from 'magmastream';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {slashCommandMention} from '@/utils/discord';
import {safeReply} from '@/utils/discord/interactions';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/utils/formatting';
import {ensurePlaying} from '@/utils/music';

const TRACKS_PER_PAGE = 10;

async function buildQueueEmbed(client: NMClient, player: Player, page: number) {
  const start = (page - 1) * TRACKS_PER_PAGE;
  const end = start + TRACKS_PER_PAGE;
  const tracks = await player.queue.getSlice(start, end);
  const currentTrack = await player.queue.getCurrent();
  const totalTracks = await player.queue.size();
  const totalPages = Math.max(1, Math.ceil(totalTracks / TRACKS_PER_PAGE));
  const queueDuration = await player.queue.duration();

  const footer = totalPages > 1 ? `${page}/${totalPages} 페이지\n+${Math.max(0, totalTracks - page * TRACKS_PER_PAGE)}곡` : ' ';
  const trackList = tracks.map((track: Track, i: number) => ({
    name: `${start + i + 1}. ${truncateWithEllipsis(track.title, 50)}`,
    value: `┕ ${track.isStream ? '실시간 스트리밍' : msToTime(track.duration)} | ${typeof track.requester === 'string' ? track.requester : track.requester?.id ? `<@${track.requester.id}>` : '알 수 없음'}`,
  }));

  return new EmbedBuilder()
    .setTitle(`📋 현재 대기열 (${msToTime(queueDuration)})`)
    .setDescription(currentTrack ? hyperlink(truncateWithEllipsis(`⏵ ${currentTrack.title}`, 50), currentTrack.uri) : '현재 재생중인 음악이 없어요.')
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
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const totalTracks = await player.queue.size();
    const totalPages = Math.max(1, Math.ceil(totalTracks / TRACKS_PER_PAGE));
    let page = interaction.options.getNumber('page') ?? 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * TRACKS_PER_PAGE;
    const end = start + TRACKS_PER_PAGE;

    if (totalTracks === 0) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('대기열이 비어있어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (page < 1 || page > totalPages) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('유효하지 않은 페이지에요.').setDescription(`페이지는 1 이상 ${totalPages} 이하여야 해요.`).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const remainingTracks = Math.max(0, totalTracks - end);
    const footer = totalPages > 1 ? `${page}/${totalPages} 페이지\n+${remainingTracks}곡` : ' ';

    const embed = await buildQueueEmbed(client, player, page);
    const row = buildQueueButtons(page, totalPages);

    await safeReply(interaction, {
      embeds: [embed],
      components: [row],
    });

    const filter = async (i: MessageComponentInteraction) => {
      // queue 버튼만 처리 (다른 버튼은 무시)
      if (!i.customId.startsWith('queue_')) return false;

      if (i.user.id !== interaction.user.id) {
        try {
          // 인터랙션이 이미 응답되었는지 확인
          if (!i.replied && !i.deferred) {
            await i.reply({
              embeds: [
                new EmbedBuilder()
                  .setTitle('다른 사용자의 인터렉션이에요.')
                  .setDescription(`${await slashCommandMention(interaction, 'queue')} 명령어로 대기열을 확인할 수 있어요.`)
                  .setColor(client.config.EMBED_COLOR_ERROR),
              ],
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

    // 메시지에 바인딩된 collector 생성 (이 메시지의 버튼만 감지)
    const collector = reply.createMessageComponentCollector({filter, time: 60 * 1000 * 60}); // 60분

    const disableComponents = async () => {
      try {
        // 메시지가 여전히 존재하는지 확인
        const message = await interaction.fetchReply().catch(() => null);
        if (message) {
          await message.edit({
            embeds: [new EmbedBuilder().setTitle(`만료된 인터렉션이에요. ${await slashCommandMention(interaction, 'queue')} 명령어를 사용해 다시 확인해 주세요.`)],
            components: [],
          });
        }
      } catch (error) {
        const code = (error as {code?: number})?.code;
        // 10008: Unknown Message, 50001: Missing Access
        if (code === 10008 || code === 50001) {
          client.logger.debug(`Failed to edit message (known error ${code}): ${error}`);
        } else {
          client.logger.error(`Failed to edit message: ${error}`);
        }
      } finally {
        if (!collector.ended) collector.stop();
      }
    };

    collector.on('collect', async i => {
      if (!i.isButton()) return;

      try {
        // 중복 인터랙션 처리 방지를 위한 추가 체크
        if (i.replied || i.deferred) {
          client.logger.warn('Interaction already handled, skipping...');
          return;
        }

        // 플레이어가 여전히 존재하는지 확인
        const currentPlayer = client.manager.players.get(interaction.guildId!);
        if (!currentPlayer) {
          await i.reply({
            embeds: [new EmbedBuilder().setTitle('플레이어를 찾을 수 없어요.').setDescription('음악 재생이 중단되었거나 봇이 음성 채널에서 나갔어요.').setColor(client.config.EMBED_COLOR_ERROR)],
            flags: MessageFlags.Ephemeral,
          });
          collector.stop();
          return;
        }

        await i.deferUpdate();

        // 현재 대기열 상태에 맞는 총 페이지 수 계산
        const currentTotalTracks = await currentPlayer.queue.size();
        const currentTotalPages = Math.max(1, Math.ceil(currentTotalTracks / TRACKS_PER_PAGE));

        // 대기열이 비어있는 경우
        if (currentTotalTracks === 0) {
          await i.editReply({
            embeds: [new EmbedBuilder().setTitle('대기열이 비어있어요.').setDescription('더 이상 재생할 음악이 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
            components: [],
          });
          return;
        }

        if (i.customId === 'queue_previous' && page > 1) page--;
        else if (i.customId === 'queue_next' && page < currentTotalPages) page++;
        else if (i.customId === 'queue_refresh') {
          // 새로고침 시 현재 페이지가 유효한 범위 내에 있는지 확인
          page = Math.max(1, Math.min(page, currentTotalPages));
        }

        await i.editReply({
          embeds: [await buildQueueEmbed(client, currentPlayer, page)],
          components: [buildQueueButtons(page, currentTotalPages)],
        });
      } catch (error) {
        client.logger.error(`Error handling queue interaction: ${error}`);

        if (error && typeof error === 'object' && 'code' in error) {
          const discordError = error as {code: number};

          // 알려진 Discord 에러 코드 처리
          if (discordError.code === 10062) {
            // Unknown interaction
            client.logger.warn('Unknown interaction, stopping collector');
            collector.stop();
            return;
          } else if (discordError.code === 40060) {
            // Interaction has already been acknowledged
            client.logger.debug('Interaction already acknowledged');
            return;
          } else if (discordError.code === 10008) {
            // Unknown message
            client.logger.warn('Message was deleted, stopping collector');
            collector.stop();
            return;
          } else if (discordError.code === 50001) {
            // Missing access
            client.logger.debug('Missing access to edit message, stopping collector');
            collector.stop();
            return;
          }
        }

        // 다른 에러의 경우 사용자에게 알림 (가능한 경우)
        try {
          if (!i.replied && !i.deferred) {
            await i.reply({
              embeds: [new EmbedBuilder().setTitle('오류가 발생했어요.').setDescription('잠시 후 다시 시도해 주세요.').setColor(client.config.EMBED_COLOR_ERROR)],
              flags: MessageFlags.Ephemeral,
            });
          }
        } catch (replyError) {
          client.logger.error(`Failed to send error reply: ${replyError}`);
        }
      }
    });

    collector.on('end', (collected, reason) => {
      client.logger.debug(`Queue collector ended. Reason: ${reason}, Collected: ${collected.size}`);
      disableComponents();
    });

    // 예외적인 상황에서 컬렉터 정리
    collector.on('error', error => {
      client.logger.error(`Queue collector error: ${error}`);
      disableComponents();
    });
  },
} as Command;
