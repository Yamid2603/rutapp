export function money(n) {
  if (n == null) return '—';
  return '$' + Number(n).toLocaleString('es-CO');
}

export function pct(value, total) {
  if (!total) return '0%';
  return Math.round((value / total) * 100) + '%';
}

export function validarTelefono(t) {
  const trimmed = (t || '').trim();
  if (!trimmed) return null;
  if (!trimmed.startsWith('+')) return 'El teléfono debe comenzar con + (ej: +573001234567)';
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8 || digits.length > 15) return 'El teléfono debe tener entre 8 y 15 dígitos';
  return null;
}
