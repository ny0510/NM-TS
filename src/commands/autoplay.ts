import {ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder().setName('autoplay').setDescription('자동 재생을 설정해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const enabled = !player.isAutoplay;
    player.setAutoplay(enabled, client.user);

    await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(`자동 재생을 ${enabled ? '활성화' : '비활성화'}했어요.`)
          .setDescription(enabled ? '마지막 곡이 끝나면 자동으로 비슷한 곡을 재생해요.' : ' ')
          .setColor(client.config.EMBED_COLOR_NORMAL),
      ],
    });
  },
} as Command;
