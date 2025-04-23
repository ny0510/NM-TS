import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, SlashCommandBuilder, time, userMention} from 'discord.js';

import {version} from '@/../package.json';
import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder().setName('info').setDescription('봇의 상태를 확인해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;

    const status = Array.from(client.manager.nodes.values())[0]?.stats;
    const cpu = status?.cpu ? Math.round(status.cpu.lavalinkLoad * 100) : 0;
    const memory = status?.memory ? Math.round(status.memory.used / 1024 / 1024) : 0;
    const uptime = status?.uptime ? new Date(new Date().getTime() - status.uptime) : null;
    const guilds = interaction.client.guilds.cache;

    const fields = [
      {name: '개발자', value: `👨‍💻 ${userMention('690148325604720660')}`, inline: true},
      {name: '버전', value: `📦 v${version}`, inline: true},
      {name: '라이브러리', value: `📚 [Discord.js](https://discord.js.org), [Lavalink](https://github.com/lavalink-devs/Lavalink)`, inline: true},
      {name: '서버 수', value: `📊 ${guilds.size}개`, inline: true},
      {name: '사용자 수', value: `👥 ${guilds.reduce((a, g) => a + g.memberCount, 0)}명`, inline: true},
      {name: '현재 재생중인 서버 수', value: `🎵 ${client.manager.players.size}개`, inline: true},
      {name: '음악 서버 상태', value: `🎛 CPU ${cpu}% | 🛢️ RAM ${memory}MB | 🕒 업타임 ${uptime !== null ? time(uptime, 'R') : 'N/A'}`},
    ];

    return safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle(client.user?.username || client.user?.displayName || '')
          .setColor(client.config.EMBED_COLOR_NORMAL as HexColorString)
          .setThumbnail(client.user?.displayAvatarURL({forceStatic: true}) || '')
          .setFields(fields),
      ],
    });
  },
} as Command;
