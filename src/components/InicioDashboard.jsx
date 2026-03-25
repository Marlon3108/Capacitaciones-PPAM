import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Users, CheckCircle, Clock, AlertTriangle, FileText, Activity, 
  PauseCircle, Search, ChevronLeft, ChevronRight, Calendar, MapPin, ClipboardList, Phone, RefreshCw
} from 'lucide-react'

const MetricaCard = ({ titulo, valor, colorFondo, colorIcono }) => (
  <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
    <div className={`p-3 rounded-xl ${colorFondo} flex-shrink-0 mr-4`}>
      <Icono size={24} className={colorIcono} />
    </div>
    <div className="text-right">
      <p className="text-sm font-semibold text-gray-500 whitespace-nowrap">{titulo}</p>
      <p className="text-3xl font-bold text-gray-800 mt-1">{valor}</p>
    </div>
  </div>
)

const traducirEstado = (estado) => {
  const diccionario = {
    aprobado: { texto: 'Aprobado', color: 'text-green-700 bg-green-100' },
    requiere_refuerzo: { texto: 'Refuerzo (1m)', color: 'text-yellow-700 bg-yellow-100' },
    repetir_6_meses: { texto: 'Repetir (6m)', color: 'text-orange-700 bg-orange-100' },
    no_cumple: { texto: 'No cumple', color: 'text-red-700 bg-red-100' },
  }
  return diccionario[estado] || { texto: estado, color: 'text-gray-700 bg-gray-100' }
}

export default function InicioDashboard({ userName, setPestanaActiva }) {
  const [metricas, setMetricas] = useState({ total: 0, pendientes: 0, aprobados: 0, refuerzo: 0, rechazos: 0, pausa: 0 })
  const [evaluacionesRecientes, setEvaluacionesRecientes] = useState([])
  const [cargando, setCargando] = useState(true)

  const [rolUsuario, setRolUsuario] = useState(null)
  const [misAsignaciones, setMisAsignaciones] = useState([])

  const [busqueda, setBusqueda] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const itemsPorPagina = 10

  // ESTE ES EL CAMBIO PRINCIPAL: Añadimos una función separada que podemos llamar cuando queramos
  const fetchDashboardData = async () => {
    setCargando(true)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return

    const { data: userData } = await supabase
      .from('usuarios')
      .select('roles(nombre)')
      .eq('id', session.user.id)
      .single()

    const rolStr = userData?.roles?.nombre?.toLowerCase() || 'capacitador'
    setRolUsuario(rolStr)

    if (rolStr === 'administrador' || rolStr === 'coordinador') {
      const { data: partData } = await supabase.from('participantes').select('estado')
      if (partData) {
        setMetricas({
          total: partData.length,
          pendientes: partData.filter(p => p.estado === 'pendiente').length,
          aprobados: partData.filter(p => p.estado === 'aprobado').length,
          refuerzo: partData.filter(p => p.estado === 'requiere_refuerzo' || p.estado === 'repetir_6_meses').length,
          rechazos: partData.filter(p => p.estado === 'no_cumple').length,
          pausa: partData.filter(p => p.estado === 'en_pausa').length,
        })
      }

      const { data: evalData } = await supabase
        .from('evaluaciones_lccs')
        .select(`
          id, creado_en, resultado_aprobacion, punto_metropolitana,
          participantes(nombres_apellidos),
          usuarios(nombre_completo)
        `)
        .order('creado_en', { ascending: false })

      if (evalData) setEvaluacionesRecientes(evalData)

    } else {
      // AQUÍ TAMBIÉN ESTÁ EL CAMBIO DEL TELÉFONO QUE HICIMOS ANTES
      const { data: asigData } = await supabase
        .from('participantes')
        .select('id, nombres_apellidos, congregacion, fecha_programada, punto_programado, telefono')
        .eq('capacitador_id', session.user.id)
        .in('estado', ['pendiente', 'requiere_refuerzo', 'repetir_6_meses'])
        .order('fecha_programada', { ascending: true })

      if (asigData) setMisAsignaciones(asigData)
    }

    setCargando(false)
  }

  // Al quitar el [] vacío o dejarlo, la clave es que el componente DashboardLayout
  // desmonta y monta InicioDashboard cada vez que cambias de pestaña.
  // Por lo tanto, el useEffect se disparará siempre que entres a esta vista.
  useEffect(() => {
    const cargar = async () => {
      await fetchDashboardData()
    }
    cargar()
  }, [])

  const evaluacionesFiltradas = useMemo(() => {
    if (!evaluacionesRecientes) return []
    return evaluacionesRecientes.filter(ev => {
      const termino = busqueda.toLowerCase()
      const participante = (ev.participantes?.nombres_apellidos || '').toLowerCase()
      const capacitador = (ev.usuarios?.nombre_completo || '').toLowerCase()
      const punto = (ev.punto_metropolitana || '').toLowerCase()

      return participante.includes(termino) || 
             capacitador.includes(termino) || 
             punto.includes(termino)
    })
  }, [evaluacionesRecientes, busqueda])

  const totalPaginas = Math.ceil(evaluacionesFiltradas.length / itemsPorPagina)
  const evaluacionesPaginadas = evaluacionesFiltradas.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina
  )

  const manejarBusqueda = (e) => {
    setBusqueda(e.target.value)
    setPaginaActual(1)
  }

  if (cargando) return <div className="h-full flex items-center justify-center"><Activity className="animate-spin mr-2 text-blue-600" /> Actualizando panel...</div>

  const nombreMostrar = userName ? userName.split(' ')[0] : 'Usuario'

  return (
    <div className="space-y-8 pb-10">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Hola, {nombreMostrar} 👋</h1>
          <p className="text-gray-500 mt-1">
            {rolUsuario === 'capacitador' 
              ? 'Bienvenido a tu panel de capacitaciones asignadas.' 
              : 'Este es el resumen general del departamento de capacitaciones.'}
          </p>
        </div>
        {/* BOTÓN DE RECARGA MANUAL */}
        <button
          onClick={fetchDashboardData}
          disabled={cargando}
          className="flex items-center px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-600 rounded-lg shadow-sm transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          title="Actualizar datos del panel"
        >
          <RefreshCw size={16} className={`mr-2 ${cargando ? 'animate-spin text-blue-600' : ''}`} />
          {cargando ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {rolUsuario === 'capacitador' ? (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-6 border-b border-gray-100 bg-slate-50">
            <h2 className="text-xl font-bold text-gray-800 flex items-center">
              <ClipboardList className="mr-2 text-blue-600" /> Mis Capacitaciones Pendientes
            </h2>
            <p className="text-sm text-gray-500 mt-1">Personas que tienes programadas para evaluar próximamente.</p>
          </div>

          <div className="p-6">
            {misAsignaciones.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                <div className="text-4xl mb-3">🎉</div>
                <h3 className="text-lg font-bold text-gray-700">¡Al día!</h3>
                <p className="text-gray-500">No tienes capacitaciones pendientes asignadas en este momento.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {misAsignaciones.map(asig => (
                  <div key={asig.id} className="border border-gray-200 rounded-xl p-5 hover:shadow-md transition-shadow bg-white flex flex-col justify-between">
                    <div>
                      {/* === ALERTAS VISUALES === */}
                      <div className="flex justify-between items-start mb-1">
                        <h3 className="text-lg font-bold text-gray-800">{asig.nombres_apellidos}</h3>
                        
                        {/* Etiquetas de estado si viene de una evaluación previa */}
                        {asig.estado === 'requiere_refuerzo' && (
                          <span className="bg-yellow-100 text-yellow-800 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex items-center">
                            <AlertTriangle size={10} className="mr-1"/> Refuerzo (1m)
                          </span>
                        )}
                        {asig.estado === 'repetir_6_meses' && (
                          <span className="bg-orange-100 text-orange-800 text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex items-center">
                            <AlertTriangle size={10} className="mr-1"/> Repetir (6m)
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-500 mb-4">{asig.congregacion}</p>
                      
                      {/* BOTONES DE LLAMADA */}
                      {asig.telefono && (
                        <div className="flex gap-2 mb-4">
                          <a 
                            href={`tel:${asig.telefono}`} 
                            className="flex-1 bg-green-50 text-green-700 hover:bg-green-100 border border-green-200 py-1.5 px-3 rounded-lg text-sm font-medium text-center transition-colors flex items-center justify-center"
                          >
                            <Phone size={14} className="mr-1" /> Llamar
                          </a>
                          <a 
                            href={`https://wa.me/57${asig.telefono.replace(/\s+/g, '')}`} 
                            target="_blank" rel="noreferrer"
                            className="flex-1 bg-green-500 text-white hover:bg-green-600 py-1.5 px-3 rounded-lg text-sm font-medium text-center transition-colors"
                          >
                            💬 WhatsApp
                          </a>
                        </div>
                      )}
                      
                      <div className="space-y-2 mb-6">
                        <div className="flex items-center text-sm font-medium text-gray-700 bg-gray-50 p-2 rounded-lg">
                          <Calendar size={16} className="text-green-600 mr-2 flex-shrink-0"/> 
                          {asig.fecha_programada ? new Date(asig.fecha_programada).toLocaleDateString() : 'Fecha por definir'}
                        </div>
                        <div className="flex items-center text-sm font-medium text-gray-700 bg-gray-50 p-2 rounded-lg">
                          <MapPin size={16} className="text-blue-600 mr-2 flex-shrink-0"/> 
                          {asig.punto_programado || 'Punto por definir'}
                        </div>
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => setPestanaActiva && setPestanaActiva('Listas de Chequeo', asig)}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg flex items-center justify-center transition-colors"
                    >
                      <FileText size={18} className="mr-2" /> Iniciar Evaluación
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            <MetricaCard titulo="Total Evaluados" valor={metricas.total} icono={Users} colorFondo="bg-blue-50" colorIcono="text-blue-600" />
            <MetricaCard titulo="Pendientes" valor={metricas.pendientes} icono={Clock} colorFondo="bg-gray-50" colorIcono="text-gray-600" />
            <MetricaCard titulo="Aprobados" valor={metricas.aprobados} icono={CheckCircle} colorFondo="bg-green-50" colorIcono="text-green-600" />
            <MetricaCard titulo="En Refuerzo" valor={metricas.refuerzo} icono={AlertTriangle} colorFondo="bg-orange-50" colorIcono="text-orange-600" />
            <MetricaCard titulo="En Pausa" valor={metricas.pausa} icono={PauseCircle} colorFondo="bg-gray-100" colorIcono="text-gray-800" />
            <MetricaCard titulo="No Cumplen" valor={metricas.rechazos} icono={AlertTriangle} colorFondo="bg-red-50" colorIcono="text-red-600" />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <h2 className="text-lg font-bold text-gray-800 flex items-center">
                <FileText className="mr-2 text-gray-400" size={20} /> Últimas Evaluaciones Recientes
              </h2>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Buscar participante, punto..." 
                  value={busqueda}
                  onChange={manejarBusqueda}
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full sm:w-72"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50 text-gray-500 text-sm">
                    <th className="p-4 font-medium">Fecha</th>
                    <th className="p-4 font-medium">Participante</th>
                    <th className="p-4 font-medium">Capacitador</th>
                    <th className="p-4 font-medium">Punto</th>
                    <th className="p-4 font-medium">Resultado</th>
                  </tr>
                </thead>
                <tbody className="text-sm divide-y divide-gray-100">
                  {evaluacionesPaginadas.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="p-8 text-center text-gray-500">
                        {busqueda ? `No se encontraron resultados para "${busqueda}"` : 'No hay evaluaciones recientes'}
                      </td>
                    </tr>
                  ) : (
                    evaluacionesPaginadas.map(ev => {
                      const est = traducirEstado(ev.resultado_aprobacion)
                      return (
                        <tr key={ev.id} className="hover:bg-gray-50">
                          <td className="p-4 text-gray-600">{new Date(ev.creado_en).toLocaleDateString()}</td>
                          <td className="p-4 font-medium text-gray-800">{ev.participantes?.nombres_apellidos}</td>
                          <td className="p-4 text-gray-600">{ev.usuarios?.nombre_completo}</td>
                          <td className="p-4 text-gray-600">{ev.punto_metropolitana}</td>
                          <td className="p-4">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${est.color}`}>
                              {est.texto}
                            </span>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalPaginas > 1 && (
              <div className="p-4 border-t border-gray-100 flex items-center justify-between bg-gray-50">
                <span className="text-sm text-gray-500">
                  Mostrando {(paginaActual - 1) * itemsPorPagina + 1} a {Math.min(paginaActual * itemsPorPagina, evaluacionesFiltradas.length)} de {evaluacionesFiltradas.length}
                </span>
                <div className="flex space-x-2">
                  <button 
                    onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                    disabled={paginaActual === 1}
                    className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft size={18} />
                  </button>
                  <button 
                    onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                    disabled={paginaActual === totalPaginas}
                    className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}