import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, SlashCommandBuilder, hyperlink, inlineCode} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder()
    .setName('shuffle')
    .setDescription('대기열을 섞어요.')
    .addStringOption(option => option.setName('mode').setDescription('대기열을 섞는 모드를 선택해 주세요.').addChoices({name: '랜덤', value: 'random'}, {name: '역순', value: 'reverse'}, {name: '라운드 로빈', value: 'roundrobin'})),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const mode = interaction.options.getString('mode') ?? 'random';

    if (mode === 'random') player.queue.shuffle();
    else if (mode === 'reverse') player.queue.reverse();
    else if (mode === 'roundrobin') player.queue.roundRobinShuffle();

    return await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(`대기열을 ${mode === 'random' ? '랜덤' : mode === 'reverse' ? '역순' : '라운드 로빈'}으로 섞었어요.`)
          .setDescription(mode === 'roundrobin' ? '라운드 로빈 모드는 모든 노래를 균등하게 요청자별로 섞어요.' : ' ')
          .setColor(client.config.EMBED_COLOR_NORMAL),
      ],
    });
  },
} as Command;
