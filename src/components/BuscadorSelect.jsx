import { useState, useRef, useEffect } from 'react'
import { Search, ChevronDown } from 'lucide-react'

export default function BuscadorSelect({ 
  opciones, 
  valorSeleccionado, 
  alSeleccionar, 
  placeholder = "-- Seleccionar --",
  error = false 
}) {
  const [abierto, setAbierto] = useState(false)
  const [busqueda, setBusqueda] = useState('')
  const dropdownRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setAbierto(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const opcionesFiltradas = opciones.filter(op => 
    op.label.toLowerCase().includes(busqueda.toLowerCase())
  )

  const opcionActiva = opciones.find(op => op.value === valorSeleccionado)

  return (
    <div className="relative w-full" ref={dropdownRef}>
      {/* Botón que simula el select */}
      <div 
        className={`w-full bg-blue-100/50 border ${error ? 'border-red-500 bg-red-50' : 'border-gray-400'} px-2 py-1 text-sm outline-none cursor-pointer flex justify-between items-center h-[30px]`}
        onClick={() => {
          setAbierto(!abierto)
          setBusqueda('')
        }}
      >
        <span className={opcionActiva ? 'text-black truncate' : 'text-gray-500 italic'}>
          {opcionActiva ? opcionActiva.label : placeholder}
        </span>
        <ChevronDown size={14} className="text-gray-500 ml-2 flex-shrink-0" />
      </div>

      {/* Menú desplegable */}
      {abierto && (
        <div className="absolute top-full left-0 w-full mt-1 bg-white border border-gray-300 shadow-xl z-50">
          <div className="p-2 border-b border-gray-200 flex items-center bg-gray-50">
            <Search size={14} className="text-gray-400 mr-2 flex-shrink-0" />
            <input 
              type="text" 
              placeholder="Buscar..." 
              className="w-full bg-transparent outline-none text-sm text-gray-700"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              autoFocus
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {opcionesFiltradas.length === 0 ? (
              <div className="p-2 text-sm text-gray-500 text-center italic">No hay resultados</div>
            ) : (
              opcionesFiltradas.map(op => (
                <div 
                  key={op.value}
                  className="p-2 text-sm hover:bg-blue-600 hover:text-white cursor-pointer transition-colors border-b border-gray-100 last:border-0 truncate"
                  onClick={() => {
                    alSeleccionar(op.value)
                    setAbierto(false)
                  }}
                >
                  {op.label}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
