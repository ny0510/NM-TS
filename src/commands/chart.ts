import {ActionRowBuilder, ButtonBuilder, ButtonStyle, type ChatInputCommandInteraction, EmbedBuilder, type HexColorString, type MessageComponentInteraction, MessageFlags, SlashCommandBuilder, inlineCode} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/types/client';
import {truncateWithEllipsis} from '@/utils';
import {slashCommandMention} from '@/utils/discord';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {safeReply} from '@/utils/discord/interactions';
import {type ChartRankingRow, formatMonthLabel, getChartRanking, getCurrentMonthStart, getTotalPlayCount, parseMonthInput} from '@/utils/music/chartStats';

const TRACKS_PER_PAGE = 5;

function getRankChangeIndicator(rankChange: number | null): string {
  if (rankChange === null) return '🆕';
  if (rankChange > 0) return `🔺${rankChange}`;
  if (rankChange < 0) return `🔻${Math.abs(rankChange)}`;
  return '➖';
}

function buildChartEmbed(client: NMClient, ranking: ChartRankingRow[], page: number, totalPages: number, monthLabel: string, isGlobal: boolean, guildName: string | null): EmbedBuilder {
  const start = (page - 1) * TRACKS_PER_PAGE;
  const end = Math.min(start + TRACKS_PER_PAGE, ranking.length);
  const pageItems = ranking.slice(start, end);
  const totalPlayCount = getTotalPlayCount(ranking);

  const scopeLabel = isGlobal ? '글로벌' : (guildName ?? '이 서버');

  // const description = pageItems
  //   .map(item => {
  //     const rankIndicator = getRankChangeIndicator(item.rankChange);
  //     const title = item.uri ? hyperlink(truncateWithEllipsis(item.title, 40), item.uri) : truncateWithEllipsis(item.title, 40);
  //     const artist = truncateWithEllipsis(item.artist, 20);

  //     return `${item.rank}. ${title}\n┕ ${artist} · ${inlineCode(`${item.playCount}회`)} · ${rankIndicator}`;
  //   })
  //   .join('\n\n');

  const trackList = pageItems.map((item: ChartRankingRow, i: number) => ({
    name: `${start + i + 1}. ${truncateWithEllipsis(item.title, 50)}`,
    // value: `┕ ${track.info.isStream ? '실시간 스트리밍' : msToTime(track.info.length)} | ${typeof track.requester === 'string' ? track.requester : track.requester?.id ? `<@${track.requester.id}>` : '알 수 없음'}`,
    value: `┕ ${truncateWithEllipsis(item.artist, 50)} · ${inlineCode(`${item.playCount}회`)} · ${getRankChangeIndicator(item.rankChange)}`,
  }));

  const embed = new EmbedBuilder()
    .setTitle(`📊 ${monthLabel} ${scopeLabel} 음악 차트`)
    .addFields(trackList)
    .setColor(client.config.EMBED_COLOR_NORMAL as HexColorString)
    .setFooter({
      text: [totalPages > 1 ? `${page}/${totalPages} 페이지` : null, `총 ${ranking.length}곡 · ${totalPlayCount}회 재생`].filter(Boolean).join(' · '),
    });

  return embed;
}

function buildChartButtons(page: number, totalPages: number): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('chart_previous')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId('chart_next')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId('chart_refresh').setLabel('새로고침').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName('chart')
    .setDescription('음악 재생 순위를 확인해요.')
    .addStringOption(option => option.setName('scope').setDescription('🌐 조회 범위를 선택해 주세요.').addChoices({name: '🏠 이 서버', value: 'guild'}, {name: '🌐 전체 서버', value: 'global'}))
    .addStringOption(option => option.setName('month').setDescription('📅 조회할 달을 YYYY-MM 형식으로 입력해 주세요.')),
  cooldown: 5,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = getClient(interaction);
    const guildId = interaction.guildId;

    if (!guildId) {
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '서버에서만 사용할 수 있어요.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    const scope = interaction.options.getString('scope') ?? 'guild';
    const isGlobal = scope === 'global';
    const monthInput = interaction.options.getString('month');
    const month = monthInput ? parseMonthInput(monthInput) : getCurrentMonthStart();

    if (!month) {
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '입력한 날짜 형식이 올바르지 않아요.', 'YYYY-MM 형식으로 입력해 주세요.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    try {
      const ranking = await getChartRanking(month, isGlobal ? null : guildId);

      if (ranking.length === 0) {
        await safeReply(interaction, {
          embeds: [createErrorEmbed(client, '아직 재생 기록이 없어요.', '음악을 재생한 후 다시 확인해 주세요.')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const monthLabel = formatMonthLabel(month);
      const totalPages = Math.max(1, Math.ceil(ranking.length / TRACKS_PER_PAGE));
      let page = 1;
      const guildName = interaction.guild?.name ?? null;

      const embed = buildChartEmbed(client, ranking, page, totalPages, monthLabel, isGlobal, guildName);
      const components = [buildChartButtons(page, totalPages)];

      await safeReply(interaction, {
        embeds: [embed],
        components,
      });

      if (totalPages <= 1) return;

      const filter = async (i: MessageComponentInteraction) => {
        if (!i.customId.startsWith('chart_')) return false;

        if (i.user.id !== interaction.user.id) {
          try {
            if (!i.replied && !i.deferred) {
              await i.reply({
                embeds: [createErrorEmbed(client, '다른 사용자의 인터렉션이에요.', `${await slashCommandMention(interaction, 'chart')} 명령어로 차트를 확인할 수 있어요.`)],
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
              embeds: [new EmbedBuilder().setTitle(`만료된 인터렉션이에요. ${await slashCommandMention(interaction, 'chart')} 명령어를 사용해 다시 확인해 주세요.`)],
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

          await i.deferUpdate();

          if (i.customId === 'chart_previous' && page > 1) page--;
          else if (i.customId === 'chart_next' && page < totalPages) page++;

          await i.editReply({
            embeds: [buildChartEmbed(client, ranking, page, totalPages, monthLabel, isGlobal, guildName)],
            components: [buildChartButtons(page, totalPages)],
          });
        } catch (error) {
          client.logger.error(error instanceof Error ? error : new Error(`Error handling chart interaction: ${error}`));

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
        client.logger.debug(`Chart collector ended. Reason: ${reason}, Collected: ${collected.size}`);
        disableComponents();
      });

      collector.on('error', error => {
        client.logger.error(error instanceof Error ? error : new Error(`Chart collector error: ${error}`));
        disableComponents();
      });
    } catch (error) {
      client.logger.error(error instanceof Error ? error : new Error(`차트 순위를 불러오는 중 오류가 발생했어요: ${error}`));
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '차트를 불러오는 중 오류가 발생했어요.', '잠시 후 다시 시도해 주세요.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} satisfies Command;
