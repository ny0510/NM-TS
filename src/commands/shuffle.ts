import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/types/client';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {safeReply} from '@/shared/discord/interactions';
import {validateMusicCommand} from '@/features/music/guard';

export default {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('대기열을 섞어요.')
    .addStringOption(option => option.setName('mode').setDescription('대기열을 섞는 모드를 선택해 주세요.').addChoices({name: '🎲 랜덤', value: 'random'}, {name: '🔄 라운드 로빈', value: 'roundrobin'})),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const queue = await validateMusicCommand(interaction, {requirePlaying: true});
    if (!queue) return;
    const client = getClient(interaction);

    const mode = interaction.options.getString('mode') ?? 'random';

    if (mode === 'roundrobin') queue.roundRobinShuffle();
    else queue.shuffle();

    return await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(`대기열을 ${mode === 'roundrobin' ? '라운드 로빈' : '랜덤'}으로 섞었어요.`)
          .setDescription(mode === 'roundrobin' ? '라운드 로빈 모드는 모든 노래를 균등하게 요청자별로 섞어요.' : null)
          .setColor(COLORS.normal),
      ],
    });
  },
} satisfies Command;
