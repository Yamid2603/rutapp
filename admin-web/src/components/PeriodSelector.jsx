import styles from './PeriodSelector.module.css';

const PERIODS = [
  { key: 'day', label: 'Hoy' },
  { key: 'week', label: 'Esta semana' },
  { key: 'month', label: 'Este mes' },
];

export default function PeriodSelector({ value, onChange }) {
  return (
    <div className={styles.pills}>
      {PERIODS.map(p => (
        <button
          key={p.key}
          className={`${styles.pill} ${value === p.key ? styles.active : ''}`}
          onClick={() => onChange(p.key)}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}
