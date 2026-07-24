import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children }) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#0D1117',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'var(--warning)',
        fontSize: 18,
      }}>
        Cargando...
      </div>
    );
  }

  if (!user || role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return children;
}

export function ModuleRoute({ modulo, children }) {
  const { modulosHabilitados } = useAuth();
  if (!modulosHabilitados.includes(modulo)) {
    return <Navigate to="/admin" replace />;
  }
  return children;
}
