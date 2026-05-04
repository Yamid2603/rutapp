import { useMemo } from 'react';
import styles from './SemaforoResumen.module.css';

export default function SemaforoResumen({ eficiencia, riesgo, gastos, alertas }) {
  const stats = useMemo(() => {
    const promedioRatio = eficiencia.length
      ? eficiencia.reduce((s, c) => s + c.ratioCobranza, 0) / eficiencia.length
      : 0;

    const clientesEnRiesgo = riesgo.filter(c => c.status.semaforo === 'red').length;
    const totalGastos = gastos?.porCategoria?.total || 0;
    const alertasAltas = alertas.filter(a => a.severidad === 'red').length;

    return { promedioRatio, clientesEnRiesgo, totalGastos, alertasAltas };
  }, [eficiencia, riesgo, gastos, alertas]);

  const getSemaforoColor = (ratio) => {
    if (ratio >= 85) return '#10B981';
    if (ratio >= 70) return '#F59E0B';
    return '#EF4444';
  };

  return (
    <div className={styles.resumen}>
      <div className={styles.tarjeta}>
        <h3>Eficiencia</h3>
        <div className={styles.contenido}>
          <div
            className={styles.circulo}
            style={{ background: getSemaforoColor(stats.promedioRatio) }}
          />
          <div className={styles.valor}>{stats.promedioRatio.toFixed(1)}%</div>
        </div>
      </div>

      <div className={styles.tarjeta}>
        <h3>Riesgo Clientes</h3>
        <div className={styles.contenido}>
          <div className={styles.numero}>{stats.clientesEnRiesgo}</div>
          <div className={styles.subtitulo}>en riesgo</div>
        </div>
      </div>

      <div className={styles.tarjeta}>
        <h3>Gastos</h3>
        <div className={styles.contenido}>
          <div className={styles.numero}>
            ${(stats.totalGastos / 1000).toFixed(0)}k
          </div>
          <div className={styles.subtitulo}>este período</div>
        </div>
      </div>

      <div className={styles.tarjeta}>
        <h3>Alertas</h3>
        <div className={styles.contenido}>
          <div
            className={styles.numero}
            style={{ color: stats.alertasAltas > 0 ? '#EF4444' : '#10B981' }}
          >
            {stats.alertasAltas}
          </div>
          <div className={styles.subtitulo}>críticas</div>
        </div>
      </div>
    </div>
  );
}
