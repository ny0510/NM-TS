import {ChatInputCommandInteraction, EmbedBuilder, type HexColorString, MessageFlags, PermissionsBitField, SlashCommandBuilder, inlineCode} from 'discord.js';
import {LoadTypes, type Track} from 'magmastream';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {safeReply} from '@/utils/discord/interactions';
import {hyperlink} from '@/utils/formatting';
import {truncateWithEllipsis} from '@/utils/formatting';
import {playlistPattern, videoPattern} from '@/utils/formatting';
import {createPlayer, ensureSameVoiceChannel, ensureVoiceChannel, getEmbedMeta} from '@/utils/music';

const coverKeywords = ['cover', 'covers', '커버', 'covered by', 'cover by', 'acoustic cover', 'piano cover', 'guitar cover', 'vocal cover', '어쿠스틱 커버', '피아노 커버', '기타 커버', '보컬 커버', 'remix', '리믹스', 'version', '버전', 'ver', '피처링', 'ft', 'ft.', '피쳐링'];

function isCoverTrack(track: Track): boolean {
  const title = track.title.toLowerCase();
  const author = track.author.toLowerCase();

  return coverKeywords.some(keyword => title.includes(keyword.toLowerCase()) || author.includes(keyword.toLowerCase()));
}

export default {
  data: new SlashCommandBuilder()
    .setName('play')
    .setDescription('음악을 재생해요.')
    .addStringOption(option => option.setName('query').setDescription('재생할 음악의 제목이나 URL을 입력해 주세요.').setRequired(true))
    .addBooleanOption(option => option.setName('addfirst').setDescription('대기열의 맨 앞에 음악을 추가해요.').setRequired(false))
    .addIntegerOption(option => option.setName('index').setDescription('대기열의 특정 위치에 음악을 추가해요.').setRequired(false))
    .addBooleanOption(option => option.setName('ignoreplaylist').setDescription('재생목록을 무시하고 해당 음악만 추가해요.').setRequired(false))
    .addBooleanOption(option => option.setName('excludecover').setDescription('커버 곡을 제외하고 검색해요.').setRequired(false)),
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;

    let player = client.manager.get(interaction.guildId!);

    if (!(await ensureVoiceChannel(interaction))) return; // 음성 채널에 들어가 있는지 확인
    if (!(await ensureSameVoiceChannel(interaction))) return; // 같은 음성 채널에 있는지 확인

    await interaction.deferReply();

    let query = interaction.options.getString('query', true);
    const addFirst = interaction.options.getBoolean('addfirst') ?? false;
    const index = interaction.options.getInteger('index');
    const ignorePlaylist = interaction.options.getBoolean('ignoreplaylist') ?? false;
    const excludeCover = interaction.options.getBoolean('excludecover') ?? false;

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

    // 커버 곡 제외 옵션이 활성화된 경우 필터링
    if (excludeCover && res.tracks.length > 0) {
      const originalTracksCount = res.tracks.length;
      res.tracks = res.tracks.filter(track => !isCoverTrack(track));

      // 모든 트랙이 커버 곡인 경우
      if (res.tracks.length === 0) {
        return await safeReply(interaction, {
          embeds: [new EmbedBuilder().setTitle('커버 곡을 제외한 결과가 없어요.').setDescription(`검색된 ${originalTracksCount}곡이 모두 커버 곡으로 판단되었어요.`).setColor(client.config.EMBED_COLOR_ERROR)],
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

        const trackTitle = excludeCover ? `💿 커버 곡을 제외하고 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.` : `💿 음악을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;

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

        // 커버 곡 제외 옵션이 활성화된 경우 재생목록에서도 필터링
        if (excludeCover && res.tracks.length > 0) {
          const originalTracksCount = res.tracks.length;
          res.tracks = res.tracks.filter(track => !isCoverTrack(track));

          // 모든 트랙이 커버 곡인 경우
          if (res.tracks.length === 0) {
            return await safeReply(interaction, {
              embeds: [new EmbedBuilder().setTitle('커버 곡을 제외한 결과가 없어요.').setDescription(`재생목록의 ${originalTracksCount}곡이 모두 커버 곡으로 판단되었어요.`).setColor(client.config.EMBED_COLOR_ERROR)],
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

        const playlistTitle =
          excludeCover && res.tracks.length !== res.playlist?.tracks.length
            ? `📜 재생목록에서 커버 곡을 제외한 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`
            : `📜 재생목록에 포함된 음악 ${res.tracks.length}곡을 대기열${addFirst ? '의 맨 앞에' : index !== null ? `의 ${index}번째에` : '에'} 추가했어요.`;

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
