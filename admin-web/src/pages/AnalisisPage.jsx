import { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useAnalisisIA } from '../hooks/useAnalisisIA';
import SemaforoResumen from '../components/SemaforoResumen';
import SeccionEficiencia from '../components/SeccionEficiencia';
import SeccionRiesgo from '../components/SeccionRiesgo';
import SeccionOportunidades from '../components/SeccionOportunidades';
import SeccionGastos from '../components/SeccionGastos';
import SeccionAlertas from '../components/SeccionAlertas';
import ChatbotPanel from '../components/ChatbotPanel';
import styles from './AnalisisPage.module.css';

export default function AnalisisPage() {
  const { empresaId } = useAuth();
  const [periodo, setPeriodo] = useState('30d'); // '7d', '30d', 'custom'
  const [customInicio, setCustomInicio] = useState(null);
  const [customFin, setCustomFin] = useState(null);

  // Calcular fechas
  const { fechaInicio, fechaFin } = useMemo(() => {
    const fin = new Date();
    const inicio = new Date();

    if (periodo === '7d') inicio.setDate(inicio.getDate() - 7);
    else if (periodo === '30d') inicio.setDate(inicio.getDate() - 30);
    else if (periodo === 'custom') {
      return { fechaInicio: customInicio, fechaFin: customFin };
    }

    return { fechaInicio: inicio, fechaFin: fin };
  }, [periodo, customInicio, customFin]);

  const { eficiencia, riesgo, oportunidades, gastos, alertas, loading, error } = useAnalisisIA(
    empresaId,
    fechaInicio,
    fechaFin,
  );

  return (
    <div className={styles.container}>
      <div className={styles.pageHeader}>
        <h1>Análisis IA</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {[
            { key: '7d', label: 'Última semana' },
            { key: '30d', label: 'Último mes' },
            { key: 'custom', label: 'Personalizado' },
          ].map(p => (
            <button
              key={p.key}
              onClick={() => setPeriodo(p.key)}
              style={{
                padding: '8px 14px',
                borderRadius: 6,
                border: periodo === p.key ? '2px solid #1693A5' : '1px solid #D8D8C0',
                background: periodo === p.key ? '#1693A5' : 'white',
                color: periodo === p.key ? 'white' : '#1a1a1a',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              {p.label}
            </button>
          ))}
          {periodo === 'custom' && (
            <>
              <input
                type="date"
                value={customInicio ? customInicio.toISOString().split('T')[0] : ''}
                onChange={e => setCustomInicio(e.target.value ? new Date(e.target.value) : null)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D8D8C0', fontSize: 13 }}
              />
              <span style={{ color: '#8B949E', fontSize: 13 }}>→</span>
              <input
                type="date"
                value={customFin ? customFin.toISOString().split('T')[0] : ''}
                onChange={e => setCustomFin(e.target.value ? new Date(e.target.value) : null)}
                style={{ padding: '7px 10px', borderRadius: 6, border: '1px solid #D8D8C0', fontSize: 13 }}
              />
            </>
          )}
        </div>
      </div>

      {loading && (
        <div className={styles.spinner}>
          <div>Cargando análisis...</div>
        </div>
      )}

      {error && (
        <div className={styles.errorBanner}>
          <strong>Error:</strong> {error}
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Resumen visual con semáforos */}
          <SemaforoResumen
            eficiencia={eficiencia}
            riesgo={riesgo}
            gastos={gastos}
            alertas={alertas}
          />

          {/* Grid de secciones */}
          <div className={styles.grid}>
            <SeccionEficiencia datos={eficiencia} exportable />
            <SeccionRiesgo datos={riesgo} exportable />
            <SeccionOportunidades datos={oportunidades} exportable />
            <SeccionGastos datos={gastos} exportable />
            <div style={{ gridColumn: '1 / -1' }}>
              <SeccionAlertas datos={alertas} />
            </div>
          </div>
        </>
      )}

      {/* Chatbot flotante */}
      <ChatbotPanel empresaId={empresaId} />
    </div>
  );
}
