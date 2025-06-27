import {ChatInputCommandInteraction, EmbedBuilder, GuildMember, type HexColorString, MessageFlags, channelMention, codeBlock} from 'discord.js';
import getColors from 'get-image-colors';
import {type Player, StateTypes, type Track} from 'magmastream';

import type {NMClient} from '@/client/Client';
import {slashCommandMention} from '@/utils/discord';
import {safeReply} from '@/utils/discord/interactions';
import {msToTime} from '@/utils/formatting';

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

    // 과거 재생된 곡들의 히스토리 초기화 (중복 방지용)
    if (!player.get('playHistory')) {
      player.set('playHistory', []);
    }

    // 최근 자동재생으로 추가된 곡들의 메타데이터 저장 (더 정확한 중복 방지)
    if (!player.get('autoplayHistory')) {
      player.set('autoplayHistory', []);
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
