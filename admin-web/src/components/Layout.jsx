import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import Sidebar from './Sidebar';
import styles from './Layout.module.css';

export default function Layout({ children }) {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  // Cerrar sidebar al cambiar de ruta (móvil)
  useEffect(() => { setOpen(false); }, [location.pathname]);

  // Bloquear scroll del body cuando el sidebar móvil está abierto
  useEffect(() => {
    if (open) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className={styles.layout}>
      <Sidebar isOpen={open} onClose={() => setOpen(false)} />

      {/* Backdrop móvil */}
      {open && <div className={styles.backdrop} onClick={() => setOpen(false)} />}

      {/* Header móvil con hamburguesa */}
      <header className={styles.mobileHeader}>
        <button
          className={styles.menuBtn}
          onClick={() => setOpen(v => !v)}
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
        >
          {open ? <X size={22} /> : <Menu size={22} />}
        </button>
        <div className={styles.mobileBrand}>
          <img src="/logo-light.png" alt="" className={styles.mobileLogo} />
          <span>RUTAAPP</span>
        </div>
      </header>

      <main className={styles.main}>{children}</main>
    </div>
  );
}
