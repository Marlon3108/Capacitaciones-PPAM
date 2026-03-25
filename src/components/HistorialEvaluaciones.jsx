import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { Search, ChevronLeft, ChevronRight, Activity, ShieldAlert, Download, Eye, X, CheckCircle2, XCircle } from 'lucide-react'

// Diccionario exacto basado en la LCCS - PPAM Oficial
const diccionarioPreguntas = {
  // ANTES DE LA CAPACITACIÓN
  antes_1: "Antes: ¿Ya se comunicó con el participante?",
  antes_2: "Antes: ¿Le comunicó al Hombre clave para informarle de la capacitación y la disponibilidad del turno?",
  
  // REQUISITOS
  durante_req_1: "Requisitos: ¿Se repasaron los requisitos que deben cumplir los participantes?",
  
  // EQUIPO DE PREDICACIÓN
  durante_eq_1: "Equipo: ¿Se ha llevado al participante a conocer los lugares donde se guardan los exhibidores?",
  durante_eq_2: "Equipo: ¿Se enseña a cómo transportar correctamente los exhibidores?",
  durante_eq_3: "Equipo: ¿Se le enseña a enrollar y guardar correctamente el forro protector del exhibidor?",
  durante_eq_4: "Equipo: ¿Se muestra cómo usar los elementos de limpieza?",
  durante_eq_5: "Equipo: ¿Se explica la forma correcta de organizar las publicaciones y su indicación?",
  durante_eq_6: "Equipo: ¿Se muestra qué cosas se guardan en la pequeña bodega que hay detrás del exhibidor?",
  
  // SEGURIDAD
  durante_seg_1: "Seguridad: ¿Se enseña la forma correcta de ubicar los exhibidores para que nadie se acerque por detrás?",
  durante_seg_2: "Seguridad: ¿Se explica cómo actuar ante un perturbador y qué hacer?",
  durante_seg_3: "Seguridad: ¿Se le ayuda a ver la importancia de la seguridad personal?",
  
  // TURNOS
  durante_tur_1: "Turnos: ¿El participante llegó puntual a la cita?",
  durante_tur_2: "Turnos: ¿Se le explica la importancia de estar comprometidos con la asignación?",
  durante_tur_3: "Turnos: ¿Se le ayuda a saber qué hacer en caso de no poder cumplir el turno?",
  durante_tur_4: "Turnos: ¿Se le explica cómo abordar a las personas?",
  durante_tur_5: "Turnos: ¿Durante el turno, sonríe y tiene contacto visual con las personas?",
  durante_tur_6: "Turnos: ¿Repasó la información sobre cómo iniciar conversaciones de forma natural?",
  durante_tur_7: "Turnos: ¿Sabe cómo direccionar a las personas al sitio web?",
  durante_tur_8: "Turnos: ¿No habla demasiado con los demás participantes del turno?",
  durante_tur_9: "Turnos: ¿Aprendió a usar las herramientas digitales?",

  // INFORME DESPUÉS DE LA CAPACITACIÓN
  informe_1: "Informe: ¿Se le ha informado al participante la decisión?",
  informe_2: "Informe: ¿Se le informó al hombre clave y encargado de punto?",
  informe_3: "Informe: ¿Se informó al comité de servicio si requiere capacitación en 6 meses?",
  informe_4: "Informe: ¿Se informó al comité de servicio del participante que no fue aprobado?"
};

const obtenerTextoPregunta = (clave) => {
  if (diccionarioPreguntas[clave]) {
    return diccionarioPreguntas[clave];
  }
  return clave.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const traducirEstado = (estado) => {
  const diccionario = {
    aprobado: { texto: 'Aprobado', color: 'text-green-700 bg-green-100' },
    requiere_refuerzo: { texto: 'Refuerzo (1m)', color: 'text-yellow-700 bg-yellow-100' },
    repetir_6_meses: { texto: 'Repetir (6m)', color: 'text-orange-700 bg-orange-100' },
    no_cumple: { texto: 'No cumple', color: 'text-red-700 bg-red-100' },
  }
  return diccionario[estado] || { texto: estado, color: 'text-gray-700 bg-gray-100' }
}

// ESTA ES LA LÍNEA QUE LE FALTABA A VERCEL PARA COMPILAR:
export default function HistorialEvaluaciones() {
  const [evaluaciones, setEvaluaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState(null)
  const [busqueda, setBusqueda] = useState('')
  const [paginaActual, setPaginaActual] = useState(1)
  const itemsPorPagina = 10

  useEffect(() => {
    const verificarPermisosYTraerDatos = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('usuarios')
        .select('roles(nombre)')
        .eq('id', session.user.id)
        .single()

      const rol = userData?.roles?.nombre?.toLowerCase() || ''
      
      if (rol !== 'administrador' && rol !== 'coordinador' && rol !== 'superintendente') {
        setAccesoDenegado(true)
        setCargando(false)
        return
      }

      const { data, error } = await supabase
        .from('evaluaciones_lccs')
        .select(`
          *,
          participantes(nombres_apellidos, congregacion, ciudad),
          usuarios(nombre_completo)
        `)
        .order('creado_en', { ascending: false })

      if (data) setEvaluaciones(data)
      setCargando(false)
    }

    verificarPermisosYTraerDatos()
  }, [])

  const evaluacionesFiltradas = useMemo(() => {
    if (!evaluaciones) return []
    return evaluaciones.filter(ev => {
      const termino = busqueda.toLowerCase()
      const participante = (ev.participantes?.nombres_apellidos || '').toLowerCase()
      const capacitador = (ev.usuarios?.nombre_completo || '').toLowerCase()
      const punto = (ev.punto_metropolitana || '').toLowerCase()
      const congregacion = (ev.participantes?.congregacion || '').toLowerCase()
      const ciudad = (ev.participantes?.ciudad || '').toLowerCase()

      return participante.includes(termino) || 
             capacitador.includes(termino) || 
             punto.includes(termino) ||
             congregacion.includes(termino) ||
             ciudad.includes(termino)
    })
  }, [evaluaciones, busqueda])

  const totalPaginas = Math.ceil(evaluacionesFiltradas.length / itemsPorPagina)
  const evaluacionesPaginadas = evaluacionesFiltradas.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina
  )

  const manejarBusqueda = (e) => {
    setBusqueda(e.target.value)
    setPaginaActual(1)
  }

  const generarPDF = (idEvaluacion) => {
    alert(`Pronto se descargará el PDF de la evaluación ID: ${idEvaluacion}`)
  }

  if (cargando) return <div className="h-full flex items-center justify-center"><Activity className="animate-spin mr-2 text-blue-600" /> Cargando historial...</div>

  if (accesoDenegado) {
    return (
      <div className="bg-red-50 border border-red-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto mt-10">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-800 mb-2">Acceso Restringido</h2>
        <p className="text-red-600">No tienes los permisos necesarios para ver el historial completo del departamento.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10 relative">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Historial de Evaluaciones</h1>
        <p className="text-gray-500 mt-1">Consulta y visualiza los resultados detallados de todas las listas de chequeo.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-50">
          <div className="relative w-full sm:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nombre, congregación, ciudad, punto..." 
              value={busqueda}
              onChange={manejarBusqueda}
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
            />
          </div>
          <div className="text-sm text-gray-500 font-medium">
            Total: {evaluacionesFiltradas.length} registros
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-gray-500 text-sm border-b border-gray-100">
                <th className="p-4 font-semibold">Fecha</th>
                <th className="p-4 font-semibold">Participante</th>
                <th className="p-4 font-semibold">Detalles</th>
                <th className="p-4 font-semibold">Capacitador</th>
                <th className="p-4 font-semibold">Resultado</th>
                <th className="p-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {evaluacionesPaginadas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    No se encontraron evaluaciones con esos criterios.
                  </td>
                </tr>
              ) : (
                evaluacionesPaginadas.map(ev => {
                  const est = traducirEstado(ev.resultado_aprobacion)
                  return (
                    <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600 font-medium">
                        {new Date(ev.creado_en).toLocaleDateString()}
                      </td>
                      <td className="p-4 font-bold text-gray-800">
                        {ev.participantes?.nombres_apellidos}
                      </td>
                      <td className="p-4">
                        <div className="text-gray-800">{ev.punto_metropolitana}</div>
                        <div className="text-xs text-gray-500 mt-1">{ev.participantes?.ciudad} • {ev.participantes?.congregacion}</div>
                      </td>
                      <td className="p-4 text-gray-600">{ev.usuarios?.nombre_completo}</td>
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold ${est.color}`}>
                          {est.texto}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => setEvaluacionSeleccionada(ev)}
                            className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Ver detalles del Checklist"
                          >
                            <Eye size={18} />
                          </button>
                          <button 
                            onClick={() => generarPDF(ev.id)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors"
                            title="Descargar PDF"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="p-4 flex items-center justify-between bg-white border-t border-gray-100">
            <span className="text-sm text-gray-500 font-medium">
              Página {paginaActual} de {totalPaginas}
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1}
                className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {evaluacionSeleccionada && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {evaluacionSeleccionada.participantes?.nombres_apellidos}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Evaluado por {evaluacionSeleccionada.usuarios?.nombre_completo} el {new Date(evaluacionSeleccionada.creado_en).toLocaleDateString()}
                </p>
              </div>
              <button 
                onClick={() => setEvaluacionSeleccionada(null)}
                className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <h4 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider border-b pb-2">Información General</h4>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium text-sm pr-4">Fecha Capacitación</span>
                  <span className="text-gray-600 text-sm font-semibold">{evaluacionSeleccionada.fecha_capacitacion || new Date(evaluacionSeleccionada.creado_en).toLocaleDateString()}</span>
                </div>
                {evaluacionSeleccionada.tipo_capacitacion && (
                  <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700 font-medium text-sm pr-4">Tipo Capacitación</span>
                    <span className="text-gray-600 text-sm font-semibold">{evaluacionSeleccionada.tipo_capacitacion}</span>
                  </div>
                )}
              </div>

              <h4 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider border-b pb-2">Respuestas del Checklist</h4>
              
              <div className="space-y-3">
                {evaluacionSeleccionada.respuestas && typeof evaluacionSeleccionada.respuestas === 'object' ? (
                  Object.entries(evaluacionSeleccionada.respuestas).map(([clave, valor]) => {
                    const clavesIgnoradas = ['participante', 'capacitador_id', 'capacitador', 'id', 'fecha', 'observaciones_finales'];
                    
                    if (clavesIgnoradas.some(ignorada => clave.toLowerCase().includes(ignorada))) {
                      return null; 
                    }

                    const nombreBonito = obtenerTextoPregunta(clave);

                    return (
                      <div key={clave} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-700 font-medium text-sm pr-4">{nombreBonito}</span>
                        <span className="flex-shrink-0">
                          {valor === true || valor === 'Sí' || valor === 'Cumple' ? (
                            <span className="flex items-center text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-bold"><CheckCircle2 size={14} className="mr-1"/> Sí</span>
                          ) : valor === false || valor === 'No' || valor === 'No Cumple' ? (
                            <span className="flex items-center text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-bold"><XCircle size={14} className="mr-1"/> No</span>
                          ) : (
                            <span className="text-gray-600 text-sm font-semibold">{valor.toString()}</span>
                          )}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded-lg">No hay respuestas registradas en formato detallado para este participante.</div>
                )}
              </div>

              {evaluacionSeleccionada.observaciones_finales && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                  <h4 className="font-bold text-yellow-800 mb-2 text-xs uppercase tracking-wider">Observaciones Finales</h4>
                  <p className="text-sm text-yellow-900">{evaluacionSeleccionada.observaciones_finales}</p>
                </div>
              )}

              <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Resultado Final</h4>
                <div className={`inline-flex items-center px-4 py-2 rounded-lg font-bold ${traducirEstado(evaluacionSeleccionada.resultado_aprobacion).color}`}>
                  {traducirEstado(evaluacionSeleccionada.resultado_aprobacion).texto}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-2xl">
              <button 
                onClick={() => setEvaluacionSeleccionada(null)}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
