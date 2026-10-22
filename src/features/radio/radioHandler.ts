import type {ChatInputCommandInteraction, ComponentType, Message} from 'discord.js';
import {type LavalinkResponse, LoadType} from 'shoukaku';
import {getClient} from '@/shared/discord/client';
import {safeDeferUpdate, safeEditReply, safeFollowUp, safeReply} from '@/shared/discord/interactions';
import {slashCommandMention} from '@/shared/discord/mention';
import {toError} from '@/shared/errors';
import {getRadioTrackUri} from '@/shared/playback/radioUrl';
import {getPlaybackOptions, type PlaybackInteraction, playbackError} from '@/shared/playback/sessionGuard';
import {requestPlaybackAction} from '@/shared/playback/switchHandler';
import type {QueueTrack} from '@/types/music';
import {buildRadioMessage, type RadioViewState} from './radioBuilder';
import {findRadioStation, getAdjacentStation, radioRegions} from './radioStations';

const requests = new Map<string, symbol>();
const RADIO_COLLECTOR_TIMEOUT = 10 * 60_000;

export async function handleRadio(interaction: ChatInputCommandInteraction): Promise<void> {
  const manager = getClient(interaction).services.lavalinkManager;
  if (interaction.guildId && manager.getSession(interaction.guildId)?.mode === 'music') {
    await requestPlaybackAction(interaction, 'radio', async confirmation => {
      const message = await safeFollowUp(confirmation, buildRadioMessage({regionKey: 'seoul'}, undefined, getClient(confirmation).config));
      if (!message) throw new Error('Failed to open radio controls');
      await openRadioControls(confirmation, message);
    });
    return;
  }
  await openRadioControls(interaction);
}

async function openRadioControls(interaction: PlaybackInteraction, followUpMessage?: Message): Promise<void> {
  const client = getClient(interaction);
  const guildId = interaction.guildId;
  if (!guildId) return;
  const manager = client.services.lavalinkManager;
  const initial = manager.getRadioSession(guildId);
  const view: RadioViewState = {regionKey: initial?.regionKey ?? 'seoul'};
  let displayedSessionId = initial?.sessionId;
  let expired = false;
  let commandMention = '/radio';
  const render = async () => {
    const active = manager.getRadioSession(guildId);
    displayedSessionId = active?.sessionId;
    const payload = buildRadioMessage(view, active, client.config, expired, commandMention);
    if (followUpMessage) await followUpMessage.edit(payload);
    else await safeEditReply(interaction, payload);
  };
  if (!followUpMessage) await safeReply(interaction, buildRadioMessage(view, initial, client.config));
  const message = followUpMessage ?? (await interaction.fetchReply());
  const collector = message.createMessageComponentCollector<ComponentType.Button | ComponentType.StringSelect>({time: RADIO_COLLECTOR_TIMEOUT, filter: i => i.customId.startsWith('radio:')});
  collector.on('collect', async selection => {
    try {
      if (!(await safeDeferUpdate(selection))) return;
      const [, action, regionKey] = selection.customId.split(':');
      if (action === 'region' && selection.isStringSelectMenu()) {
        const region = radioRegions.find(item => item.key === selection.values[0]);
        if (region) {
          view.regionKey = region.key;
        }
        await render();
        return;
      }
      if (action === 'refresh') {
        await render();
        return;
      }
      if (!(await getPlaybackOptions(selection))) return;
      const active = manager.getRadioSession(guildId);
      const region = radioRegions.find(item => item.key === (action === 'station' ? regionKey : view.regionKey));
      if (!region) return;
      if ((action === 'lower' || action === 'higher') && active?.sessionId !== displayedSessionId) {
        await playbackError(selection, '재생 상태가 바뀌었어요. 화면을 새로고침해 주세요.');
        return;
      }
      const station = action === 'station' && selection.isStringSelectMenu() ? findRadioStation(region.key, selection.values[0] ?? '') : action === 'lower' || action === 'higher' ? getAdjacentStation(region, active?.regionKey === region.key ? active.station : undefined, action) : undefined;
      if (!station) return;
      const token = Symbol();
      requests.set(guildId, token);
      const previousSessionId = manager.getSession(guildId)?.sessionId;
      const isCurrent = () => requests.get(guildId) === token && manager.getSession(guildId)?.sessionId === previousSessionId;
      let response: LavalinkResponse | undefined;
      try {
        response = await manager.loadRadio(station.id, selection.user);
      } catch (error) {
        if (isCurrent()) {
          client.logger.error(toError(error, 'Radio load failed'));
          await playbackError(selection, '라디오에 연결할 수 없어요. 현재 재생은 유지돼요.');
        }
        return;
      }
      if (!isCurrent()) return;
      if (!response || response.loadType !== LoadType.TRACK) {
        await playbackError(selection, '라디오에 연결할 수 없어요. 잠시 후 다시 시도하거나 다른 채널을 선택해 주세요.');
        return;
      }
      const track: QueueTrack = {...response.data, requester: selection.user, info: {...response.data.info, title: station.name, author: station.provider, uri: getRadioTrackUri(station.id), isStream: true, isSeekable: false}, playContext: {playContext: 'play', requestChannelId: selection.channelId}};
      await requestPlaybackAction(
        selection,
        'radio',
        async (_currentInteraction, context, options) => {
          const existing = context.getRadioSession();
          const session = existing ?? (await context.createRadioSession(options));
          session.textChannelId = options.textChannelId;
          try {
            await session.tune(region.key, station, track);
          } catch (error) {
            if (!existing) await context.destroySession(session.sessionId);
            throw error;
          }
          view.regionKey = region.key;
          await render();
        },
        isCurrent,
      );
    } catch (error) {
      client.logger.error(toError(error, 'Radio interaction failed'));
      await playbackError(selection, '라디오를 조작하는 중 오류가 발생했어요. 다시 시도해 주세요.');
    }
  });
  collector.on('end', async () => {
    expired = true;
    try {
      commandMention = await slashCommandMention(interaction, 'radio');
      await render();
    } catch (error) {
      client.logger.error(toError(error, 'Failed to expire radio controls'));
    }
  });
}
