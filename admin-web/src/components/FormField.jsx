import styles from './FormField.module.css';

export default function FormField({ label, children, ...rest }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      {children || <input className={styles.input} {...rest} />}
    </div>
  );
}

export function Select({ label, value, onChange, options }) {
  return (
    <div className={styles.field}>
      {label && <label className={styles.label}>{label}</label>}
      <select className={styles.input} value={value} onChange={e => onChange(e.target.value)}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function Btn({ children, variant = 'primary', ...rest }) {
  return (
    <button className={`${styles.btn} ${styles[variant]}`} {...rest}>
      {children}
    </button>
  );
}
