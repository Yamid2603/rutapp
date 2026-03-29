export function money(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('es-CO');
}

export function pct(value, total) {
  if (!total) return '0%';
  return Math.round((value / total) * 100) + '%';
}
