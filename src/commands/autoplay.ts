import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, SlashCommandBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {safeReply} from '@/utils/discord/interactions';
import {createAutoplayEmbed, ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel, initializeAutoplay} from '@/utils/music';

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

    // const enabled = !player.get('autoplayEnabled');
    const enabled = player.isAutoplay;

    if (!enabled) {
      await interaction.deferReply();
      player.setAutoplay(true, interaction.user);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 재생을 활성화했어요!').setDescription('마지막 곡이 끝나면 자동으로 비슷한 곡을 재생해요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });

      // const result = await initializeAutoplay(client, player);

      // if (!result.success) {
      //   return await safeReply(interaction, {
      //     embeds: [
      //       new EmbedBuilder()
      //         .setTitle('자동 재생 활성화 중 오류가 발생했어요.')
      //         .setDescription(result.error || '알 수 없는 오류가 발생했어요.')
      //         .setColor(client.config.EMBED_COLOR_ERROR),
      //     ],
      //   });
      // }

      // player.set('autoplayEnabled', true);

      // if (result.addedTracks.length > 0) {
      //   const embed = await createAutoplayEmbed(result.addedTracks, player, client, '자동 재생을 활성화했어요!', '마지막 곡이 끝나면 자동으로 비슷한 곡을 재생해요.');

      //   const currentDescription = embed.data.description || '';
      //   const newDescription = currentDescription.replace(`${result.addedTracks.length}곡을 대기열에 추가했어요.`, `현재 재생중인 곡과 관련된 음악 ${result.addedTracks.length}곡을 대기열에 추가했어요.`);
      //   embed.setDescription(newDescription);

      //   return await safeReply(interaction, {
      //     embeds: [embed],
      //   });
      // } else {
      //   return await safeReply(interaction, {
      //     embeds: [new EmbedBuilder().setTitle('관련 음악을 찾지 못했어요.')],
      //   });
      // }
    } else {
      // 자동재생 비활성화
      // player.set('autoplayEnabled', false);
      player.setAutoplay(false);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('자동 재생을 비활성화했어요.').setDescription('더 이상 관련 음악을 자동으로 추가하지 않아요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    }
  },
} as Command;
