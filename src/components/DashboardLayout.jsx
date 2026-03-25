import { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { LogOut, Menu, X, Users, ClipboardList, LayoutDashboard, Settings, FileSpreadsheet, FileText, Calendar, Activity } from 'lucide-react'
import ImportadorSheets from './ImportadorSheets'
import FormularioLCCS from './FormularioLCCS'
import TableroParticipantes from './TableroParticipantes'
import InicioDashboard from './InicioDashboard'
import ConfiguracionPerfil from './ConfiguracionPerfil'
import HistorialEvaluaciones from './HistorialEvaluaciones'
import AsignacionParticipantes from './AsignacionParticipantes'

export default function DashboardLayout({ userEmail }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [activeMenu, setActiveMenu] = useState('Inicio')
  const [datosEvaluacion, setDatosEvaluacion] = useState(null)
  const [rolUsuario, setRolUsuario] = useState(null)
  const [cargandoRol, setCargandoRol] = useState(true)

  const handleCambioPestana = (menu, datosOpcionales = null) => {
    setActiveMenu(menu)
    setDatosEvaluacion(datosOpcionales)
    setSidebarOpen(false)
  }

  useEffect(() => {
    const obtenerRol = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('roles(nombre)')
          .eq('id', session.user.id)
          .single()
        
        setRolUsuario(userData?.roles?.nombre?.toLowerCase() || 'capacitador')
      }
      setCargandoRol(false)
    }
    obtenerRol()
  }, [])

  // Menú completo. Usamos la propiedad 'rolesPermitidos' para decidir quién lo ve
  const menuItemsCompleto = [
    { name: 'Inicio', icon: LayoutDashboard, rolesPermitidos: ['administrador', 'coordinador', 'capacitador'] },
    { name: 'Historial Evaluaciones', icon: FileText, rolesPermitidos: ['administrador', 'coordinador', 'capacitador'] },
    { name: 'Listas de Chequeo', icon: ClipboardList, rolesPermitidos: ['administrador', 'coordinador', 'capacitador'] },
    { name: 'Participantes', icon: Users, rolesPermitidos: ['administrador', 'coordinador'] },
    { name: 'Programación', icon: Calendar, rolesPermitidos: ['administrador', 'coordinador'] },
    { name: 'Importar Sheets', icon: FileSpreadsheet, rolesPermitidos: ['administrador'] },
    { name: 'Configuración', icon: Settings, rolesPermitidos: ['administrador', 'coordinador', 'capacitador'] },
  ]

  // Filtramos el menú según el rol que tenga la persona
  const menuItems = menuItemsCompleto.filter(item => 
    rolUsuario && item.rolesPermitidos.includes(rolUsuario)
  )

  if (cargandoRol) return <div className="h-screen flex items-center justify-center bg-gray-50"><Activity className="animate-spin text-blue-600 mr-2" /> Cargando...</div>

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Botón menú móvil */}
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white rounded-md shadow-md"
        onClick={() => setSidebarOpen(!sidebarOpen)}
      >
        {sidebarOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Sidebar (Barra Lateral) */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="h-full flex flex-col">
          {/* Logo/Título */}
          <div className="h-16 flex items-center px-6 border-b border-gray-200">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
              <ClipboardList size={20} className="text-white" />
            </div>
            <span className="text-xl font-bold text-gray-800">LCCS App</span>
          </div>

          {/* Menú de Navegación */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon
              const isActive = activeMenu === item.name
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActiveMenu(item.name)
                    setSidebarOpen(false)
                  }}
                  className={`w-full flex items-center px-4 py-3 rounded-xl transition-colors ${
                    isActive 
                      ? 'bg-blue-50 text-blue-700 font-semibold' 
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon size={20} className={`mr-3 ${isActive ? 'text-blue-700' : 'text-gray-400'}`} />
                  {item.name}
                </button>
              )
            })}
          </nav>

          {/* Usuario y Cerrar Sesión */}
          <div className="p-4 border-t border-gray-200">
            <div className="px-4 py-3 mb-2 rounded-xl bg-gray-50 flex flex-col">
              <span className="text-xs text-gray-500 font-medium uppercase">
                {rolUsuario}
              </span>
              <span className="text-sm font-semibold text-gray-800 truncate">{userEmail}</span>
            </div>
            <button
              onClick={() => supabase.auth.signOut()}
              className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl transition-colors font-medium"
            >
              <LogOut size={20} className="mr-3" />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </aside>

      {/* Área Principal de Contenido */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8">
          <h1 className="text-xl font-semibold text-gray-800 pl-10 lg:pl-0">{activeMenu}</h1>
        </header>

        <div className="flex-1 overflow-auto p-8 bg-slate-50">
          <div className="max-w-[1400px] mx-auto h-full">
            {activeMenu === 'Inicio' ? (
              // 1. CAMBIAMOS setActiveMenu POR handleCambioPestana
              <InicioDashboard userName={userEmail} setPestanaActiva={handleCambioPestana} />
            ) : activeMenu === 'Historial Evaluaciones' ? (
              <HistorialEvaluaciones />
            ) : activeMenu === 'Participantes' ? (
              <TableroParticipantes />
            ) : activeMenu === 'Programación' ? (
              <AsignacionParticipantes />
            ) : activeMenu === 'Listas de Chequeo' ? (
              <FormularioLCCS preDatos={datosEvaluacion} />
            ) : activeMenu === 'Importar Sheets' ? (
              <ImportadorSheets />
            ) : activeMenu === 'Configuración' ? (
              <ConfiguracionPerfil userEmail={userEmail} />
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center">Módulo no encontrado</div>
            )}
          </div>
        </div>
      </main>

      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  )
}