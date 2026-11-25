const formatNumber = new Intl.NumberFormat('en').format;

export { formatNumber };

export function formatRows(count: number): string {
  return `${formatNumber(count)} ${count === 1 ? 'row' : 'rows'}`;
}

export function hasOuterSpaces(value: string): boolean {
  return value.startsWith(' ') || value.endsWith(' ');
}
