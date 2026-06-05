import { useState, useEffect } from "react";
import { supabase } from "../supabaseClient";
import {
  LogOut,
  Menu,
  X,
  Users,
  ClipboardList,
  LayoutDashboard,
  Settings,
  FileSpreadsheet,
  FileText,
  Calendar,
  Activity,
  UserCheck,
  Send,
  QrCode,
  UserCog,
} from "lucide-react";

// Importación de todos los módulos/pantallas del sistema
import GestorNuevosParticipantes from "./GestorNuevosParticipantes";
import FormularioLCCS from "./FormularioLCCS";
import TableroParticipantes from "./TableroParticipantes";
import InicioDashboard from "./InicioDashboard";
import ConfiguracionPerfil from "./ConfiguracionPerfil";
import HistorialEvaluaciones from "./HistorialEvaluaciones";
import AsignacionParticipantes from "./AsignacionParticipantes";
import CapacitadoresList from "./CapacitadoresList";
import GeneradorInvitacionQR from "./GeneradorInvitacionQR";
import ScannerOrientacion from "./ScannerOrientacion";
import GestionUsuarios from "./GestionUsuarios";

// Hook personalizado que cierra la sesión automáticamente por inactividad
import useAutoLogout from "./useAutoLogout";

export default function DashboardLayout({ userEmail }) {
  // Activa el cierre automático de sesión por inactividad
  useAutoLogout();

  // Controla si el sidebar está abierto en móvil
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Guarda cuál pantalla está activa actualmente
  const [activeMenu, setActiveMenu] = useState("Inicio");

  // Datos opcionales que se pasan al FormularioLCCS (p.ej. cuando se edita una evaluación)
  const [datosEvaluacion, setDatosEvaluacion] = useState(null);

  // Rol del usuario logueado (administrador, coordinador, capacitador, escritorio)
  const [rolUsuario, setRolUsuario] = useState(null);

  // Evita mostrar el menú antes de saber qué rol tiene el usuario
  const [cargandoRol, setCargandoRol] = useState(true);

  // Función central de navegación: cambia la pantalla activa y opcionalmente
  // pasa datos (ej: al navegar desde Historial a editar un formulario)
  const handleCambioPestana = (menu, datosOpcionales = null) => {
    setActiveMenu(menu);
    setDatosEvaluacion(datosOpcionales);
    setSidebarOpen(false); // Cierra el sidebar en móvil al navegar
  };

  useEffect(() => {
    const obtenerRol = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        // Consultamos la tabla 'usuarios' para obtener el rol del usuario logueado
        const { data: userData } = await supabase
          .from("usuarios")
          .select("roles(nombre)") // Join con la tabla 'roles'
          .eq("id", session.user.id) // Solo el registro del usuario actual
          .single();

        const roleName =
          userData?.roles?.nombre?.toLowerCase() || "capacitador";
        setRolUsuario(roleName);

        // El rol 'escritorio' solo puede ver el historial — redirigimos automáticamente
        if (roleName === "escritorio") {
          setActiveMenu("Historial Evaluaciones");
        }
      }
      setCargandoRol(false);
    };
    obtenerRol();
  }, []);

  // Definición completa del menú con control de acceso por rol.
  // Cada ítem declara qué roles pueden verlo en 'rolesPermitidos'.
  const menuItemsCompleto = [
    {
      name: "Inicio",
      icon: LayoutDashboard,
      rolesPermitidos: ["administrador", "coordinador", "capacitador"],
    },
    {
      name: "Historial Evaluaciones",
      icon: FileText,
      rolesPermitidos: [
        "administrador",
        "coordinador",
        "capacitador",
        "escritorio",
      ],
    },
    {
      name: "Informe de Capacitación",
      icon: ClipboardList,
      rolesPermitidos: ["administrador", "coordinador", "capacitador"],
    },
    {
      name: "Participantes",
      icon: Users,
      rolesPermitidos: ["administrador", "coordinador"],
    },
    {
      name: "Programación",
      icon: Calendar,
      rolesPermitidos: ["administrador", "coordinador"],
    },
    {
      name: "Capacitadores",
      icon: UserCheck,
      rolesPermitidos: ["administrador", "coordinador"],
    },
    {
      name: "Gestión Usuarios",
      icon: UserCog,
      rolesPermitidos: ["administrador"],
    },
    {
      name: "Invitaciones QR",
      icon: Send,
      rolesPermitidos: [
        "administrador",
        "escritorio",
        "coordinador",
        "superintendente",
      ],
    },
    {
      name: "Scanner Orientación",
      icon: QrCode,
      rolesPermitidos: ["administrador", "escritorio", "superintendente"],
    },
    {
      name: "Nuevos Participantes",
      icon: FileSpreadsheet,
      rolesPermitidos: ["administrador"],
    },
    {
      name: "Configuración",
      icon: Settings,
      rolesPermitidos: [
        "administrador",
        "coordinador",
        "capacitador",
        "escritorio",
      ],
    },
  ];

  // Filtramos el menú para mostrar solo los ítems permitidos para el rol actual
  const menuItems = menuItemsCompleto.filter(
    (item) => rolUsuario && item.rolesPermitidos.includes(rolUsuario),
  );

  // Pantalla de carga mientras se consulta el rol en Supabase
  if (cargandoRol)
    return (
      <div className="h-screen flex items-center justify-center bg-gray-50">
        <Activity className="animate-spin text-blue-600 mr-2" /> Cargando...
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* ── SIDEBAR (Barra Lateral de Navegación) ── */}
      {/* En móvil se oculta/muestra con translate. En desktop siempre está visible (lg:static) */}
      <aside
        className={`
        fixed lg:static inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
      `}
      >
        <div className="h-full flex flex-col relative">
          {/* Logo del sistema + botón de cerrar sidebar en móvil */}
          <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
            <div className="flex items-center">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center mr-3">
                <ClipboardList size={20} className="text-white" />
              </div>
              <span className="text-xl font-bold text-gray-800">DC APP</span>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-md"
            >
              <X size={20} />
            </button>
          </div>

          {/* Lista de opciones del menú, filtrada según el rol */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeMenu === item.name;
              return (
                <button
                  key={item.name}
                  onClick={() => {
                    setActiveMenu(item.name);
                    setSidebarOpen(false);
                  }}
                  // El ítem activo se resalta en azul
                  className={`w-full flex items-center text-left px-4 py-3 rounded-xl transition-colors overflow-hidden ${
                    isActive
                      ? "bg-blue-50 text-blue-700 font-semibold"
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon
                    size={20}
                    className={`flex-shrink-0 mr-3 ${isActive ? "text-blue-700" : "text-gray-400"}`}
                  />
                  <span className="truncate">{item.name}</span>
                </button>
              );
            })}
          </nav>

          {/* Pie del sidebar: muestra el rol, nombre del usuario y botón de cerrar sesión */}
          <div className="p-4 border-t border-gray-200">
            <div className="px-4 py-3 mb-2 rounded-xl bg-gray-50 flex flex-col">
              <span className="text-xs text-gray-500 font-medium uppercase">
                {rolUsuario}
              </span>
              <span className="text-sm font-semibold text-gray-800 truncate">
                {userEmail}
              </span>
            </div>
            {/* signOut() limpia la sesión de Supabase y App.jsx redirige al Login */}
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

      {/* ── ÁREA PRINCIPAL DE CONTENIDO ── */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        {/* Header superior con botón hamburguesa (solo móvil) y título de la pantalla activa */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center px-4 lg:px-8">
          <button
            className="lg:hidden p-2 mr-4 text-gray-600 hover:bg-gray-100 rounded-md"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={24} />
          </button>
          <h1 className="text-xl font-semibold text-gray-800">{activeMenu}</h1>
        </header>

        {/* Zona de contenido desplazable */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 bg-slate-50">
          <div className="max-w-[1400px] mx-auto h-full">
            {/* 
      Router interno: según el valor de activeMenu se renderiza 
      el componente correspondiente. No usa React Router,
      todo el enrutamiento es manejado con estado local.
    */}
            {activeMenu === "Inicio" ? (
              <InicioDashboard
                userName={userEmail}
                setPestanaActiva={handleCambioPestana}
              />
            ) : activeMenu === "Historial Evaluaciones" ? (
              <HistorialEvaluaciones setPestanaActiva={handleCambioPestana} />
            ) : activeMenu === "Participantes" ? (
              <TableroParticipantes />
            ) : activeMenu === "Programación" ? (
              <AsignacionParticipantes />
            ) : activeMenu === "Capacitadores" ? (
              <CapacitadoresList />
            ) : activeMenu === "Gestión Usuarios" ? (
              <GestionUsuarios />
            ) : activeMenu === "Invitaciones QR" ? (
              <GeneradorInvitacionQR />
            ) : activeMenu === "Scanner Orientación" ? (
              <ScannerOrientacion />
            ) : activeMenu === "Informe de Capacitación" ? (
              <FormularioLCCS
                preDatos={datosEvaluacion}
                setPestanaActiva={handleCambioPestana}
              />
            ) : activeMenu === "Nuevos Participantes" ? (
              <GestorNuevosParticipantes />
            ) : activeMenu === "Configuración" ? (
              <ConfiguracionPerfil userEmail={userEmail} />
            ) : (
              <div className="bg-white rounded-2xl p-8 text-center">
                Módulo no encontrado: "{activeMenu}"
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Overlay oscuro detrás del sidebar en móvil — al tocarlo lo cierra */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-30 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
