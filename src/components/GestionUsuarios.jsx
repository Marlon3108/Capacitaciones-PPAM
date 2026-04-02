import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Search, Edit, Trash2, ShieldAlert, CheckCircle2, UserX, 
  UserCheck, Activity, AlertTriangle, X, Save, Loader2 
} from 'lucide-react'

export default function GestionUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [roles, setRoles] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  
  // Estados de Modales
  const [modalEdicion, setModalEdicion] = useState({ abierto: false, usuario: null })
  const [modalConfirmacion, setModalConfirmacion] = useState({ abierto: false, tipo: null, usuario: null, mensajeValidacion: null })
  
  const [procesando, setProcesando] = useState(false)
  const [mensajeNotificacion, setMensajeNotificacion] = useState(null)

  const cargarDatos = async () => {
    setCargando(true)
    
    // CORRECCIÓN: Se quitó 'email' de la consulta porque no existe en la tabla pública 'usuarios'
    const { data: usersData, error: usersError } = await supabase
      .from('usuarios')
      .select('id, nombre_completo, activo, rol_id, roles(nombre)')
      .order('nombre_completo')

    if (usersError) {
      console.error("Error cargando usuarios:", usersError)
    } else if (usersData) {
      setUsuarios(usersData)
    }

    // 2. Cargar Roles para el formulario de edición
    const { data: rolesData } = await supabase
      .from('roles')
      .select('id, nombre')
    
    if (rolesData) {
      setRoles(rolesData)
    }

    setCargando(false)
  }

  useEffect(() => {
    cargarDatos()
  }, [])

  const usuariosFiltrados = useMemo(() => {
    return usuarios.filter(u => {
      const termino = busqueda.toLowerCase()
      const nombre = (u.nombre_completo || '').toLowerCase()
      const rol = (u.roles?.nombre || '').toLowerCase()
      
      return nombre.includes(termino) || rol.includes(termino)
    })
  }, [usuarios, busqueda])

  // ==========================================
  // VALIDACIONES ANTES DE ACCIONES
  // ==========================================
  const verificarDependencias = async (userId, accion) => {
    if (accion === 'inactivar') {
      // Validar si tiene personas pendientes por evaluar
      const { count } = await supabase
        .from('participantes')
        .select('id', { count: 'exact', head: true })
        .eq('capacitador_id', userId)
        .in('estado', ['pendiente', 'requiere_refuerzo', 'repetir_6_meses'])

      if (count > 0) {
        return { permitido: false, mensaje: `No se puede inactivar. Tiene ${count} participante(s) pendiente(s) por evaluar. Reasígnalos primero.` }
      }
    }

    if (accion === 'borrar') {
      // Validar si tiene CUALQUIER participante asignado (histórico o pendiente)
      const { count: countPart } = await supabase
        .from('participantes')
        .select('id', { count: 'exact', head: true })
        .eq('capacitador_id', userId)

      // Validar si ha hecho evaluaciones
      const { count: countEval } = await supabase
        .from('evaluaciones_lccs')
        .select('id', { count: 'exact', head: true })
        .eq('capacitador_id', userId)

      if (countPart > 0 || countEval > 0) {
        return { permitido: false, mensaje: `No se puede borrar. El usuario tiene un historial de ${countEval} evaluación(es) y ${countPart} participante(s) asignado(s). Para quitarle el acceso, debes Inactivarlo.` }
      }
    }

    return { permitido: true, mensaje: null }
  }

  const iniciarAccion = async (usuario, accion) => {
    setProcesando(true)
    const validacion = await verificarDependencias(usuario.id, accion)
    setProcesando(false)

    setModalConfirmacion({
      abierto: true,
      tipo: accion,
      usuario: usuario,
      mensajeValidacion: validacion.permitido ? null : validacion.mensaje
    })
  }

  // ==========================================
  // EJECUCIÓN DE ACCIONES (DB)
  // ==========================================
  const ejecutarAccion = async () => {
    const { tipo, usuario } = modalConfirmacion
    setProcesando(true)

    try {
      if (tipo === 'inactivar' || tipo === 'activar') {
        const nuevoEstado = tipo === 'activar'
        const { error } = await supabase.from('usuarios').update({ activo: nuevoEstado }).eq('id', usuario.id)
        if (error) throw error
        setMensajeNotificacion({ tipo: 'exito', texto: `Usuario ${nuevoEstado ? 'activado' : 'inactivado'} correctamente.` })
      } 
      else if (tipo === 'borrar') {
        const { error } = await supabase.from('usuarios').delete().eq('id', usuario.id)
        if (error) throw error
        setMensajeNotificacion({ tipo: 'exito', texto: 'Perfil de usuario borrado correctamente.' })
      }

      await cargarDatos()
    } catch (error) {
      setMensajeNotificacion({ tipo: 'error', texto: `Hubo un error: ${error.message}` })
    }

    setProcesando(false)
    setModalConfirmacion({ abierto: false, tipo: null, usuario: null, mensajeValidacion: null })
    setTimeout(() => setMensajeNotificacion(null), 3000)
  }

  const guardarEdicion = async (e) => {
    e.preventDefault()
    setProcesando(true)

    const { error } = await supabase
      .from('usuarios')
      .update({ 
        nombre_completo: modalEdicion.usuario.nombre_completo,
        rol_id: modalEdicion.usuario.rol_id 
      })
      .eq('id', modalEdicion.usuario.id)

    if (error) {
      setMensajeNotificacion({ tipo: 'error', texto: 'Error al actualizar el usuario.' })
    } else {
      setMensajeNotificacion({ tipo: 'exito', texto: 'Usuario actualizado correctamente.' })
      await cargarDatos()
      setModalEdicion({ abierto: false, usuario: null })
    }
    
    setProcesando(false)
    setTimeout(() => setMensajeNotificacion(null), 3000)
  }


  if (cargando) return <div className="h-full flex items-center justify-center"><Activity className="animate-spin mr-2 text-blue-600" /> Cargando usuarios...</div>

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Gestión de Usuarios</h1>
          <p className="text-gray-500 mt-1">Administra accesos, roles y el estado de los integrantes del equipo.</p>
        </div>
      </div>

      {mensajeNotificacion && (
        <div className={`p-4 rounded-xl text-sm font-bold flex items-center ${mensajeNotificacion.tipo === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
          {mensajeNotificacion.tipo === 'error' ? <ShieldAlert className="mr-2"/> : <CheckCircle2 className="mr-2"/>}
          {mensajeNotificacion.texto}
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 bg-slate-50 flex items-center">
          <div className="relative flex-1 w-full max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text" placeholder="Buscar por nombre o rol..." 
              value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
              className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none bg-white"
            />
          </div>
          <div className="ml-4 text-sm font-medium text-gray-500">
            Total: {usuariosFiltrados.length} usuarios
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-gray-500 text-sm border-b border-gray-100">
                <th className="p-4 font-semibold">Nombre del Usuario</th>
                <th className="p-4 font-semibold">Rol</th>
                <th className="p-4 font-semibold">Estado</th>
                <th className="p-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {usuariosFiltrados.map(u => (
                <tr key={u.id} className={`hover:bg-gray-50 transition-colors ${!u.activo ? 'opacity-60 bg-gray-50' : ''}`}>
                  <td className="p-4 font-bold text-gray-800">{u.nombre_completo}</td>
                  <td className="p-4">
                    <span className="bg-blue-50 text-blue-700 border border-blue-100 px-2.5 py-1 rounded-lg font-semibold text-xs uppercase tracking-wide">
                      {u.roles?.nombre}
                    </span>
                  </td>
                  <td className="p-4">
                    {u.activo ? (
                      <span className="flex items-center text-green-700 font-bold text-xs"><CheckCircle2 size={14} className="mr-1"/> Activo</span>
                    ) : (
                      <span className="flex items-center text-red-600 font-bold text-xs"><UserX size={14} className="mr-1"/> Inactivo</span>
                    )}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-center space-x-2">
                      <button 
                        onClick={() => setModalEdicion({ abierto: true, usuario: { ...u } })}
                        className="p-2 bg-gray-100 text-gray-600 hover:bg-blue-100 hover:text-blue-700 rounded-lg transition-colors"
                        title="Editar nombre o rol"
                      >
                        <Edit size={16} />
                      </button>

                      {u.activo ? (
                        <button 
                          onClick={() => iniciarAccion(u, 'inactivar')}
                          disabled={procesando}
                          className="p-2 bg-gray-100 text-gray-600 hover:bg-orange-100 hover:text-orange-700 rounded-lg transition-colors disabled:opacity-50"
                          title="Inactivar usuario"
                        >
                          <UserX size={16} />
                        </button>
                      ) : (
                        <button 
                          onClick={() => iniciarAccion(u, 'activar')}
                          disabled={procesando}
                          className="p-2 bg-gray-100 text-gray-600 hover:bg-green-100 hover:text-green-700 rounded-lg transition-colors disabled:opacity-50"
                          title="Reactivar usuario"
                        >
                          <UserCheck size={16} />
                        </button>
                      )}

                      <button 
                        onClick={() => iniciarAccion(u, 'borrar')}
                        disabled={procesando}
                        className="p-2 bg-gray-100 text-gray-600 hover:bg-red-100 hover:text-red-700 rounded-lg transition-colors disabled:opacity-50"
                        title="Borrar definitivamente"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DE EDICIÓN */}
      {modalEdicion.abierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-slate-50">
              <h3 className="font-bold text-lg text-gray-800">Editar Usuario</h3>
              <button onClick={() => setModalEdicion({ abierto: false, usuario: null })} className="text-gray-400 hover:text-gray-600"><X size={20}/></button>
            </div>
            
            <form onSubmit={guardarEdicion} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input 
                  type="text" required
                  value={modalEdicion.usuario.nombre_completo}
                  onChange={e => setModalEdicion({ abierto: true, usuario: { ...modalEdicion.usuario, nombre_completo: e.target.value }})}
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rol en el Sistema</label>
                <select 
                  required
                  value={modalEdicion.usuario.rol_id}
                  onChange={e => setModalEdicion({ abierto: true, usuario: { ...modalEdicion.usuario, rol_id: e.target.value }})}
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.nombre.toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
                <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wide">Privacidad</label>
                <p className="text-[11px] text-blue-600 mt-1 leading-tight">
                  Por seguridad, el correo electrónico y la contraseña solo pueden modificarse desde el panel principal de la Base de Datos.
                </p>
              </div>

              <div className="pt-4 flex justify-end gap-3 border-t border-gray-100">
                <button type="button" onClick={() => setModalEdicion({ abierto: false, usuario: null })} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium">Cancelar</button>
                <button type="submit" disabled={procesando} className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium flex items-center">
                  {procesando ? <Loader2 size={16} className="animate-spin mr-2"/> : <Save size={16} className="mr-2"/>}
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMACIÓN (INACTIVAR/BORRAR) */}
      {modalConfirmacion.abierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${modalConfirmacion.mensajeValidacion ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-orange-600'}`}>
                {modalConfirmacion.mensajeValidacion ? <ShieldAlert size={32} /> : <AlertTriangle size={32} />}
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {modalConfirmacion.mensajeValidacion ? 'Acción Denegada' : '¿Estás seguro?'}
              </h3>
              
              <p className="text-sm text-gray-600 mb-6 px-2">
                {modalConfirmacion.mensajeValidacion 
                  ? modalConfirmacion.mensajeValidacion 
                  : modalConfirmacion.tipo === 'inactivar' 
                    ? `Vas a quitarle el acceso al sistema a ${modalConfirmacion.usuario.nombre_completo}. Podrás reactivarlo luego.`
                    : modalConfirmacion.tipo === 'activar'
                      ? `Vas a devolverle el acceso al sistema a ${modalConfirmacion.usuario.nombre_completo}.`
                      : `Vas a borrar definitivamente a ${modalConfirmacion.usuario.nombre_completo}. Esta acción no se puede deshacer.`
                }
              </p>

              <div className="flex gap-3">
                <button 
                  onClick={() => setModalConfirmacion({ abierto: false, tipo: null, usuario: null, mensajeValidacion: null })}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  {modalConfirmacion.mensajeValidacion ? 'Entendido' : 'Cancelar'}
                </button>
                
                {!modalConfirmacion.mensajeValidacion && (
                  <button 
                    onClick={ejecutarAccion}
                    disabled={procesando}
                    className={`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 ${modalConfirmacion.tipo === 'borrar' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                  >
                    {procesando ? <Loader2 size={18} className="animate-spin" /> : 'Sí, continuar'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}