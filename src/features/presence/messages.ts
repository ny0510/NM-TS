import type {ClientStats, PresenceConfig} from '@/types/client';

const renderPresenceMessage = (template: string, stats: ClientStats): string => template.replaceAll('{guilds}', String(stats.guilds)).replaceAll('{users}', String(stats.users)).replaceAll('{players}', String(stats.activePlayers));

export const buildPresenceMessages = (config: PresenceConfig, stats: ClientStats): string[] => {
  return config.PRESENCE_MESSAGES.filter(template => stats.activePlayers > 0 || !template.includes('{players}')).map(template => renderPresenceMessage(template, stats));
};
