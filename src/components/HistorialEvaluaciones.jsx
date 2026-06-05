import { useState, useEffect, useMemo } from "react";
import { supabase } from "../supabaseClient";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  Activity,
  ShieldAlert,
  Download,
  Eye,
  X,
  CheckCircle2,
  XCircle,
  FileSpreadsheet,
  MapPin,
  AlertTriangle,
  Loader2,
  Phone,
  MessageCircle,
  RefreshCw,
  Calendar,
  Edit,
} from "lucide-react";

// Diccionario exacto basado en la LCCS - PPAM Oficial
const diccionarioPreguntas = {
  antes_1: "Antes: ¿Ya se comunicó con el participante?",
  antes_2:
    "Antes: ¿Le comunicó al Hombre clave para informarle de la capacitación y la disponibilidad del turno?",
  durante_req_1:
    "Requisitos: ¿Se repasaron los requisitos que deben cumplir los participantes?",
  durante_eq_1:
    "Equipo: ¿Se ha llevado al participante a conocer los lugares donde se guardan los exhibidores?",
  durante_eq_2:
    "Equipo: ¿Se enseña a cómo transportar correctamente los exhibidores?",
  durante_eq_3:
    "Equipo: ¿Se le enseña a enrollar y guardar correctamente el forro protector del exhibidor?",
  durante_eq_4: "Equipo: ¿Se muestra cómo usar los elementos de limpieza?",
  durante_eq_5:
    "Equipo: ¿Se explica la forma correcta de organizar las publicaciones y su indicación?",
  durante_eq_6:
    "Equipo: ¿Se muestra qué cosas se guardan en la pequeña bodega que hay detrás del exhibidor?",
  durante_seg_1:
    "Seguridad: ¿Se enseña la forma correcta de ubicar los exhibidores para que nadie se acerque por detrás?",
  durante_seg_2:
    "Seguridad: ¿Se explica cómo actuar ante un perturbador y qué hacer?",
  durante_seg_3:
    "Seguridad: ¿Se le ayuda a ver la importancia de la seguridad personal?",
  durante_tur_1: "Turnos: ¿El participante llegó puntual a la cita?",
  durante_tur_2:
    "Turnos: ¿Se le explica la importancia de estar comprometidos con la asignación?",
  durante_tur_3:
    "Turnos: ¿Se le ayuda a saber qué hacer en caso de no poder cumplir el turno?",
  durante_tur_4: "Turnos: ¿Se le explica cómo abordar a las personas?",
  durante_tur_5:
    "Turnos: ¿Durante el turno, sonríe y tiene contacto visual con las personas?",
  durante_tur_6:
    "Turnos: ¿Repasó la información sobre cómo iniciar conversaciones de forma natural?",
  durante_tur_7: "Turnos: ¿Sabe cómo direccionar a las personas al sitio web?",
  durante_tur_8:
    "Turnos: ¿No habla demasiado con los demás participantes del turno?",
  durante_tur_9: "Turnos: ¿Aprendió a usar las herramientas digitales?",
  informe_1: "Informe: ¿Se le ha informado al participante la decisión?",
  informe_2: "Informe: ¿Se le informó al hombre clave y encargado de punto?",
  informe_3:
    "Informe: ¿Se informó al comité de servicio si requiere capacitación en 6 meses?",
  informe_4:
    "Informe: ¿Se informó al comité de servicio del participante que no fue aprobado?",
};

const obtenerTextoPregunta = (clave) => {
  if (diccionarioPreguntas[clave]) return diccionarioPreguntas[clave];
  return clave.replace(/_/g, " ").replace(/\b\w/g, (l) => l.toUpperCase());
};

const traducirEstado = (estado) => {
  const diccionario = {
    aprobado: { texto: "Aprobado", color: "text-green-700 bg-green-100" },
    requiere_refuerzo: {
      texto: "Refuerzo (1m)",
      color: "text-yellow-700 bg-yellow-100",
    },
    repetir_6_meses: {
      texto: "Repetir (6m)",
      color: "text-orange-700 bg-orange-100",
    },
    no_cumple: { texto: "No cumple", color: "text-red-700 bg-red-100" },
  };
  return (
    diccionario[estado] || { texto: estado, color: "text-gray-700 bg-gray-100" }
  );
};

export default function HistorialEvaluaciones({ setPestanaActiva }) {
  const [evaluaciones, setEvaluaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState(null);

  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("todas");
  const [filtroModificados, setFiltroModificados] = useState(false);
  const [paginaActual, setPaginaActual] = useState(1);
  const [rolUsuario, setRolUsuario] = useState("");

  // ESTADOS DEL MODAL DE TRAMITE
  const [modalTramite, setModalTramite] = useState({
    abierto: false,
    evaluacion: null,
    esParaQuitar: false,
  });
  const [guardandoTurno, setGuardandoTurno] = useState(false);

  const itemsPorPagina = 10;

  const traerDatos = async (sesionActual = null, rolActual = null) => {
    setCargando(true);
    try {
      const {
        data: { session },
      } = sesionActual
        ? { data: { session: sesionActual } }
        : await supabase.auth.getSession();

      if (!session) return;

      let userRol = rolActual;

      if (!userRol) {
        const { data: userData, error: errorRol } = await supabase
          .from("usuarios")
          .select("roles(nombre)")
          .eq("id", session.user.id)
          .maybeSingle();

        if (errorRol) throw errorRol;

        userRol = userData?.roles?.nombre?.toLowerCase() || "";
        setRolUsuario(userRol);
      }

      if (
        ![
          "administrador",
          "coordinador",
          "superintendente",
          "capacitador",
          "escritorio",
        ].includes(userRol)
      ) {
        setAccesoDenegado(true);
        return;
      }

      let query = supabase
        .from("evaluaciones_lccs")
        .select(
          `
        *,
        participantes(id, nombres_apellidos, congregacion, ciudad, categoria, punto_fijo, telefono, fecha_programada),
        usuarios(nombre_completo)
      `,
        )
        .order("creado_en", { ascending: false });

      if (userRol === "capacitador") {
        query = query.eq("capacitador_id", session.user.id);
      }

      const { data, error } = await query;
      if (error) throw error;

      if (data) setEvaluaciones(data);
    } catch (error) {
      console.error("Error al traer datos:", error);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    void traerDatos();
  }, []);

  const evaluacionesFiltradas = useMemo(() => {
    if (!evaluaciones) return [];

    let filtradas = evaluaciones;

    // 1. Filtro por Categoría
    if (filtroCategoria !== "todas") {
      filtradas = filtradas.filter(
        (ev) => ev.participantes?.categoria === filtroCategoria,
      );
    }

    // 2. Filtro por Modificados
    if (filtroModificados) {
      filtradas = filtradas.filter(
        (ev) => ev.fecha_edicion !== null && ev.fecha_edicion !== undefined,
      );
    }

    // 3. Filtro por Texto (Búsqueda)
    return filtradas.filter((ev) => {
      const termino = busqueda.toLowerCase();
      const participante = (
        ev.participantes?.nombres_apellidos || ""
      ).toLowerCase();
      const capacitador = (ev.usuarios?.nombre_completo || "").toLowerCase();
      const punto = (ev.punto_metropolitana || "").toLowerCase();
      const congregacion = (ev.participantes?.congregacion || "").toLowerCase();
      const ciudad = (ev.participantes?.ciudad || "").toLowerCase();

      return (
        participante.includes(termino) ||
        capacitador.includes(termino) ||
        punto.includes(termino) ||
        congregacion.includes(termino) ||
        ciudad.includes(termino)
      );
    });
  }, [evaluaciones, busqueda, filtroCategoria, filtroModificados]);

  const totalPaginas = Math.ceil(evaluacionesFiltradas.length / itemsPorPagina);
  const evaluacionesPaginadas = evaluacionesFiltradas.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina,
  );

  const manejarBusqueda = (e) => {
    setBusqueda(e.target.value);
    setPaginaActual(1);
  };

  // === LÓGICA DEL MODAL DE TRAMITE ===
  const abrirModalTramite = (ev) => {
    if (rolUsuario !== "escritorio") return;

    const estaTramitado = !!ev.participantes?.punto_fijo;
    setModalTramite({
      abierto: true,
      evaluacion: ev,
      esParaQuitar: estaTramitado,
    });
  };

  const confirmarTramite = async () => {
    setGuardandoTurno(true);
    const { evaluacion, esParaQuitar } = modalTramite;
    const nuevoValor = esParaQuitar ? null : "Tramitado";

    const { error } = await supabase
      .from("participantes")
      .update({ punto_fijo: nuevoValor })
      .eq("id", evaluacion.participante_id);

    if (!error) {
      setModalTramite({
        abierto: false,
        evaluacion: null,
        esParaQuitar: false,
      });
      // ACTUALIZAR AUTOMÁTICAMENTE
      await traerDatos(null, rolUsuario);
    } else {
      console.error("Error al tramitar:", error);
      alert("Hubo un error al actualizar el estado del participante.");
    }
    setGuardandoTurno(false);
  };

  // === FUNCIÓN: EXPORTAR A CSV (NUEVA ESTRUCTURA) ===
  const exportarCSV = () => {
    if (evaluacionesFiltradas.length === 0) return;

    const encabezados = [
      "Fecha Asignacion",
      "Fecha Capacitacion",
      "Participante",
      "Categoria",
      "Ciudad",
      "Congregacion",
      "Punto Metropolitano (Donde Evaluó)",
      "Capacitador",
      "Tramitado por Escritorio",
      "Resultado Final",
      "Tipo Capacitacion",
    ];

    const filas = evaluacionesFiltradas.map((ev) => {
      const limpiar = (texto) => {
        if (!texto) return '""';
        return `"${texto.toString().replace(/"/g, '""').replace(/\n/g, " ")}"`;
      };

      let categoria = ev.participantes?.categoria || "No especificada";
      if (categoria === "nuevo") categoria = "NUEVO";
      else if (categoria === "viejo_sin_punto") categoria = "ANTIGUO SIN PUNTO";
      else if (categoria === "viejo_punto_fijo")
        categoria = "ANTIGUO CON PUNTO";

      const estaTramitadoStr = ev.participantes?.punto_fijo ? "SÍ" : "NO";
      const fechaAsig = ev.participantes?.fecha_programada
        ? new Date(ev.participantes.fecha_programada).toLocaleDateString()
        : "Sin asignar";
      const fechaCap = ev.fecha_capacitacion
        ? new Date(ev.fecha_capacitacion).toLocaleDateString()
        : new Date(ev.creado_en).toLocaleDateString();

      return [
        limpiar(fechaAsig),
        limpiar(fechaCap),
        limpiar(ev.participantes?.nombres_apellidos),
        limpiar(categoria),
        limpiar(ev.participantes?.ciudad),
        limpiar(ev.participantes?.congregacion),
        limpiar(ev.punto_metropolitana),
        limpiar(ev.usuarios?.nombre_completo),
        limpiar(estaTramitadoStr),
        limpiar(traducirEstado(ev.resultado_aprobacion).texto),
        limpiar(ev.tipo_capacitacion),
      ].join(",");
    });

    const contenidoCSV = [encabezados.join(","), ...filas].join("\n");
    const blob = new Blob(["\uFEFF" + contenidoCSV], {
      type: "text/csv;charset=utf-8;",
    });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);

    link.setAttribute("href", url);
    link.setAttribute(
      "download",
      `Historial_Evaluaciones_${new Date().toISOString().split("T")[0]}.csv`,
    );
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generarPDF = (ev) => {
    let htmlContent = `
      <html>
        <head>
          <title>Evaluación - ${ev.participantes?.nombres_apellidos}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 40px; color: #333; line-height: 1.6; max-width: 800px; margin: 0 auto; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 20px; margin-bottom: 30px; }
            .title { font-size: 24px; font-weight: bold; color: #1e40af; margin: 0 0 10px 0; }
            .subtitle { font-size: 14px; color: #64748b; margin: 0; }
            .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 40px; background: #f8fafc; padding: 20px; border-radius: 8px; border: 1px solid #e2e8f0; }
            .info-item strong { display: block; font-size: 12px; color: #64748b; text-transform: uppercase; margin-bottom: 4px; }
            .section-title { font-size: 16px; font-weight: bold; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px; color: #1e293b; }
            .response-item { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f1f5f9; page-break-inside: avoid; }
            .response-q { width: 80%; font-size: 14px; }
            .response-a { font-weight: bold; }
            .a-yes { color: #16a34a; } .a-no { color: #dc2626; }
            .obs-box { background: #fefce8; border: 1px solid #fef08a; padding: 15px; border-radius: 8px; margin-top: 30px; page-break-inside: avoid; }
            .result-box { margin-top: 40px; padding: 20px; text-align: center; border: 2px solid #e2e8f0; border-radius: 8px; font-size: 18px; font-weight: bold; background: #f8fafc; }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Informe de Capacitación LCCS</h1>
            <p class="subtitle">Programa de Predicación Pública en Áreas Metropolitanas</p>
          </div>
          <div class="info-grid">
            <div class="info-item"><strong>Participante Evaluado</strong>${ev.participantes?.nombres_apellidos}</div>
            <div class="info-item"><strong>Capacitador / Supervisor</strong>${ev.usuarios?.nombre_completo}</div>
            <div class="info-item"><strong>Punto Metropolitano</strong>${ev.punto_metropolitana || "No especificado"}</div>
            <div class="info-item"><strong>Fecha Asignación</strong>${ev.participantes?.fecha_programada ? new Date(ev.participantes.fecha_programada).toLocaleDateString() : "Sin asignar"}</div>
            <div class="info-item"><strong>Fecha Capacitación</strong>${ev.fecha_capacitacion ? new Date(ev.fecha_capacitacion).toLocaleDateString() : new Date(ev.creado_en).toLocaleDateString()}</div>
            <div class="info-item"><strong>Congregación</strong>${ev.participantes?.congregacion || "No especificada"}</div>
            <div class="info-item"><strong>Ciudad</strong>${ev.participantes?.ciudad || "No especificada"}</div>
          </div>

          <h2 class="section-title">Respuestas del Checklist</h2>
    `;

    if (ev.respuestas && typeof ev.respuestas === "object") {
      const clavesIgnoradas = [
        "participante",
        "capacitador_id",
        "capacitador",
        "id",
        "fecha",
        "observaciones_finales",
      ];

      Object.entries(ev.respuestas).forEach(([clave, valor]) => {
        if (
          !clavesIgnoradas.some((ignorada) =>
            clave.toLowerCase().includes(ignorada),
          )
        ) {
          const nombreBonito = obtenerTextoPregunta(clave);
          let valorFormateado = valor;
          let claseColor = "";

          if (valor === true || valor === "Sí" || valor === "Cumple") {
            valorFormateado = "SÍ";
            claseColor = "a-yes";
          } else if (
            valor === false ||
            valor === "No" ||
            valor === "No Cumple"
          ) {
            valorFormateado = "NO";
            claseColor = "a-no";
          }

          htmlContent += `
            <div class="response-item">
              <div class="response-q">${nombreBonito}</div>
              <div class="response-a ${claseColor}">${valorFormateado}</div>
            </div>
          `;
        }
      });
    }

    if (ev.observaciones_finales) {
      htmlContent += `
        <div class="obs-box">
          <strong>Observaciones del Capacitador:</strong><br/>
          <p style="margin-top: 8px; font-size: 14px;">${ev.observaciones_finales}</p>
        </div>
      `;
    }

    const estadoFinal = traducirEstado(ev.resultado_aprobacion);
    htmlContent += `
          <div class="result-box" style="border-color: ${estadoFinal.texto === "Aprobado" ? "#16a34a" : "#dc2626"}; color: ${estadoFinal.texto === "Aprobado" ? "#16a34a" : "#dc2626"}">
            Resultado Final de la Capacitación: ${estadoFinal.texto.toUpperCase()}
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open("", "_blank");
    printWindow.document.write(htmlContent);
    printWindow.document.close();

    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  if (cargando && evaluaciones.length === 0)
    return (
      <div className="h-full flex items-center justify-center">
        <Activity className="animate-spin mr-2 text-blue-600" /> Cargando
        historial...
      </div>
    );

  if (accesoDenegado) {
    return (
      <div className="bg-red-50 border border-red-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto mt-10">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-800 mb-2">
          Acceso Restringido
        </h2>
        <p className="text-red-600">
          No tienes los permisos necesarios para ver el historial completo del
          departamento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {rolUsuario === "capacitador"
              ? "Mis Evaluaciones Realizadas"
              : "Historial de Evaluaciones"}
          </h1>
          <p className="text-gray-500 mt-1">
            {rolUsuario === "capacitador"
              ? "Consulta y descarga los resultados de las personas que has evaluado."
              : "Consulta y visualiza los resultados detallados de todas los informes de capacitación."}
          </p>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => traerDatos(null, rolUsuario)}
            disabled={cargando}
            className="flex items-center justify-center px-4 py-2 bg-white border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-blue-600 rounded-xl shadow-sm transition-colors text-sm font-medium disabled:opacity-50"
            title="Actualizar tabla"
          >
            <RefreshCw
              size={16}
              className={`mr-2 ${cargando ? "animate-spin text-blue-600" : ""}`}
            />
            {cargando ? "Actualizando..." : "Actualizar"}
          </button>

          {evaluacionesFiltradas.length > 0 && (
            <button
              onClick={exportarCSV}
              className="flex items-center justify-center px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-sm transition-colors font-medium text-sm"
            >
              <FileSpreadsheet size={18} className="mr-2" />
              Exportar a Excel (CSV)
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* BARRA DE FILTROS SUPERIOR */}
        <div className="p-6 border-b border-gray-100 flex flex-col gap-4 bg-slate-50">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                size={18}
              />
              <input
                type="text"
                placeholder="Buscar por nombre, congregación, ciudad, punto..."
                value={busqueda}
                onChange={manejarBusqueda}
                className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-full"
              />
            </div>
            <div className="text-sm text-gray-500 font-medium">
              Total: {evaluacionesFiltradas.length} registros
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-2">
            <button
              onClick={() => {
                setFiltroCategoria("todas");
                setPaginaActual(1);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${filtroCategoria === "todas" ? "bg-slate-700 text-white shadow" : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"}`}
            >
              Todos
            </button>
            <button
              onClick={() => {
                setFiltroCategoria("nuevo");
                setPaginaActual(1);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${filtroCategoria === "nuevo" ? "bg-emerald-600 text-white shadow" : "bg-white border border-gray-200 text-emerald-700 hover:bg-emerald-50"}`}
            >
              Nuevos
            </button>
            <button
              onClick={() => {
                setFiltroCategoria("viejo_sin_punto");
                setPaginaActual(1);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${filtroCategoria === "viejo_sin_punto" ? "bg-amber-500 text-white shadow" : "bg-white border border-gray-200 text-amber-700 hover:bg-amber-50"}`}
            >
              Antiguos Sin Punto
            </button>
            <button
              onClick={() => {
                setFiltroCategoria("viejo_punto_fijo");
                setPaginaActual(1);
              }}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${filtroCategoria === "viejo_punto_fijo" ? "bg-indigo-600 text-white shadow" : "bg-white border border-gray-200 text-indigo-700 hover:bg-indigo-50"}`}
            >
              Antiguos Con Punto
            </button>
            {["administrador", "coordinador", "superintendente"].includes(
              rolUsuario,
            ) && (
              <button
                onClick={() => {
                  setFiltroModificados(!filtroModificados);
                  setPaginaActual(1);
                }}
                className={`ml-2 px-3 py-1.5 text-xs font-bold rounded-full transition-colors flex items-center ${filtroModificados ? "bg-purple-600 text-white shadow" : "bg-white border border-gray-200 text-purple-700 hover:bg-purple-50"}`}
                title="Ver evaluaciones que han sido modificadas"
              >
                <Edit size={14} className="mr-1" /> Modificados
              </button>
            )}
          </div>
        </div>

        {/* TABLA PRINCIPAL */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-gray-500 text-sm border-b border-gray-100">
                <th className="p-4 font-semibold">Participante Evaluado</th>
                <th className="p-4 font-semibold">Categoría</th>
                <th className="p-4 font-semibold w-48">Capacitador / Fecha</th>
                <th className="p-4 font-semibold">Resultado</th>

                {/* COLUMNA "ACCIONES" SOLO PARA ROLES SUPERIORES */}
                {["administrador", "coordinador", "superintendente"].includes(
                  rolUsuario,
                ) && (
                  <th className="p-4 font-semibold text-center w-24">
                    Acciones
                  </th>
                )}

                <th className="p-4 font-semibold text-center">
                  Tramitar Participante
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {evaluacionesPaginadas.length === 0 ? (
                <tr>
                  <td colSpan="6" className="p-8 text-center text-gray-500">
                    No se encontraron evaluaciones con este filtro.
                  </td>
                </tr>
              ) : (
                evaluacionesPaginadas.map((ev) => {
                  const est = traducirEstado(ev.resultado_aprobacion);
                  let categoria =
                    ev.participantes?.categoria || "no_especificada";
                  let bgBadge = "bg-gray-100 text-gray-700 border-gray-200";
                  let textoBadge = "No especificado";

                  if (categoria === "nuevo") {
                    bgBadge =
                      "bg-emerald-50 text-emerald-700 border-emerald-200";
                    textoBadge = "NUEVO";
                  } else if (categoria === "viejo_sin_punto") {
                    bgBadge = "bg-amber-50 text-amber-700 border-amber-200";
                    textoBadge = "ANTIGUO SIN PUNTO";
                  } else if (categoria === "viejo_punto_fijo") {
                    bgBadge = "bg-indigo-50 text-indigo-700 border-indigo-200";
                    textoBadge = "ANTIGUO CON PUNTO";
                  }

                  const estaTramitado = !!ev.participantes?.punto_fijo;
                  const puedeEditarTramite = rolUsuario === "escritorio";
                  const puedeVerAcciones = [
                    "administrador",
                    "coordinador",
                    "superintendente",
                  ].includes(rolUsuario);

                  return (
                    <tr
                      key={ev.id}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="p-4">
                        <div className="font-bold text-gray-800 text-base">
                          {ev.participantes?.nombres_apellidos}
                        </div>
                        <div className="text-gray-500 text-xs mt-1">
                          {ev.participantes?.congregacion} •{" "}
                          {ev.participantes?.ciudad}
                        </div>

                        {/* BOTONES SUTILES DE CONTACTO */}
                        <div className="flex gap-2 mt-2">
                          <a
                            href={`tel:${ev.participantes?.telefono || ""}`}
                            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                              ev.participantes?.telefono
                                ? "bg-gray-100 hover:bg-blue-100 text-gray-500 hover:text-blue-600"
                                : "bg-gray-50 text-gray-300 cursor-not-allowed"
                            }`}
                            title={
                              ev.participantes?.telefono
                                ? `Llamar al ${ev.participantes.telefono}`
                                : "Sin teléfono"
                            }
                            onClick={(e) =>
                              !ev.participantes?.telefono && e.preventDefault()
                            }
                          >
                            <Phone size={14} />
                          </a>

                          <a
                            href={`https://wa.me/57${(ev.participantes?.telefono || "").replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`p-1.5 rounded-md flex items-center justify-center transition-colors ${
                              ev.participantes?.telefono
                                ? "bg-gray-100 hover:bg-green-100 text-gray-500 hover:text-green-600"
                                : "bg-gray-50 text-gray-300 cursor-not-allowed"
                            }`}
                            title={
                              ev.participantes?.telefono
                                ? "Enviar mensaje por WhatsApp"
                                : "Sin teléfono"
                            }
                            onClick={(e) =>
                              !ev.participantes?.telefono && e.preventDefault()
                            }
                          >
                            <MessageCircle size={14} />
                          </a>
                        </div>
                      </td>
                      <td className="p-4 align-top pt-5">
                        <span
                          className={`px-2.5 py-1 rounded-md text-[10px] font-bold border ${bgBadge} whitespace-nowrap`}
                        >
                          {textoBadge}
                        </span>
                      </td>
                      <td className="p-4 align-top pt-5">
                        <div className="text-gray-800 font-bold mb-2">
                          {ev.usuarios?.nombre_completo}
                        </div>
                        <div className="text-gray-500 text-xs flex items-center mb-1">
                          <MapPin size={10} className="mr-1 text-gray-400" />{" "}
                          {ev.punto_metropolitana || "Sin punto"}
                        </div>

                        {/* LAS DOS FECHAS SOLICITADAS */}
                        <div className="flex flex-col gap-1 mt-2 bg-gray-50 p-2 rounded border border-gray-100">
                          <div
                            className="text-gray-500 text-xs flex items-center justify-between"
                            title="Fecha Asignada"
                          >
                            <span className="flex items-center">
                              <Calendar
                                size={10}
                                className="mr-1 text-gray-400"
                              />{" "}
                              Asig:
                            </span>
                            <span className="font-semibold text-gray-600">
                              {ev.participantes?.fecha_programada
                                ? new Date(
                                    ev.participantes.fecha_programada,
                                  ).toLocaleDateString()
                                : "---"}
                            </span>
                          </div>
                          <div
                            className="text-gray-500 text-xs flex items-center justify-between"
                            title="Fecha Real de Capacitación"
                          >
                            <span className="flex items-center">
                              <CheckCircle2
                                size={10}
                                className="mr-1 text-green-500"
                              />{" "}
                              Cap:
                            </span>
                            <span className="font-bold text-gray-700">
                              {ev.fecha_capacitacion
                                ? new Date(
                                    ev.fecha_capacitacion,
                                  ).toLocaleDateString()
                                : new Date(ev.creado_en).toLocaleDateString()}
                            </span>
                          </div>
                        </div>
                        {/* AVISO DE MODIFICACIÓN */}
                        {ev.fecha_edicion &&
                          [
                            "administrador",
                            "coordinador",
                            "superintendente",
                          ].includes(rolUsuario) && (
                            <div className="mt-2 bg-purple-50 border border-purple-100 rounded p-1.5 text-[10px] text-purple-800">
                              <span className="font-bold flex items-center mb-0.5">
                                <Edit size={10} className="mr-1" /> Editado por:
                              </span>
                              <span
                                className="truncate block"
                                title={ev.editor_nombre}
                              >
                                {ev.editor_nombre}
                              </span>
                              <span className="text-[9px] text-purple-600">
                                {new Date(
                                  ev.fecha_edicion,
                                ).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                      </td>
                      <td className="p-4 align-top pt-5">
                        <span
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap ${est.color}`}
                        >
                          {est.texto}
                        </span>
                      </td>

                      {/* BOTONES DE ACCIÓN SOLO PARA ROLES SUPERIORES */}
                      {puedeVerAcciones && (
                        <td className="p-4 align-top pt-5">
                          <div className="flex items-center justify-center space-x-2">
                            <button
                              onClick={() =>
                                setPestanaActiva &&
                                setPestanaActiva("Informe de Capacitación", ev)
                              }
                              className="p-2 bg-gray-100 hover:bg-blue-100 text-gray-600 hover:text-blue-700 rounded-lg transition-colors"
                              title="Editar Evaluación"
                            >
                              <Eye size={18} />
                            </button>
                            <button
                              onClick={() => generarPDF(ev)}
                              className="p-2 bg-gray-100 hover:bg-emerald-100 text-gray-600 hover:text-emerald-700 rounded-lg transition-colors"
                              title="Descargar Informe LCCS en PDF"
                            >
                              <Download size={18} />
                            </button>
                          </div>
                        </td>
                      )}

                      {/* COLUMNA "TRAMITAR PARTICIPANTE" PARA TODOS (con permisos restringidos) */}
                      <td className="p-4 text-center align-top pt-5">
                        {estaTramitado ? (
                          <button
                            onClick={() => abrirModalTramite(ev)}
                            disabled={!puedeEditarTramite}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                              puedeEditarTramite
                                ? "bg-orange-100 text-orange-700 border-orange-200 hover:bg-orange-200 cursor-pointer"
                                : "bg-orange-50 text-orange-800/60 border-orange-100 cursor-default opacity-80"
                            }`}
                            title={
                              !puedeEditarTramite
                                ? "Solo el rol Escritorio puede editar esto"
                                : ""
                            }
                          >
                            Tramitado por Escritorio
                          </button>
                        ) : (
                          <button
                            onClick={() => abrirModalTramite(ev)}
                            disabled={!puedeEditarTramite}
                            className={`px-3 py-1.5 rounded-full text-xs font-bold transition-colors border ${
                              puedeEditarTramite
                                ? "bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200 cursor-pointer"
                                : "bg-gray-50 text-gray-400 border-gray-100 cursor-default opacity-80"
                            }`}
                            title={
                              !puedeEditarTramite
                                ? "Solo el rol Escritorio puede editar esto"
                                : ""
                            }
                          >
                            No Tramitado
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="p-4 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-4 bg-gray-50">
            <span className="text-sm text-gray-500 font-medium">
              Mostrando {(paginaActual - 1) * itemsPorPagina + 1} a{" "}
              {Math.min(
                paginaActual * itemsPorPagina,
                evaluacionesFiltradas.length,
              )}{" "}
              de {evaluacionesFiltradas.length}
            </span>
            <div className="flex space-x-2">
              <button
                onClick={() => setPaginaActual((prev) => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1}
                className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>
              <button
                onClick={() =>
                  setPaginaActual((prev) => Math.min(prev + 1, totalPaginas))
                }
                disabled={paginaActual === totalPaginas}
                className="px-3 py-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* === MODAL CONFIRMAR TRAMITE === */}
      {modalTramite.abierto && modalTramite.evaluacion && (
        <div className="fixed inset-0 bg-black/60 z-[110] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              <div
                className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${modalTramite.esParaQuitar ? "bg-gray-100 text-gray-500" : "bg-orange-100 text-orange-500"}`}
              >
                <CheckCircle2 size={32} />
              </div>

              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {modalTramite.esParaQuitar
                  ? "¿Quitar estado de Tramitado?"
                  : "¿Confirmar Trámite?"}
              </h3>

              <p className="text-sm text-gray-600 mb-6 px-2">
                {modalTramite.esParaQuitar
                  ? `Vas a marcar a ${modalTramite.evaluacion.participantes?.nombres_apellidos} como "No Tramitado".`
                  : `¿Estás seguro/a de marcar a ${modalTramite.evaluacion.participantes?.nombres_apellidos} como "Tramitado por Escritorio"?`}
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() =>
                    setModalTramite({
                      abierto: false,
                      evaluacion: null,
                      esParaQuitar: false,
                    })
                  }
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarTramite}
                  disabled={guardandoTurno}
                  className={`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 ${
                    modalTramite.esParaQuitar
                      ? "bg-gray-600 hover:bg-gray-700"
                      : "bg-orange-500 hover:bg-orange-600"
                  }`}
                >
                  {guardandoTurno ? (
                    <Loader2 size={18} className="animate-spin" />
                  ) : (
                    "Sí, confirmar"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* === MODAL DETALLES === */}
      {evaluacionSeleccionada && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex justify-end">
          <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-slate-50 sticky top-0 z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-800">
                  Detalles de Evaluación
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Realizada el{" "}
                  {new Date(
                    evaluacionSeleccionada.creado_en,
                  ).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => setEvaluacionSeleccionada(null)}
                className="p-2 text-gray-400 hover:bg-gray-200 hover:text-gray-600 rounded-full transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <div className="p-8 overflow-y-auto flex-1 custom-scrollbar">
              <div className="grid grid-cols-2 gap-4 mb-8">
                <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                  <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-1">
                    Participante Evaluado
                  </span>
                  <span className="font-bold text-gray-800 text-lg">
                    {evaluacionSeleccionada.participantes?.nombres_apellidos}
                  </span>
                  <div className="text-sm text-gray-500 mt-1">
                    {evaluacionSeleccionada.participantes?.congregacion}
                  </div>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <span className="text-xs font-bold text-blue-400 uppercase tracking-wider block mb-1">
                    Capacitador
                  </span>
                  <span className="font-bold text-blue-900 text-lg">
                    {evaluacionSeleccionada.usuarios?.nombre_completo}
                  </span>
                  <div className="text-sm text-blue-600 mt-1 flex items-center">
                    <MapPin size={12} className="mr-1" />{" "}
                    {evaluacionSeleccionada.punto_metropolitana ||
                      "Sin punto registrado"}
                  </div>
                </div>
              </div>

              <div className="mb-10">
                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center border-b border-gray-100 pb-2">
                  <CheckCircle2 className="text-green-500 mr-2" /> Respuestas
                  del Formulario LCCS
                </h3>
                <div className="space-y-3 bg-white border border-gray-100 rounded-xl p-1">
                  {Object.entries(evaluacionSeleccionada.respuestas || {})
                    .filter(
                      ([clave]) =>
                        ![
                          "participante",
                          "capacitador_id",
                          "capacitador",
                          "id",
                          "fecha",
                          "observaciones_finales",
                        ].some((ignorada) =>
                          clave.toLowerCase().includes(ignorada),
                        ),
                    )
                    .map(([clave, valor], idx) => {
                      const respondioSi =
                        valor === true || valor === "Sí" || valor === "Cumple";
                      const respondioNo =
                        valor === false ||
                        valor === "No" ||
                        valor === "No Cumple";
                      return (
                        <div
                          key={idx}
                          className="flex justify-between items-start p-3 hover:bg-gray-50 rounded-lg transition-colors border-b border-gray-50 last:border-0"
                        >
                          <span className="text-sm text-gray-600 w-4/5 leading-relaxed pr-4">
                            {obtenerTextoPregunta(clave)}
                          </span>
                          <span
                            className={`text-sm font-bold flex items-center ${respondioSi ? "text-green-600 bg-green-50 px-3 py-1 rounded-lg" : respondioNo ? "text-red-600 bg-red-50 px-3 py-1 rounded-lg" : "text-gray-800 bg-gray-100 px-3 py-1 rounded-lg"}`}
                          >
                            {respondioSi ? (
                              <CheckCircle2 size={16} className="mr-1.5" />
                            ) : respondioNo ? (
                              <XCircle size={16} className="mr-1.5" />
                            ) : null}
                            {respondioSi ? "SÍ" : respondioNo ? "NO" : valor}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="mb-8">
                <h3 className="text-lg font-bold text-gray-800 mb-3 border-b border-gray-100 pb-2">
                  Observaciones Finales
                </h3>
                <div className="bg-yellow-50/50 border border-yellow-200 p-5 rounded-xl text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
                  {evaluacionSeleccionada.observaciones_finales || (
                    <span className="text-gray-400 italic">
                      El capacitador no dejó observaciones adicionales.
                    </span>
                  )}
                </div>
              </div>

              <div className="mt-8 border-t border-gray-100 pt-6">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider block mb-3 text-center">
                  Decisión del Capacitador
                </span>
                <div
                  className={`p-4 rounded-xl text-center border font-bold text-lg ${traducirEstado(evaluacionSeleccionada.resultado_aprobacion).color.replace("text-", "border-").replace("bg-", "bg-").split(" ")[1]}`}
                >
                  {traducirEstado(
                    evaluacionSeleccionada.resultado_aprobacion,
                  ).texto.toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
