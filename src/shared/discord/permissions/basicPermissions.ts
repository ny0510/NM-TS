import {PermissionsBitField} from 'discord.js';

export const REQUIRED_PERMISSIONS = [PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.EmbedLinks, PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak] as const;

export function checkMissingPermissions(guildPermissions: PermissionsBitField): string[] {
  return guildPermissions.missing(REQUIRED_PERMISSIONS);
}

export function generateInviteLink(clientId: string): string {
  const permissions = new PermissionsBitField(REQUIRED_PERMISSIONS);
  const permissionValue = permissions.bitfield.toString();

  return `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissionValue}&scope=bot%20applications.commands`;
}
