import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'
import Login from './components/Login'
import DashboardLayout from './components/DashboardLayout'
import ForzarCambioClave from './components/ForzarCambioClave'
import ScannerOrientacion from './components/ScannerOrientacion'

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

  // 3. SI NO HAY SESIÓN, MOSTRAMOS LOGIN + BOTÓN DE ESCÁNER
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        
        {/* Renderiza el componente de Login normal */}
        <Login />

        {/* BOTÓN PÚBLICO PARA ACOMODADORES EXTERNOS */}
        <div className="mt-8 text-center max-w-md w-full">
           <div className="border-t border-gray-200 pt-6">
             <p className="text-sm text-gray-500 mb-3">¿Eres acomodador de la Reunión de Orientación?</p>
             <button 
               onClick={() => setMostrarEscaner(true)}
               className="w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-sm"
             >
               Abrir Escáner de Asistencia
             </button>
           </div>
        </div>

        {/* 4. RENDERIZADO DEL ESCÁNER SI ESTÁ ACTIVO */}
        {mostrarEscaner && (
          <ScannerOrientacion onCerrar={() => setMostrarEscaner(false)} />
        )}
        
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