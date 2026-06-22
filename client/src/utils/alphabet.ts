const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

export function titleLetter(title: string): string {
  const t = title.trim();
  if (!t) return '#';
  const normalized = t.normalize('NFD').replace(/\p{M}/gu, '');
  const ch = normalized.charAt(0).toUpperCase();
  if (/[A-Z]/.test(ch)) return ch;
  return '#';
}

export function groupByLetter<T extends { title: string }>(items: T[]): { letter: string; items: T[] }[] {
  const map = new Map<string, T[]>();
  for (const item of items) {
    const letter = titleLetter(item.title);
    if (!map.has(letter)) map.set(letter, []);
    map.get(letter)!.push(item);
  }
  const groups: { letter: string; items: T[] }[] = [];
  for (const letter of LETTERS) {
    const list = map.get(letter);
    if (list?.length) groups.push({ letter, items: list });
  }
  return groups;
}

export { LETTERS };
