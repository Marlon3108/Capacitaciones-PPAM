import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Save, User, Shield, KeyRound, AlertCircle, CheckCircle2, UserPlus, Mail } from 'lucide-react'

export default function ConfiguracionPerfil({ userEmail }) {
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [password, setPassword] = useState('')

  // Estados para el panel de crear usuario
  const [isAdmin, setIsAdmin] = useState(false)
  // Añadimos el estado del rol seleccionado. Por defecto será 'capacitador' para que no quede vacío
  const [nuevoUsuario, setNuevoUsuario] = useState({ nombre: '', email: '', rolNombre: 'capacitador' })
  // Estado para guardar los roles que traemos de la base de datos
  const [rolesDisponibles, setRolesDisponibles] = useState([])

  useEffect(() => {
    const fetchDatosIniciales = async () => {
      // 1. Verificar si el usuario actual es administrador o coordinador
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData, error: userError } = await supabase
        .from('usuarios')
        .select(`
          rol_id,
          roles (nombre)
        `)
        .eq('id', session.user.id)
        .single()

      if (userError) {
        console.error("Error al buscar rol:", userError)
        return
      }
      
      const nombreRol = userData?.roles?.nombre?.toLowerCase() || ''
      if (nombreRol === 'administrador' || nombreRol === 'coordinador') {
        setIsAdmin(true)
      }

      // 2. Si es admin/coordinador, traemos la lista de roles para llenar el <select>
      if (nombreRol === 'administrador' || nombreRol === 'coordinador') {
        const { data: rolesData, error: rolesError } = await supabase
          .from('roles')
          .select('id, nombre')
          .order('nombre')
        
        if (!rolesError && rolesData) {
          setRolesDisponibles(rolesData)
        }
      }
    }
    
    fetchDatosIniciales()
  }, [])

  const handleActualizarPassword = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      setMensaje({ tipo: 'error', texto: 'La contraseña debe tener al menos 6 caracteres' })
      return
    }

    setLoading(true)
    setMensaje(null)
    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    } else {
      setMensaje({ tipo: 'exito', texto: 'Contraseña actualizada correctamente' })
      setPassword('')
    }
    setLoading(false)
  }

  const handleInvitarUsuario = async (e) => {
    e.preventDefault()
    setLoading(true)
    setMensaje(null)

    try {
      // 1. Buscamos el ID exacto del rol que se seleccionó en el formulario
      const rolSeleccionado = rolesDisponibles.find(r => r.nombre.toLowerCase() === nuevoUsuario.rolNombre.toLowerCase())
      
      if (!rolSeleccionado) throw new Error("Rol no válido.")

      // 2. Creamos al usuario en Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: nuevoUsuario.email,
        password: 'PasswordTemporal123!', 
      })

      if (authError) throw authError

      // 3. Lo insertamos en la tabla pública con el UUID del rol seleccionado
      if (authData.user) {
        const { error: dbError } = await supabase.from('usuarios').insert([{
          id: authData.user.id,
          nombre_completo: nuevoUsuario.nombre,
          rol_id: rolSeleccionado.id 
        }])

        if (dbError) throw dbError

        // Formateamos el nombre del rol para el mensaje (ej: capacitador -> Capacitador)
        const rolBonito = nuevoUsuario.rolNombre.charAt(0).toUpperCase() + nuevoUsuario.rolNombre.slice(1)
        
        setMensaje({ tipo: 'exito', texto: `¡${rolBonito} creado exitosamente! Puede iniciar sesión con la contraseña: PasswordTemporal123!` })
        setNuevoUsuario({ nombre: '', email: '', rolNombre: 'capacitador' })
      }
    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    }
    
    setLoading(false)
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6 pb-12">
      <div>
        <h2 className="text-2xl font-bold text-gray-800">Configuración del Sistema</h2>
        <p className="text-gray-500 text-sm mt-1">Gestiona tu perfil y herramientas del departamento.</p>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-lg flex items-center font-medium ${mensaje.tipo === 'error' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'}`}>
          {mensaje.tipo === 'error' ? <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0"/> : <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0"/>}
          {mensaje.texto}
        </div>
      )}

      {/* PANEL EXCLUSIVO PARA ADMINISTRADORES Y COORDINADORES */}
      {isAdmin && (
        <div className="bg-white p-8 rounded-2xl shadow-sm border-2 border-blue-100 relative overflow-hidden">
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-bl-lg flex items-center">
            <Shield size={12} className="mr-1" /> Panel de Administración
          </div>
          <h3 className="text-lg font-bold text-gray-800 flex items-center border-b pb-4 mb-6">
            <UserPlus className="mr-2 text-blue-600" /> Registrar Nuevo Usuario
          </h3>
          <p className="text-sm text-gray-500 mb-6">Crea nuevos accesos y asígnales un nivel de permisos en el sistema.</p>
          
          <form onSubmit={handleInvitarUsuario} className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo *</label>
              <input 
                type="text" required
                value={nuevoUsuario.nombre}
                onChange={(e) => setNuevoUsuario({...nuevoUsuario, nombre: e.target.value})}
                placeholder="Ej: Juan Pérez"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico *</label>
              <input 
                type="email" required
                value={nuevoUsuario.email}
                onChange={(e) => setNuevoUsuario({...nuevoUsuario, email: e.target.value})}
                placeholder="juan@ejemplo.com"
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>
            
            {/* NUEVO CAMPO: Selector de Rol */}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol de Acceso *</label>
              <select
                required
                value={nuevoUsuario.rolNombre}
                onChange={(e) => setNuevoUsuario({...nuevoUsuario, rolNombre: e.target.value})}
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                {rolesDisponibles.map(rol => (
                  <option key={rol.id} value={rol.nombre.toLowerCase()}>
                    {rol.nombre.charAt(0).toUpperCase() + rol.nombre.slice(1)}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-2">
                {nuevoUsuario.rolNombre === 'administrador' ? "Acceso total al sistema y configuraciones." : 
                 nuevoUsuario.rolNombre === 'coordinador' ? "Puede ver reportes y descargar listas de chequeo." : 
                 "Solo puede llenar listas de chequeo de sus asignados."}
              </p>
            </div>

            <div className="md:col-span-2 flex justify-end pt-2 border-t mt-4">
              <button 
                type="submit" disabled={loading || !nuevoUsuario.nombre || !nuevoUsuario.email}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50"
              >
                {loading ? 'Creando...' : <><Save size={18} className="mr-2" /> Crear Usuario</>}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* TARJETAS DE PERFIL GENERALES */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 flex items-center border-b pb-4 mb-6">
          <User className="mr-2 text-gray-600" /> Mi Información
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-500">Correo de Acceso</label>
          <div className="mt-1 p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 font-medium flex items-center">
            <Mail size={16} className="mr-2 text-gray-400" /> {userEmail}
          </div>
        </div>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-bold text-gray-800 flex items-center border-b pb-4 mb-6">
          <KeyRound className="mr-2 text-gray-600" /> Cambiar Contraseña
        </h3>
        <form onSubmit={handleActualizarPassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Escribe tu nueva contraseña..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none max-w-md"
            />
          </div>
          <div className="pt-2">
            <button 
              type="submit" disabled={loading || !password}
              className="bg-gray-800 hover:bg-gray-900 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Actualizar mi Contraseña'}
            </button>
          </div>
        </form>
      </div>

    </div>
  )
}
