import { money } from '../utils/format';
import styles from './LineChart.module.css';

export default function LineChart({ data, labels, height = 160 }) {
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => {
    const x = data.length === 1 ? 50 : (i / (data.length - 1)) * 100;
    const y = 100 - (v / max) * 85 - 5;
    return { x, y, val: v };
  });
  const polyline = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className={styles.wrap} style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className={styles.svg}>
        <polyline
          points={polyline}
          fill="none"
          stroke="#F59E0B"
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="1.5" fill="#F59E0B">
            <title>{money(p.val)}</title>
          </circle>
        ))}
      </svg>
      <div className={styles.labels}>
        {labels.map((l, i) => <span key={i} className={styles.label}>{l}</span>)}
      </div>
    </div>
  );
}
