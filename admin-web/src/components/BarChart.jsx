import styles from './BarChart.module.css';
import { money } from '../utils/format';

export default function BarChart({ data, labels, height = 180 }) {
  const max = Math.max(...data, 1);
  return (
    <div className={styles.chart} style={{ height }}>
      <div className={styles.bars}>
        {data.map((val, i) => (
          <div key={i} className={styles.col}>
            <div className={styles.barWrap}>
              <div
                className={styles.bar}
                style={{ height: `${(val / max) * 100}%` }}
                title={money(val)}
              />
            </div>
            <span className={styles.label}>{labels[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
