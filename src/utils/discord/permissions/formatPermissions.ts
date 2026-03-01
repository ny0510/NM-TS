import {PermissionFlagsBits, type PermissionsString} from 'discord.js';

import PermissionTranslations from './locale/permission';

/**
 * Formats missing permissions into a human-readable string with translations.
 * Handles both bigint permissions (from PermissionFlagsBits) and string permissions (from checkBotPermissions).
 *
 * @param permissions - Array of permissions (bigint or string)
 * @returns Formatted string with Korean translations and permission names (e.g., "+ 채널 보기 (ViewChannel)")
 */
export const formatMissingPermissions = (permissions: bigint[] | string[]): string => {
  if (permissions.length === 0) return '';

  // If first element is bigint, convert all to permission names
  if (typeof permissions[0] === 'bigint') {
    const bigintPerms = permissions as bigint[];

    // Create reverse mapping: bigint value -> permission name
    const bitToName = Object.entries(PermissionFlagsBits).reduce(
      (acc, [name, bit]) => {
        acc[bit.toString()] = name;
        return acc;
      },
      {} as Record<string, string>,
    );

    return bigintPerms
      .map(perm => {
        const permName = bitToName[perm.toString()] as PermissionsString | undefined;
        const displayName = permName || perm.toString();
        const translation = permName && PermissionTranslations[permName] ? PermissionTranslations[permName] : '알 수 없음';
        return `+ ${translation} (${displayName})`;
      })
      .join('\n');
  }

  // If string permissions, use directly
  const stringPerms = permissions as string[];
  return stringPerms.map(permission => `+ ${PermissionTranslations[permission as PermissionsString]} (${permission})`).join('\n');
};
