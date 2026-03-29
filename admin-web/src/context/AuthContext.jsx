import { createContext, useContext, useEffect, useState } from 'react';
import { signInWithEmailAndPassword, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [empresaId, setEmpresaId] = useState(null);
  const [nombre, setNombre] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function clearUser() {
    setUser(null);
    setRole(null);
    setEmpresaId(null);
    setNombre(null);
  }

  useEffect(() => {
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
      const userDoc = await getDoc(doc(db, 'usuarios', credential.user.uid));
      if (!userDoc.exists()) {
        await firebaseSignOut(auth);
        throw new Error('Usuario no encontrado en el sistema.');
      }
      const data = userDoc.data();
      if (data.rol !== 'admin') {
        await firebaseSignOut(auth);
        throw new Error('Acceso solo para administradores.');
      }
      return { user: credential.user, role: data.rol };
    } catch (err) {
      const message = err.message || 'Error al iniciar sesión.';
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
    <AuthContext.Provider value={{ user, role, empresaId, nombre, loading, error, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return context;
}
