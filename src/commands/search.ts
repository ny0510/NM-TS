import {ActionRowBuilder, ChatInputCommandInteraction, ComponentType, EmbedBuilder, GuildMember, type HexColorString, MessageFlags, PermissionsBitField, SlashCommandBuilder, StringSelectMenuBuilder, StringSelectMenuInteraction, channelMention, codeBlock, italic} from 'discord.js';
import {LoadTypes, SearchPlatform, StateTypes, type Track} from 'magmastream';

import type {NMClient} from '@/client/Client';
import type {Command} from '@/client/types';
import {slashCommandMention} from '@/utils/discord';
import {safeReply} from '@/utils/discord/interactions';
import {hyperlink, msToTime, truncateWithEllipsis} from '@/utils/formatting';
import {createPlayer, ensureSameVoiceChannel, ensureVoiceChannel, getEmbedMeta} from '@/utils/music';

export default {
  data: new SlashCommandBuilder()
    .setName('search')
    .setDescription('음악을 검색해요.')
    .addStringOption(option => option.setName('query').setDescription('검색할 음악의 제목이나 URL을 입력해 주세요.').setRequired(true))
    .addStringOption(option => option.setName('searchplatform').setDescription('검색할 플랫폼을 선택해 주세요.').addChoices({name: '유튜브', value: SearchPlatform.YouTube}, {name: '스포티파이', value: SearchPlatform.Spotify}, {name: '사운드클라우드', value: SearchPlatform.SoundCloud})),
  permissions: [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak],
  cooldown: 3,
  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const client = interaction.client as NMClient;

    await interaction.deferReply();

    const query = interaction.options.getString('query', true);
    const searchPlatform = (interaction.options.getString('searchplatform') as SearchPlatform) ?? SearchPlatform.YouTube;
    const platformDisplayName = [
      {name: '유튜브', value: SearchPlatform.YouTube},
      {name: '스포티파이', value: SearchPlatform.Spotify},
      {name: '사운드클라우드', value: SearchPlatform.SoundCloud},
    ].find(option => option.value === searchPlatform)?.name;

    let res = await client.manager.search({query, source: searchPlatform}, interaction.user);

    if (res.loadType === LoadTypes.Empty || res.loadType === LoadTypes.Error || !('tracks' in res))
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('음악을 찾을 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });

    const tracks = res.tracks as Track[];

    const optinos = tracks
      .filter((track: Track) => !!track.title)
      .map((track: Track, index: number) => {
        return {
          label: truncateWithEllipsis(track.title, 100, ''),
          value: track.uri,
          emoji: {name: ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][index]},
          description: `${truncateWithEllipsis(track.author, 20)} (${msToTime(track.duration)})`,
        };
      })
      .slice(0, 10);

    if (optinos.length === 0)
      return await safeReply(interaction, {
        embeds: [new EmbedBuilder().setTitle('음악을 찾을 수 없어요.').setColor(client.config.EMBED_COLOR_ERROR)],
        flags: MessageFlags.Ephemeral,
      });

    const customId = `search:${interaction.id}`;
    const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(customId).setPlaceholder('음악을 선택해 주세요.').setMinValues(1).setMaxValues(optinos.length).addOptions(optinos));

    const embed = new EmbedBuilder().setTitle(`🔍 ${platformDisplayName}에서 ${query} 검색 결과`).setDescription('대기열에 추가할 음악을 선택해 주세요.').setColor(client.config.EMBED_COLOR_NORMAL);

    await safeReply(interaction, {
      embeds: [embed],
      components: [row],
      ephemeral: true,
    });

    const filter = async (i: StringSelectMenuInteraction) => {
      if (i.user.id !== interaction.user.id) {
        i.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle('다른 사용자의 인터렉션이에요.')
              .setDescription(`${await slashCommandMention(interaction, 'search')} 명령어로 검색할 수 있어요.`)
              .setColor(client.config.EMBED_COLOR_ERROR),
          ],
          flags: MessageFlags.Ephemeral,
        });
        return false;
      }

      if (!i.values || i.values.length === 0) {
        i.reply({embeds: [new EmbedBuilder().setTitle('재생할 음악을 선택해 주세요.').setColor(client.config.EMBED_COLOR_ERROR)], flags: MessageFlags.Ephemeral});
        return false;
      }

      return true;
    };

    const collector = interaction.channel?.createMessageComponentCollector({filter, time: 60 * 1000 * 5, componentType: ComponentType.StringSelect}); // 5분 동안 대기
    const followUp = await interaction.fetchReply();
    if (!collector || !followUp) return;

    let handled = false;

    const disableComponents = async () => {
      if (handled) return;
      try {
        await followUp?.edit({embeds: [new EmbedBuilder().setTitle(`만료된 인터렉션이에요. ${await slashCommandMention(interaction, 'search')} 명령어를 사용해 다시 검색해 주세요.`).setColor(client.config.EMBED_COLOR_ERROR)], components: []});
      } catch {
        // 이미 수정된 메시지는 무시
      }
    };

    collector?.on('collect', async i => {
      if (!i.isStringSelectMenu()) return;
      if (i.customId !== customId) return;

      handled = true;
      collector.stop();

      const selectedTracks = i.values.map(value => tracks.find((track: Track) => track.uri === value)).filter((track): track is Track => Boolean(track));

      let player = client.manager.players.get(interaction.guildId!);

      const inVoice = await ensureVoiceChannel(interaction); // 음성 채널에 들어가 있는지 확인
      const inSameVoice = await ensureSameVoiceChannel(interaction); // 같은 음성 채널에 있는지 확인
      if (!inVoice || !inSameVoice) return;

      player = await createPlayer(interaction);
      if (!player) return;

      const results: {track: Track; success: boolean; error?: string}[] = [];
      for (const track of selectedTracks) {
        if (track) {
          try {
            await player.queue.add(track);
            results.push({track, success: true});
          } catch (e) {
            const errorMessage = e instanceof Error && e.message ? e.message : '알 수 없는 오류';
            results.push({track, success: false, error: errorMessage});
          }
        }
      }

      const searchQueueSize = await player.queue.size();
      if (!player.playing && !player.paused && searchQueueSize + 1 === selectedTracks.length) await player.play();

      const tracksMeta = await getEmbedMeta(selectedTracks, true, player);
      const [tracksColor, tracksFooterText] = [tracksMeta.colors, tracksMeta.footerText];
      const description = results.length
        ? results
            .map(({track, success, error}, index) => {
              return `${success ? '☑️' : `⚠️ (${error})`} ${hyperlink(truncateWithEllipsis(track.title, 50), track.uri)}`;
            })
            .join('\n')
        : '음악을 찾을 수 없어요.';

      const firstTrackThumbnail = selectedTracks[0]?.artworkUrl || selectedTracks[0]?.thumbnail;

      return await i.update({
        embeds: [
          new EmbedBuilder()
            .setTitle(`💿 선택한 음악을 대기열에 추가했어요.`)
            .setDescription(description)
            .setThumbnail(firstTrackThumbnail || null)
            .setFooter({text: tracksFooterText})
            .setColor((tracksColor[0]?.hex?.() ?? client.config.EMBED_COLOR_NORMAL) as HexColorString),
        ],
        components: [],
      });
    });
    collector?.on('end', disableComponents);
  },
} as Command;
