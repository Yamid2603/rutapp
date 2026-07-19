import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { signIn, signInWithGoogle, user, role, loading: authLoading, error: authError } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resetMsg, setResetMsg] = useState('');

  // Si ya hay sesión válida (por ej. tras redirect de Google en móvil), entrar al admin
  useEffect(() => {
    if (!authLoading && user && role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [authLoading, user, role, navigate]);

  async function handleReset() {
    if (!email.trim()) { setError('Ingresa tu correo para recuperar la contraseña.'); return; }
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setResetMsg('Correo de recuperación enviado. Revisa tu bandeja.');
      setError('');
    } catch {
      setError('No se pudo enviar el correo. Verifica que el email sea correcto.');
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Ingresa tu correo y contraseña.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      navigate('/admin');
    } catch (err) {
      setError(err.message || 'Error al iniciar sesión.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.logo}>
          <img src="/logo-light.png" alt="RutaApp" className={styles.logoImg} />
          <span className={styles.logoSub}>Panel Administrativo</span>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.field}>
            <label className={styles.label}>CORREO</label>
            <input
              className={styles.input}
              type="email"
              placeholder="admin@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label}>CONTRASEÑA</label>
            <div className={styles.passwordRow}>
              <input
                className={styles.input}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                style={{ flex: 1 }}
              />
              <button type="button" className={styles.eyeBtn} onClick={() => setShowPassword(v => !v)}>
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {(error || authError) && <p className={styles.error}>{error || authError}</p>}
          {resetMsg && <p className={styles.success}>{resetMsg}</p>}

          <button className={styles.button} type="submit" disabled={loading}>
            {loading ? 'Ingresando...' : 'ENTRAR →'}
          </button>
        </form>

        <div className={styles.divider}><span>o</span></div>

        <button
          className={styles.googleButton}
          onClick={async () => {
            setLoading(true);
            setError('');
            try {
              await signInWithGoogle();
              navigate('/admin');
            } catch (err) {
              setError(err.message || 'Error con Google.');
            } finally {
              setLoading(false);
            }
          }}
          disabled={loading}
        >
          <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={20} />
          Continuar con Google
        </button>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <button type="button" className={styles.forgotBtn} onClick={handleReset}>
            ¿Olvidaste tu contraseña?
          </button>
        </div>

        <div style={{ textAlign: 'center', marginTop: 12 }}>
          <Link to="/onboarding" style={{ fontSize: 13, color: '#1693A5', textDecoration: 'none', fontWeight: 500 }}>
            ¿Eres nuevo? Registra tu empresa →
          </Link>
        </div>
      </div>
    </div>
  );
}
