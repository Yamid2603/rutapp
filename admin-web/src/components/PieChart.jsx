import { money } from '../utils/format';

export default function PieChart({ segments, size = 180, strokeWidth = 32 }) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  if (total === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '20px 0' }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#E5E5E5"
            strokeWidth={strokeWidth}
          />
        </svg>
        <p style={{ color: '#8B949E', marginTop: 12, fontSize: 13 }}>Sin datos</p>
      </div>
    );
  }

  let cumulative = 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        {segments.map((seg, i) => {
          const fraction = seg.value / total;
          const dashArray = `${fraction * circumference} ${circumference}`;
          const dashOffset = -cumulative * circumference;
          cumulative += fraction;
          return (
            <circle
              key={i}
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={seg.color}
              strokeWidth={strokeWidth}
              strokeDasharray={dashArray}
              strokeDashoffset={dashOffset}
            >
              <title>{seg.label}: {money(seg.value)}</title>
            </circle>
          );
        })}
      </svg>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%' }}>
        {segments.map((seg, i) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          return (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
              <span style={{
                display: 'inline-block', width: 10, height: 10, borderRadius: 2,
                backgroundColor: seg.color,
              }} />
              <span style={{ flex: 1, color: '#1a1a1a' }}>{seg.label}</span>
              <span style={{ fontWeight: 600, color: '#1a1a1a' }}>{money(seg.value)}</span>
              <span style={{ color: '#8B949E', minWidth: 36, textAlign: 'right' }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
