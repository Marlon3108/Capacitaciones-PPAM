import { useState, useEffect } from 'react'
import { RefreshCw } from 'lucide-react'

export default function NuevaVersionBanner() {
  const [hayNuevaVersion, setHayNuevaVersion] = useState(false)

  useEffect(() => {
    // Guardamos la versión con la que el usuario abrió la app
    let versionActual = null

    const verificarVersion = async () => {
      try {
        // El ?t= evita que el navegador cachee este archivo
        const res = await fetch(`/version.json?t=${Date.now()}`)
        const data = await res.json()

        if (versionActual === null) {
          // Primera vez: guardamos la versión actual
          versionActual = data.version
        } else if (data.version !== versionActual) {
          // La versión cambió → hay un deploy nuevo
          setHayNuevaVersion(true)
        }
      } catch (e) {
        // Si falla el fetch, no pasa nada
      }
    }

    verificarVersion()
    // Revisar cada 2 minutos
    const intervalo = setInterval(verificarVersion, 2 * 60 * 1000)
    return () => clearInterval(intervalo)
  }, [])

  if (!hayNuevaVersion) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[999] p-3 bg-blue-600 shadow-2xl">
      <div className="max-w-lg mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-white">
          <RefreshCw size={18} className="flex-shrink-0" />
          <p className="text-sm font-medium">
            Hay una nueva versión disponible.
          </p>
        </div>
        <button
          onClick={() => window.location.reload()}
          className="flex-shrink-0 bg-white text-blue-700 font-bold text-sm px-4 py-2 rounded-lg hover:bg-blue-50 transition-colors"
        >
          Actualizar
        </button>
      </div>
    </div>
  )
}