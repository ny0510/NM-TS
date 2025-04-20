import {ChatInputCommandInteraction, EmbedBuilder, MessageFlags, SlashCommandBuilder} from 'discord.js';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

export default {
  data: new SlashCommandBuilder()
    .setName('repeat')
    .setDescription('반복 재생을 설정해요.')
    .addSubcommand(sub => sub.setName('track').setDescription('현재 음악을 반복 재생해요.'))
    .addSubcommand(sub => sub.setName('queue').setDescription('대기열 전체를 반복 재생해요.'))
    .addSubcommand(sub => sub.setName('off').setDescription('반복 재생을 해제해요.')),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const subcommand = interaction.options.getSubcommand();
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    const inVoice = await ensureVoiceChannel(interaction);
    const inSameVoice = await ensureSameVoiceChannel(interaction);
    const isPlaying = await ensurePlaying(interaction);
    if (!inVoice || !inSameVoice || !isPlaying || !player) return;

    if (subcommand === 'track') {
      const enabled = !player.trackRepeat;
      player.setTrackRepeat(enabled);
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle(`현재 음악 반복을 ${enabled ? '활성화' : '비활성화'}했어요.`).setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    } else if (subcommand === 'queue') {
      const enabled = !player.queueRepeat;
      const description = enabled && player.trackRepeat ? '현재 음악 반복이 활성화된 상태여서 자동으로 비활성화했어요.' : ' ';

      player.setQueueRepeat(enabled);
      return await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle(`대기열 반복을 ${enabled ? '활성화' : '비활성화'}했어요.`)
            .setDescription(description)
            .setColor(client.config.EMBED_COLOR_NORMAL),
        ],
      });
    } else if (subcommand === 'off') {
      const trackRepeat = player.trackRepeat;
      const queueRepeat = player.queueRepeat;

      if (!trackRepeat && !queueRepeat) {
        return await safeReply(interaction, {
          embeds: [new EmbedBuilder().setTitle('반복 재생이 비활성화된 상태에요.').setColor(client.config.EMBED_COLOR_NORMAL)],
          flags: MessageFlags.Ephemeral,
        });
      }

      player.setTrackRepeat(false);
      player.setQueueRepeat(false);

      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('반복 재생을 해제했어요.').setColor(client.config.EMBED_COLOR_NORMAL)],
      });
    }
  },
} as Command;
