import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlayerReady} from '@/utils/music';

export default {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('대기열을 섞어요.')
    .addStringOption(option => option.setName('mode').setDescription('대기열을 섞는 모드를 선택해 주세요.').addChoices({name: '랜덤', value: 'random'}, {name: '라운드 로빈', value: 'roundrobin'})),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    if (!(await ensurePlayerReady(interaction, {requirePlaying: true}))) return;

    const client = getClient(interaction);
    const queue = client.queues.get(interaction.guildId!);
    if (!queue) return;

    const mode = interaction.options.getString('mode') ?? 'random';

    if (mode === 'roundrobin') queue.roundRobinShuffle();
    else queue.shuffle();

    return await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(`대기열을 ${mode === 'roundrobin' ? '라운드 로빈' : '랜덤'}으로 섞었어요.`)
          .setDescription(mode === 'roundrobin' ? '라운드 로빈 모드는 모든 노래를 균등하게 요청자별로 섞어요.' : null)
          .setColor(client.config.EMBED_COLOR_NORMAL),
      ],
    });
  },
} satisfies Command;
