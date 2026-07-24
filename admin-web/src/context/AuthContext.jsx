import { createContext, useContext, useEffect, useState } from 'react';
import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext(null);

function isMobile() {
  if (typeof navigator === 'undefined') return false;
  return /Mobi|Android|iPhone|iPad|iPod|Opera Mini|IEMobile/i.test(navigator.userAgent);
}

async function ensureAdminOrSignOut(firebaseUser) {
  const userDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
  if (!userDoc.exists()) {
    await firebaseSignOut(auth);
    throw new Error('Tu cuenta no está registrada en RutaApp. Regístrala desde el onboarding.');
  }
  const data = userDoc.data();
  if (data.rol !== 'admin') {
    await firebaseSignOut(auth);
    throw new Error('Acceso solo para administradores.');
  }
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [nombre, setNombre] = useState(null);
  const [modulosHabilitados, setModulosHabilitados] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function clearUser() {
    setUser(null);
    setRole(null);
    setEmpresaId(null);
    setNombre(null);
    setModulosHabilitados([]);
  }

  useEffect(() => {
    // Procesar resultado de signInWithRedirect (móvil) si lo hubo
    getRedirectResult(auth).catch((err) => {
      if (err?.code && err.code !== 'auth/no-auth-event') {
        setError(err.message || 'Error al iniciar sesión con Google.');
      }
    });

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userDoc = await getDoc(doc(db, 'usuarios', firebaseUser.uid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            setUser(firebaseUser);
            setRole(data.rol);
            setEmpresaId(data.empresaId ?? null);
            setNombre(data.nombre ?? null);
            if (data.empresaId) {
              const empresaDoc = await getDoc(doc(db, 'empresas', data.empresaId));
              setModulosHabilitados(empresaDoc.exists() ? (empresaDoc.data().modulosHabilitados || []) : []);
            } else {
              setModulosHabilitados([]);
            }
          } else {
            clearUser();
          }
        } catch {
          clearUser();
        }
      } else {
        clearUser();
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  async function signIn(email, password) {
    setError(null);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const data = await ensureAdminOrSignOut(credential.user);
      return { user: credential.user, role: data.rol };
    } catch (err) {
      const message = err.message || 'Error al iniciar sesión.';
      setError(message);
      throw err;
    }
  }

  async function signInWithGoogle() {
    setError(null);
    const provider = new GoogleAuthProvider();
    try {
      if (isMobile()) {
        // En móvil: redirect (popup es bloqueado/cerrado por el OS)
        await signInWithRedirect(auth, provider);
        // El flujo continúa al volver a la página — onAuthStateChanged + getRedirectResult lo manejan
        return null;
      }
      const credential = await signInWithPopup(auth, provider);
      const data = await ensureAdminOrSignOut(credential.user);
      return { user: credential.user, role: data.rol };
    } catch (err) {
      // Errores típicos en popup que NO son del usuario cerrando a propósito
      if (err?.code === 'auth/popup-closed-by-user' || err?.code === 'auth/cancelled-popup-request') {
        const message = 'La ventana de Google se cerró antes de completar el inicio de sesión.';
        setError(message);
        throw new Error(message);
      }
      const message = err.message || 'Error al iniciar sesión con Google.';
      setError(message);
      throw err;
    }
  }

  async function signOut() {
    await firebaseSignOut(auth);
    clearUser();
    setError(null);
  }

  return (
    <AuthContext.Provider value={{ user, role, empresaId, nombre, modulosHabilitados, loading, error, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
