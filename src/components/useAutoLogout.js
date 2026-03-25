import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../supabaseClient'

// 30 minutos en milisegundos (estándar para apps administrativas)
const TIEMPO_INACTIVIDAD = 30 * 60 * 1000 

export default function useAutoLogout() {
  const temporizador = useRef(null)

  const cerrarSesion = useCallback(async () => {
    console.log("Cerrando sesión por inactividad...")
    await supabase.auth.signOut()
    // Supabase automáticamente redirigirá al login gracias a tu App.jsx
  }, [])

  const reiniciarTemporizador = useCallback(() => {
    if (temporizador.current) {
      clearTimeout(temporizador.current)
    }
    // Vuelve a empezar la cuenta regresiva de 30 minutos
    temporizador.current = setTimeout(cerrarSesion, TIEMPO_INACTIVIDAD)
  }, [cerrarSesion])

  useEffect(() => {
    // Lista de eventos que consideramos "actividad"
    const eventos = [
      'mousedown',
      'mousemove',
      'keydown',
      'scroll',
      'touchstart'
    ]

    // Iniciamos el temporizador por primera vez
    reiniciarTemporizador()

    // Cada vez que el usuario hace algo, reiniciamos la cuenta regresiva
    eventos.forEach((evento) => {
      window.addEventListener(evento, reiniciarTemporizador)
    })

    // Limpieza al desmontar
    return () => {
      if (temporizador.current) {
        clearTimeout(temporizador.current)
      }
      eventos.forEach((evento) => {
        window.removeEventListener(evento, reiniciarTemporizador)
      })
    }
  }, [reiniciarTemporizador])

  return null
}