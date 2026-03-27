import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Calendar, MapPin, User, Search, Save, X, Loader2, CheckCircle2, AlertTriangle, Phone, Star, Filter, RefreshCcw } from 'lucide-react'

const PUNTOS_METROPOLITANA = [
  'Cali- AVIANCA',
  'Cali- BUITRERA',
  'Cali- CANCHAS PANAMERICANAS',
  'Cali- CARRERA OCTAVA',
  'Cali- CAM',
  'Cali- GOBERNACIÓN DEL VALLE',
  'Cali- IMBANACO',
  'Cali- LA 14 CALIMA',
  'Cali- PLAZA CAYZEDO',
  'Jamundí',
  'Palmira- BOLIVAR',
  'Palmira- LA FACTORÍA',
  'Yumbo'
]

export default function AsignacionParticipantes() {
  const [participantes, setParticipantes] = useState([])
  const [capacitadores, setCapacitadores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  
  // Controles de vista
  const [vistaActual, setVistaActual] = useState('pendientes') // 'pendientes' o 'asignados'
  const [busqueda, setBusqueda] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('todos')
  const [filtroCategoria, setFiltroCategoria] = useState('todos') // 'todos', 'nuevo', 'viejo_punto_fijo', 'viejo_sin_punto'
  
  const [participanteSeleccionado, setParticipanteSeleccionado] = useState(null)
  const [formAsignacion, setFormAsignacion] = useState({ fecha: '', punto: '', capacitador_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const cargarDatos = async (modoManual = false) => {
    if (modoManual) setActualizando(true)
    
    // 1. Cargar Participantes (Asegurándonos de traer punto_fijo)
    const { data: partData } = await supabase
      .from('participantes')
      .select(`
        id, nombres_apellidos, congregacion, ciudad, estado, telefono, 
        fecha_programada, punto_programado, es_prioridad,
        categoria, punto_fijo,
        capacitador_id,
        usuarios (nombre_completo)
      `)
      .in('estado', ['pendiente', 'requiere_refuerzo', 'repetir_6_meses'])
      .order('es_prioridad', { ascending: false })
      .order('creado_en', { ascending: false })

    if (partData) setParticipantes(partData)

    // 2. Cargar Capacitadores (solo una vez)
    if (capacitadores.length === 0) {
      const { data: capData } = await supabase
        .from('usuarios')
        .select('id, nombre_completo, roles!inner(nombre)')
        .order('nombre_completo')

      if (capData) setCapacitadores(capData)
    }
    
    setCargando(false)
    if (modoManual) setTimeout(() => setActualizando(false), 500)
  }

  useEffect(() => {
    // Carga inicial
    cargarDatos()

    // Suscripción a cambios en tiempo real
    const channel = supabase
      .channel('cambios-asignacion')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participantes' },
        () => {
          cargarDatos() // Refresca silenciosamente
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const abrirModalAsignacion = (participante) => {
    setParticipanteSeleccionado(participante)
    setFormAsignacion({
      fecha: participante.fecha_programada || '',
      // Si ya tiene uno programado lo usamos, si no, sugerimos su punto fijo si lo tiene
      punto: participante.punto_programado || participante.punto_fijo || '',
      capacitador_id: participante.capacitador_id || ''
    })
    setMensaje(null)
  }

  const handleGuardarAsignacion = async (e) => {
    e.preventDefault()
    setGuardando(true)

    const { error } = await supabase
      .from('participantes')
      .update({
        fecha_programada: formAsignacion.fecha || null,
        punto_programado: formAsignacion.punto || null,
        capacitador_id: formAsignacion.capacitador_id || null
      })
      .eq('id', participanteSeleccionado.id)

    if (error) {
      setMensaje({ tipo: 'error', texto: 'Error al guardar asignación.' })
    } else {
      setMensaje({ tipo: 'exito', texto: '¡Programación actualizada correctamente!' })
      // FORZAMOS LA CARGA LOCAL INMEDIATA AQUÍ
      await cargarDatos()
      setTimeout(() => setParticipanteSeleccionado(null), 1000)
    }
    setGuardando(false)
  }

  const marcarComoPrioridad = async (id, estadoActual) => {
    const nuevoEstado = !estadoActual;
    
    // 1. ACTUALIZACIÓN OPTIMISTA (Instantánea en la pantalla)
    setParticipantes(prev => prev.map(p =>
      p.id === id ? { ...p, es_prioridad: nuevoEstado } : p
    ));

    // 2. Enviar a la base de datos
    const { error } = await supabase
      .from('participantes')
      .update({ es_prioridad: nuevoEstado })
      .eq('id', id)
      
    // 3. Si falla en la base de datos, revertimos el cambio visual (Fallback)
    if (error) {
      console.error("Error al actualizar prioridad", error);
      setParticipantes(prev => prev.map(p =>
        p.id === id ? { ...p, es_prioridad: estadoActual } : p
      ));
    }
  }

  // Filtrado de la lista
  const participantesAMostrar = useMemo(() => {
    return participantes.filter(p => {
      // 1. Filtro de vista (Pendientes vs Asignados)
      if (vistaActual === 'pendientes' && p.capacitador_id) return false;
      if (vistaActual === 'asignados' && !p.capacitador_id) return false;

      // 2. Filtro de Búsqueda de texto
      const textoBusqueda = busqueda.toLowerCase()
      const coincideTexto = p.nombres_apellidos?.toLowerCase().includes(textoBusqueda) || 
                            p.congregacion?.toLowerCase().includes(textoBusqueda) ||
                            p.usuarios?.nombre_completo?.toLowerCase().includes(textoBusqueda) ||
                            p.punto_fijo?.toLowerCase().includes(textoBusqueda) ||
                            p.punto_programado?.toLowerCase().includes(textoBusqueda)
      
      // 3. Filtro de Prioridad (Estrella)
      if (filtroPrioridad === 'prioridad' && !p.es_prioridad) return false;
      if (filtroPrioridad === 'normal' && p.es_prioridad) return false;

      // 4. Filtro por Categoría
      if (filtroCategoria !== 'todos' && p.categoria !== filtroCategoria) return false;

      return coincideTexto
    })
  }, [participantes, busqueda, filtroPrioridad, filtroCategoria, vistaActual])

  // Etiqueta visual de categoría
  const renderBadgeCategoria = (categoria, puntoFijo) => {
    if (categoria === 'nuevo' || categoria === 'nuevo_orientacion') {
      return (
        <span className="flex items-center text-[10px] font-bold bg-green-100 text-green-800 px-2 py-1 rounded w-fit mt-1">
          <Star size={10} className="mr-1" /> NUEVO
        </span>
      )
    }
    if (categoria === 'viejo_punto_fijo') {
      return (
        <span className="flex items-center text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded w-fit mt-1 truncate max-w-[200px]">
          <MapPin size={10} className="mr-1 flex-shrink-0" /> ANTIGUO
        </span>
      )
    }
    if (categoria === 'viejo_sin_punto') {
      return (
        <span className="flex items-center text-[10px] font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded w-fit mt-1">
          ANTIGUO (Sin turno)
        </span>
      )
    }
    return null;
  }

  if (cargando) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600 mr-2"/> Cargando panel de asignaciones...</div>

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 flex items-center">
            Programación
            <button 
              onClick={() => cargarDatos(true)}
              disabled={actualizando}
              className="ml-4 p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Actualizar datos"
            >
              <RefreshCcw size={16} className={actualizando ? "animate-spin text-blue-600" : ""} />
            </button>
          </h1>
          <p className="text-gray-500 mt-1">Asigna, visualiza o reasigna capacitadores y fechas.</p>
        </div>
        
        {/* PESTAÑAS PRINCIPALES */}
        <div className="flex bg-gray-200 p-1 rounded-xl">
          <button 
            onClick={() => setVistaActual('pendientes')}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${vistaActual === 'pendientes' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Sin Programar ({participantes.filter(p => !p.capacitador_id).length})
          </button>
          <button 
            onClick={() => setVistaActual('asignados')}
            className={`px-5 py-2 text-sm font-bold rounded-lg transition-all ${vistaActual === 'asignados' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-600 hover:text-gray-800'}`}
          >
            Ya Asignados ({participantes.filter(p => p.capacitador_id).length})
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        
        {/* BARRA DE FILTROS SUPERIOR */}
        <div className="flex flex-col xl:flex-row gap-4 mb-6 justify-between items-start xl:items-center">
          <div className="relative flex-1 w-full xl:max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" placeholder={vistaActual === 'asignados' ? "Buscar participante o capacitador..." : "Buscar por nombre o punto..."} 
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div className="flex flex-wrap gap-3">
            {/* Filtro por Categorías */}
            <div className="flex bg-gray-50 p-1 rounded-xl items-center border border-gray-100">
              <Filter size={14} className="text-gray-400 mx-2" />
              <button 
                onClick={() => setFiltroCategoria('todos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroCategoria === 'todos' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Todos
              </button>
              <button 
                onClick={() => setFiltroCategoria('nuevo')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroCategoria === 'nuevo' ? 'bg-white shadow-sm text-green-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Nuevos
              </button>
              <button 
                onClick={() => setFiltroCategoria('viejo_punto_fijo')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroCategoria === 'viejo_punto_fijo' ? 'bg-white shadow-sm text-blue-700' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Antiguos
              </button>
            </div>

            {/* Filtro Prioridad */}
            <div className="flex bg-amber-50 p-1 rounded-xl items-center border border-amber-100">
              <button 
                onClick={() => setFiltroPrioridad('todos')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filtroPrioridad === 'todos' ? 'bg-white shadow-sm text-gray-800' : 'text-amber-600/70 hover:text-amber-700'}`}
              >
                Todas las prioridades
              </button>
              <button 
                onClick={() => setFiltroPrioridad('prioridad')}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center ${filtroPrioridad === 'prioridad' ? 'bg-white shadow-sm text-amber-700' : 'text-amber-600/70 hover:text-amber-700'}`}
              >
                <AlertTriangle size={12} className="mr-1"/> Urgentes
              </button>
            </div>
          </div>
        </div>

        {participantesAMostrar.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">No hay participantes que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participantesAMostrar.map(p => (
              <div key={p.id} className={`p-4 rounded-xl border relative flex flex-col justify-between transition-all hover:shadow-md
                ${p.es_prioridad ? 'border-amber-200 bg-amber-50/30' : (p.capacitador_id ? 'border-green-200 bg-green-50/50' : 'border-gray-200 bg-white')} shadow-sm`}
              >
                <button 
                  onClick={() => marcarComoPrioridad(p.id, p.es_prioridad)}
                  className={`absolute top-4 right-4 p-1.5 rounded-full transition-colors ${p.es_prioridad ? 'bg-amber-100 text-amber-600 hover:bg-amber-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                  title={p.es_prioridad ? "Quitar prioridad" : "Marcar como urgente/nuevo"}
                >
                  <AlertTriangle size={16} />
                </button>

                <div className="pr-8">
                  <h3 className="font-bold text-gray-800 leading-tight">{p.nombres_apellidos}</h3>
                  
                  {/* Etiqueta de Categoría */}
                  <div className="flex flex-wrap gap-2 items-center mt-1">
                    {renderBadgeCategoria(p.categoria, p.punto_fijo)}
                  </div>
                  
                  <p className="text-xs text-gray-500 mb-2 mt-2">{p.congregacion} • {p.ciudad}</p>
                  
                  {/* NUEVA ETIQUETA INFORMATIVA PARA EL COORDINADOR (PUNTO FIJO) */}
                  {p.punto_fijo && !p.capacitador_id && (
                    <p className="text-[11px] text-indigo-700 font-medium mb-3 bg-indigo-50 border border-indigo-100 inline-block px-2 py-1 rounded">
                      📍 Sirve en: {p.punto_fijo}
                    </p>
                  )}
                  
                  {p.telefono && (
                    <p className="text-xs text-gray-600 mb-3 flex items-center"><Phone size={12} className="mr-1"/> {p.telefono}</p>
                  )}

                  {p.capacitador_id ? (
                    <div className="space-y-1.5 text-sm text-gray-700 bg-white p-3 rounded-lg border border-green-100 mb-2">
                      <div className="flex items-start"><User size={14} className="mr-2 mt-0.5 text-purple-600 flex-shrink-0"/> <span className="font-medium">{p.usuarios?.nombre_completo}</span></div>
                      <div className="flex items-start"><Calendar size={14} className="mr-2 mt-0.5 text-green-600 flex-shrink-0"/> <span>{new Date(p.fecha_programada).toLocaleDateString()}</span></div>
                      <div className="flex items-start"><MapPin size={14} className="mr-2 mt-0.5 text-blue-600 flex-shrink-0"/> <span className="font-medium text-xs bg-blue-50 px-1.5 py-0.5 rounded text-blue-800 border border-blue-100">{p.punto_programado}</span></div>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100 mb-2">
                      Aún no tiene capacitador asignado.
                    </div>
                  )}
                </div>
                
                <button 
                  onClick={() => abrirModalAsignacion(p)}
                  className={`mt-2 w-full py-2 rounded-lg font-bold text-sm transition-colors ${p.capacitador_id ? 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50' : 'bg-blue-600 text-white hover:bg-blue-700'}`}
                >
                  {p.capacitador_id ? 'Reasignar / Cambiar Fecha' : 'Programar Ahora'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL DE ASIGNACIÓN */}
      {participanteSeleccionado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-gray-800">
                {participanteSeleccionado.capacitador_id ? 'Reasignar Capacitación' : 'Programar Capacitación'}
              </h3>
              <button onClick={() => setParticipanteSeleccionado(null)} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <form onSubmit={handleGuardarAsignacion} className="p-6 space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 mb-4">
                <span className="text-xs text-blue-500 uppercase font-bold tracking-wider">Participante</span>
                <p className="font-bold text-blue-900">{participanteSeleccionado.nombres_apellidos}</p>
                <div className="flex gap-2 mt-1">
                  {participanteSeleccionado.es_prioridad && <span className="inline-block bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-medium">Prioridad Urgente</span>}
                  {participanteSeleccionado.categoria === 'viejo_punto_fijo' && <span className="inline-block bg-blue-200 text-blue-800 text-xs px-2 py-0.5 rounded font-medium">Tiene Punto Fijo</span>}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Capacitador Asignado</label>
                <select 
                  required
                  value={formAsignacion.capacitador_id}
                  onChange={e => setFormAsignacion({...formAsignacion, capacitador_id: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Seleccionar Capacitador --</option>
                  {capacitadores.map(cap => (
                    <option key={cap.id} value={cap.id}>{cap.nombre_completo} ({cap.roles?.nombre})</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Programada</label>
                <input 
                  type="date" required
                  value={formAsignacion.fecha}
                  onChange={e => setFormAsignacion({...formAsignacion, fecha: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Punto Metropolitano</label>
                <select 
                  required
                  value={formAsignacion.punto}
                  onChange={e => setFormAsignacion({...formAsignacion, punto: e.target.value})}
                  className="w-full p-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">-- Seleccionar Punto --</option>
                  {PUNTOS_METROPOLITANA.map(punto => (
                    <option key={punto} value={punto}>{punto}</option>
                  ))}
                </select>
                {/* MENSAJE EXPLICATIVO SI SE SUGIRIÓ EL PUNTO FIJO */}
                {participanteSeleccionado.punto_fijo && !participanteSeleccionado.capacitador_id && formAsignacion.punto === participanteSeleccionado.punto_fijo && (
                  <p className="text-xs text-indigo-600 mt-1 font-medium">
                    * El sistema pre-seleccionó el punto donde sirve habitualmente. Puedes cambiarlo si lo deseas.
                  </p>
                )}
              </div>

              {mensaje && (
                <div className={`p-3 rounded-lg text-sm flex items-center ${mensaje.tipo === 'exito' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {mensaje.tipo === 'exito' && <CheckCircle2 size={16} className="mr-2"/>}
                  {mensaje.texto}
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-2">
                {participanteSeleccionado.capacitador_id && (
                  <button 
                    type="button" 
                    onClick={() => setFormAsignacion({ fecha: '', punto: '', capacitador_id: '' })}
                    className="mr-auto px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg font-medium text-sm"
                  >
                    Borrar Asignación
                  </button>
                )}
                
                <button type="button" onClick={() => setParticipanteSeleccionado(null)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button type="submit" disabled={guardando} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center">
                  {guardando ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}