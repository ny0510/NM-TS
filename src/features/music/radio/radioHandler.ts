import {type ButtonInteraction, type ChatInputCommandInteraction, type ComponentType, codeBlock, MessageFlags, PermissionsBitField, type StringSelectMenuInteraction} from 'discord.js';
import {LoadType} from 'shoukaku';

import {createQueue, ensureSameVoiceChannel, ensureVoiceChannel} from '@/features/music/guard';
import {getEmbedMeta} from '@/features/music/track/embeds';
import {slashCommandMention} from '@/shared/discord';
import {getClient} from '@/shared/discord/client';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeDeferUpdate, safeEditReply, safeReply} from '@/shared/discord/interactions';
import {checkBotPermissions} from '@/shared/discord/permissions/checkPermissions';
import {formatMissingPermissions} from '@/shared/discord/permissions/formatPermissions';
import {toError} from '@/shared/errors';
import type {QueueTrack} from '@/types/music';
import {buildRadioAddedEmbed, buildRadioComponents, buildRadioEmbed, buildRadioExpiredEmbed, buildRadioMessage, RADIO_STATIONS_PER_PAGE} from './radioBuilder';
import {type RadioRegion, radioRegions} from './radioStations';

const RADIO_COLLECTOR_TIMEOUT = 5 * 60_000;

function findRegion(key: string | undefined): RadioRegion | undefined {
  return radioRegions.find(region => region.key === key);
}

async function handleRegionButton(button: ButtonInteraction): Promise<void> {
  const [, action, key, page] = button.customId.split(':');
  const region = findRegion(key);
  if (!region) return;

  if (action === 'region') {
    await button.update(buildRadioMessage(radioRegions, region.key));
  } else if (action === 'page') {
    await button.update({embeds: [buildRadioEmbed(region)], components: buildRadioComponents(radioRegions, region.key, Number(page))});
  }
}

async function handleStationSelect(selection: StringSelectMenuInteraction): Promise<boolean> {
  const client = getClient(selection);
  const region = findRegion(selection.customId.split(':')[2]);
  const station = region?.stations[Number(selection.values[0])];

  if (!station) {
    await safeReply(selection, {embeds: [createErrorEmbed(client, '라디오 채널 정보를 찾을 수 없어요.', `${await slashCommandMention(selection, 'radio')} 명령어를 사용해 다시 선택해 주세요.`)], flags: MessageFlags.Ephemeral});
    return false;
  }

  if (!(await ensureVoiceChannel(selection)) || !(await ensureSameVoiceChannel(selection))) return false;

  const voiceChannel = selection.guild?.members.cache.get(selection.user.id)?.voice.channel;
  const {result, missing} = await checkBotPermissions(selection, [PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak], voiceChannel);
  if (!result) {
    await safeReply(selection, {embeds: [createErrorEmbed(client, '음성 채널에 연결할 권한이 부족해요.', codeBlock('diff', formatMissingPermissions(missing)))], flags: MessageFlags.Ephemeral});
    return false;
  }

  if (!(await safeDeferUpdate(selection))) return false;

  const res = await client.services.lavalinkManager.search(station.url, selection.user);
  if (!res || res.loadType !== LoadType.TRACK) {
    await safeReply(selection, {embeds: [createErrorEmbed(client, '라디오에 연결할 수 없어요.', '잠시 후 다시 시도하거나 다른 채널을 선택해 주세요.')], flags: MessageFlags.Ephemeral});
    return false;
  }

  const track = res.data as QueueTrack;
  track.info = {...track.info, title: station.name, author: station.provider, uri: station.url};
  track.playContext = {playContext: 'play', requestChannelId: selection.channelId ?? undefined};

  const guildId = selection.guildId;
  if (!guildId) return false;
  const queue = client.queues.get(guildId) ?? (await createQueue(selection));
  if (!queue) return false;

  queue.add(track);
  if (queue.isAutoShuffle && queue.size() > 1) queue.shuffle();
  if (!queue.playing && !queue.paused) await queue.play();

  const {footerText} = await getEmbedMeta(track, false, queue, 'add');
  await safeEditReply(selection, {embeds: [buildRadioAddedEmbed(station.name, station.url, footerText)], components: []});
  return true;
}

export async function handleRadio(interaction: ChatInputCommandInteraction): Promise<void> {
  const client = getClient(interaction);

  if (!radioRegions.length) {
    await safeReply(interaction, {embeds: [createErrorEmbed(client, '등록된 라디오 채널이 없어요.')], flags: MessageFlags.Ephemeral});
    return;
  }

  await safeReply(interaction, {...buildRadioMessage(radioRegions), flags: MessageFlags.Ephemeral});
  const message = await interaction.fetchReply();

  const collector = message.createMessageComponentCollector<ComponentType.Button | ComponentType.StringSelect>({
    time: RADIO_COLLECTOR_TIMEOUT,
    filter: i => i.user.id === interaction.user.id && i.customId.startsWith('radio:'),
  });

  let selectingStation = false;
  collector.on('collect', async i => {
    if (selectingStation || collector.ended) {
      await safeDeferUpdate(i);
      return;
    }

    try {
      if (i.isButton()) {
        await handleRegionButton(i);
      } else if (i.isStringSelectMenu()) {
        selectingStation = true;
        if (await handleStationSelect(i)) {
          collector.stop('selected');
          return;
        }
        const key = i.customId.split(':')[2];
        const page = Math.floor(Number(i.values[0]) / RADIO_STATIONS_PER_PAGE) + 1;
        await safeEditReply(interaction, {components: buildRadioComponents(radioRegions, key, page)});
      }
    } catch (error) {
      client.logger.error(toError(error, 'Failed to handle radio interaction'));
      await safeReply(i, {embeds: [createErrorEmbed(client, '라디오를 추가하는 중 오류가 발생했어요.', '잠시 후 다시 시도해 주세요.')], flags: MessageFlags.Ephemeral});
    } finally {
      if (i.isStringSelectMenu()) selectingStation = false;
    }
  });

  collector.on('end', async (_collected, reason) => {
    if (reason === 'selected') return;
    await safeEditReply(interaction, {embeds: [buildRadioExpiredEmbed(await slashCommandMention(interaction, 'radio'))], components: []});
  });
}
