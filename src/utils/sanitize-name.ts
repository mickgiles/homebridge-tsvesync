/**
 * HomeKit restricts the Name characteristic (HAP-NodeJS warns and iOS can
 * refuse to add the accessory otherwise): only letters, numbers, spaces,
 * apostrophes, commas, periods, and hyphens are allowed, and the name must
 * start and end with a letter or number. VeSync factory device names often
 * violate this (e.g. "OasisMist™ 4.5L").
 *
 * Unicode letters and digits are permitted, so accented names survive intact.
 */

const DISALLOWED_CHARS = /[^\p{L}\p{N} ',.-]/gu;
const LEADING_TRAILING_JUNK = /^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu;

export const DEFAULT_ACCESSORY_NAME = 'VeSync Device';

/**
 * Returns true when a name already satisfies HomeKit's Name rules.
 */
export function isValidHomeKitName(name: string): boolean {
  return name.length > 0 && name === sanitizeDeviceName(name, name);
}

/**
 * Reduce an arbitrary device name to a HomeKit-legal one:
 * strip disallowed symbols, collapse whitespace, and trim leading/trailing
 * non-alphanumerics. Falls back when nothing usable remains.
 */
export function sanitizeDeviceName(name: string, fallback = DEFAULT_ACCESSORY_NAME): string {
  const cleaned = (name ?? '')
    .replace(DISALLOWED_CHARS, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(LEADING_TRAILING_JUNK, '');
  return cleaned.length > 0 ? cleaned : fallback;
}
