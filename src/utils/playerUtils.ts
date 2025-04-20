import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, MessageFlags, channelMention, codeBlock} from 'discord.js';
import getColors from 'get-image-colors';
import {Player, StateTypes, type Track} from 'magmastream';

import {msToTime} from './format';
import {NMClient} from '@/structs/Client';
import {slashCommandMention} from '@/utils/mention';
import {safeReply} from '@/utils/safeReply';

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
          .setTitle('음악을 재생하기 위해서는 같은 음성 채널에 있어야 해요.')
          .setDescription(`${channelMention(member.voice.channel?.id || '')} 음성 채널에 들어가 주세요.`)
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

export const getRelatedTracks = async (client: NMClient, track: Track, limit: number = 5): Promise<Track[]> => {
  const maxLimit = 30;
  if (limit > maxLimit) throw new Error(`Limit exceeds maximum value of ${maxLimit}.`);

  // 현재 재생중인 노래로 유튜브 검색
  const searchQuery = `${track.author} - ${track.title}`;
  const ytSearchResult = await client.manager.search(searchQuery, {requester: client.user});

  if (!ytSearchResult || !ytSearchResult.tracks.length) return [];

  // 검색 결과에서 첫 번째 노래로 관련 동영상 찾기
  const videoId = ytSearchResult.tracks[0]?.identifier;
  const relatedUri = `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`;

  try {
    const result = await client.manager.search(relatedUri, {requester: client.user});

    if (!result || !result.tracks.length) return [];

    // 현재 재생중인 노래와 다른 노래들만 필터링
    const relatedTracks = result.tracks.filter(t => t.identifier !== track.identifier && t.title !== track.title && t.author !== track.author).slice(0, limit);

    return relatedTracks;
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
