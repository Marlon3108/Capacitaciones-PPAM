import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { UserPlus, Search, Shield, CheckCircle, Clock, Loader2, AlertCircle, X, User, FileText, Edit2, Archive, ArchiveRestore, RefreshCw } from 'lucide-react'

export default function CapacitadoresList() {
  const [capacitadores, setCapacitadores] = useState([])
  const [cargando, setCargando] = useState(true)
  const [busqueda, setBusqueda] = useState('')
  const [mostrarModal, setMostrarModal] = useState(false)
  const [creando, setCreando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [rolUsuarioActual, setRolUsuarioActual] = useState('')
  
  const [verArchivados, setVerArchivados] = useState(false)

  const [modalDetalle, setModalDetalle] = useState({ abierto: false, tipo: null, capacitador: null })
  const [listaDetalle, setListaDetalle] = useState([])
  const [cargandoDetalle, setCargandoDetalle] = useState(false)
  const [busquedaDetalle, setBusquedaDetalle] = useState('')
  
  // NUEVO: Estado para procesar reasignaciones dentro del modal
  const [reasignando, setReasignando] = useState(null)

  const [nuevoCap, setNuevoCap] = useState({ nombre_completo: '', email: '', password: '' })

  const [modalEditar, setModalEditar] = useState({ abierto: false, capacitador: null })
  const [nombreEditado, setNombreEditado] = useState('')
  const [procesandoAccion, setProcesandoAccion] = useState(false)

  const [modalConfirmacion, setModalConfirmacion] = useState({
    abierto: false,
    titulo: '',
    mensaje: '',
    tipo: 'alerta',
    capacitador: null
  })

  const cargarCapacitadores = async () => {
    setCargando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('roles(nombre)')
          .eq('id', session.user.id)
          .single()
        setRolUsuarioActual(userData?.roles?.nombre?.toLowerCase() || '')
      }

      const { data: usuarios, error } = await supabase
        .from('usuarios')
        .select(`
          id, 
          nombre_completo, 
          activo,
          roles (nombre)
        `)
        
      if (error) throw error

      const listaCapacitadores = usuarios.filter(u => 
        u.roles?.nombre?.toLowerCase() === 'capacitador' || 
        u.roles?.nombre?.toLowerCase() === 'coordinador'
      )

      const capacitadoresConMetricas = await Promise.all(listaCapacitadores.map(async (cap) => {
        const { count: pendientes } = await supabase
          .from('participantes')
          .select('*', { count: 'exact', head: true })
          .eq('capacitador_id', cap.id)
          .in('estado', ['pendiente', 'requiere_refuerzo', 'repetir_6_meses'])

        const { count: completadas } = await supabase
          .from('evaluaciones_lccs')
          .select('*', { count: 'exact', head: true })
          .eq('capacitador_id', cap.id)

        return {
          ...cap,
          activo: cap.activo !== false, 
          pendientes: pendientes || 0,
          completadas: completadas || 0,
          rol: cap.roles?.nombre?.toLowerCase()
        }
      }))

      setCapacitadores(capacitadoresConMetricas)
    } catch (error) {
      console.error("Error cargando equipo:", error)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargarCapacitadores()
  }, [])

  const handleCrearCapacitador = async (e) => {
    e.preventDefault()
    setCreando(true)
    setMensaje(null)

    try {
      const { data: rolData, error: rolError } = await supabase
        .from('roles')
        .select('id')
        .eq('nombre', 'capacitador')
        .single()
        
      if (rolError) throw new Error("No se encontró el rol de capacitador.")

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: nuevoCap.email,
        password: nuevoCap.password,
      })

      if (authError) throw authError

      if (authData?.user) {
        const { error: insertError } = await supabase.from('usuarios').insert([{
          id: authData.user.id,
          nombre_completo: nuevoCap.nombre_completo,
          rol_id: rolData.id,
          activo: true
        }])

        if (insertError) throw insertError
      }

      setMensaje({ tipo: 'exito', texto: 'Usuario creado correctamente.' })
      setTimeout(() => {
        setMostrarModal(false)
        setNuevoCap({ nombre_completo: '', email: '', password: '' })
        cargarCapacitadores()
        setMensaje(null)
      }, 2000)

    } catch (error) {
      setMensaje({ tipo: 'error', texto: error.message })
    } finally {
      setCreando(false)
    }
  }

  const abrirModalEditar = (cap) => {
    setNombreEditado(cap.nombre_completo)
    setModalEditar({ abierto: true, capacitador: cap })
  }

  const handleEditarCapacitador = async (e) => {
    e.preventDefault()
    if (!nombreEditado.trim()) return

    setProcesandoAccion(true)
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ nombre_completo: nombreEditado.trim() })
        .eq('id', modalEditar.capacitador.id)

      if (error) throw error

      setCapacitadores(prev => prev.map(c => 
        c.id === modalEditar.capacitador.id ? { ...c, nombre_completo: nombreEditado.trim() } : c
      ))
      setModalEditar({ abierto: false, capacitador: null })
      
    } catch (error) {
      console.error("Error al editar:", error)
    } finally {
      setProcesandoAccion(false)
    }
  }

  const intentarArchivar = (cap) => {
    if (cap.pendientes > 0) {
      setModalConfirmacion({
        abierto: true,
        titulo: 'No se puede archivar',
        mensaje: `No puedes archivar a ${cap.nombre_completo} porque tiene ${cap.pendientes} personas pendientes por evaluar.\n\nPara solucionarlo, haz clic en la tarjeta de sus "Pendientes" y reasígnalos a otro capacitador.`,
        tipo: 'alerta',
        capacitador: cap
      })
    } else {
      setModalConfirmacion({
        abierto: true,
        titulo: 'Archivar Capacitador',
        mensaje: `¿Estás seguro de que deseas archivar a ${cap.nombre_completo}? \nNo podrá recibir nuevas asignaciones, pero su historial se mantendrá intacto. Podrás reactivarlo más adelante si regresa.`,
        tipo: 'confirmar_archivar',
        capacitador: cap
      })
    }
  }

  const intentarReactivar = (cap) => {
    setModalConfirmacion({
      abierto: true,
      titulo: 'Reactivar Capacitador',
      mensaje: `¿Deseas volver a activar a ${cap.nombre_completo} en el sistema?`,
      tipo: 'confirmar_reactivar',
      capacitador: cap
    })
  }

  const ejecutarAccionConfirmada = async () => {
    setProcesandoAccion(true)
    const cap = modalConfirmacion.capacitador
    const activando = modalConfirmacion.tipo === 'confirmar_reactivar'

    try {
      const { error } = await supabase
        .from('usuarios')
        .update({ activo: activando })
        .eq('id', cap.id)

      if (error) throw error

      setCapacitadores(prev => prev.map(c => 
        c.id === cap.id ? { ...c, activo: activando } : c
      ))
      
      setModalConfirmacion({ abierto: false, titulo: '', mensaje: '', tipo: 'alerta', capacitador: null })
    } catch (error) {
      console.error("Error en la acción:", error)
    } finally {
      setProcesandoAccion(false)
    }
  }

  const abrirDetalle = async (cap, tipo) => {
    setModalDetalle({ abierto: true, tipo, capacitador: cap })
    setCargandoDetalle(true)
    setBusquedaDetalle('')
    setListaDetalle([])

    try {
      if (tipo === 'pendientes') {
        const { data } = await supabase
          .from('participantes')
          .select('id, nombres_apellidos, congregacion, estado, punto_programado, fecha_programada')
          .eq('capacitador_id', cap.id)
          .in('estado', ['pendiente', 'requiere_refuerzo', 'repetir_6_meses'])
          .order('fecha_programada', { ascending: true })
        
        if (data) setListaDetalle(data)
      } else {
        const { data } = await supabase
          .from('evaluaciones_lccs')
          .select(`
            id, creado_en, punto_metropolitana, resultado_aprobacion,
            participantes(nombres_apellidos, congregacion)
          `)
          .eq('capacitador_id', cap.id)
          .order('creado_en', { ascending: false })
        
        if (data) setListaDetalle(data)
      }
    } catch (error) {
      console.error("Error al cargar detalles:", error)
    } finally {
      setCargandoDetalle(false)
    }
  }

  // NUEVA FUNCIÓN: Reasignar Participante directamente desde el modal
  const handleReasignar = async (participanteId, nuevoCapacitadorId) => {
    if (!nuevoCapacitadorId) return;
    
    setReasignando(participanteId);

    try {
      const { error } = await supabase
        .from('participantes')
        .update({ capacitador_id: nuevoCapacitadorId })
        .eq('id', participanteId);

      if (error) throw error;

      // Actualizar la lista del modal (quitar al reasignado)
      setListaDetalle(prev => prev.filter(p => p.id !== participanteId));

      // Actualizar los contadores visuales en el fondo sin recargar todo
      setCapacitadores(prev => prev.map(c => {
        // Restar 1 al actual
        if (c.id === modalDetalle.capacitador.id) {
          return { ...c, pendientes: Math.max(0, c.pendientes - 1) }
        }
        // Sumar 1 al nuevo
        if (c.id === nuevoCapacitadorId) {
          return { ...c, pendientes: c.pendientes + 1 }
        }
        return c;
      }));

    } catch (error) {
      console.error("Error al reasignar:", error);
      alert("Hubo un error al intentar reasignar al participante.");
    } finally {
      setReasignando(null);
    }
  }

  const capacitadoresFiltrados = capacitadores.filter(c => {
    const coincideTexto = c.nombre_completo?.toLowerCase().includes(busqueda.toLowerCase());
    const coincideEstado = verArchivados ? c.activo === false : c.activo === true;
    return coincideTexto && coincideEstado;
  })

  const listaDetalleFiltrada = listaDetalle.filter(item => {
    const termino = busquedaDetalle.toLowerCase()
    const nombre = modalDetalle.tipo === 'pendientes' ? item.nombres_apellidos : item.participantes?.nombres_apellidos
    return nombre?.toLowerCase().includes(termino)
  })

  // Lista de capacitadores activos a los que se puede reasignar
  // Se excluye al capacitador actual
  const opcionesReasignacion = capacitadores.filter(c => 
    c.activo && c.id !== modalDetalle.capacitador?.id
  )

  const puedeModificar = rolUsuarioActual === 'administrador' || rolUsuarioActual === 'coordinador';

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Equipo de Trabajo</h2>
          <p className="text-gray-500 text-sm mt-1">Gestiona el personal y revisa su carga de trabajo.</p>
        </div>
        
        {puedeModificar && (
          <button 
            onClick={() => setMostrarModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center shadow-sm"
          >
            <UserPlus size={18} className="mr-2" />
            Nuevo Usuario
          </button>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-4 justify-between items-center">
        <div className="relative w-full">
          <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input 
            type="text" 
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-gray-50 border-transparent focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-xl outline-none transition-all"
          />
        </div>
        
        <button 
          onClick={() => setVerArchivados(!verArchivados)}
          className={`whitespace-nowrap flex items-center px-4 py-3 rounded-xl font-medium transition-colors border ${
            verArchivados ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
          }`}
        >
          {verArchivados ? <User size={18} className="mr-2" /> : <Archive size={18} className="mr-2" />}
          {verArchivados ? 'Ver Activos' : 'Ver Archivados'}
        </button>
      </div>

      {cargando ? (
        <div className="py-20 flex flex-col items-center justify-center text-gray-500">
          <Loader2 size={40} className="animate-spin text-blue-500 mb-4" />
          <p>Cargando información del equipo...</p>
        </div>
      ) : capacitadoresFiltrados.length === 0 ? (
        <div className="py-16 text-center bg-white rounded-2xl border border-dashed border-gray-200">
          <Shield size={48} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900">
            {verArchivados ? 'No hay usuarios archivados' : 'No se encontraron miembros activos'}
          </h3>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {capacitadoresFiltrados.map((cap) => {
            let puedeEditar = false;
            if (rolUsuarioActual === 'administrador') puedeEditar = true;
            if (rolUsuarioActual === 'coordinador' && cap.rol === 'capacitador') puedeEditar = true;

            return (
              <div key={cap.id} className={`bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden group border ${!cap.activo ? 'border-gray-300 opacity-75 grayscale-[0.5]' : 'border-gray-100'}`}>
                <div className={`absolute top-0 left-0 right-0 h-2 ${!cap.activo ? 'bg-gray-400' : cap.rol === 'coordinador' ? 'bg-purple-500' : 'bg-blue-500'}`}></div>
                
                <div className="flex items-start justify-between mb-4 mt-2">
                  <div className="pr-4">
                    <h3 className="text-lg font-bold text-gray-800 line-clamp-1" title={cap.nombre_completo}>
                      {cap.nombre_completo}
                    </h3>
                    <div className="flex items-center text-sm text-gray-500 mt-1">
                      <User size={14} className="mr-1.5 flex-shrink-0" />
                      <span className="capitalize">{cap.rol} {!cap.activo && '(Archivado)'}</span>
                    </div>
                  </div>
                  
                  {puedeEditar && (
                    <div className="flex space-x-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      {cap.activo ? (
                        <>
                          <button onClick={() => abrirModalEditar(cap)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Editar nombre">
                            <Edit2 size={16} />
                          </button>
                          <button onClick={() => intentarArchivar(cap)} className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors" title="Archivar usuario">
                            <Archive size={16} />
                          </button>
                        </>
                      ) : (
                        <button onClick={() => intentarReactivar(cap)} className="p-1.5 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Reactivar usuario">
                          <ArchiveRestore size={16} />
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-gray-50">
                  <button 
                    onClick={() => abrirDetalle(cap, 'pendientes')}
                    className="bg-orange-50 hover:bg-orange-100 rounded-xl p-3 text-left transition-colors cursor-pointer border border-transparent hover:border-orange-200"
                  >
                    <div className="flex items-center text-orange-700 mb-1">
                      <Clock size={14} className="mr-1.5" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Pendientes</span>
                    </div>
                    <p className="text-2xl font-bold text-orange-800">{cap.pendientes}</p>
                  </button>
                  
                  <button 
                    onClick={() => abrirDetalle(cap, 'realizadas')}
                    className="bg-green-50 hover:bg-green-100 rounded-xl p-3 text-left transition-colors cursor-pointer border border-transparent hover:border-green-200"
                  >
                    <div className="flex items-center text-green-700 mb-1">
                      <CheckCircle size={14} className="mr-1.5" />
                      <span className="text-xs font-semibold uppercase tracking-wider">Realizadas</span>
                    </div>
                    <p className="text-2xl font-bold text-green-800">{cap.completadas}</p>
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* MODAL GLOBAL DE CONFIRMACIÓN */}
      {modalConfirmacion.abierto && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800 flex items-center">
                {modalConfirmacion.tipo === 'alerta' ? <AlertCircle className="mr-2 text-red-500" /> : 
                 modalConfirmacion.tipo === 'confirmar_archivar' ? <Archive className="mr-2 text-orange-500" /> : 
                 <ArchiveRestore className="mr-2 text-green-500" />}
                {modalConfirmacion.titulo}
              </h3>
              <button 
                onClick={() => setModalConfirmacion({ ...modalConfirmacion, abierto: false })} 
                className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-lg shadow-sm"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6">
              <p className="text-gray-600 whitespace-pre-line leading-relaxed">
                {modalConfirmacion.mensaje}
              </p>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              {modalConfirmacion.tipo === 'alerta' ? (
                <button 
                  onClick={() => setModalConfirmacion({ ...modalConfirmacion, abierto: false })}
                  className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors"
                >
                  Entendido
                </button>
              ) : (
                <>
                  <button 
                    onClick={() => setModalConfirmacion({ ...modalConfirmacion, abierto: false })}
                    className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={ejecutarAccionConfirmada}
                    disabled={procesandoAccion}
                    className={`flex-1 px-4 py-3 text-white font-medium rounded-xl transition-colors flex justify-center items-center disabled:opacity-50 ${
                      modalConfirmacion.tipo === 'confirmar_archivar' ? 'bg-orange-600 hover:bg-orange-700' : 'bg-green-600 hover:bg-green-700'
                    }`}
                  >
                    {procesandoAccion ? <Loader2 size={18} className="animate-spin" /> : 
                     modalConfirmacion.tipo === 'confirmar_archivar' ? 'Sí, Archivar' : 'Sí, Reactivar'}
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETALLES DE PARTICIPANTES (AHORA CON OPCIÓN DE REASIGNAR) */}
      {modalDetalle.abierto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-start bg-gray-50 rounded-t-3xl">
              <div>
                <h3 className="text-xl font-bold text-gray-800 flex items-center">
                  {modalDetalle.tipo === 'pendientes' ? <Clock className="mr-2 text-orange-600" /> : <CheckCircle className="mr-2 text-green-600" />}
                  {modalDetalle.tipo === 'pendientes' ? 'Personas Pendientes' : 'Evaluaciones Realizadas'}
                </h3>
                <p className="text-sm text-gray-500 mt-1">Capacitador: <span className="font-semibold text-gray-700">{modalDetalle.capacitador?.nombre_completo}</span></p>
              </div>
              <button onClick={() => setModalDetalle({ abierto: false, tipo: null, capacitador: null })} className="text-gray-400 hover:text-gray-600 p-2 bg-white rounded-xl shadow-sm">
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-gray-100 bg-white">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Filtrar participante..."
                  value={busquedaDetalle}
                  onChange={(e) => setBusquedaDetalle(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 rounded-lg outline-none text-sm transition-all"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2 bg-gray-50/30">
              {cargandoDetalle ? (
                <div className="py-12 flex justify-center"><Loader2 className="animate-spin text-blue-500" size={30} /></div>
              ) : listaDetalleFiltrada.length === 0 ? (
                <div className="py-12 text-center text-gray-500 text-sm">No hay registros que mostrar.</div>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {listaDetalleFiltrada.map((item, idx) => (
                    <li key={item.id || idx} className="p-4 hover:bg-white transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      {modalDetalle.tipo === 'pendientes' ? (
                        <>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800">{item.nombres_apellidos}</span>
                            <span className="text-sm text-gray-500">{item.congregacion}</span>
                            <div className="mt-2 flex gap-2">
                              <span className="text-[11px] font-medium bg-blue-100 text-blue-800 px-2 py-0.5 rounded-md">{item.punto_programado || 'Sin punto asignado'}</span>
                              <span className="text-[11px] font-medium bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md">
                                {item.fecha_programada ? new Date(item.fecha_programada).toLocaleDateString() : 'Sin fecha'}
                              </span>
                            </div>
                          </div>

                          {/* SELECTOR PARA REASIGNAR (SOLO PARA PENDIENTES Y SI ES ADMIN/COORD) */}
                          {puedeModificar && (
                            <div className="min-w-[180px]">
                              {reasignando === item.id ? (
                                <div className="text-xs text-blue-600 flex items-center bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                  <RefreshCw size={12} className="animate-spin mr-1.5" /> Reasignando...
                                </div>
                              ) : (
                                <select 
                                  onChange={(e) => handleReasignar(item.id, e.target.value)}
                                  className="w-full text-xs p-2 border border-gray-200 rounded-lg bg-white text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent shadow-sm"
                                  defaultValue=""
                                >
                                  <option value="" disabled>Reasignar a...</option>
                                  {opcionesReasignacion.map(cap => (
                                    <option key={cap.id} value={cap.id}>
                                      {cap.nombre_completo}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="flex flex-col w-full">
                          <span className="font-bold text-gray-800">{item.participantes?.nombres_apellidos}</span>
                          <div className="flex items-center text-sm text-gray-500 mt-1">
                            <FileText size={14} className="mr-1" />
                            <span>Punto: {item.punto_metropolitana}</span>
                          </div>
                          <div className="mt-2 flex justify-between items-center">
                            <span className="text-[11px] font-bold uppercase px-2 py-0.5 rounded-md bg-green-100 text-green-800">
                              {item.resultado_aprobacion === 'aprobado' ? 'Aprobado' : item.resultado_aprobacion.replace('_', ' ')}
                            </span>
                            <span className="text-xs text-gray-400 font-medium">{new Date(item.creado_en).toLocaleDateString()}</span>
                          </div>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL EDITAR CAPACITADOR */}
      {modalEditar.abierto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">Editar Nombre</h3>
              <button onClick={() => setModalEditar({ abierto: false, capacitador: null })} className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-lg shadow-sm">
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleEditarCapacitador} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input 
                  type="text" required
                  value={nombreEditado}
                  onChange={(e) => setNombreEditado(e.target.value)}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                />
              </div>
              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setModalEditar({ abierto: false, capacitador: null })}
                  className="flex-1 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={procesandoAccion}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex justify-center items-center disabled:opacity-50"
                >
                  {procesandoAccion ? <Loader2 size={18} className="animate-spin" /> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL CREAR CAPACITADOR */}
      {mostrarModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="text-xl font-bold text-gray-800">Agregar Capacitador</h3>
              <button onClick={() => setMostrarModal(false)} className="text-gray-400 hover:text-gray-600 p-1 bg-white rounded-lg shadow-sm">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCrearCapacitador} className="p-6 space-y-4">
              {mensaje && (
                <div className={`p-3 rounded-lg text-sm font-medium flex items-center ${
                  mensaje.tipo === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
                }`}>
                  {mensaje.tipo === 'error' ? <AlertCircle size={16} className="mr-2" /> : <CheckCircle size={16} className="mr-2" />}
                  {mensaje.texto}
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nombre Completo</label>
                <input 
                  type="text" required
                  value={nuevoCap.nombre_completo}
                  onChange={(e) => setNuevoCap({...nuevoCap, nombre_completo: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  placeholder="Ej. Juan Pérez"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Correo Electrónico (Para Login)</label>
                <input 
                  type="email" required
                  value={nuevoCap.email}
                  onChange={(e) => setNuevoCap({...nuevoCap, email: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  placeholder="juan@ejemplo.com"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Temporal</label>
                <input 
                  type="text" required
                  value={nuevoCap.password}
                  onChange={(e) => setNuevoCap({...nuevoCap, password: e.target.value})}
                  className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all"
                  placeholder="Mínimo 6 caracteres"
                />
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setMostrarModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  disabled={creando}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors flex justify-center items-center disabled:opacity-50"
                >
                  {creando ? <Loader2 size={18} className="animate-spin" /> : 'Guardar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}