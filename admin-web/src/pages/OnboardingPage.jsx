import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
} from 'firebase/auth';
import { doc, getDoc, setDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { httpsCallable } from 'firebase/functions';
import { auth, db, storage, functions } from '../config/firebase';
import { useAuth } from '../context/AuthContext';
import { validarTelefono } from '../utils/format';
import UbicacionPicker from '../components/UbicacionPicker';
import styles from './OnboardingPage.module.css';

const TOTAL = 5;
const MAX_PRODUCTOS = 3;

export default function OnboardingPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [paso, setPaso] = useState(1);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  const [empresaId] = useState(() => crypto.randomUUID().replace(/-/g, '').slice(0, 16));
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showConductorPass, setShowConductorPass] = useState(false);

  // Paso 2
  const [empresa, setEmpresa] = useState({ nombre: '', nit: '', ciudad: '', direccion: '', lat: null, lng: null });
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(null);

  // Paso 3
  const [admin, setAdmin] = useState({ nombre: '', email: '', password: '', whatsapp: '' });
  const [codigoPais, setCodigoPais] = useState('+57');
  const [adminUsedGoogle, setAdminUsedGoogle] = useState(false);

  // Paso 4 — múltiples productos
  const [productos, setProductos] = useState([{ emoji: '', nombre: '' }]);
  const [conductor, setConductor] = useState({ nombre: '', email: '', passwordTemp: '', telefono: '' });

  useEffect(() => {
    if (!authLoading && user && role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  function handleLogoChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLogoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setLogoPreview(reader.result);
    reader.readAsDataURL(file);
  }

  function avanzar() {
    setError('');
    setPaso(p => p + 1);
  }

  function validarPaso2() {
    if (!empresa.nombre.trim()) return 'El nombre de la empresa es requerido';
    if (!empresa.ciudad.trim()) return 'La ciudad es requerida';
    if (empresa.nit.trim() && !/^\d{7,10}[-\d]?$/.test(empresa.nit.replace(/\./g, '').trim())) {
      return 'NIT inválido (solo dígitos, 8-10 caracteres)';
    }
    return null;
  }

  function validarPaso3() {
    if (!admin.nombre.trim()) return 'Tu nombre es requerido';
    if (!admin.email.includes('@')) return 'Email inválido';
    if (admin.password.length < 6) return 'La contraseña debe tener al menos 6 caracteres';
    if (!admin.whatsapp.trim()) return 'El número de WhatsApp es requerido';
    if (!/^\d{6,15}$/.test(admin.whatsapp.replace(/\s/g, ''))) return 'Número de WhatsApp inválido';
    return null;
  }

  function validarPaso4() {
    const primerProducto = productos[0];
    if (!primerProducto.emoji.trim()) return 'El emoji del primer producto es requerido';
    if (!primerProducto.nombre.trim()) return 'El nombre del primer producto es requerido';
    for (let i = 1; i < productos.length; i++) {
      if (productos[i].emoji.trim() && !productos[i].nombre.trim()) return `Nombre del producto ${i + 1} requerido`;
      if (!productos[i].emoji.trim() && productos[i].nombre.trim()) return `Emoji del producto ${i + 1} requerido`;
    }
    if (!conductor.nombre.trim()) return 'El nombre del conductor es requerido';
    if (!conductor.email.includes('@')) return 'Email del conductor inválido';
    if (conductor.passwordTemp.length < 6) return 'La contraseña temporal debe tener al menos 6 caracteres';
    if (conductor.telefono) {
      const telErr = validarTelefono(conductor.telefono);
      if (telErr) return telErr;
    }
    return null;
  }

  function agregarProducto() {
    if (productos.length < MAX_PRODUCTOS) {
      setProductos(p => [...p, { emoji: '', nombre: '' }]);
    }
  }

  function eliminarProducto(idx) {
    setProductos(p => p.filter((_, i) => i !== idx));
  }

  function actualizarProducto(idx, campo, valor) {
    setProductos(p => p.map((prod, i) => i === idx ? { ...prod, [campo]: valor } : prod));
  }

  async function guardarEmpresaYAdmin(adminUid, adminEmail, adminNombre) {
    let logoUrl = null;
    if (logoFile) {
      const logoRef = ref(storage, `logos/${empresaId}`);
      await uploadBytes(logoRef, logoFile);
      logoUrl = await getDownloadURL(logoRef);
    }
    await setDoc(doc(db, 'empresas', empresaId), {
      nombre: empresa.nombre.trim(),
      nit: empresa.nit.trim(),
      ciudad: empresa.ciudad.trim(),
      direccion: empresa.direccion || null,
      lat: empresa.lat || null,
      lng: empresa.lng || null,
      logoUrl,
      wapAdmin: `${codigoPais}${admin.whatsapp.trim()}`,
      adminUid,
      creadoEn: serverTimestamp(),
    });
    await setDoc(doc(db, 'usuarios', adminUid), {
      nombre: adminNombre.trim(),
      email: adminEmail.trim(),
      rol: 'admin',
      empresaId,
      wap: `${codigoPais}${admin.whatsapp.trim()}`,
      creadoEn: serverTimestamp(),
    });
  }

  async function handleSubmitPaso3() {
    const err = validarPaso3();
    if (err) { setError(err); return; }
    setCargando(true);
    setError('');
    try {
      const cred = await createUserWithEmailAndPassword(auth, admin.email.trim(), admin.password);
      await guardarEmpresaYAdmin(cred.user.uid, admin.email.trim(), admin.nombre);
      setAdminUsedGoogle(false);
      setPaso(4);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use') {
        setError('Este email ya está registrado. Usa otro o inicia sesión.');
      } else if (e.code === 'permission-denied' || e.message?.includes('permission')) {
        setError('Error de permisos en la base de datos. Contacta soporte.');
      } else {
        setError(e.message || 'Error desconocido al crear la cuenta.');
      }
    } finally {
      setCargando(false);
    }
  }

  async function handleGooglePaso3() {
    if (!admin.whatsapp.trim()) { setError('Ingresa tu WhatsApp antes de continuar con Google.'); return; }
    if (!admin.nombre.trim()) { setError('Ingresa tu nombre antes de continuar con Google.'); return; }
    setCargando(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      const existingDoc = await getDoc(doc(db, 'usuarios', cred.user.uid));
      if (existingDoc.exists()) {
        await signOut(auth);
        setError('Esta cuenta Google ya está registrada en RutaApp. Ve a iniciar sesión.');
        setCargando(false);
        return;
      }
      const nombreFinal = admin.nombre || cred.user.displayName || '';
      setAdmin(a => ({ ...a, email: cred.user.email, nombre: nombreFinal }));
      await guardarEmpresaYAdmin(cred.user.uid, cred.user.email, nombreFinal);
      setAdminUsedGoogle(true);
      setPaso(4);
    } catch (e) {
      if (e.code === 'auth/popup-closed-by-user') {
        setError('');
      } else {
        setError(e.message || 'Error con Google Sign-In.');
      }
    } finally {
      setCargando(false);
    }
  }

  async function handleSubmitPaso4() {
    const err = validarPaso4();
    if (err) { setError(err); return; }
    setCargando(true);
    setError('');
    try {
      if (adminUsedGoogle) {
        const fn = httpsCallable(functions, 'crearConductor');
        await fn({
          email: conductor.email.trim(),
          password: conductor.passwordTemp,
          nombre: conductor.nombre.trim(),
          empresaId,
          camionId: null,
          telefono: conductor.telefono?.trim() || undefined,
        });
        try { await sendPasswordResetEmail(auth, conductor.email.trim()); } catch {}
      } else {
        const condCred = await createUserWithEmailAndPassword(auth, conductor.email.trim(), conductor.passwordTemp);
        const condUid = condCred.user.uid;
        await setDoc(doc(db, 'usuarios', condUid), {
          nombre: conductor.nombre.trim(),
          email: conductor.email.trim(),
          rol: 'conductor',
          empresaId,
          telefono: conductor.telefono?.trim() || null,
          pendiente: false,
          creadoEn: serverTimestamp(),
        });
        await sendPasswordResetEmail(auth, conductor.email.trim());
        await signOut(auth);
        await signInWithEmailAndPassword(auth, admin.email.trim(), admin.password);
      }

      // Crear todos los productos (filtrando los vacíos)
      const productosValidos = productos.filter(p => p.emoji.trim() && p.nombre.trim());
      await Promise.all(productosValidos.map(p =>
        addDoc(collection(db, 'productos'), {
          emoji: p.emoji.trim(),
          nombre: p.nombre.trim(),
          empresaId,
          creadoEn: serverTimestamp(),
        })
      ));

      setPaso(5);
    } catch (e) {
      if (e.code === 'auth/email-already-in-use' || e?.details?.message?.includes('ya está registrado')) {
        setError('El email del conductor ya está registrado.');
      } else {
        setError(e?.details?.message || e.message || 'Error al crear el conductor');
      }
    } finally {
      setCargando(false);
    }
  }

  if (authLoading) return null;

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        {/* Logo */}
        <div className={styles.logo}>
          <img src="/logo-light.png" alt="RutaApp" className={styles.logoImg} />
        </div>

        {/* Barra de progreso */}
        {paso > 1 && paso < 5 && (
          <div className={styles.progreso}>
            {Array.from({ length: TOTAL }, (_, i) => (
              <div key={i} className={styles.progresoItem}>
                <div className={`${styles.progresoBurbuja} ${i + 1 < paso ? styles.completado : ''} ${i + 1 === paso ? styles.activo : ''}`}>
                  {i + 1 < paso ? '✓' : i + 1}
                </div>
                {i < TOTAL - 1 && (
                  <div className={`${styles.progresoLinea} ${i + 1 < paso ? styles.lineaCompletada : ''}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── PASO 1: Bienvenida ── */}
        {paso === 1 && (
          <div className={styles.paso}>
            <h1 className={styles.titulo}>Bienvenido a RutaApp</h1>
            <p className={styles.subtitulo}>
              La plataforma que transforma cómo distribuyes, cobras y analizas tu negocio.
              Configura tu empresa en menos de 3 minutos.
            </p>
            <div className={styles.bienvenidaGrid}>
              <div className={styles.feature}>
                <div className={styles.featureIcon}>🗺️</div>
                <div className={styles.featureTexto}>
                  <div className={styles.featureTitulo}>Rutas en tiempo real</div>
                  <div className={styles.featureDesc}>Conductor y admin conectados</div>
                </div>
              </div>
              <div className={styles.feature}>
                <div className={styles.featureIcon}>💰</div>
                <div className={styles.featureTexto}>
                  <div className={styles.featureTitulo}>Control de cobranza</div>
                  <div className={styles.featureDesc}>Deudas y pagos al instante</div>
                </div>
              </div>
              <div className={styles.feature}>
                <div className={styles.featureIcon}>🤖</div>
                <div className={styles.featureTexto}>
                  <div className={styles.featureTitulo}>Análisis con IA</div>
                  <div className={styles.featureDesc}>Resúmenes automáticos por email</div>
                </div>
              </div>
              <div className={styles.feature}>
                <div className={styles.featureIcon}>👥</div>
                <div className={styles.featureTexto}>
                  <div className={styles.featureTitulo}>Gestión de clientes</div>
                  <div className={styles.featureDesc}>Historial, fotos y notas</div>
                </div>
              </div>
            </div>
            <button className={styles.btnPrimario} onClick={() => setPaso(2)}>
              Registrar mi empresa →
            </button>
            <Link to="/login" className={styles.linkSecundario}>
              Ya tengo cuenta → Iniciar sesión
            </Link>
          </div>
        )}

        {/* ── PASO 2: Datos empresa ── */}
        {paso === 2 && (
          <div className={styles.paso}>
            <h2 className={styles.titulo}>Datos de tu empresa</h2>
            <p className={styles.subtitulo}>Paso 2 de 5 — Información básica</p>

            <div className={styles.campos}>
              <div className={styles.campo}>
                <label className={styles.label}>NOMBRE DE LA EMPRESA *</label>
                <input className={styles.input} placeholder="Distribuidora El Rápido" value={empresa.nombre}
                  onChange={e => setEmpresa({ ...empresa, nombre: e.target.value })} />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>NIT (OPCIONAL)</label>
                <input className={styles.input} placeholder="900.123.456-7" value={empresa.nit}
                  onChange={e => setEmpresa({ ...empresa, nit: e.target.value })} />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>CIUDAD *</label>
                <input className={styles.input} placeholder="Bogotá" value={empresa.ciudad}
                  onChange={e => setEmpresa({ ...empresa, ciudad: e.target.value })} />
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#8B949E', marginBottom: 8 }}>
                  Ubicación de la empresa (opcional)
                </div>
                <UbicacionPicker
                  lat={empresa.lat}
                  lng={empresa.lng}
                  onSelect={({ lat, lng, direccion }) => setEmpresa(e => ({ ...e, lat, lng, direccion }))}
                />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>LOGO (OPCIONAL)</label>
                <label className={styles.logoUpload}>
                  {logoPreview
                    ? <img src={logoPreview} alt="logo" className={styles.logoPreviewImg} />
                    : <span className={styles.logoPlaceholder}>📁 Subir logo</span>
                  }
                  <input type="file" accept="image/*" onChange={handleLogoChange} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btnPrimario} onClick={() => {
              const err = validarPaso2();
              if (err) { setError(err); return; }
              avanzar();
            }}>
              Continuar →
            </button>
          </div>
        )}

        {/* ── PASO 3: Cuenta admin ── */}
        {paso === 3 && (
          <div className={styles.paso}>
            <h2 className={styles.titulo}>Tu cuenta de administrador</h2>
            <p className={styles.subtitulo}>Paso 3 de 5 — Con esto accedes al panel</p>

            <div className={styles.campos}>
              <div className={styles.campo}>
                <label className={styles.label}>TU NOMBRE *</label>
                <input className={styles.input} placeholder="Carlos Rodríguez" value={admin.nombre}
                  onChange={e => setAdmin({ ...admin, nombre: e.target.value })} />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>EMAIL *</label>
                <input className={styles.input} type="email" placeholder="admin@empresa.com" value={admin.email}
                  onChange={e => setAdmin({ ...admin, email: e.target.value })} />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>CONTRASEÑA * (mín. 6 caracteres)</label>
                <div className={styles.passRow}>
                  <input className={styles.passInput} type={showAdminPass ? 'text' : 'password'} placeholder="••••••••" value={admin.password}
                    onChange={e => setAdmin({ ...admin, password: e.target.value })} />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowAdminPass(v => !v)}>
                    {showAdminPass ? '🙈' : '👁️'}
                  </button>
                </div>
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>WHATSAPP PARA REPORTES *</label>
                <div className={styles.wapRow}>
                  <select className={styles.wapSelect} value={codigoPais} onChange={e => setCodigoPais(e.target.value)}>
                    <option value="+57">🇨🇴 +57 Colombia</option>
                    <option value="+52">🇲🇽 +52 México</option>
                    <option value="+54">🇦🇷 +54 Argentina</option>
                    <option value="+55">🇧🇷 +55 Brasil</option>
                    <option value="+56">🇨🇱 +56 Chile</option>
                    <option value="+51">🇵🇪 +51 Perú</option>
                    <option value="+593">🇪🇨 +593 Ecuador</option>
                    <option value="+58">🇻🇪 +58 Venezuela</option>
                    <option value="+591">🇧🇴 +591 Bolivia</option>
                    <option value="+595">🇵🇾 +595 Paraguay</option>
                    <option value="+598">🇺🇾 +598 Uruguay</option>
                    <option value="+507">🇵🇦 +507 Panamá</option>
                    <option value="+506">🇨🇷 +506 Costa Rica</option>
                    <option value="+504">🇭🇳 +504 Honduras</option>
                    <option value="+502">🇬🇹 +502 Guatemala</option>
                    <option value="+503">🇸🇻 +503 El Salvador</option>
                    <option value="+505">🇳🇮 +505 Nicaragua</option>
                    <option value="+53">🇨🇺 +53 Cuba</option>
                    <option value="+1809">🇩🇴 +1809 Rep. Dominicana</option>
                    <option value="+34">🇪🇸 +34 España</option>
                    <option value="+1">🇺🇸 +1 EE.UU.</option>
                  </select>
                  <input className={styles.wapInput} placeholder="300 123 4567" value={admin.whatsapp}
                    onChange={e => setAdmin({ ...admin, whatsapp: e.target.value.replace(/\D/g, '') })}
                    type="tel" maxLength={15} />
                </div>
                <span className={styles.wapPreview}>
                  {admin.whatsapp ? `Número: ${codigoPais}${admin.whatsapp}` : 'Solo dígitos, sin espacios'}
                </span>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btnPrimario} onClick={handleSubmitPaso3} disabled={cargando}>
              {cargando ? 'Creando cuenta...' : 'Crear cuenta →'}
            </button>
            <div className={styles.divider}><span>o</span></div>
            <button className={styles.googleBtn} onClick={handleGooglePaso3} disabled={cargando}>
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" width={18} />
              Registrar con Google
            </button>
            <button className={styles.btnVolver} onClick={() => { setError(''); setPaso(2); }}>
              ← Volver
            </button>
          </div>
        )}

        {/* ── PASO 4: Productos + Conductor ── */}
        {paso === 4 && (
          <div className={styles.paso}>
            <h2 className={styles.titulo}>Productos y conductor</h2>
            <p className={styles.subtitulo}>Paso 4 de 5 — Puedes agregar más después</p>

            <div className={styles.seccionLabel}>📦 Productos ({productos.length}/{MAX_PRODUCTOS})</div>

            {productos.map((prod, idx) => (
              <div key={idx} className={styles.productoRow}>
                <div className={styles.camposRow} style={{ flex: 1 }}>
                  <div className={styles.campo} style={{ flex: '0 0 72px' }}>
                    <label className={styles.label}>EMOJI *</label>
                    <input className={styles.input} placeholder="🧴" value={prod.emoji}
                      onChange={e => actualizarProducto(idx, 'emoji', e.target.value)} maxLength={2} />
                  </div>
                  <div className={styles.campo} style={{ flex: 1 }}>
                    <label className={styles.label}>NOMBRE *</label>
                    <input className={styles.input} placeholder="Shampoo 400ml" value={prod.nombre}
                      onChange={e => actualizarProducto(idx, 'nombre', e.target.value)} />
                  </div>
                </div>
                {idx > 0 && (
                  <button className={styles.btnEliminarProducto} onClick={() => eliminarProducto(idx)} title="Eliminar producto">
                    ✕
                  </button>
                )}
              </div>
            ))}

            {productos.length < MAX_PRODUCTOS && (
              <button className={styles.btnAgregarProducto} onClick={agregarProducto}>
                + Agregar otro producto
              </button>
            )}

            <div className={styles.seccionLabel} style={{ marginTop: 24 }}>🚗 Conductor</div>
            <div className={styles.campos}>
              <div className={styles.campo}>
                <label className={styles.label}>NOMBRE *</label>
                <input className={styles.input} placeholder="Juan Pérez" value={conductor.nombre}
                  onChange={e => setConductor({ ...conductor, nombre: e.target.value })} />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>EMAIL *</label>
                <input className={styles.input} type="email" placeholder="conductor@empresa.com" value={conductor.email}
                  onChange={e => setConductor({ ...conductor, email: e.target.value })} />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>TELÉFONO (OPCIONAL)</label>
                <input className={styles.input} type="tel" placeholder="+573001234567" value={conductor.telefono}
                  onChange={e => setConductor({ ...conductor, telefono: e.target.value })} />
              </div>
              <div className={styles.campo}>
                <label className={styles.label}>CONTRASEÑA TEMPORAL * (mín. 6 caracteres)</label>
                <div className={styles.passRow}>
                  <input className={styles.passInput} type={showConductorPass ? 'text' : 'password'} placeholder="••••••••" value={conductor.passwordTemp}
                    onChange={e => setConductor({ ...conductor, passwordTemp: e.target.value })} />
                  <button type="button" className={styles.eyeBtn} onClick={() => setShowConductorPass(v => !v)}>
                    {showConductorPass ? '🙈' : '👁️'}
                  </button>
                </div>
                <span className={styles.hint}>Le enviaremos un email para que la cambie.</span>
              </div>
            </div>

            {error && <p className={styles.error}>{error}</p>}
            <button className={styles.btnPrimario} onClick={handleSubmitPaso4} disabled={cargando}>
              {cargando ? 'Configurando...' : 'Finalizar configuración →'}
            </button>
          </div>
        )}

        {/* ── PASO 5: Confirmación ── */}
        {paso === 5 && (
          <div className={styles.paso}>
            <div className={styles.exito}>
              <div className={styles.exitoIcon}>🎉</div>
              <h2 className={styles.titulo}>¡Todo listo!</h2>
              <p className={styles.subtitulo}>
                Tu empresa está configurada. El conductor {conductor.nombre} recibirá un email para activar su cuenta.
              </p>
              <div className={styles.resumen}>
                <div className={styles.resumenItem}><span>🏢</span><span><strong>{empresa.nombre}</strong> — {empresa.ciudad}</span></div>
                {productos.filter(p => p.emoji && p.nombre).map((p, i) => (
                  <div key={i} className={styles.resumenItem}><span>📦</span><span>{p.emoji} {p.nombre}</span></div>
                ))}
                <div className={styles.resumenItem}><span>🚗</span><span>{conductor.nombre}</span></div>
              </div>
              <div className={styles.resumenSiguientes}>
                <div className={styles.siguientesTitulo}>Próximos pasos</div>
                <div className={styles.siguientesItem}>① Agrega tus clientes en la sección Clientes</div>
                <div className={styles.siguientesItem}>② Asigna una ruta en Zonas & Carga</div>
                <div className={styles.siguientesItem}>③ El conductor descarga la app y empieza</div>
              </div>
            </div>
            <button className={styles.btnPrimario} onClick={() => navigate('/admin')}>
              Ir al panel admin →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
