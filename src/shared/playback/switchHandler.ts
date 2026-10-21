import {ActionRowBuilder, ButtonBuilder, type ButtonInteraction, ButtonStyle, EmbedBuilder} from 'discord.js';
import {getClient} from '@/shared/discord/client';
import {COLORS} from '@/shared/discord/embedColors';
import {createErrorEmbed} from '@/shared/discord/embeds';
import {safeDeferUpdate, safeEditReply, safeReply} from '@/shared/discord/interactions';
import {toError} from '@/shared/errors';
import type {CreateQueueOptions} from '@/types/music';
import type {PlaybackMode, SessionMutation} from '@/types/playback';
import {getPlaybackOptions, type PlaybackInteraction, playbackError} from './sessionGuard';

type PlaybackAction = (interaction: PlaybackInteraction, context: SessionMutation, options: CreateQueueOptions) => Promise<void>;
interface PendingSwitch {
  userId: string;
  guildId: string;
  voiceChannelId: string;
  sessionId: string;
  target: PlaybackMode;
  expires: number;
  execute: PlaybackAction;
  isCurrent: () => boolean;
}

const pending = new Map<string, PendingSwitch>();
const SWITCH_TTL = 120_000;
const MAX_PENDING = 1000;

function addPending(value: PendingSwitch): string {
  for (const [key, request] of pending) {
    if (request.expires <= Date.now() || (request.userId === value.userId && request.guildId === value.guildId)) pending.delete(key);
  }
  if (pending.size >= MAX_PENDING) {
    const oldest = pending.keys().next().value;
    if (oldest) pending.delete(oldest);
  }
  const nonce = crypto.randomUUID();
  pending.set(nonce, value);
  return nonce;
}

export async function requestPlaybackAction(interaction: PlaybackInteraction, target: PlaybackMode, execute: PlaybackAction, isCurrent: () => boolean = () => true): Promise<boolean> {
  const client = getClient(interaction);
  const guildId = interaction.guildId;
  if (!guildId) return false;
  try {
    return await client.services.lavalinkManager.runWithSessionLock(guildId, async context => {
      if (!isCurrent()) return false;
      const options = await getPlaybackOptions(interaction);
      if (!options || !isCurrent()) return false;
      const current = context.getSession();
      if (current && current.voiceChannelId !== options.voiceChannelId) {
        await playbackError(interaction, '재생 상태가 바뀌었어요. 명령어를 다시 실행해 주세요.');
        return false;
      }
      if (current && current.mode !== target) {
        const nonce = addPending({userId: interaction.user.id, guildId: options.guildId, voiceChannelId: options.voiceChannelId, sessionId: current.sessionId, target, expires: Date.now() + SWITCH_TTL, execute, isCurrent});
        const from = current.mode === 'radio' ? '라디오' : '음악';
        const to = target === 'radio' ? '라디오' : '음악';
        await safeReply(interaction, {
          embeds: [createErrorEmbed(client, `${from} 재생 중에는 ${to}${target === 'radio' ? '를' : '을'} 시작할 수 없어요.`, `전환하면 현재 ${from} 재생${current.mode === 'music' ? '과 대기열' : ''}을 종료해요.`)],
          components: [
            new ActionRowBuilder<ButtonBuilder>().addComponents(
              new ButtonBuilder().setCustomId(`playback:switch:${nonce}`).setLabel(`${from} 종료 후 ${to} 모드로 전환`).setStyle(ButtonStyle.Danger),
              new ButtonBuilder().setCustomId(`playback:switch:cancel:${nonce}`).setLabel('전환 안 함').setStyle(ButtonStyle.Secondary),
            ),
          ],
        });
        return false;
      }
      await execute(interaction, context, options);
      return true;
    });
  } catch (error) {
    client.logger.error(toError(error, 'Playback action failed'));
    await playbackError(interaction, '재생을 시작하지 못했어요. 다시 시도해 주세요.');
    return false;
  }
}

export async function handlePlaybackSwitch(interaction: ButtonInteraction): Promise<void> {
  const action = interaction.customId.slice('playback:switch:'.length);
  const cancelled = action.startsWith('cancel:');
  const nonce = cancelled ? action.slice('cancel:'.length) : action;
  const request = pending.get(nonce);
  if (!request || request.expires <= Date.now()) {
    pending.delete(nonce);
    await playbackError(interaction, '전환 요청이 만료됐어요. 명령어를 다시 실행해 주세요.');
    return;
  }
  if (request.userId !== interaction.user.id || request.guildId !== interaction.guildId) {
    await playbackError(interaction, '다른 사용자의 인터렉션이에요.');
    return;
  }
  pending.delete(nonce);
  if (!(await safeDeferUpdate(interaction))) return;
  const client = getClient(interaction);
  if (cancelled) {
    await safeEditReply(interaction, {embeds: [new EmbedBuilder().setTitle('전환을 취소했어요.').setColor(COLORS.normal)], components: []});
    return;
  }
  let switched = false;
  try {
    await client.services.lavalinkManager.runWithSessionLock(request.guildId, async context => {
      const options = await getPlaybackOptions(interaction);
      if (!options) return;
      if (options.voiceChannelId !== request.voiceChannelId) {
        await playbackError(interaction, '음성 채널이 바뀌었어요. 명령어를 다시 실행해 주세요.');
        return;
      }
      const current = context.getSession();
      if (current?.sessionId !== request.sessionId || !request.isCurrent() || request.expires <= Date.now()) {
        await playbackError(interaction, '재생 상태가 바뀌었어요. 명령어를 다시 실행해 주세요.');
        return;
      }
      if (!(await context.destroySession(request.sessionId))) return;
      await request.execute(interaction, context, options);
      switched = true;
    });
  } catch (error) {
    client.logger.error(toError(error, 'Playback mode switch failed'));
    await playbackError(interaction, '재생 모드를 전환하지 못했어요. 다시 시도해 주세요.');
  } finally {
    const from = request.target === 'radio' ? '음악' : '라디오';
    const to = request.target === 'radio' ? '라디오' : '음악';
    await safeEditReply(interaction, {
      components: [],
      ...(switched ? {embeds: [new EmbedBuilder().setTitle(`${from}${from === '음악' ? '을' : '를'} 종료하고 ${to} 모드로 전환했어요.`).setColor(COLORS.normal)]} : {}),
    });
  }
}
