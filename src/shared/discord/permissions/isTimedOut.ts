import type {GuildMember} from 'discord.js';

export function isTimedOut(member: GuildMember | null | undefined): boolean {
  return (
    member?.communicationDisabledUntil !== null &&
    member?.communicationDisabledUntil !== undefined &&
    member.communicationDisabledUntil > new Date()
  );
}
