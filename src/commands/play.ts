import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, MessageFlags, PermissionsBitField, SlashCommandBuilder, inlineCode} from 'discord.js';
import {LoadTypes, type Track} from 'magmastream';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {safeReply} from '@/utils/discord/interactions';
import {hyperlink} from '@/utils/formatting';
import {truncateWithEllipsis} from '@/utils/formatting';
import {playlistPattern, videoPattern} from '@/utils/formatting';
import {coverPattern} from '@/utils/formatting';
import {createPlayer, ensureSameVoiceChannel, ensureVoiceChannel, getEmbedMeta} from '@/utils/music';

function isCoverTrack(track: Track): boolean {
  return coverPattern.test(track.title) || coverPattern.test(track.author);
}

function isShortsTrack(track: Track): boolean {
  // YouTube Shorts are typically under 60 seconds (60000 milliseconds)
  return track.duration !== undefined && track.duration > 0 && track.duration <= 60000;
}

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('음악을 재생해요.')
    .addStringOption(option => option.setName('query').setDescription('재생할 음악의 제목이나 URL을 입력해 주세요.').setRequired(true))
    .addBooleanOption(option => option.setName('add_first').setDescription('대기열의 맨 앞에 음악을 추가해요.').setRequired(false))
    .addIntegerOption(option => option.setName('index').setDescription('대기열의 특정 위치에 음악을 추가해요.').setRequired(false))
    .addBooleanOption(option => option.setName('ignore_playlist').setDescription('재생목록을 무시하고 해당 음악만 추가해요.').setRequired(false))
    .addBooleanOption(option => option.setName('exclude_cover').setDescription('커버 곡을 제외하고 검색해요.').setRequired(false))
    .addBooleanOption(option => option.setName('exclude_shorts').setDescription('쇼츠 영상을 제외하고 검색해요.').setRequired(false)),
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;

    let player = client.manager.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인

    await interaction.deferReply();

    let query = interaction.options.getString('query', true);
    const addFirst = interaction.options.getBoolean('add_first') ?? false;
    const index = interaction.options.getInteger('index');
    const ignorePlaylist = interaction.options.getBoolean('ignore_playlist') ?? false;
    const excludeCover = interaction.options.getBoolean('exclude_cover') ?? false;
    const excludeShorts = interaction.options.getBoolean('exclude_shorts') ?? false;

    if (ignorePlaylist) {
      if (videoPattern.test(query) && playlistPattern.test(query)) query = query.replace(playlistPattern, '');
      else
        return await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setTitle('재생목록 무시 옵션을 사용하려면 유튜브 URL을 입력해야 해요.')
              .setDescription(`${inlineCode(`${videoPattern}`)} 형식의 URL을 입력해 주세요.`)
              .setColor(client.config.EMBED_COLOR_ERROR),
          ],
          flags: MessageFlags.Ephemeral,
        });
    }

    // 옵션 상호작용 검증
    if (addFirst && index !== null)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('대기열의 맨 앞에 추가하는 경우에는 인덱스를 설정할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    if (index !== null && index < 0)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('대기열의 인덱스는 0 이상이어야 해요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });
    if (index !== null) {
      if (!player || (!player.playing && !player.paused && player.queue.size === 0)) {
        return await safeReply(interaction, {
          embeds: [new EmbedBuilder().setTitle('아무것도 재생중이지 않을 때는 인덱스를 설정할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
          flags: MessageFlags.Ephemeral,
        });
      }
      if (player && index > player.queue.size) {
        return await safeReply(interaction, {
          embeds: [new EmbedBuilder().setTitle(`대기열보다 더 큰 인덱스를 설정할 수 없어요.`).setDescription(`대기열에 ${player.queue.size}곡이 있어요.`).setColor(client.config.EMBED_COLOR_ERROR)],
          flags: MessageFlags.Ephemeral,
        });
      }
    }
    if (ignorePlaylist && player?.queue.current?.isStream)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('스트리밍 음악인 경우에는 재생목록 무시 옵션을 사용할 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });

    let res = await client.manager.search(query, interaction.user);

    if (res.loadType === LoadTypes.Empty || res.loadType === LoadTypes.Error)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('음악을 찾을 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });

    // 필터링 옵션이 활성화된 경우 트랙 필터링
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
          errorMessage = `검색된 ${originalTracksCount}곡이 모두 커버 곡 또는 쇼츠로 판단되었어요.`;
        } else if (excludeCover) {
          errorMessage = `검색된 ${originalTracksCount}곡이 모두 커버 곡으로 판단되었어요.`;
        } else if (excludeShorts) {
          errorMessage = `검색된 ${originalTracksCount}곡이 모두 쇼츠로 판단되었어요.`;
        }

        return await safeReply(interaction, {
          embeds: [new EmbedBuilder().setTitle('필터링된 결과가 없어요.').setDescription(errorMessage).setColor(client.config.EMBED_COLOR_ERROR)],
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    player = await createPlayer(interaction);
    if (!player) return;

    switch (res.loadType) {
      case LoadTypes.Track:
      case LoadTypes.Search:
        const track = res.tracks[0] as Track;
        if (addFirst) player.queue.add(track, 0);
        else if (index !== null) player.queue.add(track, index);
        else player.queue.add(track);

        if (!player.playing && !player.paused && !player.queue.size) await player.play();

        const trackMeta = await getEmbedMeta(track, false, player, 'add');
        const [colors, footerText] = [trackMeta.colors, trackMeta.footerText];

        let trackTitle = `💿 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
        if (excludeCover && excludeShorts) {
          trackTitle = `💿 커버 곡과 쇼츠를 제외하고 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
        } else if (excludeCover) {
          trackTitle = `💿 커버 곡을 제외하고 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
        } else if (excludeShorts) {
          trackTitle = `💿 쇼츠를 제외하고 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
        }

        await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setTitle(trackTitle)
              .setDescription(hyperlink(truncateWithEllipsis(track.title, 50), track.uri))
              .setThumbnail(track.artworkUrl ?? null)
              .setFooter({text: footerText})
              .setColor((colors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString),
          ],
        });

        break;
      case LoadTypes.Playlist:
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

            return await safeReply(interaction, {
              embeds: [new EmbedBuilder().setTitle('필터링된 결과가 없어요.').setDescription(errorMessage).setColor(client.config.EMBED_COLOR_ERROR)],
              flags: MessageFlags.Ephemeral,
            });
          }
        }

        if (addFirst) player.queue.add(res.tracks, 0);
        else if (index !== null) player.queue.add(res.tracks, index);
        else player.queue.add(res.tracks);

        if (!player.playing && !player.paused && player.queue.size === res.tracks.length) await player.play();

        const playlistMeta = await getEmbedMeta(res.tracks, true, player);
        const [playlistColors, playlistFooterText] = [playlistMeta.colors, playlistMeta.footerText];

        let playlistTitle = `📜 재생목록에 포함된 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;

        const originalPlaylistCount = res.playlist?.tracks.length || 0;
        const isFiltered = res.tracks.length !== originalPlaylistCount;

        if (isFiltered) {
          if (excludeCover && excludeShorts) {
            playlistTitle = `📜 재생목록에서 커버 곡과 쇼츠를 제외한 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
          } else if (excludeCover) {
            playlistTitle = `📜 재생목록에서 커버 곡을 제외한 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
          } else if (excludeShorts) {
            playlistTitle = `📜 재생목록에서 쇼츠를 제외한 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;
          }
        }

        await safeReply(interaction, {
          embeds: [
            new EmbedBuilder()
              .setTitle(playlistTitle)
              .setDescription(hyperlink(truncateWithEllipsis(res.playlist?.name!, 50), query))
              .setThumbnail(res.playlist?.tracks[0]?.artworkUrl ?? null)
              .setFooter({text: `최대 100곡까지 한번에 추가할 수 있어요.\n${playlistFooterText}`})
              .setColor((playlistColors[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString),
          ],
        });
        break;
    }
  },
} as Command;
