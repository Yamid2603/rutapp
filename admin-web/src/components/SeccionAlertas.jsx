import styles from './Seccion.module.css';

export default function SeccionAlertas({ datos }) {
  const iconoSeveridad = {
    red: '🔴',
    yellow: '🟡',
    green: '🟢',
  };

  const colorSeveridad = {
    red: '#FEE2E2',
    yellow: '#FEF3C7',
    green: '#D1FAE5',
  };

  return (
    <div className={styles.seccion}>
      <div className={styles.header}>
        <h3>🚨 Alertas ({datos.length})</h3>
      </div>

      <div className={styles.alertasLista}>
        {datos.map((alerta) => (
          <div
            key={alerta.id}
            className={styles.alerta}
            style={{ borderLeftColor: colorSeveridad[alerta.severidad], background: colorSeveridad[alerta.severidad] }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 18 }}>{iconoSeveridad[alerta.severidad]}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
                  {alerta.titulo}
                </div>
                <div style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>
                  {alerta.descripcion}
                </div>
                <div style={{ fontSize: 11, color: '#999', fontStyle: 'italic' }}>
                  → {alerta.accion}
                </div>
              </div>
            </div>
          </div>
        ))}

        {!datos.length && (
          <div style={{ padding: 16, textAlign: 'center', color: '#999', fontSize: 13 }}>
            ✅ Sin alertas críticas
          </div>
        )}
      </div>
    </div>
  );
}
