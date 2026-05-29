import {type ChatInputCommandInteraction, EmbedBuilder, type HexColorString, MessageFlags, SlashCommandBuilder, hyperlink, inlineCode} from 'discord.js';

import type {Command} from '@/types/client';
import {truncateWithEllipsis} from '@/utils';
import {getClient} from '@/utils/discord/client';
import {createErrorEmbed} from '@/utils/discord/embeds';
import {safeReply} from '@/utils/discord/interactions';
import {formatMonthLabel, getCurrentMonthStart, getMonthlyTrackRanking, parseMonthInput} from '@/utils/music/monthlyStats';

function buildRankingDescription(items: Awaited<ReturnType<typeof getMonthlyTrackRanking>>): string {
  if (!items || items.length === 0) return '아직 이 달의 재생 기록이 없어요.';

  return items
    .map((item, index) => {
      const title = item.uri ? hyperlink(truncateWithEllipsis(item.title, 50), item.uri) : truncateWithEllipsis(item.title, 50);
      return `${index + 1}위. ${title} - ${inlineCode(`${item.playCount}회`)}`;
    })
    .join('\n');
}

export default {
  data: new SlashCommandBuilder()
    .setName('monthly-ranking')
    .setDescription('이번 달 곡 재생 순위를 확인해요.')
    .addStringOption(option => option.setName('month').setDescription('조회할 달을 YYYY-MM 형식으로 입력해 주세요.')),
  cooldown: 3,
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
      const ranking = await getMonthlyTrackRanking(guildId, month);

      const monthLabel = formatMonthLabel(month);
      const description = buildRankingDescription(ranking);

      await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle(`📊 ${monthLabel} 음악 재생 순위`)
            .setDescription(description)
            .setColor(client.config.EMBED_COLOR_NORMAL as HexColorString),
        ],
      });
    } catch (error) {
      client.logger.error(error instanceof Error ? error : new Error(`월간 재생 순위를 불러오는 중 오류가 발생했어요: ${error}`));
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '순위를 불러오는 중 오류가 발생했어요.', '잠시 후 다시 시도해 주세요.')],
        flags: MessageFlags.Ephemeral,
      });
    }
  },
} satisfies Command;
