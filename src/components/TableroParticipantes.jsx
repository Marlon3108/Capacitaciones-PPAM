import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Search, Clock, AlertTriangle, CheckCircle, RefreshCcw, UserX, PauseCircle, Filter, Star, MapPin } from 'lucide-react'

const COLUMNAS = [
  { id: 'pendiente', titulo: 'Pendientes', color: 'bg-blue-100', text: 'text-blue-700', icon: Clock },
  { id: 'requiere_refuerzo', titulo: 'Refuerzo (1 mes)', color: 'bg-yellow-100', text: 'text-yellow-700', icon: RefreshCcw },
  { id: 'repetir_6_meses', titulo: 'Repetir (6 meses)', color: 'bg-orange-100', text: 'text-orange-700', icon: AlertTriangle },
  { id: 'en_pausa', titulo: 'En Pausa', color: 'bg-gray-200', text: 'text-gray-700', icon: PauseCircle },
  { id: 'aprobado', titulo: 'Aprobados', color: 'bg-green-100', text: 'text-green-700', icon: CheckCircle },
  { id: 'no_cumple', titulo: 'No Cumple', color: 'bg-red-100', text: 'text-red-700', icon: UserX },
]

export default function TableroParticipantes() {
  const [participantes, setParticipantes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [actualizando, setActualizando] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todos')

  const cargarParticipantes = async (modoManual = false) => {
    if (modoManual) setActualizando(true)

    const { data, error } = await supabase
      .from('participantes')
      .select('*')
      .order('creado_en', { ascending: false })

    if (error) {
      console.error('Error cargando:', error)
    } else if (data) {
      setParticipantes(data)
    }

    setCargando(false)
    if (modoManual) setTimeout(() => setActualizando(false), 500)
  }

  useEffect(() => {
    const timer = setTimeout(() => {
      void cargarParticipantes()
    }, 0)

    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    const channel = supabase
      .channel('cambios-participantes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'participantes' },
        () => {
          void cargarParticipantes()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const participantesFiltrados = participantes.filter(p => {
    const pasaBusqueda =
      p.nombres_apellidos?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.codigo_unico?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.ciudad?.toLowerCase().includes(busqueda.toLowerCase()) ||
      p.punto_fijo?.toLowerCase().includes(busqueda.toLowerCase())

    const pasaCategoria = filtroCategoria === 'todos' || p.categoria === filtroCategoria
    return pasaBusqueda && pasaCategoria
  })

  const renderBadgeCategoria = (categoria, puntoFijo) => {
    if (categoria === 'nuevo' || categoria === 'nuevo_orientacion') {
      return (
        <span className="flex items-center text-[10px] font-bold bg-green-100 text-green-800 px-2 py-1 rounded w-fit mt-2">
          <Star size={10} className="mr-1" /> NUEVO
        </span>
      )
    }

    if (categoria === 'pendiente_programacion_punto') {
      return (
        <span className="flex items-center text-[10px] font-bold bg-violet-100 text-violet-800 px-2 py-1 rounded w-fit mt-2">
          <MapPin size={10} className="mr-1 flex-shrink-0" /> PENDIENTE PUNTO
        </span>
      )
    }

    if (categoria === 'viejo_punto_fijo') {
      return (
        <span className="flex items-center text-[10px] font-bold bg-blue-100 text-blue-800 px-2 py-1 rounded w-fit mt-2 truncate max-w-[200px]">
          <MapPin size={10} className="mr-1 flex-shrink-0" /> ANTIGUO: {puntoFijo || 'Sin punto'}
        </span>
      )
    }

    if (categoria === 'viejo_sin_punto') {
      return (
        <span className="flex items-center text-[10px] font-bold bg-gray-200 text-gray-700 px-2 py-1 rounded w-fit mt-2">
          ANTIGUO (Sin turno)
        </span>
      )
    }

    return null
  }

  const TarjetaParticipante = ({ participante }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group flex flex-col h-full">
      <div className="flex justify-between items-start mb-1">
        <h3 className="font-semibold text-gray-800 text-sm leading-tight pr-2">{participante.nombres_apellidos}</h3>
        <span className="text-[10px] font-mono bg-gray-50 px-1.5 py-0.5 rounded border border-gray-200 text-gray-500 flex-shrink-0">
          {participante.codigo_unico}
        </span>
      </div>

      {renderBadgeCategoria(participante.categoria, participante.punto_fijo)}

      <div className="flex flex-col text-xs text-gray-500 mt-3 space-y-1 flex-1">
        <span>📍 {participante.ciudad}</span>
        <span>🏛️ {participante.congregacion}</span>
      </div>

      <div className="text-[10px] text-gray-400 mt-3 pt-2 border-t border-gray-50 flex justify-between items-center">
        <span>Ingreso:</span>
        <span>{new Date(participante.creado_en).toLocaleDateString()}</span>
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-800 flex items-center">
              Gestión de Participantes
              <button
                onClick={() => cargarParticipantes(true)}
                disabled={actualizando}
                className="ml-4 p-1.5 bg-white border border-gray-200 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                title="Actualizar datos manualmente"
              >
                <RefreshCcw size={16} className={actualizando ? 'animate-spin text-blue-600' : ''} />
              </button>
            </h2>
            <p className="text-gray-500 text-sm mt-1">Supervisa el estado y ciclo de vida de los integrantes.</p>
          </div>

          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              placeholder="Buscar por nombre, ciudad o punto..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm shadow-sm"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border border-gray-200 shadow-sm w-fit">
          <Filter size={16} className="text-gray-400 ml-2 mr-1" />
          <span className="text-xs text-gray-500 font-medium mr-2">Filtros:</span>

          <button
            onClick={() => setFiltroCategoria('todos')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filtroCategoria === 'todos' ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
          >
            Todos
          </button>

          <button
            onClick={() => setFiltroCategoria('nuevo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center ${filtroCategoria === 'nuevo' ? 'bg-green-600 text-white' : 'bg-green-50 text-green-700 hover:bg-green-100'}`}
          >
            <Star size={12} className="mr-1" /> Nuevos
          </button>

          <button
            onClick={() => setFiltroCategoria('viejo_punto_fijo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors flex items-center ${filtroCategoria === 'viejo_punto_fijo' ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-700 hover:bg-blue-100'}`}
          >
            <MapPin size={12} className="mr-1" /> Antiguos (Fijo)
          </button>

          <button
            onClick={() => setFiltroCategoria('viejo_sin_punto')}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${filtroCategoria === 'viejo_sin_punto' ? 'bg-gray-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
          >
            Antiguos (Sin Turno)
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max h-full">
          {COLUMNAS.map(col => {
            const Icono = col.icon
            const listaColumna = participantesFiltrados.filter(p => p.estado === col.id)

            return (
              <div key={col.id} className="w-80 flex flex-col h-full bg-gray-50/50 rounded-2xl border border-gray-200 overflow-hidden shadow-sm">
                <div className={`p-4 border-b border-gray-200 ${col.color} bg-opacity-40`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Icono size={18} className={`mr-2 ${col.text}`} />
                      <h3 className={`font-bold text-sm ${col.text}`}>{col.titulo}</h3>
                    </div>
                    <span className={`text-xs font-bold px-2 py-1 rounded-full bg-white ${col.text} shadow-sm`}>
                      {listaColumna.length}
                    </span>
                  </div>
                </div>

                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {cargando ? (
                    <div className="text-center py-8 text-gray-400 text-sm flex flex-col items-center">
                      <RefreshCcw className="animate-spin mb-2" size={20} />
                      Cargando...
                    </div>
                  ) : listaColumna.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                      <p className="text-gray-400 text-sm">No hay participantes</p>
                    </div>
                  ) : (
                    listaColumna.map(p => <TarjetaParticipante key={p.id} participante={p} />)
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
