import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, MessageFlags, SlashCommandBuilder, codeBlock, hyperlink, inlineCode} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {safeReply} from '@/utils/discord/interactions';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/music';

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('대기열에서 음악을 제거해요.')
    .addNumberOption(option => option.setName('index').setDescription('제거할 음악의 인덱스를 입력해 주세요.').setRequired(true).setMinValue(1)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인
    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const index = interaction.options.getNumber('index')! - 1; // 0부터 시작하는 인덱스
    const queueSize = await player.queue.size();

    if (index < 0 || index >= queueSize) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('유효하지 않은 인덱스에요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const tracks = await player.queue.getSlice(index, index + 1);
    const track = tracks[0];

    if (!track) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle(`${index + 1}번째 음악이 없어요.`).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    await player.queue.remove(index);
    return await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(`${index + 1}번째 음악을 대기열에서 제거했어요.`)
          .setDescription(codeBlock('diff', `- ${track.title}`))
          .setColor(client.config.EMBED_COLOR_NORMAL as HexColorString),
      ],
    });
  },
} as Command;
