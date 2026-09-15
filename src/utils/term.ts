const MAX_LINES = 1_000;
const lines: string[] = [];
let partial = '';
let bar = '';

export const writeTerm = (chunk: string): void => {
  const parts = (partial + chunk).split('\n');
  partial = parts.pop() ?? '';
  lines.push(...parts);
  if (lines.length > MAX_LINES) {
    lines.splice(0, lines.length - MAX_LINES);
  }
  process.stdout.write(chunk);
};

const drawBar = (): void => {
  const rows = process.stdout.rows;
  process.stdout.write(`\x1b7\x1b[${rows};1H\x1b[2K${bar}\x1b8`);
};

const visibleRows = (line: string, columns: number): number => {
  let width = 0;
  let inEscape = false;
  for (const character of line) {
    if (inEscape) {
      if (character === 'm') inEscape = false;
    } else if (character === '\x1b') {
      inEscape = true;
    } else {
      width += (character.codePointAt(0) ?? 0) > 0xff ? 2 : 1;
    }
  }
  return Math.max(1, Math.ceil(width / columns));
};

const repaint = (): void => {
  const rows = process.stdout.rows;
  const columns = process.stdout.columns || 80;
  if (rows < 2) return;

  const tail: string[] = [];
  let used = 0;
  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index];
    if (line === undefined) break;
    const height = visibleRows(line, columns);
    if (used + height > rows - 2) break;
    tail.unshift(line);
    used += height;
  }

  const startRow = rows - 1 - used;
  process.stdout.write(`\x1b[r\x1b[2J\x1b[${startRow};1H${tail.map(line => `${line}\n`).join('')}\x1b[1;${rows - 1}r\x1b[${rows - 1};1H`);
  drawBar();
};

let resizeTimer: ReturnType<typeof setTimeout> | undefined;

const handleResize = (): void => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(repaint, 150);
};

export const clearTerm = (): void => {
  lines.length = 0;
  partial = '';
  const rows = process.stdout.rows;
  process.stdout.write(`\x1b[r\x1b[${rows};1H\x1b[2K${'\n'.repeat(rows)}`);
  repaint();
};

const teardown = (): void => {
  process.stdout.write(`\x1b[r\x1b[${process.stdout.rows};1H\x1b[2K`);
};

export const setupTerm = (barText: string): void => {
  bar = barText;
  const rows = process.stdout.rows;
  if (rows >= 2) {
    process.stdout.write(`\x1b[1;${rows - 1}r\x1b[${rows - 1};1H`);
    drawBar();
  }
  process.stdout.on('resize', handleResize);
  process.on('exit', teardown);
};
