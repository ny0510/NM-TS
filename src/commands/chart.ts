import {type ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {COLLECTOR_TIMEOUT_1H} from '@/shared/discord/constants';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeReply} from '@/shared/discord/interactions';
import {toError} from '@/shared/errors';
import {formatMonthLabel, getChartRanking, getCurrentMonthStart, parseMonthInput} from '@/features/chart/data';
import {TRACKS_PER_PAGE, buildChartEmbed, buildChartButtons} from '@/features/chart/embed';
import {createChartFilter, disableChartComponents, handleChartCollect, handleChartCollectError} from '@/features/chart/collector';

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
      let ranking = await getChartRanking(month, isGlobal ? null : guildId);

      if (ranking.length === 0) {
        await safeReply(interaction, {
          embeds: [createErrorEmbed(client, '아직 재생 기록이 없어요.', '음악을 재생한 후 다시 확인해 주세요.')],
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const monthLabel = formatMonthLabel(month);
      let totalPages = Math.max(1, Math.ceil(ranking.length / TRACKS_PER_PAGE));
      let page = 1;
      const guildName = interaction.guild?.name ?? null;

      const embed = buildChartEmbed(client, ranking, page, totalPages, monthLabel, isGlobal, guildName);
      const components = [buildChartButtons(page, totalPages)];

      await safeReply(interaction, {
        embeds: [embed],
        components,
      });

      const reply = await interaction.fetchReply();
      if (!reply) {
        client.logger.warn('Failed to fetch reply');
        return;
      }

      const collector = reply.createMessageComponentCollector({
        filter: createChartFilter(interaction, client),
        time: COLLECTOR_TIMEOUT_1H,
      });

      const pageRef = {value: page};
      const rankingRef = {value: ranking};
      const totalPagesRef = {value: totalPages};

      collector.on('collect', async i => {
        try {
          await handleChartCollect(i, client, collector, pageRef, rankingRef, totalPagesRef, month, monthLabel, isGlobal, guildName, guildId);
        } catch (error) {
          await handleChartCollectError(error, i, client, collector);
        }
      });

      collector.on('end', (collected, reason) => {
        client.logger.debug(`Chart collector ended. Reason: ${reason}, Collected: ${collected.size}`);
        disableChartComponents(interaction, client);
      });

      collector.on('error', error => {
        client.logger.error(toError(error, 'Chart collector error'));
        disableChartComponents(interaction, client);
      });
    } catch (error) {
      client.logger.error(toError(error, '차트 순위를 불러오는 중 오류가 발생했어요'));
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '차트를 불러오는 중 오류가 발생했어요.', '잠시 후 다시 시도해 주세요.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} satisfies Command;
