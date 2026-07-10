import {ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, resolveColor, SeparatorBuilder, SeparatorSpacingSize, TextDisplayBuilder} from 'discord.js';
import type {MessageActionRowComponentBuilder} from 'discord.js';

import type {NMClient} from '@/client/Client';
import type {Queue} from '@/features/music/queue/Queue';
import type {QueueTrack} from '@/types/music';
import {COLORS} from '@/shared/discord/embedColors';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/shared/formatting';

export const TRACKS_PER_PAGE = 10;

function formatRequester(requester: unknown): string {
  if (typeof requester === 'string') return requester;
  if (requester && typeof requester === 'object' && 'id' in requester) return `<@${(requester as {id: string}).id}>`;
  return '알 수 없음';
}

function buildPaginationRow(page: number, totalPages: number): ActionRowBuilder<MessageActionRowComponentBuilder> {
  return new ActionRowBuilder<MessageActionRowComponentBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('queue_previous')
      .setEmoji('◀')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page <= 1),
    new ButtonBuilder()
      .setCustomId('queue_page')
      .setLabel(`${page}/${totalPages}`)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(totalPages <= 1),
    new ButtonBuilder()
      .setCustomId('queue_next')
      .setEmoji('▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(page >= totalPages),
    new ButtonBuilder().setCustomId('queue_refresh').setLabel('새로고침').setEmoji('🔄').setStyle(ButtonStyle.Primary),
  );
}

export function buildQueueContainer(client: NMClient, queue: Queue, page: number): ContainerBuilder {
  const start = (page - 1) * TRACKS_PER_PAGE;
  const end = start + TRACKS_PER_PAGE;
  const tracks = queue.getSlice(start, end);
  const currentTrack = queue.getCurrent();
  const totalTracks = queue.size();
  const totalPages = Math.max(1, Math.ceil(totalTracks / TRACKS_PER_PAGE));
  const queueDuration = queue.duration();
  const nextTrack = queue.getSlice(0, 1)[0] as QueueTrack | undefined;

  const container = new ContainerBuilder().setAccentColor(resolveColor(COLORS.normal));

  // Header
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`### 📋 현재 대기열 (${msToTime(queueDuration)})`));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // Current track
  if (currentTrack) {
    const title = truncateWithEllipsis(currentTrack.info.title, 50);
    const url = currentTrack.info.uri ?? '';
    const duration = currentTrack.info.isStream ? '실시간 스트리밍' : msToTime(currentTrack.info.length);
    const requester = formatRequester(currentTrack.requester);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`**${hyperlink(`⏵ ${title}`, url)}**\n┕ ${duration} | ${requester}`),
    );
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('> 현재 재생중인 음악이 없어요.'));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // Next track
  if (nextTrack) {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(`**다음 곡** · **${truncateWithEllipsis(nextTrack.info.title, 50)}**`));
  } else {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent('**다음 곡** · 없음'));
  }

  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // Track list — TextDisplay per track
  tracks.forEach((track, i) => {
    const index = start + i + 1;
    const duration = track.info.isStream ? '실시간 스트리밍' : msToTime(track.info.length);
    const requester = formatRequester(track.requester);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`${index}. **${truncateWithEllipsis(track.info.title, 50)}**\n┕ ${duration} | ${requester}`),
    );
  });

  // Footer
  const footerText = totalPages > 1 ? `-# ${page}/${totalPages} 페이지 · +${Math.max(0, totalTracks - page * TRACKS_PER_PAGE)}곡` : ' ';
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(footerText));
  container.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));

  // Pagination buttons
  container.addActionRowComponents(buildPaginationRow(page, totalPages));

  return container;
}
