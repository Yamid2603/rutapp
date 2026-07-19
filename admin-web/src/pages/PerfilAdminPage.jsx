import { useState, useEffect } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { updatePassword, EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { auth, db } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import FormField, { Btn } from '../components/FormField';
import styles from './GestionPage.module.css';

export default function PerfilAdminPage() {
  const { user, empresaId, signOut } = useAuth();

  const [form, setForm] = useState({ nombre: '', wap: '', email: '' });
  const [empresa, setEmpresa] = useState('');
  const [saving, setSaving] = useState(false);

  const [passForm, setPassForm] = useState({ actual: '', nueva: '', confirmar: '' });
  const [savingPass, setSavingPass] = useState(false);
  const [passMsg, setPassMsg] = useState('');
  const [passError, setPassError] = useState('');

  useEffect(() => {
    if (!user || !empresaId) return;
    getDoc(doc(db, 'usuarios', user.uid)).then(snap => {
      if (snap.exists()) {
        const d = snap.data();
        setForm({ nombre: d.nombre || '', wap: d.wap || '', email: d.email || user.email || '' });
      }
    });
    getDoc(doc(db, 'empresas', empresaId)).then(snap => {
      if (snap.exists()) setEmpresa(snap.data().nombre || '');
    });
  }, [user, empresaId]);

  function validarWap(w) {
    const trimmed = (w || '').trim();
    if (!trimmed) return null; // permitir vacío
    if (!trimmed.startsWith('+')) return 'WhatsApp debe comenzar con + (código de país). Ej: +573001234567';
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return 'WhatsApp debe tener entre 8 y 15 dígitos.';
    return null;
  }

  async function handleSavePerfil() {
    const wapError = validarWap(form.wap);
    if (wapError) { alert(wapError); return; }
    setSaving(true);
    try {
      await updateDoc(doc(db, 'usuarios', user.uid), {
        nombre: form.nombre.trim(),
        wap: form.wap.trim(),
      });
      alert('Perfil actualizado');
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCambiarPassword() {
    setPassMsg('');
    setPassError('');
    if (passForm.nueva.length < 6) { setPassError('La nueva contraseña debe tener al menos 6 caracteres.'); return; }
    if (passForm.nueva !== passForm.confirmar) { setPassError('Las contraseñas no coinciden.'); return; }
    setSavingPass(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, passForm.actual);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, passForm.nueva);
      setPassForm({ actual: '', nueva: '', confirmar: '' });
      setPassMsg('Contraseña cambiada exitosamente.');
    } catch (err) {
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setPassError('Contraseña actual incorrecta.');
      } else if (err.code === 'auth/requires-recent-login') {
        setPassError('Sesión expirada. Cierra sesión, vuelve a entrar e inténtalo de nuevo.');
      } else {
        setPassError(err.message);
      }
    } finally {
      setSavingPass(false);
    }
  }

  // Detectar si tiene provider de password (puede tener AMBOS Google y password)
  const hasPasswordProvider = user?.providerData?.some(p => p.providerId === 'password');

  return (
    <div>
      <h1 className={styles.pageTitle}>Mi perfil</h1>

      {/* Info personal */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>👤 Información personal</h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 32,
            background: 'var(--navy)', color: '#fff',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 24, fontWeight: 700,
          }}>
            {(form.nombre || form.email || '?').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1a1a1a' }}>{form.nombre || '—'}</div>
            <div style={{ fontSize: 13, color: '#8B949E' }}>{form.email}</div>
            <div style={{ fontSize: 12, color: 'var(--teal)', marginTop: 2 }}>Empresa: {empresa || '—'}</div>
          </div>
        </div>

        <div className={styles.configGrid}>
          <FormField
            label="Nombre"
            value={form.nombre}
            onChange={e => setForm({ ...form, nombre: e.target.value })}
          />
          <FormField
            label="Email"
            value={form.email}
            disabled
          />
          <FormField
            label="WhatsApp (con código de país)"
            placeholder="+573001234567"
            value={form.wap}
            onChange={e => setForm({ ...form, wap: e.target.value })}
          />
        </div>
        <div style={{ marginTop: 14 }}>
          <Btn onClick={handleSavePerfil} disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar perfil'}
          </Btn>
        </div>
      </div>

      {/* Cambiar contraseña — solo si tiene provider de password */}
      {hasPasswordProvider && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>🔒 Cambiar contraseña</h3>
          <div className={styles.configGrid}>
            <FormField
              label="Contraseña actual"
              type="password"
              value={passForm.actual}
              onChange={e => setPassForm({ ...passForm, actual: e.target.value })}
            />
            <FormField
              label="Nueva contraseña"
              type="password"
              value={passForm.nueva}
              onChange={e => setPassForm({ ...passForm, nueva: e.target.value })}
            />
            <FormField
              label="Confirmar nueva contraseña"
              type="password"
              value={passForm.confirmar}
              onChange={e => setPassForm({ ...passForm, confirmar: e.target.value })}
            />
          </div>
          {passError && <p style={{ color: 'var(--danger)', fontSize: 13, marginTop: 8 }}>{passError}</p>}
          {passMsg && <p style={{ color: 'var(--success)', fontSize: 13, marginTop: 8 }}>{passMsg}</p>}
          <div style={{ marginTop: 14 }}>
            <Btn onClick={handleCambiarPassword} disabled={savingPass || !passForm.actual || !passForm.nueva}>
              {savingPass ? 'Cambiando...' : 'Cambiar contraseña'}
            </Btn>
          </div>
        </div>
      )}

      {!hasPasswordProvider && (
        <div className={styles.card}>
          <h3 className={styles.cardTitle}>🔒 Contraseña</h3>
          <p style={{ fontSize: 13, color: '#8B949E' }}>
            Tu cuenta usa Google Sign-In. La contraseña se administra desde tu cuenta de Google.
          </p>
        </div>
      )}

      {/* Cerrar sesión */}
      <div className={styles.card}>
        <h3 className={styles.cardTitle}>Sesión</h3>
        <p style={{ fontSize: 13, color: '#8B949E', marginBottom: 12 }}>
          Cierra sesión en este dispositivo. Podrás volver a entrar cuando quieras.
        </p>
        <button
          onClick={signOut}
          style={{
            padding: '10px 18px',
            background: '#FFFFFF',
            color: 'var(--danger)',
            border: '1.5px solid rgba(184,75,75,0.40)',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
