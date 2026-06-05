import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import DashboardLayout from './components/DashboardLayout'
import ForzarCambioClave from './components/ForzarCambioClave'
import ScannerOrientacion from './components/ScannerOrientacion'
import NuevaVersionBanner from './components/NuevaVersionBanner'

function App() {
  const [session, setSession] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [necesitaCambioClave, setNecesitaCambioClave] = useState(false)
  
  // 2. NUEVO ESTADO PARA ABRIR EL ESCÁNER PÚBLICO
  const [mostrarEscaner, setMostrarEscaner] = useState(false)

  const fetchUserProfile = async (userId) => {
    const { data } = await supabase
      .from('usuarios')
      .select('nombre_completo, roles(nombre)')
      .eq('id', userId)
      .single()

    if (data) setUserData(data)
    setLoading(false)
  }

  // Función para verificar si el usuario tiene la contraseña temporal
  const verificarContrasenaTemporal = async () => {
    // Lee los metadatos del usuario actual — sin hacer ningún login adicional
    const { data: { user } } = await supabase.auth.getUser()
    if (user?.user_metadata?.debe_cambiar_clave === true) {
      setNecesitaCambioClave(true)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchUserProfile(session.user.id)
        // Revisamos si necesita cambiar clave verificando la temporal
        verificarContrasenaTemporal()
        
        // Limpiamos la URL por si quedó algún rastro de hash o error del correo
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname)
        }
      } else {
        setLoading(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (session) {
        fetchUserProfile(session.user.id)
        if (event === 'SIGNED_IN') {
           verificarContrasenaTemporal()
        }
      } else {
        setUserData(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return (
      <>
        <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>
        <NuevaVersionBanner />
      </>
    )
  }

  // 3. SI NO HAY SESIÓN, MOSTRAMOS LOGIN + BOTÓN DE ESCÁNER
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        
        {/* Renderiza el componente de Login normal */}
        <Login />

        {/* 4. RENDERIZADO DEL ESCÁNER SI ESTÁ ACTIVO */}
        {mostrarEscaner && (
          <ScannerOrientacion onCerrar={() => setMostrarEscaner(false)} />
        )}
        <NuevaVersionBanner />
      </div>
    )
  }

  // SI LA CONTRASEÑA ES LA TEMPORAL, APARECE EL CANDADO.
  if (necesitaCambioClave) {
    return (
      <>
        <ForzarCambioClave onClaveCambiada={() => setNecesitaCambioClave(false)} />
        <NuevaVersionBanner />
      </>
    )
  }

  const nombreMostrar = userData?.nombre_completo || session.user.email

  return (
    <>
      <DashboardLayout userEmail={nombreMostrar} />
      <NuevaVersionBanner />
    </>
  )
}

export default App