import {
  DEFAULT_ACCESSORY_NAME,
  isValidHomeKitName,
  sanitizeDeviceName,
} from '../../utils/sanitize-name';

describe('sanitizeDeviceName', () => {
  it.each([
    // [input, expected] - names needing repair
    ['OasisMist™ 4.5L', 'OasisMist 4.5L'],
    ['OasisMist® 4.5L', 'OasisMist 4.5L'],
    ['Fan 💨', 'Fan'],
    ['A™B', 'A B'],
    ['  - Bedroom -  ', 'Bedroom'],
    ['Fan.', 'Fan'],
    ['"Office" Purifier', 'Office Purifier'],
    ['Fan   with   spaces', 'Fan with spaces'],
    ['\'Quoted\'', 'Quoted'],
  ])('sanitizes %j to %j', (input, expected) => {
    expect(sanitizeDeviceName(input)).toBe(expected);
  });

  it.each([
    // Already-valid names must pass through untouched
    ['Core 300S Series'],
    ["Mick's Fan, No. 2 - Office"],
    ['Büro Lüfter'],
    ['加湿器'],
    ['Bedroom Air Purifier'],
  ])('leaves valid name %j unchanged', (input) => {
    expect(sanitizeDeviceName(input)).toBe(input);
  });

  it('falls back when nothing usable remains', () => {
    expect(sanitizeDeviceName('™®')).toBe(DEFAULT_ACCESSORY_NAME);
    expect(sanitizeDeviceName('   ')).toBe(DEFAULT_ACCESSORY_NAME);
    expect(sanitizeDeviceName('')).toBe(DEFAULT_ACCESSORY_NAME);
    expect(sanitizeDeviceName(undefined as unknown as string)).toBe(DEFAULT_ACCESSORY_NAME);
  });

  it('honours a custom fallback', () => {
    expect(sanitizeDeviceName('🎉', 'Backup Name')).toBe('Backup Name');
  });
});

describe('isValidHomeKitName', () => {
  it.each([
    ['Core 300S Series', true],
    ['OasisMist™ 4.5L', false],
    ['Fan.', false],
    ['', false],
    ["Mick's Fan", true],
  ])('%j -> %s', (input, expected) => {
    expect(isValidHomeKitName(input)).toBe(expected);
  });
});
