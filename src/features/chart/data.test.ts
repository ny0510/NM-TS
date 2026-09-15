import {describe, expect, test} from 'bun:test';
import {DateTime} from 'luxon';

import {parseMonthInput} from './data';

const KST_ZONE = 'Asia/Seoul';
const CURRENT_YEAR = 2026;

const toYearMonth = (date: Date | null): string | null => (date ? DateTime.fromJSDate(date, {zone: KST_ZONE}).toFormat('yyyy-MM') : null);

describe('parseMonthInput', () => {
  test.each([
    ['1', '2026-01'],
    ['01', '2026-01'],
    ['2026-1', '2026-01'],
    ['2026-01', '2026-01'],
  ])('parses %s as %s', (input, expected) => {
    // Given: a supported month input and a fixed current year
    // When: the chart month input is parsed
    const parsed = parseMonthInput(input, CURRENT_YEAR);

    // Then: the input resolves to the expected KST calendar month
    expect(toYearMonth(parsed)).toBe(expected);
  });

  test.each(['0', '00', '13', '2026-0', '2026-13', '26-01', '2026/01'])('rejects invalid month input %s', input => {
    // Given: an unsupported month input
    // When: the chart month input is parsed
    const parsed = parseMonthInput(input, CURRENT_YEAR);

    // Then: parsing fails without coercing it to another month
    expect(parsed).toBeNull();
  });
});
