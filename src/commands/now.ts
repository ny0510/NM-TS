import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, SlashCommandBuilder, hyperlink, inlineCode} from 'discord.js';
import getColors from 'get-image-colors';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {msToTime, truncateWithEllipsis} from '@/utils/format';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder().setName('now').setDescription('현재 재생중인 음악을 확인해요.'),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    const inVoice = await ensureVoiceChannel(interaction); // 음성 채널에 들어가 있는지 확인
    const inSameVoice = await ensureSameVoiceChannel(interaction); // 같은 음성 채널에 있는지 확인
    const isPlaying = await ensurePlaying(interaction); // 음악이 재생중인지 확인
    if (!inVoice || !inSameVoice || !isPlaying || !player) return;

    const track = player.queue.current!;
    const colors = await getColors(track.artworkUrl.replace('webp', 'png'), {count: 1});
    const repeatState = player.queueRepeat ? '대기열 반복 중' : player.trackRepeat ? '현재 음악 반복 중' : '반복 중이 아님';

    return await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setDescription(`${player.playing ? '▶️' : '⏸️'} ${hyperlink(truncateWithEllipsis(track.title, 50), track.uri)}`)
          .setThumbnail(track.artworkUrl)
          .setFields([
            {
              name: '곡 길이',
              value: inlineCode(`${track.isStream ? '실시간 스트리밍' : msToTime(track.duration)}`),
              inline: true,
            },
            {
              name: '남은 대기열',
              value: inlineCode(`${player.queue.length}곡 (${msToTime(player.queue.duration)})`),
              inline: true,
            },
            {
              name: '볼륨',
              value: inlineCode(`${player.volume}%`),
              inline: true,
            },
            {
              name: '반복',
              value: inlineCode(`${repeatState}`),
              inline: true,
            },
            {
              name: '추천 음악 자동 재생',
              value: inlineCode(player.isAutoplay ? '활성화 됨' : '비활성화 됨'),
              inline: true,
            },
            {
              name: '요청자',
              value: `${track.requester}`,
              inline: true,
            },
          ])
          .setColor((colors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString),
      ],
    });
  },
} as Command;
