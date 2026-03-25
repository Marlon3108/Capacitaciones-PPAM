import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Calendar, MapPin, User, Search, Save, X, Loader2, CheckCircle2, AlertTriangle, Phone, Users } from 'lucide-react'

// La misma lista que usamos en el checklist
const PUNTOS_METROPOLITANA = [
  'Cali- AVIANCA (Alexander Castro)',
  'Cali- BUITRERA (Marlon Cano/ Andrés Abadía)',
  'Cali- CANCHAS PANAMERICANAS (Daniel Torres/ Orlando)',
  'Cali- CARRERA OCTAVA (Jeisson Gómez)',
  'Cali- CAM (Alexander Castro)',
  'Cali- GOBERNACIÓN DEL VALLE (Jose Luis Castillo)',
  'Cali- IMBANACO (Daniel Torres/ Orlando)',
  'Cali- LA 14 CALIMA (José Eduardo Ortega)',
  'Cali- PLAZA CAYZEDO (Jose Luis Castillo)',
  'Jamundí (Edgar Pérez/ John Armijo)',
  'Palmira- BOLIVAR (Juan David Moncada)',
  'Palmira- LA FACTORÍA (Juan David Moncada)',
  'Yumbo (Sebastián Redondo/ Juan Esteban)'
]

export default function AsignacionParticipantes() {
  const [participantes, setParticipantes] = useState([])
  const [capacitadores, setCapacitadores] = useState([])
  const [cargando, setCargando] = useState(true)
  
  // Controles de vista
  const [vistaActual, setVistaActual] = useState('pendientes') // 'pendientes' o 'asignados'
  const [busqueda, setBusqueda] = useState('')
  const [filtroPrioridad, setFiltroPrioridad] = useState('todos')
  
  const [participanteSeleccionado, setParticipanteSeleccionado] = useState(null)
  const [formAsignacion, setFormAsignacion] = useState({ fecha: '', punto: '', capacitador_id: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    setCargando(true)
    
    const { data: partData } = await supabase
      .from('participantes')
      .select(`
        id, nombres_apellidos, congregacion, ciudad, estado, telefono, 
        fecha_programada, punto_programado, es_prioridad,
        capacitador_id,
        usuarios (nombre_completo)
      `)
      .in('estado', ['pendiente', 'requiere_refuerzo', 'repetir_6_meses'])
      .order('es_prioridad', { ascending: false })
      .order('creado_en', { ascending: false })

    if (partData) setParticipantes(partData)

    const { data: capData } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, roles!inner(nombre)')
      .order('nombre_completo')

    if (capData) setCapacitadores(capData)
    
    setCargando(false)
  }

  const abrirModalAsignacion = (participante) => {
    setParticipanteSeleccionado(participante)
    setFormAsignacion({
      fecha: participante.fecha_programada || '',
      punto: participante.punto_programado || '',
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
      await cargarDatos()
      setTimeout(() => setParticipanteSeleccionado(null), 1500)
    }
    setGuardando(false)
  }

  const marcarComoPrioridad = async (id, estadoActual) => {
    const { error } = await supabase
      .from('participantes')
      .update({ es_prioridad: !estadoActual })
      .eq('id', id)
      
    if (!error) cargarDatos()
  }

  // Lógica para filtrar entre los que no tienen capacitador y los que sí, además de la búsqueda
  const participantesAMostrar = useMemo(() => {
    return participantes.filter(p => {
      // 1. Filtro de vista (Pendientes vs Asignados)
      if (vistaActual === 'pendientes' && p.capacitador_id) return false;
      if (vistaActual === 'asignados' && !p.capacitador_id) return false;

      // 2. Filtro de Búsqueda
      const coincideTexto = p.nombres_apellidos.toLowerCase().includes(busqueda.toLowerCase()) || 
                            (p.congregacion && p.congregacion.toLowerCase().includes(busqueda.toLowerCase())) ||
                            (p.usuarios?.nombre_completo && p.usuarios.nombre_completo.toLowerCase().includes(busqueda.toLowerCase()))
      
      // 3. Filtro de Prioridad
      if (filtroPrioridad === 'prioridad') return coincideTexto && p.es_prioridad === true
      if (filtroPrioridad === 'normal') return coincideTexto && p.es_prioridad === false
      return coincideTexto
    })
  }, [participantes, busqueda, filtroPrioridad, vistaActual])

  if (cargando) return <div className="flex justify-center items-center h-64"><Loader2 className="animate-spin text-blue-600 mr-2"/> Cargando panel de asignaciones...</div>

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Programación</h1>
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
        <div className="flex flex-col md:flex-row gap-4 mb-6 justify-between">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" placeholder={vistaActual === 'asignados' ? "Buscar participante o capacitador..." : "Buscar por nombre o congregación..."} 
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          <div className="flex bg-gray-100 p-1 rounded-xl w-fit h-fit">
            <button 
              onClick={() => setFiltroPrioridad('todos')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${filtroPrioridad === 'todos' ? 'bg-white shadow-sm text-gray-800' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => setFiltroPrioridad('prioridad')}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors flex items-center ${filtroPrioridad === 'prioridad' ? 'bg-white shadow-sm text-amber-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              <AlertTriangle size={14} className="mr-1"/> Urgentes
            </button>
          </div>
        </div>

        {participantesAMostrar.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-300">
            <p className="text-gray-500">No hay participantes en esta vista.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {participantesAMostrar.map(p => (
              <div key={p.id} className={`p-4 rounded-xl border relative flex flex-col justify-between
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
                  <p className="text-xs text-gray-500 mb-3 mt-1">{p.congregacion} • {p.ciudad}</p>
                  
                  {p.telefono && (
                    <p className="text-xs text-gray-600 mb-3 flex items-center"><Phone size={12} className="mr-1"/> {p.telefono}</p>
                  )}

                  {p.capacitador_id ? (
                    <div className="space-y-1.5 text-sm text-gray-700 bg-white p-3 rounded-lg border border-green-100 mb-2">
                      <div className="flex items-start"><User size={14} className="mr-2 mt-0.5 text-purple-600 flex-shrink-0"/> <span className="font-medium">{p.usuarios?.nombre_completo}</span></div>
                      <div className="flex items-start"><Calendar size={14} className="mr-2 mt-0.5 text-green-600 flex-shrink-0"/> <span>{new Date(p.fecha_programada).toLocaleDateString()}</span></div>
                      <div className="flex items-start"><MapPin size={14} className="mr-2 mt-0.5 text-blue-600 flex-shrink-0"/> <span className="text-xs">{p.punto_programado}</span></div>
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
                {participanteSeleccionado.es_prioridad && <span className="inline-block mt-1 bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded font-medium">Prioridad Urgente</span>}
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
              </div>

              {mensaje && (
                <div className={`p-3 rounded-lg text-sm flex items-center ${mensaje.tipo === 'exito' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                  {mensaje.tipo === 'exito' && <CheckCircle2 size={16} className="mr-2"/>}
                  {mensaje.texto}
                </div>
              )}

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100 mt-2">
                {/* Botón para remover asignación (Solo si ya tenía una) */}
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