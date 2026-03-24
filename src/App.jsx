import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import DashboardLayout from './components/DashboardLayout'
import ForzarCambioClave from './components/ForzarCambioClave'

function App() {
  const [session, setSession] = useState(null)
  const [userData, setUserData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [necesitaCambioClave, setNecesitaCambioClave] = useState(false)

  const fetchUserProfile = async (userId) => {
    const { data } = await supabase
      .from('usuarios')
      .select('nombre_completo, roles(nombre)')
      .eq('id', userId)
      .single()

    if (data) setUserData(data)
    setLoading(false)
  }

  // Nueva función para verificar si el usuario tiene la contraseña temporal
  const verificarContrasenaTemporal = async (email) => {
    // Intentamos hacer un "login falso" silencioso con la contraseña temporal
    const { error } = await supabase.auth.signInWithPassword({
      email: email,
      password: 'PasswordTemporal123!'
    })
    
    // Si NO hay error, significa que la contraseña temporal FUNCIONÓ. 
    // Por lo tanto, ¡necesita cambiarla obligatoriamente!
    if (!error) {
      setNecesitaCambioClave(true)
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      if (session) {
        fetchUserProfile(session.user.id)
        // Revisamos si necesita cambiar clave verificando la temporal
        verificarContrasenaTemporal(session.user.email)
        
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
           verificarContrasenaTemporal(session.user.email)
        }
      } else {
        setUserData(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  if (loading) {
    return <div className="min-h-screen bg-gray-50 flex items-center justify-center">Cargando...</div>
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Login />
      </div>
    )
  }

  // SI LA CONTRASEÑA ES LA TEMPORAL, APARECE EL CANDADO.
  if (necesitaCambioClave) {
    return <ForzarCambioClave onClaveCambiada={() => setNecesitaCambioClave(false)} />
  }

  const nombreMostrar = userData?.nombre_completo || session.user.email

  return <DashboardLayout userEmail={nombreMostrar} />
}

export default App
