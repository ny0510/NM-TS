import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, type HexColorString, MessageFlags, channelMention, codeBlock} from 'discord.js';
import getColors from 'get-image-colors';
import {Player, StateTypes, type Track} from 'magmastream';

import {NMClient} from '@/client/Client';
import {slashCommandMention} from '@/utils/discord';
import {safeReply} from '@/utils/discord/interactions';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/utils/formatting';

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

export const ensurePlaying = async (interaction: ChatInputCommandInteraction): Promise<boolean> => {
  const client = interaction.client as NMClient;
  const player = client.manager.players.get(interaction.guildId!);

  if (!player || !player.playing || !player.queue.current) {
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

export const createPlayer = async (interaction: ChatInputCommandInteraction): Promise<Player | undefined> => {
  const client = interaction.client as NMClient;
  const member = interaction.member as GuildMember;

  let player: Player;
  try {
    player = client.manager.create({
      guildId: interaction.guildId!,
      voiceChannelId: member.voice.channel?.id,
      textChannelId: interaction.channelId,
      volume: client.config.DEFAULT_VOLUME,
      selfDeafen: true,
      selfMute: true,
    });
    if (player.state !== StateTypes.Connected) player.connect();

    // 자동재생 상태 초기화 (기본값: 비활성화)
    if (!player.get('autoplayEnabled')) {
      player.set('autoplayEnabled', false);
    }

    return player;
  } catch (e) {
    await safeReply(interaction, {
      embeds: [
        new EmbedBuilder()
          .setTitle('플레이어를 생성하는 중 오류가 발생했어요.')
          .setDescription(codeBlock('js', `${e}`))
          .setColor(client.config.EMBED_COLOR_ERROR),
      ],
      flags: MessageFlags.Ephemeral,
    });
    return undefined;
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
    const colors = firstTrack ? await getColors(firstTrack.artworkUrl.replace('webp', 'png'), {count: 1}) : [];
    const playlistDuration = tracks.reduce((acc, track) => acc + (track.duration || 0), 0);
    const footerText = `추가된 음악 ${tracks.length}곡 (${msToTime(playlistDuration)}) | 대기열에 ${player.queue.size}곡 (${msToTime(player.queue.duration)})`;
    return {colors, footerText};
  } else {
    const track = trackOrTracks as Track;
    const colors = await getColors(track.artworkUrl.replace('webp', 'png'), {count: 1});
    const actionText = action === 'add' ? '추가된' : '재생중인';
    const footerText = `${actionText} 음악 (${track.isStream ? '실시간 스트리밍' : msToTime(track.duration)}) | 대기열에 ${player.queue.size}곡 (${msToTime(player.queue.duration - track.duration)})`;
    return {colors, footerText};
  }
};

// 문자열 유사도 계산 (Levenshtein distance 기반)
const calculateSimilarity = (str1: string, str2: string): number => {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim();
  const a = normalize(str1);
  const b = normalize(str2);

  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0]![j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i]![j] = matrix[i - 1]![j - 1]!;
      } else {
        matrix[i]![j] = Math.min(matrix[i - 1]![j - 1]! + 1, matrix[i]![j - 1]! + 1, matrix[i - 1]![j]! + 1);
      }
    }
  }

  const maxLength = Math.max(a.length, b.length);
  return (maxLength - matrix[b.length]![a.length]!) / maxLength;
};

// 중복 트랙 검사 함수
const isDuplicateTrack = (track1: Track, track2: Track, existingTracks: Track[] = []): boolean => {
  // 정확히 같은 identifier는 중복
  if (track1.identifier === track2.identifier) return true;

  // 모든 기존 트랙과도 비교
  const allTracks = [track2, ...existingTracks];

  for (const existingTrack of allTracks) {
    if (track1.identifier === existingTrack.identifier) return true;

    // 제목 유사도가 85% 이상이고 아티스트가 같으면 중복으로 판단
    const titleSimilarity = calculateSimilarity(track1.title, existingTrack.title);
    const authorSimilarity = calculateSimilarity(track1.author, existingTrack.author);

    if (titleSimilarity >= 0.85 && authorSimilarity >= 0.8) return true;

    // 제목이 거의 같고 (90% 이상) 길이가 비슷하면 중복으로 판단 (리마스터, 다른 채널 업로드 등)
    if (titleSimilarity >= 0.9) {
      const durationDiff = Math.abs(track1.duration - existingTrack.duration);
      if (durationDiff < 10000) return true; // 10초 이내 차이
    }
  }

  return false;
};

export const getRelatedTracks = async (client: NMClient, track: Track, limit: number = 10, existingTracks: Track[] = []): Promise<Track[]> => {
  const maxLimit = 30;
  if (limit > maxLimit) throw new Error(`Limit exceeds maximum value of ${maxLimit}.`);

  // 현재 재생중인 노래로 유튜브 검색
  const searchQuery = `${track.author} - ${track.title}`;
  const ytSearchResult = await client.manager.search(searchQuery, {requester: '자동재생'});

  if (!ytSearchResult || !ytSearchResult.tracks.length) return [];

  // 검색 결과에서 첫 번째 노래로 관련 동영상 찾기
  const videoId = ytSearchResult.tracks[0]?.identifier;
  const relatedUri = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;

  try {
    const result = await client.manager.search(relatedUri, {requester: '자동재생'});

    if (!result || !result.tracks.length) return [];

    // 중복 제거 및 필터링 강화
    const filteredTracks: Track[] = [];

    for (const relatedTrack of result.tracks) {
      // 기본 중복 체크 및 강화된 필터링
      if (!isDuplicateTrack(relatedTrack, track, [...existingTracks, ...filteredTracks])) {
        filteredTracks.push(relatedTrack);
        if (filteredTracks.length >= limit) break;
      }
    }

    return filteredTracks;
  } catch (error) {
    throw new Error(`Error fetching related tracks: ${error}`);
  }
};

export const createProgressBar = (
  player: Player,
  options?: {
    barChar?: string;
    indicator?: string;
    barLength?: number;
  },
): string => {
  const track = player.queue.current;
  if (!track || track.isStream) return '';
  const total = track.duration;
  const current = player.position;
  const barLength = options?.barLength ?? 25;
  const barChar = options?.barChar ?? '▬';
  const indicator = options?.indicator ?? '🔘';

  const progress = Math.round((current / total) * barLength);
  const bar = barChar.repeat(barLength);
  return `${msToTime(current)} ${bar.substring(0, progress)}${indicator}${bar.substring(progress + 1)} ${msToTime(total)}`;
};

// 자동재생을 위한 관련 트랙 추가
export const addRelatedTracksToQueue = async (client: NMClient, player: Player, currentTrack: Track, count: number = 10): Promise<Track[]> => {
  try {
    // 현재 대기열의 모든 트랙을 가져와서 중복 방지
    const existingTracks = [...player.queue];
    if (player.queue.current) existingTracks.push(player.queue.current);

    const relatedTracks = await getRelatedTracks(client, currentTrack, count, existingTracks);

    if (relatedTracks.length > 0) {
      // 트랙의 requester를 '자동재생'으로 설정
      relatedTracks.forEach(track => {
        (track as any).requester = '자동재생';
      });

      player.queue.add(relatedTracks);
    }

    return relatedTracks;
  } catch (error) {
    throw new Error(`자동재생 중 오류가 발생했어요: ${error}`);
  }
};

// 자동재생 초기 설정 (처음 활성화할 때 10곡 추가)
export const initializeAutoplay = async (client: NMClient, player: Player): Promise<{success: boolean; addedTracks: Track[]; error?: string}> => {
  try {
    const currentTrack = player.queue.current;
    if (!currentTrack) {
      return {success: false, addedTracks: [], error: '현재 재생중인 음악이 없어요.'};
    }

    const addedTracks = await addRelatedTracksToQueue(client, player, currentTrack, 10);

    return {success: true, addedTracks};
  } catch (error) {
    return {success: false, addedTracks: [], error: error instanceof Error ? error.message : '알 수 없는 오류가 발생했어요.'};
  }
};

// 대기열이 적을 때 자동으로 관련 트랙 추가 (개선된 버전)
export const checkAndAddAutoplayTracks = async (client: NMClient, player: Player): Promise<{added: boolean; addedTracks: Track[]}> => {
  try {
    // 자동재생이 비활성화되어 있으면 실행하지 않음
    if (!player.get('autoplayEnabled')) {
      return {added: false, addedTracks: []};
    }

    // 대기열에 1곡 이하 남았을 때 관련 트랙 추가
    if (player.queue.size <= 1) {
      const currentTrack = player.queue.current;
      if (!currentTrack) return {added: false, addedTracks: []};

      // 먼저 현재 재생중인 곡으로 시도
      let addedTracks = await addRelatedTracksToQueue(client, player, currentTrack, 5);

      // 관련 트랙을 찾지 못했고 대기열에 다른 곡이 있다면 다음 곡으로도 시도
      if (addedTracks.length === 0 && player.queue.size > 0) {
        const nextTrack = player.queue[0];
        if (nextTrack) {
          addedTracks = await addRelatedTracksToQueue(client, player, nextTrack, 5);
        }
      }

      // 여전히 찾지 못했다면 마지막 수단으로 인기 음악 검색
      if (addedTracks.length === 0) {
        try {
          // 현재 곡의 아티스트로 인기 곡 검색
          const fallbackQuery = `${currentTrack.author} popular songs`;
          const fallbackResult = await client.manager.search(fallbackQuery, {requester: '자동재생'});

          if (fallbackResult && fallbackResult.tracks.length > 0) {
            // 현재 대기열과 중복되지 않는 트랙들만 선택
            const existingTracks = [...player.queue];
            if (player.queue.current) existingTracks.push(player.queue.current);

            const fallbackTracks = fallbackResult.tracks.filter(track => !existingTracks.some(existing => existing.identifier === track.identifier)).slice(0, 3); // 최대 3곡만 추가

            if (fallbackTracks.length > 0) {
              // 트랙의 requester를 '자동재생'으로 설정
              fallbackTracks.forEach(track => {
                (track as any).requester = '자동재생';
              });

              player.queue.add(fallbackTracks);
              addedTracks = fallbackTracks;
            }
          }
        } catch (fallbackError) {
          // 폴백도 실패하면 로그만 남김
          console.warn('Fallback autoplay search failed:', fallbackError);
        }
      }

      return {added: addedTracks.length > 0, addedTracks};
    }

    return {added: false, addedTracks: []};
  } catch (error) {
    return {added: false, addedTracks: []};
  }
};

// 자동재생 embed 생성 함수
export const createAutoplayEmbed = async (tracks: Track[], player: Player, client: NMClient, title: string, additionalFooterText?: string): Promise<EmbedBuilder> => {
  const tracksMeta = await getEmbedMeta(tracks, true, player);
  const [tracksColor, tracksFooterText] = [tracksMeta.colors, tracksMeta.footerText];

  const trackList = tracks
    .slice(0, 5) // 처음 5곡만 표시
    .map((autoTrack, index) => `${index + 1}. ${hyperlink(truncateWithEllipsis(autoTrack.title, 50), autoTrack.uri)}`)
    .join('\n');

  const remainingCount = tracks.length - 5;
  const additionalText = remainingCount > 0 ? `\n... 그리고 ${remainingCount}곡 더` : '';

  const footerText = additionalFooterText ? `${tracksFooterText}\n${additionalFooterText}` : tracksFooterText;

  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(`${tracks.length}곡을 대기열에 추가했어요.\n\n${trackList}${additionalText}`)
    .setFooter({text: footerText})
    .setColor((tracksColor[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString);
};
