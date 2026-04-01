import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../supabaseClient'
import { 
  Search, ChevronLeft, ChevronRight, Activity, ShieldAlert, Download, 
  Eye, X, CheckCircle2, XCircle, FileSpreadsheet, MapPin, AlertTriangle, Loader2 
} from 'lucide-react'

// Puntos fijos de PPAM
const PUNTOS_METROPOLITANA = [
  'Cali- AVIANCA',
  'Cali- BUITRERA',
  'Cali- CANCHAS PANAMERICANAS',
  'Cali- CARRERA OCTAVA',
  'Cali- CAM',
  'Cali- GOBERNACIÓN DEL VALLE',
  'Cali- IMBANACO',
  'Cali- LA 14 CALIMA',
  'Cali- PLAZA CAYZEDO',
  'Jamundí',
  'Palmira- BOLIVAR',
  'Palmira- LA FACTORÍA',
  'Yumbo'
];

// Diccionario exacto basado en la LCCS - PPAM Oficial
const diccionarioPreguntas = {
  antes_1: "Antes: ¿Ya se comunicó con el participante?",
  antes_2: "Antes: ¿Le comunicó al Hombre clave para informarle de la capacitación y la disponibilidad del turno?",
  durante_req_1: "Requisitos: ¿Se repasaron los requisitos que deben cumplir los participantes?",
  durante_eq_1: "Equipo: ¿Se ha llevado al participante a conocer los lugares donde se guardan los exhibidores?",
  durante_eq_2: "Equipo: ¿Se enseña a cómo transportar correctamente los exhibidores?",
  durante_eq_3: "Equipo: ¿Se le enseña a enrollar y guardar correctamente el forro protector del exhibidor?",
  durante_eq_4: "Equipo: ¿Se muestra cómo usar los elementos de limpieza?",
  durante_eq_5: "Equipo: ¿Se explica la forma correcta de organizar las publicaciones y su indicación?",
  durante_eq_6: "Equipo: ¿Se muestra qué cosas se guardan en la pequeña bodega que hay detrás del exhibidor?",
  durante_seg_1: "Seguridad: ¿Se enseña la forma correcta de ubicar los exhibidores para que nadie se acerque por detrás?",
  durante_seg_2: "Seguridad: ¿Se explica cómo actuar ante un perturbador y qué hacer?",
  durante_seg_3: "Seguridad: ¿Se le ayuda a ver la importancia de la seguridad personal?",
  durante_tur_1: "Turnos: ¿El participante llegó puntual a la cita?",
  durante_tur_2: "Turnos: ¿Se le explica la importancia de estar comprometidos con la asignación?",
  durante_tur_3: "Turnos: ¿Se le ayuda a saber qué hacer en caso de no poder cumplir el turno?",
  durante_tur_4: "Turnos: ¿Se le explica cómo abordar a las personas?",
  durante_tur_5: "Turnos: ¿Durante el turno, sonríe y tiene contacto visual con las personas?",
  durante_tur_6: "Turnos: ¿Repasó la información sobre cómo iniciar conversaciones de forma natural?",
  durante_tur_7: "Turnos: ¿Sabe cómo direccionar a las personas al sitio web?",
  durante_tur_8: "Turnos: ¿No habla demasiado con los demás participantes del turno?",
  durante_tur_9: "Turnos: ¿Aprendió a usar las herramientas digitales?",
  informe_1: "Informe: ¿Se le ha informado al participante la decisión?",
  informe_2: "Informe: ¿Se le informó al hombre clave y encargado de punto?",
  informe_3: "Informe: ¿Se informó al comité de servicio si requiere capacitación en 6 meses?",
  informe_4: "Informe: ¿Se informó al comité de servicio del participante que no fue aprobado?"
};

const obtenerTextoPregunta = (clave) => {
  if (diccionarioPreguntas[clave]) return diccionarioPreguntas[clave];
  return clave.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

const traducirEstado = (estado) => {
  const diccionario = {
    aprobado: { texto: 'Aprobado', color: 'text-green-700 bg-green-100' },
    requiere_refuerzo: { texto: 'Refuerzo (1m)', color: 'text-yellow-700 bg-yellow-100' },
    repetir_6_meses: { texto: 'Repetir (6m)', color: 'text-orange-700 bg-orange-100' },
    no_cumple: { texto: 'No cumple', color: 'text-red-700 bg-red-100' },
  }
  return diccionario[estado] || { texto: estado, color: 'text-gray-700 bg-gray-100' }
}

export default function HistorialEvaluaciones() {
  const [evaluaciones, setEvaluaciones] = useState([])
  const [cargando, setCargando] = useState(true)
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [evaluacionSeleccionada, setEvaluacionSeleccionada] = useState(null)
  
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('todas')
  const [paginaActual, setPaginaActual] = useState(1)
  const [rolUsuario, setRolUsuario] = useState('') 

  // NUEVOS ESTADOS PARA ASIGNAR/REMOVER TURNO FIJO
  const [modalTurno, setModalTurno] = useState({ abierto: false, tipo: null, evaluacion: null, puntoSeleccionado: '' })
  const [guardandoTurno, setGuardandoTurno] = useState(false)
  
  const itemsPorPagina = 10

  useEffect(() => {
    const verificarPermisosYTraerDatos = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const { data: userData } = await supabase
        .from('usuarios')
        .select('roles(nombre)')
        .eq('id', session.user.id)
        .single()

      const rol = userData?.roles?.nombre?.toLowerCase() || ''
      setRolUsuario(rol)

      if (rol !== 'administrador' && rol !== 'coordinador' && rol !== 'superintendente' && rol !== 'capacitador') {
        setAccesoDenegado(true)
        setCargando(false)
        return
      }

      let query = supabase
        .from('evaluaciones_lccs')
        .select(`
          *,
          participantes(id, nombres_apellidos, congregacion, ciudad, categoria, punto_fijo),
          usuarios(nombre_completo)
        `)
        .order('creado_en', { ascending: false })

      if (rol === 'capacitador') {
        query = query.eq('capacitador_id', session.user.id)
      }

      const { data } = await query

      if (data) setEvaluaciones(data)
      setCargando(false)
    }

    verificarPermisosYTraerDatos()
  }, [])

  const evaluacionesFiltradas = useMemo(() => {
    if (!evaluaciones) return []
    
    let filtradas = evaluaciones;
    if (filtroCategoria !== 'todas') {
      filtradas = filtradas.filter(ev => ev.participantes?.categoria === filtroCategoria);
    }

    return filtradas.filter(ev => {
      const termino = busqueda.toLowerCase()
      const participante = (ev.participantes?.nombres_apellidos || '').toLowerCase()
      const capacitador = (ev.usuarios?.nombre_completo || '').toLowerCase()
      const punto = (ev.punto_metropolitana || '').toLowerCase()
      const congregacion = (ev.participantes?.congregacion || '').toLowerCase()
      const ciudad = (ev.participantes?.ciudad || '').toLowerCase()

      return participante.includes(termino) || 
             capacitador.includes(termino) || 
             punto.includes(termino) ||
             congregacion.includes(termino) ||
             ciudad.includes(termino)
    })
  }, [evaluaciones, busqueda, filtroCategoria])

  const totalPaginas = Math.ceil(evaluacionesFiltradas.length / itemsPorPagina)
  const evaluacionesPaginadas = evaluacionesFiltradas.slice(
    (paginaActual - 1) * itemsPorPagina,
    paginaActual * itemsPorPagina
  )

  const manejarBusqueda = (e) => {
    setBusqueda(e.target.value)
    setPaginaActual(1)
  }

  // === LÓGICA PARA POPUP DE ASIGNACIÓN DE TURNO ===
  const abrirModalTurno = (ev) => {
    const tieneTurno = !!ev.participantes?.punto_fijo;
    setModalTurno({
      abierto: true,
      tipo: tieneTurno ? 'remover' : 'asignar',
      evaluacion: ev,
      puntoSeleccionado: tieneTurno ? ev.participantes.punto_fijo : ''
    });
  };

  const confirmarCambioTurno = async () => {
    setGuardandoTurno(true);
    const { evaluacion, tipo, puntoSeleccionado } = modalTurno;
    const nuevoPunto = tipo === 'asignar' ? puntoSeleccionado : null;

    // Actualizamos al participante en la BD
    const { error } = await supabase
      .from('participantes')
      .update({ punto_fijo: nuevoPunto })
      .eq('id', evaluacion.participante_id);

    if (!error) {
      // Actualizamos el estado local en TODAS las evaluaciones de ese participante
      setEvaluaciones(prev => prev.map(item => {
        if (item.participante_id === evaluacion.participante_id) {
          return {
            ...item,
            participantes: { ...item.participantes, punto_fijo: nuevoPunto }
          };
        }
        return item;
      }));
      setModalTurno({ abierto: false, tipo: null, evaluacion: null, puntoSeleccionado: '' });
    } else {
      console.error("Error al actualizar el turno:", error);
      alert("Hubo un error al actualizar el turno del participante.");
    }
    setGuardandoTurno(false);
  };

  // === FUNCIÓN: EXPORTAR A CSV ===
  const exportarCSV = () => {
    if (evaluacionesFiltradas.length === 0) return;

    const encabezados = [
      "Fecha Evaluacion",
      "Participante",
      "Categoria",
      "Ciudad",
      "Congregacion",
      "Punto Metropolitano (Donde Evaluó)",
      "Capacitador",
      "Turno Asignado",
      "Punto Asignado",
      "Resultado Final",
      "Tipo Capacitacion",
      "Observaciones"
    ];

    const filas = evaluacionesFiltradas.map(ev => {
      const limpiar = (texto) => {
        if (!texto) return '""';
        return `"${texto.toString().replace(/"/g, '""').replace(/\n/g, ' ')}"`;
      };

      let categoria = ev.participantes?.categoria || 'No especificada';
      if (categoria === 'nuevo') categoria = 'NUEVO';
      else if (categoria === 'viejo_sin_punto') categoria = 'ANTIGUO SIN PUNTO';
      else if (categoria === 'viejo_punto_fijo') categoria = 'ANTIGUO CON PUNTO';

      const tieneTurnoStr = ev.participantes?.punto_fijo ? 'SÍ' : 'NO';
      const puntoFijoStr = ev.participantes?.punto_fijo || 'Sin asignar';

      return [
        limpiar(new Date(ev.creado_en).toLocaleDateString()),
        limpiar(ev.participantes?.nombres_apellidos),
        limpiar(categoria),
        limpiar(ev.participantes?.ciudad),
        limpiar(ev.participantes?.congregacion),
        limpiar(ev.punto_metropolitana),
        limpiar(ev.usuarios?.nombre_completo),
        limpiar(tieneTurnoStr),
        limpiar(puntoFijoStr),
        limpiar(traducirEstado(ev.resultado_aprobacion).texto),
        limpiar(ev.tipo_capacitacion),
        limpiar(ev.observaciones_finales)
      ].join(',');
    });

    const contenidoCSV = [encabezados.join(','), ...filas].join('\n');
    const blob = new Blob(['\uFEFF' + contenidoCSV], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `Historial_Evaluaciones_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
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
            <div class="info-item"><strong>Punto Metropolitano</strong>${ev.punto_metropolitana || 'No especificado'}</div>
            <div class="info-item"><strong>Fecha de Evaluación</strong>${new Date(ev.creado_en).toLocaleDateString()}</div>
            <div class="info-item"><strong>Congregación</strong>${ev.participantes?.congregacion || 'No especificada'}</div>
            <div class="info-item"><strong>Ciudad</strong>${ev.participantes?.ciudad || 'No especificada'}</div>
          </div>

          <h2 class="section-title">Respuestas del Checklist</h2>
    `;

    if (ev.respuestas && typeof ev.respuestas === 'object') {
      const clavesIgnoradas = ['participante', 'capacitador_id', 'capacitador', 'id', 'fecha', 'observaciones_finales'];
      
      Object.entries(ev.respuestas).forEach(([clave, valor]) => {
        if (!clavesIgnoradas.some(ignorada => clave.toLowerCase().includes(ignorada))) {
          const nombreBonito = obtenerTextoPregunta(clave);
          let valorFormateado = valor;
          let claseColor = '';
          
          if (valor === true || valor === 'Sí' || valor === 'Cumple') { valorFormateado = 'SÍ'; claseColor = 'a-yes'; }
          else if (valor === false || valor === 'No' || valor === 'No Cumple') { valorFormateado = 'NO'; claseColor = 'a-no'; }

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
          <div class="result-box" style="border-color: ${estadoFinal.texto === 'Aprobado' ? '#16a34a' : '#dc2626'}; color: ${estadoFinal.texto === 'Aprobado' ? '#16a34a' : '#dc2626'}">
            Resultado Final de la Capacitación: ${estadoFinal.texto.toUpperCase()}
          </div>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    printWindow.document.write(htmlContent);
    printWindow.document.close();
    
    setTimeout(() => {
      printWindow.print();
    }, 250);
  }

  if (cargando) return <div className="h-full flex items-center justify-center"><Activity className="animate-spin mr-2 text-blue-600" /> Cargando historial...</div>

  if (accesoDenegado) {
    return (
      <div className="bg-red-50 border border-red-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto mt-10">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-800 mb-2">Acceso Restringido</h2>
        <p className="text-red-600">No tienes los permisos necesarios para ver el historial completo del departamento.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 pb-10 relative">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            {rolUsuario === 'capacitador' ? 'Mis Evaluaciones Realizadas' : 'Historial de Evaluaciones'}
          </h1>
          <p className="text-gray-500 mt-1">
            {rolUsuario === 'capacitador' 
              ? 'Consulta y descarga los resultados de las personas que has evaluado.' 
              : 'Consulta y visualiza los resultados detallados de todas los informes de capacitación.'}
          </p>
        </div>

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

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* BARRA DE FILTROS SUPERIOR */}
        <div className="p-6 border-b border-gray-100 flex flex-col gap-4 bg-slate-50">
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="relative w-full sm:w-96">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
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
              onClick={() => { setFiltroCategoria('todas'); setPaginaActual(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${filtroCategoria === 'todas' ? 'bg-slate-700 text-white shadow' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              Todos
            </button>
            <button 
              onClick={() => { setFiltroCategoria('nuevo'); setPaginaActual(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${filtroCategoria === 'nuevo' ? 'bg-emerald-600 text-white shadow' : 'bg-white border border-gray-200 text-emerald-700 hover:bg-emerald-50'}`}
            >
              Nuevos
            </button>
            <button 
              onClick={() => { setFiltroCategoria('viejo_sin_punto'); setPaginaActual(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${filtroCategoria === 'viejo_sin_punto' ? 'bg-amber-500 text-white shadow' : 'bg-white border border-gray-200 text-amber-700 hover:bg-amber-50'}`}
            >
              Antiguos Sin Punto
            </button>
            <button 
              onClick={() => { setFiltroCategoria('viejo_punto_fijo'); setPaginaActual(1); }}
              className={`px-3 py-1.5 text-xs font-bold rounded-full transition-colors ${filtroCategoria === 'viejo_punto_fijo' ? 'bg-indigo-600 text-white shadow' : 'bg-white border border-gray-200 text-indigo-700 hover:bg-indigo-50'}`}
            >
              Antiguos Con Punto
            </button>
          </div>

        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[900px]">
            <thead>
              <tr className="bg-white text-gray-500 text-sm border-b border-gray-100">
                <th className="p-4 font-semibold">Fecha</th>
                <th className="p-4 font-semibold">Participante</th>
                <th className="p-4 font-semibold">Detalles</th>
                {rolUsuario !== 'capacitador' && <th className="p-4 font-semibold">Capacitador</th>}
                <th className="p-4 font-semibold text-center">Turno Asignado</th>
                <th className="p-4 font-semibold">Punto Asignado</th>
                <th className="p-4 font-semibold">Resultado</th>
                <th className="p-4 font-semibold text-center">Acciones</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-gray-100">
              {evaluacionesPaginadas.length === 0 ? (
                <tr>
                  <td colSpan={rolUsuario === 'capacitador' ? 7 : 8} className="p-8 text-center text-gray-500">
                    No se encontraron evaluaciones con esos criterios.
                  </td>
                </tr>
              ) : (
                evaluacionesPaginadas.map(ev => {
                  const est = traducirEstado(ev.resultado_aprobacion)
                  const cat = ev.participantes?.categoria;
                  
                  let bgBadge = "bg-gray-100 text-gray-700 border-gray-200";
                  let textoBadge = "No especificado";

                  if (cat === 'nuevo') {
                    bgBadge = "bg-emerald-50 text-emerald-700 border-emerald-200";
                    textoBadge = "NUEVO";
                  } else if (cat === 'viejo_sin_punto') {
                    bgBadge = "bg-amber-50 text-amber-700 border-amber-200";
                    textoBadge = "ANTIGUO SIN PUNTO";
                  } else if (cat === 'viejo_punto_fijo') {
                    bgBadge = "bg-indigo-50 text-indigo-700 border-indigo-200";
                    textoBadge = "ANTIGUO CON PUNTO";
                  }

                  const tienePuntoFijo = !!ev.participantes?.punto_fijo;

                  return (
                    <tr key={ev.id} className="hover:bg-gray-50 transition-colors">
                      <td className="p-4 text-gray-600 font-medium whitespace-nowrap">
                        {new Date(ev.creado_en).toLocaleDateString()}
                      </td>
                      <td className="p-4 min-w-[200px]">
                        <div className="font-bold text-gray-800">{ev.participantes?.nombres_apellidos}</div>
                        <span className={`inline-block mt-1 border ${bgBadge} text-[9px] font-bold px-1.5 py-0.5 rounded uppercase`}>
                          {textoBadge}
                        </span>
                      </td>
                      <td className="p-4 min-w-[150px]">
                        <div className="text-gray-800 text-xs font-semibold bg-gray-100 px-2 py-1 rounded w-fit">{ev.punto_metropolitana}</div>
                        <div className="text-xs text-gray-500 mt-1">{ev.participantes?.ciudad} • {ev.participantes?.congregacion}</div>
                      </td>
                      {rolUsuario !== 'capacitador' && (
                        <td className="p-4 text-gray-600 min-w-[150px]">{ev.usuarios?.nombre_completo}</td>
                      )}
                      <td className="p-4 text-center">
                        <div className="flex justify-center">
                          <input 
                            type="checkbox" 
                            checked={tienePuntoFijo}
                            onChange={() => abrirModalTurno(ev)}
                            className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500 cursor-pointer shadow-sm"
                            title="Haz clic para asignar o quitar un turno fijo"
                          />
                        </div>
                      </td>
                      <td className="p-4 min-w-[180px]">
                        {tienePuntoFijo ? (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200">
                            <MapPin size={12} className="mr-1.5" />
                            {ev.participantes.punto_fijo}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-gray-100 text-gray-500 border border-gray-200">
                            Sin asignar
                          </span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap ${est.color}`}>
                          {est.texto}
                        </span>
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <button 
                            onClick={() => setEvaluacionSeleccionada(ev)}
                            className="p-2 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Ver detalles del Checklist"
                          >
                            <Eye size={18} />
                          </button>
                          
                          <button 
                            onClick={() => generarPDF(ev)}
                            className="p-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors"
                            title="Descargar PDF"
                          >
                            <Download size={18} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPaginas > 1 && (
          <div className="p-4 flex items-center justify-between bg-white border-t border-gray-100">
            <span className="text-sm text-gray-500 font-medium">
              Página {paginaActual} de {totalPaginas}
            </span>
            <div className="flex space-x-2">
              <button 
                onClick={() => setPaginaActual(prev => Math.max(prev - 1, 1))}
                disabled={paginaActual === 1}
                className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronLeft size={18} />
              </button>
              <button 
                onClick={() => setPaginaActual(prev => Math.min(prev + 1, totalPaginas))}
                disabled={paginaActual === totalPaginas}
                className="p-2 border border-gray-200 rounded-lg bg-white text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ==============================================
          POPUP DE ASIGNACIÓN/REANUDACIÓN DE TURNO FIJO 
          ============================================== */}
      {modalTurno.abierto && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl animate-in fade-in zoom-in duration-200">
            <div className="p-6 text-center">
              {/* Icono animado y distintivo arriba */}
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 ${modalTurno.tipo === 'asignar' ? 'bg-blue-100 text-blue-600' : 'bg-orange-100 text-orange-600'}`}>
                {modalTurno.tipo === 'asignar' ? <MapPin size={32} /> : <AlertTriangle size={32} />}
              </div>
              
              <h3 className="text-xl font-bold text-gray-800 mb-2">
                {modalTurno.tipo === 'asignar' ? '¿Asignar Turno Fijo?' : '¿Remover Turno Fijo?'}
              </h3>
              
              <p className="text-sm text-gray-500 mb-6">
                {modalTurno.tipo === 'asignar' 
                  ? `¿Está seguro/a que a ${modalTurno.evaluacion.participantes?.nombres_apellidos} ya se le asignó turno?`
                  : `¿Está seguro de que ${modalTurno.evaluacion.participantes?.nombres_apellidos} ya no cuenta con un turno fijo?`
                }
              </p>

              {modalTurno.tipo === 'asignar' && (
                <div className="text-left mb-6">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Seleccione el punto asignado:</label>
                  <select 
                    value={modalTurno.puntoSeleccionado}
                    onChange={(e) => setModalTurno({...modalTurno, puntoSeleccionado: e.target.value})}
                    className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                  >
                    <option value="" disabled>-- Escoge un Punto --</option>
                    {PUNTOS_METROPOLITANA.map(p => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex gap-3 mt-2">
                <button 
                  onClick={() => setModalTurno({ abierto: false, tipo: null, evaluacion: null, puntoSeleccionado: '' })}
                  className="flex-1 px-4 py-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-xl transition-colors"
                >
                  Cancelar
                </button>
                <button 
                  onClick={confirmarCambioTurno}
                  disabled={guardandoTurno || (modalTurno.tipo === 'asignar' && !modalTurno.puntoSeleccionado)}
                  className={`flex-1 px-4 py-3 text-white font-bold rounded-xl transition-colors flex items-center justify-center disabled:opacity-50 ${modalTurno.tipo === 'asignar' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-orange-600 hover:bg-orange-700'}`}
                >
                  {guardandoTurno ? <Loader2 size={18} className="animate-spin" /> : 'Sí, continuar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* POPUP DE VISUALIZACIÓN EN PANTALLA (DETALLES DEL CHECKLIST) */}
      {evaluacionSeleccionada && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <div>
                <h3 className="text-xl font-bold text-gray-800">
                  {evaluacionSeleccionada.participantes?.nombres_apellidos}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  Evaluado por {evaluacionSeleccionada.usuarios?.nombre_completo} el {new Date(evaluacionSeleccionada.creado_en).toLocaleDateString()}
                </p>
              </div>
              <button 
                onClick={() => setEvaluacionSeleccionada(null)}
                className="p-2 bg-gray-200 hover:bg-gray-300 text-gray-600 rounded-full transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              <h4 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider border-b pb-2">Información General</h4>
              
              <div className="space-y-3 mb-6">
                <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-gray-700 font-medium text-sm pr-4">Fecha Capacitación</span>
                  <span className="text-gray-600 text-sm font-semibold">{evaluacionSeleccionada.fecha_capacitacion || new Date(evaluacionSeleccionada.creado_en).toLocaleDateString()}</span>
                </div>
                {evaluacionSeleccionada.tipo_capacitacion && (
                  <div className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                    <span className="text-gray-700 font-medium text-sm pr-4">Tipo Capacitación</span>
                    <span className="text-gray-600 text-sm font-semibold">{evaluacionSeleccionada.tipo_capacitacion}</span>
                  </div>
                )}
              </div>

              <h4 className="font-bold text-gray-700 mb-4 text-sm uppercase tracking-wider border-b pb-2">Respuestas del Checklist</h4>
              
              <div className="space-y-3">
                {evaluacionSeleccionada.respuestas && typeof evaluacionSeleccionada.respuestas === 'object' ? (
                  Object.entries(evaluacionSeleccionada.respuestas).map(([clave, valor]) => {
                    const clavesIgnoradas = ['participante', 'capacitador_id', 'capacitador', 'id', 'fecha', 'observaciones_finales'];
                    
                    if (clavesIgnoradas.some(ignorada => clave.toLowerCase().includes(ignorada))) {
                      return null; 
                    }

                    const nombreBonito = obtenerTextoPregunta(clave);

                    return (
                      <div key={clave} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-gray-700 font-medium text-sm pr-4">{nombreBonito}</span>
                        <span className="flex-shrink-0">
                          {valor === true || valor === 'Sí' || valor === 'Cumple' ? (
                            <span className="flex items-center text-green-600 bg-green-100 px-2 py-1 rounded text-xs font-bold"><CheckCircle2 size={14} className="mr-1"/> Sí</span>
                          ) : valor === false || valor === 'No' || valor === 'No Cumple' ? (
                            <span className="flex items-center text-red-600 bg-red-100 px-2 py-1 rounded text-xs font-bold"><XCircle size={14} className="mr-1"/> No</span>
                          ) : (
                            <span className="text-gray-600 text-sm font-semibold">{valor.toString()}</span>
                          )}
                        </span>
                      </div>
                    )
                  })
                ) : (
                  <div className="text-sm text-gray-500 italic p-4 text-center bg-gray-50 rounded-lg">No hay respuestas registradas en formato detallado para este participante.</div>
                )}
              </div>

              {evaluacionSeleccionada.observaciones_finales && (
                <div className="mt-6 p-4 bg-yellow-50 border border-yellow-100 rounded-lg">
                  <h4 className="font-bold text-yellow-800 mb-2 text-xs uppercase tracking-wider">Observaciones Finales</h4>
                  <p className="text-sm text-yellow-900">{evaluacionSeleccionada.observaciones_finales}</p>
                </div>
              )}

              <div className="mt-8 pt-4 border-t border-gray-100 flex items-center justify-between">
                <h4 className="font-bold text-gray-700 text-sm uppercase tracking-wider">Resultado Final</h4>
                <div className={`inline-flex items-center px-4 py-2 rounded-lg font-bold ${traducirEstado(evaluacionSeleccionada.resultado_aprobacion).color}`}>
                  {traducirEstado(evaluacionSeleccionada.resultado_aprobacion).texto}
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-gray-100 flex justify-end bg-gray-50 rounded-b-2xl">
              <button 
                onClick={() => setEvaluacionSeleccionada(null)}
                className="px-6 py-2 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-medium transition-colors"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}