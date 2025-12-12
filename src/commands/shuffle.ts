import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, SlashCommandBuilder, hyperlink, inlineCode} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';

export default {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('대기열을 섞어요.')
    .addStringOption(option => option.setName('mode').setDescription('대기열을 섞는 모드를 선택해 주세요.').addChoices({name: '랜덤', value: 'random'}, {name: '라운드 로빈', value: 'roundrobin'})),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const mode = interaction.options.getString('mode') ?? 'random';

    if (mode === 'roundrobin') await player.queue.roundRobinShuffle();
    else await player.queue.shuffle();

    return await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(`대기열을 ${mode === 'roundrobin' ? '라운드 로빈' : '랜덤'}으로 섞었어요.`)
          .setDescription(mode === 'roundrobin' ? '라운드 로빈 모드는 모든 노래를 균등하게 요청자별로 섞어요.' : ' ')
          .setColor(client.config.EMBED_COLOR_NORMAL),
      ],
    });
  },
} as Command;
