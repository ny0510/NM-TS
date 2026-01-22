import {ButtonInteraction, ChatInputCommandInteraction, EmbedBuilder, GuildMember, type HexColorString, MessageFlags, PermissionFlagsBits, type PermissionsString, channelMention, codeBlock, inlineCode} from 'discord.js';
import getColors from 'get-image-colors';
import {LoadTypes, type Player, StateTypes, type Track} from 'magmastream';

import type {NMClient} from '@/client/Client';
import {config} from '@/utils/config';
import {PermissionTranslations, slashCommandMention} from '@/utils/discord';
import {safeReply} from '@/utils/discord/interactions';
import {coverPattern, hyperlink, msToTime, playlistPattern, truncateWithEllipsis, videoPattern} from '@/utils/formatting';
import {createQuickAddButton} from '@/utils/music/buttons/quickAddButton';

export const ensureVoiceChannel = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const client = interaction.client as NMClient;
  const member = interaction.member as GuildMember;

  if (!member.voice?.channel) {
    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('음성 채널에 먼저 들어가 주세요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }

  return true;
};

export const ensureSameVoiceChannel = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const client = interaction.client as NMClient;
  const member = interaction.member as GuildMember;
  const player = client.manager.players.get(interaction.guildId!);

  if (player && member.voice.channel?.id !== player.voiceChannelId) {
    await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle('해당 명령어를 실행하기 위해서는 같은 음성 채널에 있어야 해요.')
          .setDescription(`${channelMention(player.voiceChannelId || '')} 음성 채널에 들어가 주세요.`)
          .setColor(client.config.EMBED_COLOR_ERROR),
      ],
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
};

export const ensurePlaying = async (interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<boolean> => {
  const client = interaction.client as NMClient;
  const player = client.manager.players.get(interaction.guildId!);
  const currentTrack = player ? await player.queue.getCurrent() : null;

  if (!player || (!player.playing && !player.paused) || !currentTrack) {
    await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle('현재 재생중인 음악이 없어요.')
          .setDescription(`${await slashCommandMention(interaction, 'play')} 명령어로 음악을 재생할 수 있어요.`)
          .setColor(client.config.EMBED_COLOR_ERROR),
      ],
      flags: MessageFlags.Ephemeral,
    });

    return false;
  }

  return true;
};

export const createPlayer = async (interaction: ChatInputCommandInteraction | ButtonInteraction): Promise<Player | undefined> => {
  const client = interaction.client as NMClient;
  const member = interaction.member as GuildMember;
  const channel = client.channels.cache.get(interaction.channelId);

  if (!channel || channel.isDMBased()) return;

  const guild = client.guilds.cache.get(interaction.guildId!);
  const botMember = guild?.members.me;
  const botPermissions = channel.permissionsFor(botMember!);

  // PermissionFlagsBits 기반으로 권한 체크 및 누락 권한 표시
  const requiredPermissions = [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages];
  const missingPermissions = requiredPermissions.filter(perm => !botPermissions?.has(perm));

  if (missingPermissions.length) {
    // PermissionFlagsBits: { [key: string]: bigint } 형태이므로, 역매핑 필요
    const bitToName = Object.entries(PermissionFlagsBits).reduce(
      (acc, [name, bit]) => {
        acc[bit.toString()] = name;
        return acc;
      },
      {} as Record<string, string>,
    );

    const missingText = missingPermissions
      .map(perm => {
        const permName = bitToName[perm.toString()] as PermissionsString | undefined;
        const displayName = permName || perm.toString();
        const translation = permName && PermissionTranslations[permName] ? PermissionTranslations[permName] : '알 수 없음';
        return `+ ${translation} (${displayName})`;
      })
      .join('\n');
    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('명령어를 실행하기 위해 필요한 권한이 부족해요. 아래 권한을 추가해 주세요.').setDescription(codeBlock('diff', missingText)).setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  try {
    const player = client.manager.create({
      guildId: interaction.guildId!,
      voiceChannelId: member.voice.channel?.id,
      textChannelId: interaction.channelId,
      volume: client.config.DEFAULT_VOLUME,
      selfDeafen: true,
      selfMute: true,
    });
    if (player.state !== StateTypes.Connected) player.connect();
    return player;
  } catch (e) {
    client.logger.error(`Failed to create player: ${e}`);
    let errorMessage = '플레이어를 생성하는 중 오류가 발생했어요.';
    let errorDescription = '';

    if (e instanceof Error) {
      if (e.message.includes('User limit')) {
        errorMessage = '음성 채널이 가득 찼어요.';
        errorDescription = '다른 음성 채널을 이용해 주세요.';
      } else if (client.config.IS_DEV_MODE) {
        errorDescription = codeBlock('js', e.message);
      }
    }

    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle(errorMessage).setDescription(errorDescription).setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }
};

export const ensurePaused = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const client = interaction.client as NMClient;
  const player = client.manager.players.get(interaction.guildId!);
  if (!player || player.paused) {
    await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle('음악이 이미 일시정지 상태에요.')
          .setDescription(`${await slashCommandMention(interaction, 'resume')} 명령어로 다시 재생할 수 있어요.`)
          .setColor(client.config.EMBED_COLOR_ERROR),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
};

export const ensureResumed = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const client = interaction.client as NMClient;
  const player = client.manager.players.get(interaction.guildId!);
  if (!player || !player.paused) {
    await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle('음악이 이미 재생중이에요.')
          .setDescription(`${await slashCommandMention(interaction, 'pause')} 명령어로 일시 정지할 수 있어요.`)
          .setColor(client.config.EMBED_COLOR_ERROR),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return false;
  }
  return true;
};

export const getEmbedMeta = async (trackOrTracks: Track | Track[], isPlaylist: boolean, player: Player, action?: 'play' | 'add') => {
  if (isPlaylist) {
    const tracks = trackOrTracks as Track[];
    const firstTrack = tracks[0];
    const colors = firstTrack?.artworkUrl ? await getColors(firstTrack.artworkUrl.replace('webp', 'png'), {count: 1}) : [];
    const playlistDuration = tracks.reduce((acc, track) => acc + (track.duration || 0), 0);
    const queueSize = await player.queue.size();
    const queueDuration = await player.queue.duration();
    const currentTrack = await player.queue.getCurrent();
    // queue.duration()이 current 트랙도 포함하므로, current 트랙의 duration을 빼줌
    const actualQueueDuration = currentTrack ? queueDuration - (currentTrack.duration || 0) : queueDuration;
    const footerText = `추가된 음악 ${tracks.length}곡 (${msToTime(playlistDuration)}) | 대기열에 ${queueSize}곡 (${msToTime(actualQueueDuration)})`;
    return {colors, footerText};
  } else {
    const track = trackOrTracks as Track;
    const colors = track.artworkUrl ? await getColors(track.artworkUrl.replace('webp', 'png'), {count: 1}) : [];
    const actionText = action === 'add' ? '추가된' : '재생중인';
    const queueSize = await player.queue.size();
    const queueDuration = await player.queue.duration();
    const currentTrack = await player.queue.getCurrent();
    // queue.duration()이 current 트랙도 포함하므로, current 트랙의 duration을 빼줌
    const actualQueueDuration = currentTrack ? queueDuration - (currentTrack.duration || 0) : queueDuration;
    const footerText = `${actionText} 음악 (${track.isStream ? '실시간 스트리밍' : msToTime(track.duration)}) | 대기열에 ${queueSize}곡 (${msToTime(actualQueueDuration)})`;
    return {colors, footerText};
  }
};

function isCoverTrack(track: Track): boolean {
  return coverPattern.test(track.title) || coverPattern.test(track.author);
}

function isShortsTrack(track: Track): boolean {
  const isDurationShorts = track.duration !== undefined && track.duration > 0 && track.duration <= 60000;
  const hasShortsTags = /#shorts/i.test(track.title);

  return isDurationShorts || hasShortsTags;
}

export interface AddTrackOptions {
  query: string;
  addFirst?: boolean;
  index?: number | null;
  ignorePlaylist?: boolean;
  excludeCover?: boolean;
  excludeShorts?: boolean;
  source?: 'play' | 'quick_add';
}

export const addTrackToQueue = async (client: NMClient, interaction: ChatInputCommandInteraction | ButtonInteraction, options: AddTrackOptions): Promise<void> => {
  let {query} = options;
  const {addFirst = false, index = null, ignorePlaylist = false, excludeCover = false, excludeShorts = false} = options;

  let player = client.manager.players.get(interaction.guildId!);

  // 옵션 상호작용 검증 및 플레이어 상태 확인
  if (index !== null) {
    const queueSize = player ? await player.queue.size() : 0;
    if (!player || (!player.playing && !player.paused && queueSize === 0)) {
      await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('아무것도 재생중이지 않을 때는 인덱스를 설정할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
    if (player && index > queueSize) {
      await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle(`대기열보다 더 큰 인덱스를 설정할 수 없어요.`).setDescription(`대기열에 ${queueSize}곡이 있어요.`).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const currentTrack = player ? await player.queue.getCurrent() : null;
  if (ignorePlaylist && currentTrack?.isStream) {
    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('스트리밍 음악인 경우에는 재생목록 무시 옵션을 사용할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
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
            .setColor(client.config.EMBED_COLOR_ERROR),
        ],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  const res = await client.manager.search(query, interaction.user);

  if (res.loadType === LoadTypes.Empty || res.loadType === LoadTypes.Error) {
    await safeReply(interaction, {
      embeds: [new EmbedBuilder().setTitle('음악을 찾을 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  // 필터링 옵션이 활성화된 경우 트랙 필터링
  if ((excludeCover || excludeShorts) && 'tracks' in res && res.tracks.length > 0) {
    const originalTracksCount = res.tracks.length;

    if (excludeCover && excludeShorts) {
      res.tracks = res.tracks.filter((track: Track) => !isCoverTrack(track) && !isShortsTrack(track));
    } else if (excludeCover) {
      res.tracks = res.tracks.filter((track: Track) => !isCoverTrack(track));
    } else if (excludeShorts) {
      res.tracks = res.tracks.filter((track: Track) => !isShortsTrack(track));
    }

    // 모든 트랙이 필터링된 경우
    if (res.tracks.length === 0) {
      let errorMessage = '';
      if (excludeCover && excludeShorts) {
        errorMessage = `검색된 ${originalTracksCount}곡이 모두 커버 곡 또는 쇼츠로 판단되었어요.`;
      } else if (excludeCover) {
        errorMessage = `검색된 ${originalTracksCount}곡이 모두 커버 곡으로 판단되었어요.`;
      } else if (excludeShorts) {
        errorMessage = `검색된 ${originalTracksCount}곡이 모두 쇼츠로 판단되었어요.`;
      }

      await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('필터링된 결과가 없어요.').setDescription(errorMessage).setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
      return;
    }
  }

  // 플레이어 생성 (없는 경우)
  player = player ?? (await createPlayer(interaction));
  if (!player) return;

  switch (res.loadType) {
    case LoadTypes.Track:
    case LoadTypes.Search: {
      const track = res.tracks[0] as Track;
      if (addFirst) await player.queue.add(track, 0);
      else if (index !== null) await player.queue.add(track, index);
      else await player.queue.add(track);

      const trackQueueSize = await player.queue.size();
      if (!player.playing && !player.paused && !trackQueueSize) await player.play();

      const trackMeta = await getEmbedMeta(track, false, player, 'add');
      const [colors, footerText] = [trackMeta.colors, trackMeta.footerText];

      let trackTitle = `음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
      if (excludeCover && excludeShorts) {
        trackTitle = `커버 곡과 쇼츠를 제외하고 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
      } else if (excludeCover) {
        trackTitle = `커버 곡을 제외하고 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
      } else if (excludeShorts) {
        trackTitle = `쇼츠를 제외하고 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
      }

      const embed = new EmbedBuilder()
        .setTitle(truncateWithEllipsis(`💿 ${track.title}`, 50))
        .setDescription(trackTitle)
        .setThumbnail(track.artworkUrl ?? null)
        .setFooter({text: footerText})
        .setURL(track.uri)
        .setColor((colors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString);

      await safeReply(interaction, {
        embeds: [embed],
        components: [createQuickAddButton()],
      });
      break;
    }
    case LoadTypes.Playlist: {
      if (res.playlist && res.playlist.tracks) res.tracks = res.playlist.tracks;

      // 필터링 옵션이 활성화된 경우 재생목록에서도 필터링
      if ((excludeCover || excludeShorts) && res.tracks.length > 0) {
        const originalTracksCount = res.tracks.length;

        if (excludeCover && excludeShorts) {
          res.tracks = res.tracks.filter(track => !isCoverTrack(track) && !isShortsTrack(track));
        } else if (excludeCover) {
          res.tracks = res.tracks.filter(track => !isCoverTrack(track));
        } else if (excludeShorts) {
          res.tracks = res.tracks.filter(track => !isShortsTrack(track));
        }

        // 모든 트랙이 필터링된 경우
        if (res.tracks.length === 0) {
          let errorMessage = '';
          if (excludeCover && excludeShorts) {
            errorMessage = `재생목록의 ${originalTracksCount}곡이 모두 커버 곡 또는 쇼츠로 판단되었어요.`;
          } else if (excludeCover) {
            errorMessage = `재생목록의 ${originalTracksCount}곡이 모두 커버 곡으로 판단되었어요.`;
          } else if (excludeShorts) {
            errorMessage = `재생목록의 ${originalTracksCount}곡이 모두 쇼츠로 판단되었어요.`;
          }

          await safeReply(interaction, {
            embeds: [new EmbedBuilder().setTitle('필터링된 결과가 없어요.').setDescription(errorMessage).setColor(client.config.EMBED_COLOR_ERROR)],
            flags: MessageFlags.Ephemeral,
          });
          return;
        }
      }

      if (addFirst) await player.queue.add(res.tracks, 0);
      else if (index !== null) await player.queue.add(res.tracks, index);
      else await player.queue.add(res.tracks);

      const playlistQueueSize = await player.queue.size();
      if (!player.playing && !player.paused && playlistQueueSize) await player.play();

      const playlistMeta = await getEmbedMeta(res.tracks, true, player);
      const [playlistColors, playlistFooterText] = [playlistMeta.colors, playlistMeta.footerText];

      let playlistTitle = `재생목록에 포함된 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;

      const originalPlaylistCount = res.playlist?.tracks.length || 0;
      const isFiltered = res.tracks.length !== originalPlaylistCount;

      if (isFiltered) {
        if (excludeCover && excludeShorts) {
          playlistTitle = `재생목록에서 커버 곡과 쇼츠를 제외한 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
        } else if (excludeCover) {
          playlistTitle = `재생목록에서 커버 곡을 제외한 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
        } else if (excludeShorts) {
          playlistTitle = `재생목록에서 쇼츠를 제외한 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
        }
      }

      const embed = new EmbedBuilder()
        .setTitle(truncateWithEllipsis(`📜 ${res.playlist.name}`, 50))
        .setDescription(playlistTitle)
        .setThumbnail(res.playlist?.tracks[0]?.artworkUrl ?? null)
        .setURL(query)
        .setFooter({text: `최대 100곡까지 한번에 추가할 수 있어요.\n${playlistFooterText}`})
        .setColor((playlistColors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString);

      await safeReply(interaction, {
        embeds: [embed],
        components: [createQuickAddButton()],
      });
      break;
    }
  }
};

export const createProgressBar = async (
  player: Player,
  options?: {
    barLength?: number;
    useEmoji?: boolean;
  },
): Promise<string> => {
  const track = await player.queue.getCurrent();
  if (!track || track.isStream) return '';
  const total = track.duration;
  const current = player.position;
  const barLength = options?.barLength ?? 10;
  const useEmoji = options?.useEmoji ?? true;

  if (useEmoji) {
    const progress = Math.round((current / total) * barLength);
    let progressBar = '';

    for (let i = 0; i < barLength; i++) {
      if (i === 0) {
        // 시작 부분
        progressBar += i < progress ? config.PROGRESS_FILLED_START : config.PROGRESS_CIRCLE_START;
      } else if (i === barLength - 1) {
        // 끝 부분
        progressBar += i < progress ? config.PROGRESS_FILLED_MIDDLE : config.PROGRESS_UNFILLED_END;
      } else {
        // 중간 부분
        if (i === progress) {
          // 현재 위치 (원형 인디케이터)
          progressBar += config.PROGRESS_CIRCLE_MIDDLE;
        } else if (i < progress) {
          // 채워진 부분
          progressBar += config.PROGRESS_FILLED_MIDDLE;
        } else {
          // 비어있는 부분
          progressBar += config.PROGRESS_UNFILLED_MIDDLE;
        }
      }
    }

    return `${msToTime(current)} ${progressBar} ${msToTime(total)}`;
  } else {
    const progress = Math.round((current / total) * barLength);
    const barChar = '▬';
    const indicator = '🔘';
    const bar = barChar.repeat(barLength);
    return `${msToTime(current)} ${bar.substring(0, progress)}${indicator}${bar.substring(progress + 1)} ${msToTime(total)}`;
  }
};
