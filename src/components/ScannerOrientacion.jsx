import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { supabase } from '../supabaseClient';
import { Lock, Camera, X, Eye, EyeOff, Search, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

// Contraseña quemada para acomodadores externos
const PASSWORD_ACCESO = 'Capacit4**';

export default function ScannerOrientacion({ onCerrar }) {
  const [autenticado, setAutenticado] = useState(false);
  const [password, setPassword] = useState('');
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [errorPassword, setErrorPassword] = useState(false);

  // Estados del escáner
  const [cargando, setCargando] = useState(false);
  const [escaneando, setEscaneando] = useState(true);
  const [mostrarPopup, setMostrarPopup] = useState(false);
  const [estadoPopup, setEstadoPopup] = useState('success'); // 'success', 'error', 'warning'
  const [mensajePopup, setMensajePopup] = useState({ titulo: '', detalle: '' });
  const [datosParticipante, setDatosParticipante] = useState(null);
  const [busquedaManual, setBusquedaManual] = useState('');
  
  const scannerRef = useRef(null);

  // Referencias para los sonidos (Opcional, puedes quitarlo si no tienes los mp3)
  const sonidoExito = useRef(typeof Audio !== "undefined" ? new Audio('/success.mp3') : null);
  const sonidoError = useRef(typeof Audio !== "undefined" ? new Audio('/error.mp3') : null);

  const reproducirSonido = (tipo) => {
    try {
      if (tipo === 'success' && sonidoExito.current) {
        sonidoExito.current.currentTime = 0;
        sonidoExito.current.play().catch(e => console.log("Autoplay bloqueado", e));
      } else if (tipo === 'error' && sonidoError.current) {
        sonidoError.current.currentTime = 0;
        sonidoError.current.play().catch(e => console.log("Autoplay bloqueado", e));
      }
    } catch (err) {
      console.log("Error de audio:", err);
    }
  };

  const verificarPassword = (e) => {
    e.preventDefault();
    if (password === PASSWORD_ACCESO) {
      setAutenticado(true);
    } else {
      setErrorPassword(true);
      setPassword('');
      setTimeout(() => setErrorPassword(false), 3000);
    }
  };

  // Inicializar escáner cuando el usuario se autentica
  useEffect(() => {
    if (!autenticado) return;

    // Pequeño delay para asegurar que el div del render exista
    setTimeout(() => {
      if (!scannerRef.current) {
        scannerRef.current = new Html5QrcodeScanner(
          "reader",
          { fps: 10, qrbox: { width: 250, height: 250 } },
          false
        );
        scannerRef.current.render(onScanSuccess, onScanFailure);
      }
    }, 100);

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => console.error("Error limpiando scanner", error));
        scannerRef.current = null;
      }
    };
  }, [autenticado]);

  const mostrarResultado = (participante, tipo, titulo, detalle) => {
    setDatosParticipante(participante);
    setEstadoPopup(tipo);
    setMensajePopup({ titulo, detalle });
    setMostrarPopup(true);
    setEscaneando(false);
    reproducirSonido(tipo);
  };

  const procesarAsistencia = async (codigoOTexto, esManual = false) => {
    if (cargando) return;
    setCargando(true);
    
    // Si viene del escáner, lo pausamos temporalmente
    if (!esManual && scannerRef.current && scannerRef.current.getState() === 2) {
      scannerRef.current.pause(true);
    }

    try {
      // 1. Buscar al participante por código único (o nombre/documento si es manual)
      let query = supabase.from('participantes').select('*');
      
      if (esManual) {
        // Búsqueda manual por nombre o código
        query = query.or(`codigounico.ilike.%${codigoOTexto}%,nombresapellidos.ilike.%${codigoOTexto}%`);
      } else {
        // Búsqueda exacta del escáner
        query = query.eq('codigounico', codigoOTexto);
      }

      const { data, error } = await query;

      if (error) throw error;

      if (!data || data.length === 0) {
        mostrarResultado(null, 'error', 'Código Inválido', 'Este código no pertenece a ningún participante registrado.');
        setCargando(false);
        return;
      }

      // Si es búsqueda manual y arroja varios resultados, aquí deberías manejar una lista
      // Por simplicidad, tomaremos el primero que coincida
      const participante = data[0];

      // 2. Verificamos si ya asistió
      if (participante.asistio_orientacion) {
        mostrarResultado(participante, 'warning', 'Ya registrado', `${participante.nombresapellidos} ya tenía registrada su asistencia a la orientación.`);
        setCargando(false);
        return;
      }

      // 3. Actualizamos los datos requeridos en la base de datos
      const { error: updateError } = await supabase
        .from('participantes')
        .update({ 
          asistio_orientacion: true,
          categoria: 'nuevo',
          es_prioridad: true,
          estado: 'pendiente' // Aseguramos que quede pendiente para capacitación
        })
        .eq('id', participante.id);

      if (updateError) throw updateError;

      // Actualizamos visualmente el objeto para el popup
      participante.asistio_orientacion = true;

      mostrarResultado(participante, 'success', 'Asistencia Confirmada', `${participante.nombresapellidos} está listo para ser programado en punto.`);

    } catch (err) {
      console.error("Error al procesar:", err);
      mostrarResultado(null, 'error', 'Error de conexión', 'Hubo un problema comunicándose con el servidor.');
    } finally {
      setCargando(false);
      setBusquedaManual('');
    }
  };

  async function onScanSuccess(decodedText) {
    // El texto decodificado será directamente el codigounico (Ej: A4B9X2)
    const codigoUnico = decodedText.toString().trim();
    await procesarAsistencia(codigoUnico, false);
  }

  function onScanFailure(error) {
    // Ignoramos errores de lectura continua (fondo, luz, etc)
  }

  const cerrarPopupYContinuar = () => {
    setMostrarPopup(false);
    setDatosParticipante(null);
    setEscaneando(true);
    
    if (scannerRef.current && scannerRef.current.getState() === 3) {
      scannerRef.current.resume();
    }
  };

  // --- VISTA DE LOGIN ---
  if (!autenticado) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex flex-col items-center justify-center p-4 backdrop-blur-sm">
        <div className="absolute top-4 right-4">
          <button onClick={onCerrar} className="text-white/70 hover:text-white p-2">
            <X size={32} />
          </button>
        </div>
        
        <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
          <div className="w-20 h-20 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock size={40} />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Escáner de Orientación</h2>
          <p className="text-gray-500 mb-8 text-sm">
            Ingresa la contraseña de acomodador para habilitar la cámara.
          </p>
          
          <form onSubmit={verificarPassword} className="space-y-4">
            
            {/* AQUÍ ESTÁ EL NUEVO DIV DEL INPUT CON EL OJITO */}
            <div className="relative w-full">
              <input 
                type={mostrarPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Contraseña de acceso"
                className={`w-full p-4 border-2 rounded-xl text-center text-lg outline-none transition-colors pr-12 ${
                  errorPassword ? 'border-red-500 bg-red-50' : 'border-gray-200 focus:border-blue-500'
                }`}
              />
              <button
                type="button"
                onClick={() => setMostrarPassword(!mostrarPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {mostrarPassword ? <EyeOff size={24} /> : <Eye size={24} />}
              </button>
            </div>
            {/* FIN DEL NUEVO DIV */}

            {errorPassword && <p className="text-red-500 text-sm font-bold animate-pulse">Contraseña incorrecta</p>}
            
            <button 
              type="submit" 
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg flex justify-center items-center"
            >
              <Camera size={20} className="mr-2" /> Activar Cámara
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- VISTA DEL ESCÁNER ---
  return (
    <div className={`fixed inset-0 z-50 bg-gray-100 flex flex-col font-sans ${mostrarPopup ? 'mostrar-popup' : ''}`}>
      {/* Header superior */}
      <div className="bg-blue-900 text-white p-4 shadow-md flex items-center justify-between z-10 relative">
        <div>
          <h1 className="text-xl font-bold">DC APP - Escáner</h1>
          <p className="text-xs text-blue-200">Reunión de Orientación</p>
        </div>
        <button onClick={onCerrar} className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-sm transition-colors text-sm">
          Cerrar
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center">
        <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-y-auto max-h-[90vh] relative pb-6 my-4">
          <div className="bg-slate-100 p-3 text-center border-b border-gray-200">
            <p className="text-sm font-bold text-gray-700">Apunta la cámara al código QR de la invitación</p>
          </div>
          
          {/* Contenedor de la cámara */}
          <div id="reader" className="w-full min-h-[300px] border-b-4 border-blue-500"></div>
          
          {/* Ingreso manual */}
          <div className="p-4 bg-gray-50">
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">
              ¿No lee el QR? Ingreso Manual
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                placeholder="Escribe el código único (Ej: A4B9X2)" 
                value={busquedaManual}
                onChange={(e) => setBusquedaManual(e.target.value.toUpperCase())}
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-blue-500 outline-none text-sm font-mono uppercase"
              />
              <button 
                onClick={() => procesarAsistencia(busquedaManual, true)}
                disabled={busquedaManual.length < 3 || cargando}
                className="bg-gray-800 text-white px-4 rounded-xl disabled:opacity-50 flex items-center"
              >
                <Search size={20} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* POPUP DE RESULTADO */}
      {mostrarPopup && (
        <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4 backdrop-blur-sm animate-fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center flex flex-col items-center">
            
            <div className="mb-4">
              {estadoPopup === 'success' && <CheckCircle2 size={80} className="text-green-500 mx-auto" />}
              {estadoPopup === 'warning' && <AlertCircle size={80} className="text-yellow-500 mx-auto" />}
              {estadoPopup === 'error' && <AlertCircle size={80} className="text-red-500 mx-auto" />}
            </div>

            <h2 className={`text-2xl font-black mb-2 ${
              estadoPopup === 'success' ? 'text-green-600' : 
              estadoPopup === 'warning' ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {mensajePopup.titulo}
            </h2>

            <p className="text-gray-600 mb-6">{mensajePopup.detalle}</p>

            {datosParticipante && (
              <div className="bg-gray-50 w-full p-4 rounded-xl border border-gray-200 mb-6 text-left">
                <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-1">Participante</p>
                <p className="font-bold text-gray-900 text-lg leading-tight">{datosParticipante.nombresapellidos}</p>
                <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                  <span className="font-mono bg-blue-100 text-blue-800 px-2 py-0.5 rounded">{datosParticipante.codigounico}</span>
                  <span>•</span>
                  <span>{datosParticipante.congregacion}</span>
                </div>
              </div>
            )}

            <button 
              onClick={cerrarPopupYContinuar}
              className={`w-full py-4 rounded-xl text-white font-bold text-lg shadow-md transition-transform hover:scale-105 ${
                estadoPopup === 'success' ? 'bg-green-600 hover:bg-green-700' : 
                estadoPopup === 'warning' ? 'bg-yellow-500 hover:bg-yellow-600' : 'bg-red-600 hover:bg-red-700'
              }`}
            >
              Continuar Escaneando
            </button>
          </div>
        </div>
      )}
    </div>
  );
}