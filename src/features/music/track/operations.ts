import {ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, MessageFlags, inlineCode, type HexColorString} from 'discord.js';
import {LoadType} from 'shoukaku';

import type {NMClient} from '@/client/Client';
import type {AddTrackOptions, QueueTrack} from '@/types/music';
import {getColors} from '@/shared/discord/embedColors';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeReply} from '@/shared/discord/interactions';
import {playlistPattern, truncateWithEllipsis, videoPattern} from '@/shared/formatting';
import {createQuickAddButton} from '@/features/music/button/quickAdd';
import {createQueue} from '@/features/music/guard';
import {createPlayerControls} from '@/features/music/button/controls';
import {getEmbedMeta} from './embeds';
import {filterTracksWithOptions} from './resolver';

function getQueuePositionText(addFirst: boolean, index: number | null): string {
  if (addFirst) return '의 맨 앞에';
  if (index !== null) return `의 ${index}번째에`;
  return '에';
}

export const addTrackToQueue = async (client: NMClient, interaction: ChatInputCommandInteraction | ButtonInteraction, options: AddTrackOptions): Promise<void> => {
  let {query} = options;
  const {addFirst = false, index = null, ignorePlaylist = false, excludeCover = false, excludeShorts = false} = options;

  let queue = client.queues.get(interaction.guildId!);

  if (index !== null) {
    const queueSize = queue ? queue.size() : 0;
    if (!queue || (!queue.playing && !queue.paused && queueSize === 0)) {
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '아무것도 재생중이지 않을 때는 인덱스를 설정할 수 없어요.')],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (queue && index > queueSize) {
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '대기열보다 더 큰 인덱스를 설정할 수 없어요.', `대기열에 ${queueSize}곡이 있어요.`)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const currentTrack = queue ? queue.getCurrent() : null;
  if (ignorePlaylist && currentTrack?.info.isStream) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '스트리밍 음악인 경우에는 재생목록 무시 옵션을 사용할 수 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  if (ignorePlaylist) {
    if (videoPattern.test(query) && playlistPattern.test(query)) {
      query = query.replace(playlistPattern, '');
    } else {
      await safeReply(interaction, {
        embeds: [
          new EmbedBuilder()
            .setTitle('재생목록 무시 옵션을 사용하려면 유튜브 URL을 입력해야 해요.')
            .setDescription(`${inlineCode(`${videoPattern}`)} 형식의 URL을 입력해 주세요.`)
            .setColor(getColors(client.config).error),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const res = await client.services.lavalinkManager.search(query, interaction.user);

  if (!res || res.loadType === LoadType.EMPTY || res.loadType === LoadType.ERROR) {
    await safeReply(interaction, {
      embeds: [createErrorEmbed(client, '음악을 찾을 수 없어요.')],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  let extractedTracks: QueueTrack[] = [];
  switch (res.loadType) {
    case LoadType.TRACK:
      extractedTracks = [res.data as QueueTrack];
      break;
    case LoadType.SEARCH:
      extractedTracks = res.data as QueueTrack[];
      break;
    case LoadType.PLAYLIST:
      extractedTracks = res.data.tracks as QueueTrack[];
      break;
  }

  if ((excludeCover || excludeShorts) && extractedTracks.length > 0 && res.loadType !== LoadType.PLAYLIST) {
    const filterResult = filterTracksWithOptions(extractedTracks, excludeCover, excludeShorts, '검색된');
    extractedTracks = filterResult.tracks;

    if (extractedTracks.length === 0) {
      await safeReply(interaction, {
        embeds: [createErrorEmbed(client, '필터링된 결과가 없어요.', filterResult.errorMessage)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  queue = queue ?? (await createQueue(interaction));
  if (!queue) return;

  switch (res.loadType) {
    case LoadType.TRACK:
    case LoadType.SEARCH: {
      const track = extractedTracks[0] as QueueTrack;
      track.playContext = {playContext: 'play', requestChannelId: interaction.channelId ?? undefined};
      if (addFirst) queue.add(track, 0);
      else if (index !== null) queue.add(track, index);
      else queue.add(track);

      if (queue.isAutoShuffle && !addFirst && index === null && queue.size() > 1) {
        queue.shuffle();
      }

      if (!queue.playing && !queue.paused) await queue.play();

      const {colors, footerText} = await getEmbedMeta(track, false, queue, 'add');

      const queuePosition = getQueuePositionText(addFirst, index);
      let trackTitle = `음악을 대기열${queuePosition} 추가했어요.`;
      if (excludeCover && excludeShorts) {
        trackTitle = `커버 곡과 쇼츠를 제외하고 음악을 대기열${queuePosition} 추가했어요.`;
      } else if (excludeCover) {
        trackTitle = `커버 곡을 제외하고 음악을 대기열${queuePosition} 추가했어요.`;
      } else if (excludeShorts) {
        trackTitle = `쇼츠를 제외하고 음악을 대기열${queuePosition} 추가했어요.`;
      }

      const embed = new EmbedBuilder()
        .setTitle(truncateWithEllipsis(`💿 ${track.info.title}`, 50))
        .setDescription(trackTitle)
        .setThumbnail(track.info.artworkUrl ?? null)
        .setFooter({text: footerText})
        .setURL(track.info.uri ?? null)
        .setColor((colors[0]?.hex?.() ?? getColors(client.config).normal) as HexColorString);

      await safeReply(interaction, {
        embeds: [embed],
        components: [createPlayerControls(queue, track.info.uri ?? '')],
      });
      break;
    }
    case LoadType.PLAYLIST: {
      let playlistTracks = extractedTracks;

      if ((excludeCover || excludeShorts) && playlistTracks.length > 0) {
        const filterResult = filterTracksWithOptions(playlistTracks, excludeCover, excludeShorts, '재생목록의');
        playlistTracks = filterResult.tracks;

        if (playlistTracks.length === 0) {
          await safeReply(interaction, {
            embeds: [createErrorEmbed(client, '필터링된 결과가 없어요.', filterResult.errorMessage)],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      for (const track of playlistTracks) {
        track.playContext = {playContext: 'play', requestChannelId: interaction.channelId ?? undefined};
      }

      if (addFirst) queue.add(playlistTracks, 0);
      else if (index !== null) queue.add(playlistTracks, index);
      else queue.add(playlistTracks);

      if (queue.isAutoShuffle && !addFirst && index === null && queue.size() > 1) {
        queue.shuffle();
      }

      const playlistQueueSize = queue.size();
      if (!queue.playing && !queue.paused && playlistQueueSize) await queue.play();

      const {colors: playlistColors, footerText: playlistFooterText} = await getEmbedMeta(playlistTracks, true, queue);

      const playlistInfo = res.data.info;
      const originalPlaylistCount = res.data.tracks.length;

      const queuePosition = getQueuePositionText(addFirst, index);
      let playlistTitle = `재생목록에 포함된 음악 ${playlistTracks.length}곡을 대기열${queuePosition} 추가했어요.`;

      const isFiltered = playlistTracks.length !== originalPlaylistCount;

      if (isFiltered) {
        if (excludeCover && excludeShorts) {
          playlistTitle = `재생목록에서 커버 곡과 쇼츠를 제외한 음악 ${playlistTracks.length}곡을 대기열${queuePosition} 추가했어요.`;
        } else if (excludeCover) {
          playlistTitle = `재생목록에서 커버 곡을 제외한 음악 ${playlistTracks.length}곡을 대기열${queuePosition} 추가했어요.`;
        } else if (excludeShorts) {
          playlistTitle = `재생목록에서 쇼츠를 제외한 음악 ${playlistTracks.length}곡을 대기열${queuePosition} 추가했어요.`;
        }
      }

      const firstPlaylistTrack = res.data.tracks[0];
      const embed = new EmbedBuilder()
        .setTitle(truncateWithEllipsis(`📜 ${playlistInfo.name}`, 50))
        .setDescription(playlistTitle)
        .setThumbnail(firstPlaylistTrack?.info.artworkUrl ?? null)
        .setURL(query)
        .setFooter({text: `최대 100곡까지 한번에 추가할 수 있어요.\n${playlistFooterText}`})
        .setColor((playlistColors[0]?.hex?.() ?? getColors(client.config).normal) as HexColorString);

      await safeReply(interaction, {
        embeds: [embed],
        components: [createQuickAddButton()],
      });
      break;
    }
  }
};
