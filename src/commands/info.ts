import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, MessageFlags, SlashCommandBuilder, time, userMention} from 'discord.js';

import {version} from '@/../package.json';
import type {Command} from '@/types/client';
import {getClient} from '@/utils/discord/client';
import {safeReply} from '@/utils/discord/interactions';

export default {
  data: new SlashCommandBuilder().setName('info').setDescription('봇의 상태를 확인해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = getClient(interaction);

    if (interaction.replied || interaction.deferred) {
      return;
    }

    try {
      const stats = client.getStats();

      const fields = [
        {name: '👨‍💻 개발자', value: userMention('690148325604720660'), inline: true},
        {name: '📦 버전', value: `v${version}`, inline: true},
        {name: '📚 라이브러리', value: '[Discord.js](https://discord.js.org), [Lavalink](https://github.com/lavalink-devs/Lavalink)', inline: true},
        {name: '📊 서버 수', value: `${stats.guilds}개`, inline: true},
        {name: '👥 사용자 수', value: `${stats.users}명`, inline: true},
        {name: '🎵 현재 재생중인 서버 수', value: `${stats.activePlayers}개`, inline: true},
        {name: '🎛 음악 서버 상태', value: `CPU ${stats.cpuUsage}% | RAM ${stats.memoryUsage}MB`},
      ];

      await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle(client.user?.username || client.user?.displayName || '')
            .setColor(client.config.EMBED_COLOR_NORMAL as HexColorString)
            .setThumbnail(client.user?.displayAvatarURL({forceStatic: true}) || '')
            .setFields(fields),
        ],
      });
    } catch (error) {
      client.logger.error(error instanceof Error ? error : new Error(`Error in info command: ${error}`));
      if (!interaction.replied && !interaction.deferred) {
        try {
          await safeReply(interaction, {
            content: '정보를 가져오는 중 오류가 발생했어요.',
            flags: MessageFlags.Ephemeral,
          });
        } catch (replyError) {
          client.logger.error(replyError instanceof Error ? replyError : new Error(`Failed to send error reply: ${replyError}`));
        }
      }
    }
  },
} satisfies Command;
