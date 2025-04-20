import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, MessageFlags, SlashCommandBuilder, codeBlock, hyperlink, inlineCode} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('대기열에서 음악을 제거해요.')
    .addNumberOption(option => option.setName('index').setDescription('제거할 음악의 인덱스를 입력해 주세요.').setRequired(true).setMinValue(1)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    const inVoice = await ensureVoiceChannel(interaction); // 음성 채널에 들어가 있는지 확인
    const inSameVoice = await ensureSameVoiceChannel(interaction); // 같은 음성 채널에 있는지 확인
    const isPlaying = await ensurePlaying(interaction); // 음악이 재생중인지 확인
    if (!inVoice || !inSameVoice || !isPlaying || !player) return;

    const index = interaction.options.getNumber('index')! - 1; // 0부터 시작하는 인덱스

    if (index < 0 || index >= player.queue.length) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('유효하지 않은 인덱스에요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const track = player.queue[index];

    if (!track) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle(`${index + 1}번째 음악이 없어요.`).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    player.queue.remove(index);
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
