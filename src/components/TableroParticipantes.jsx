import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Search, Clock, AlertTriangle, CheckCircle, RefreshCcw, UserX, PauseCircle } from 'lucide-react'


// Definimos las columnas que existirán en nuestro tablero
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
  const [busqueda, setBusqueda] = useState('')

  // Cargar los participantes desde Supabase
  const cargarParticipantes = async () => {
    // 1. Quitamos la variable 'error' que no usamos
    const { data } = await supabase
      .from('participantes')
      .select('*')
      .order('creado_en', { ascending: false })

    if (data) setParticipantes(data)
    setCargando(false)
  }

  // 2. Metemos la llamada dentro de una función anónima para que React no se queje
  useEffect(() => {
    const init = async () => {
      await cargarParticipantes()
    }
    init()
  }, [])

  // Filtrar los participantes por la búsqueda del usuario
  const participantesFiltrados = participantes.filter(p => 
    p.nombres_apellidos.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.codigo_unico.toLowerCase().includes(busqueda.toLowerCase()) ||
    p.ciudad.toLowerCase().includes(busqueda.toLowerCase())
  )

  // Componente de Tarjeta individual
  const TarjetaParticipante = ({ participante }) => (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow cursor-pointer group">
      <div className="flex justify-between items-start mb-2">
        <h3 className="font-semibold text-gray-800 text-sm">{participante.nombres_apellidos}</h3>
        <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded text-gray-600">
          {participante.codigo_unico}
        </span>
      </div>
      <div className="flex flex-col text-xs text-gray-500 mt-3 space-y-1">
        <span>📍 Ciudad: {participante.ciudad}</span>
        <span>🏛️ Cong: {participante.congregacion}</span>
      </div>
      <div className="text-[10px] text-gray-400 mt-2 text-right">
        {new Date(participante.creado_en).toLocaleDateString()}
      </div>
    </div>
  )

  return (
    <div className="h-full flex flex-col">
      {/* Cabecera y Buscador */}
      <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Gestión de Participantes</h2>
          <p className="text-gray-500 text-sm mt-1">Supervisa el estado y ciclo de vida de los nuevos integrantes.</p>
        </div>

        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nombre, código o ciudad..." 
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
      </div>

      {/* Tablero Kanban (Scroll horizontal en pantallas pequeñas) */}
      <div className="flex-1 overflow-x-auto pb-4">
        <div className="flex gap-6 min-w-max h-full">
          {COLUMNAS.map(col => {
            const Icono = col.icon
            // Filtramos a los participantes que pertenecen a esta columna
            const listaColumna = participantesFiltrados.filter(p => p.estado === col.id)

            return (
              <div key={col.id} className="w-80 flex flex-col h-full bg-gray-50/50 rounded-2xl border border-gray-200 overflow-hidden">
                {/* Cabecera de la Columna */}
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

                {/* Lista de Tarjetas (Scroll vertical independiente) */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3">
                  {cargando ? (
                    <div className="text-center py-8 text-gray-400 text-sm">Cargando...</div>
                  ) : listaColumna.length === 0 ? (
                    <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-xl">
                      <p className="text-gray-400 text-sm">No hay participantes aquí</p>
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
