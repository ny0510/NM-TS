export const truncateWithEllipsis = (text: string, maxLength: number, ellipsis: string = '...'): string => {
  if (text.length <= maxLength) return text;
  const truncatedText = text.slice(0, maxLength - ellipsis.length);
  return `${truncatedText}${ellipsis}`;
};

export const hyperlink = (text: string, url: string): string => {
  return `[${text.replaceAll('[', '［').replaceAll(']', '］')}](<${url}>)`;
};

export const msToTime = (ms: number): string => {
  const s = Math.floor(ms / 1000),
    h = Math.floor(s / 3600),
    m = Math.floor((s % 3600) / 60),
    sec = s % 60;
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
};
