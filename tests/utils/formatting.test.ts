import {describe, expect, it} from 'bun:test';

import {hyperlink, msToTime, truncateWithEllipsis} from '@/utils/formatting/format';

describe('Formatting Utils', () => {
  describe('truncateWithEllipsis', () => {
    it('should return original text if shorter than maxLength', () => {
      const text = 'Hello';
      expect(truncateWithEllipsis(text, 10)).toBe('Hello');
    });

    it('should return original text if equal to maxLength', () => {
      const text = 'Hello';
      expect(truncateWithEllipsis(text, 5)).toBe('Hello');
    });

    it('should truncate text and add ellipsis if longer than maxLength', () => {
      const text = 'Hello World';
      expect(truncateWithEllipsis(text, 5)).toBe('He...');
    });

    it('should handle custom ellipsis', () => {
      const text = 'Hello World';
      expect(truncateWithEllipsis(text, 5, '!')).toBe('Hell!');
    });
  });

  describe('hyperlink', () => {
    it('should create a markdown hyperlink', () => {
      expect(hyperlink('Link', 'https://example.com')).toBe('[Link](<https://example.com>)');
    });

    it('should escape brackets in text', () => {
      expect(hyperlink('[Link]', 'https://example.com')).toBe('[［Link］](<https://example.com>)');
    });
  });

  describe('msToTime', () => {
    it('should format milliseconds to MM:SS', () => {
      expect(msToTime(65000)).toBe('01:05');
    });

    it('should format milliseconds to HH:MM:SS if longer than an hour', () => {
      expect(msToTime(3665000)).toBe('1:01:05');
    });

    it('should handle zero', () => {
      expect(msToTime(0)).toBe('00:00');
    });
  });
});
