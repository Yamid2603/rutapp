import { useState, useRef, useEffect } from 'react';
import styles from './CreatableSelect.module.css';

/**
 * Select con búsqueda que permite crear una opción nueva sin salir del
 * formulario. Dos modos de creación:
 *  - onCrearSimple(texto) => Promise<{id, nombre}>: crea de un solo click
 *    (uso: categorías, donde el único dato es el nombre).
 *  - renderCreacionPersonalizada({texto, onCreado, onCancelar}): renderiza
 *    un mini-formulario inline antes de crear (uso: beneficiarios, donde
 *    "tipo" es obligatorio y no se puede inferir del texto tecleado).
 * Solo debe pasarse una de las dos props de creación.
 */
export default function CreatableSelect({
  label, value, onChange, options, placeholder = 'Buscar o escribir...',
  onCrearSimple, renderCreacionPersonalizada,
}) {
  const [abierto, setAbierto] = useState(false);
  const [texto, setTexto] = useState('');
  const [creandoTexto, setCreandoTexto] = useState(null); // texto pendiente de crear (modo personalizado)
  const [guardando, setGuardando] = useState(false);
  const wrapRef = useRef(null);

  const seleccionado = options.find(o => o.id === value);

  useEffect(() => {
    function onClickFuera(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setAbierto(false);
        setTexto('');
        setCreandoTexto(null);
      }
    }
    document.addEventListener('mousedown', onClickFuera);
    return () => document.removeEventListener('mousedown', onClickFuera);
  }, []);

  const filtradas = texto.trim()
    ? options.filter(o => o.nombre.toLowerCase().includes(texto.trim().toLowerCase()))
    : options;

  const hayCoincidenciaExacta = options.some(
    o => o.nombre.trim().toLowerCase() === texto.trim().toLowerCase()
  );
  const puedeCrear = texto.trim().length > 0 && !hayCoincidenciaExacta;

  function seleccionar(opcion) {
    onChange(opcion.id);
    setAbierto(false);
    setTexto('');
  }

  async function handleCrearSimple() {
    setGuardando(true);
    try {
      const nueva = await onCrearSimple(texto.trim());
      seleccionar(nueva);
    } catch (err) {
      alert('Error al crear: ' + err.message);
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      {label && <label className={styles.label}>{label}</label>}

      <div className={styles.control} onClick={() => setAbierto(true)}>
        <input
          className={styles.input}
          value={abierto ? texto : (seleccionado?.nombre || '')}
          placeholder={seleccionado ? seleccionado.nombre : placeholder}
          onFocus={() => setAbierto(true)}
          onChange={e => { setTexto(e.target.value); setCreandoTexto(null); }}
        />
      </div>

      {abierto && (
        <div className={styles.dropdown}>
          {creandoTexto !== null && renderCreacionPersonalizada ? (
            renderCreacionPersonalizada({
              texto: creandoTexto,
              onCreado: (nueva) => { seleccionar(nueva); setCreandoTexto(null); },
              onCancelar: () => setCreandoTexto(null),
            })
          ) : (
            <>
              {filtradas.map(o => (
                <div key={o.id} className={styles.opcion} onClick={() => seleccionar(o)}>
                  {o.nombre}
                </div>
              ))}
              {!filtradas.length && !puedeCrear && (
                <div className={styles.vacio}>Sin resultados</div>
              )}
              {puedeCrear && (
                <div
                  className={styles.crear}
                  onClick={() => {
                    if (guardando) return;
                    if (onCrearSimple) handleCrearSimple();
                    else setCreandoTexto(texto.trim());
                  }}
                >
                  {guardando ? 'Creando...' : `+ Crear "${texto.trim()}"`}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
