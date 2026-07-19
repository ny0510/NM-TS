import {ChatInputCommandInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {COLLECTOR_TIMEOUT_1H} from '@/shared/discord/constants';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeReply} from '@/shared/discord/interactions';
import {toError} from '@/shared/errors';
import {validateMusicCommand} from '@/features/music/guard';
import {buildQueueButtons, disableQueueComponents} from '@/features/music/interaction/buttonBuilder';
import {createQueueFilter, handleQueueCollect, handleQueueCollectError} from '@/features/music/interaction/collectHandler';
import {buildQueueEmbed, TRACKS_PER_PAGE} from '@/features/music/interaction/embedBuilder';

export default {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('대기열을 확인해요.')
    .addNumberOption(option => option.setName('page').setDescription('📄 조회할 페이지 번호를 입력해 주세요.').setMinValue(1)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = getClient(interaction);
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
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

    await safeReply(interaction, {
      embeds: [buildQueueEmbed(client, queue, page)],
      components: [buildQueueButtons(page, totalPages)],
    });

    const reply = await interaction.fetchReply();
    if (!reply) {
      client.logger.warn('Failed to fetch reply');
      return;
    }

    const collector = reply.createMessageComponentCollector({
      filter: createQueueFilter(interaction, client),
      time: COLLECTOR_TIMEOUT_1H,
    });

    const state = {value: page};

    collector.on('collect', async i => {
      try {
        await handleQueueCollect(i, client, collector, state, interaction.guildId!);
      } catch (error) {
        await handleQueueCollectError(error, i, client, collector);
      }
    });

    collector.on('end', (collected, reason) => {
      client.logger.debug(`Queue collector ended. Reason: ${reason}, Collected: ${collected.size}`);
      disableQueueComponents(interaction, client);
    });

    collector.on('error', error => {
      client.logger.error(toError(error, 'Queue collector error'));
      disableQueueComponents(interaction, client);
    });
  },
} satisfies Command;
