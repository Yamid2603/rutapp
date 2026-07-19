import { useEffect, useState } from 'react';

/**
 * Muestra un toast cuando el service worker descarga una nueva versión.
 * El usuario toca "Actualizar" y se aplica + recarga sola.
 *
 * Flujo:
 *  - Al cargar, registra el SW (vía SW ya registrado en index.html) y escucha 'updatefound'.
 *  - Cuando hay un SW 'waiting', mostramos el toast.
 *  - Al tocar "Actualizar": postMessage(SKIP_WAITING) al SW waiting + listener controllerchange recarga.
 */
export default function UpdatePrompt() {
  const [waitingWorker, setWaitingWorker] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;

    let reg;
    let mounted = true;

    function trackWaiting(r) {
      if (!r) return;
      if (r.waiting && navigator.serviceWorker.controller) {
        if (mounted) {
          setWaitingWorker(r.waiting);
          setVisible(true);
        }
      }
      r.addEventListener('updatefound', () => {
        const newWorker = r.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            if (mounted) {
              setWaitingWorker(newWorker);
              setVisible(true);
            }
          }
        });
      });
    }

    navigator.serviceWorker.getRegistration().then((r) => {
      reg = r;
      if (reg) {
        trackWaiting(reg);
        // Chequea updates al cargar y cada 60s mientras la pestaña esté abierta
        reg.update().catch(() => {});
        const interval = setInterval(() => reg.update().catch(() => {}), 60000);
        return () => clearInterval(interval);
      }
    });

    // Si el controlador cambia (skipWaiting + claim), recargamos
    let reloaded = false;
    const onControllerChange = () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);

    return () => {
      mounted = false;
      navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
    };
  }, []);

  function aplicarUpdate() {
    if (waitingWorker) {
      waitingWorker.postMessage({ type: 'SKIP_WAITING' });
    } else {
      window.location.reload();
    }
  }

  if (!visible) return null;

  return (
    <div style={styles.wrap}>
      <div style={styles.toast}>
        <div style={styles.text}>
          <strong style={styles.title}>Nueva versión disponible</strong>
          <div style={styles.sub}>Hay mejoras listas para usar.</div>
        </div>
        <button style={styles.btn} onClick={aplicarUpdate}>Actualizar</button>
      </div>
    </div>
  );
}

const styles = {
  wrap: {
    position: 'fixed',
    left: 0, right: 0, bottom: 0,
    padding: 'env(safe-area-inset-bottom, 16px) 16px 16px',
    display: 'flex',
    justifyContent: 'center',
    pointerEvents: 'none',
    zIndex: 9999,
  },
  toast: {
    pointerEvents: 'auto',
    background: '#0D2433',
    color: '#fff',
    borderRadius: 14,
    padding: '12px 14px 12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    boxShadow: '0 12px 32px rgba(0,0,0,0.30)',
    border: '1px solid rgba(22,147,165,0.35)',
    maxWidth: 480,
    width: '100%',
  },
  text: { flex: 1, minWidth: 0 },
  title: { fontSize: 14, fontWeight: 700, letterSpacing: 0.2 },
  sub: { fontSize: 12, opacity: 0.7, marginTop: 2 },
  btn: {
    background: '#1693A5',
    color: '#fff',
    border: 0,
    borderRadius: 10,
    padding: '9px 16px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    fontFamily: 'inherit',
    letterSpacing: 0.3,
    flexShrink: 0,
  },
};
