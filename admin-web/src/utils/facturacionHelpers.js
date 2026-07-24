// Estado de pago de facturasGeneradas — cálculo puro, sin tocar Firestore.
// facturasGeneradas es create-only + una única transición permitida
// (facturada -> pagada, ver firestore.rules). El estado 'vencida' NUNCA se
// escribe: se calcula al leer, comparando fechaVencimiento contra hoy.

export function calcularVencimiento(fechaGeneracionISO, diasPlazo) {
  const fecha = new Date(fechaGeneracionISO);
  fecha.setDate(fecha.getDate() + (diasPlazo || 30));
  return fecha.toISOString().split('T')[0];
}

// Facturas generadas antes de este cambio no tienen `estado` ni
// `fechaVencimiento` (los campos no existían) — nunca se debe devolver
// undefined ni dejar la fila en blanco, se marcan explícitamente.
export function estadoFactura(factura, hoyISO = new Date().toISOString().split('T')[0]) {
  if (!factura.estado) return 'Facturada (sin seguimiento)';
  if (factura.estado === 'pagada') return 'Pagada';
  if (factura.fechaVencimiento && hoyISO > factura.fechaVencimiento) return 'Vencida';
  return 'Facturada';
}
