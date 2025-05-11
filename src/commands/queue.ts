import {ActionRowBuilder, ButtonBuilder, ButtonInteraction, ButtonStyle, ChatInputCommandInteraction, EmbedBuilder, MessageComponentInteraction, MessageFlags, SlashCommandBuilder} from 'discord.js';
import type {Player} from 'magmastream';

import type {Command} from '@/interfaces/Command';
import type {NMClient} from '@/structs/Client';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/utils/format';
import {slashCommandMention} from '@/utils/mention';
import {ensurePlaying, ensureSameVoiceChannel, ensureVoiceChannel} from '@/utils/playerUtils';
import {safeReply} from '@/utils/safeReply';

const TRACKS_PER_PAGE = 10;

function buildQueueEmbed(client: NMClient, player: Player, page: number) {
  const start = (page - 1) * TRACKS_PER_PAGE;
  const end = start + TRACKS_PER_PAGE;
  const tracks = player.queue.slice(start, end);
  const currentTrack = player.queue.current;
  const totalTracks = player.queue.size;
  const totalPages = Math.max(1, Math.ceil(totalTracks / TRACKS_PER_PAGE));

  const footer = totalPages > 1 ? `${page}/${totalPages} 페이지\n+${Math.max(0, totalTracks - page * TRACKS_PER_PAGE)}곡` : ' ';
  const trackList = tracks.map((track: any, i: number) => ({
    name: `${start + i + 1}. ${truncateWithEllipsis(track.title, 50)}`,
    value: `┕ ${track.isStream ? '실시간 스트리밍' : msToTime(track.duration)} | ${track.requester}`,
  }));

  return new EmbedBuilder()
    .setTitle(`📋 현재 대기열 (${msToTime(player.queue.duration)})`)
    .setDescription(currentTrack ? `🎶 ${hyperlink(truncateWithEllipsis(currentTrack.title, 50), currentTrack.uri)}` : '현재 재생중인 음악이 없어요.')
    .addFields(trackList)
    .setFooter({text: footer})
    .setColor(client.config.EMBED_COLOR_NORMAL);
}

function buildQueueButtons(page: number, totalPages: number) {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('queue_previous')
      .setLabel('이전')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId('queue_next')
      .setLabel('다음')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId('queue_refresh').setLabel('새로고침').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}

export default {
  data: new SlashCommandBuilder()
    .setName('queue')
    .setDescription('대기열을 확인해요.')
    .addNumberOption(option => option.setName('page').setDescription('페이지를 선택해 주세요.').setMinValue(1)),
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction) {
    const client = interaction.client as NMClient;
    const player = client.manager.players.get(interaction.guildId!);

    if (!(await ensurePlaying(interaction))) return; // 음악이 재생중인지 확인
    if (!player) return;

    const totalTracks = player.queue.size;
    const totalPages = Math.max(1, Math.ceil(totalTracks / TRACKS_PER_PAGE));
    let page = interaction.options.getNumber('page') ?? 1;
    page = Math.max(1, Math.min(page, totalPages));
    const start = (page - 1) * TRACKS_PER_PAGE;
    const end = start + TRACKS_PER_PAGE;

    if (totalTracks === 0) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('대기열이 비어있어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    if (page < 1 || page > totalPages) {
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('유효하지 않은 페이지에요.').setDescription(`페이지는 1 이상 ${totalPages} 이하여야 해요.`).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    }

    const remainingTracks = Math.max(0, totalTracks - end);
    const footer = totalPages > 1 ? `${page}/${totalPages} 페이지\n+${remainingTracks}곡` : ' ';

    const embed = buildQueueEmbed(client, player, page);
    const row = buildQueueButtons(page, totalPages);

    await safeReply(interaction, {
      embeds: [embed],
      components: [row],
    });

    const filter = async (i: MessageComponentInteraction) => {
      if (i.user.id !== interaction.user.id) {
        i.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('다른 사용자의 인터렉션이에요.')
              .setDescription(`${await slashCommandMention(interaction, 'queue')} 명령어로 대기열을 확인할 수 있어요.`)
              .setColor(client.config.EMBED_COLOR_ERROR),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return false;
      }

      return true;
    };

    const collector = interaction.channel?.createMessageComponentCollector({filter, time: 60 * 1000});
    const followUp = await interaction.fetchReply();
    if (!collector || !followUp) return;

    const disableComponents = async () => {
      await followUp?.edit({
        embeds: [new EmbedBuilder().setTitle(`만료된 인터렉션이에요. ${await slashCommandMention(interaction, 'queue')} 명령어를 사용해 다시 확인해 주세요.`)],
        components: [],
      });
      collector.stop();
    };

    collector.on('collect', async i => {
      if (!i.isButton()) return;

      await i.deferUpdate();

      if (i.customId === 'queue_previous' && page > 1) page--;
      else if (i.customId === 'queue_next' && page < totalPages) page++;
      else if (i.customId === 'queue_refresh') page = Math.max(1, Math.min(page, totalPages));

      await interaction.editReply({
        embeds: [buildQueueEmbed(client, player, page)],
        components: [buildQueueButtons(page, totalPages)],
      });
    });

    collector.on('end', disableComponents);
  },
} as Command;
