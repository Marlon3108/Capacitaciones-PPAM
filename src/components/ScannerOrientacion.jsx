import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
import * as XLSX from "xlsx";
import { supabase } from "../supabaseClient";
import {
  QrCode,
  Search,
  CheckCircle2,
  AlertCircle,
  User,
  Building2,
  RefreshCw,
  Camera,
  CameraOff,
  Users,
  BarChart3,
  FileSpreadsheet,
  Printer,
} from "lucide-react";

export default function ScannerOrientacion() {
  const [codigo, setCodigo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [participante, setParticipante] = useState(null);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [camaraActiva, setCamaraActiva] = useState(false);
  const [camaraLista, setCamaraLista] = useState(false);
  const [errorCamara, setErrorCamara] = useState("");
  const [metricas, setMetricas] = useState({
    totalInvitados: 0,
    asistidos: 0,
    faltantes: 0,
    porcentajeAsistencia: 0,
    porcentajeFaltantes: 0,
    ultimosIngresos: [],
  });
  const [cargandoMetricas, setCargandoMetricas] = useState(true);
  const [exportandoExcel, setExportandoExcel] = useState(false);
  const [exportandoPdf, setExportandoPdf] = useState(false);

  const scannerRef = useRef(null);
  const ultimoCodigoRef = useRef("");
  const procesandoScanRef = useRef(false);

  const valorBusqueda = useMemo(
    () => (codigo || busqueda).trim(),
    [codigo, busqueda],
  );

  const cargarMetricas = useCallback(async () => {
    try {
      setCargandoMetricas(true);
      const { data, error } = await supabase
        .from("participantes")
        .select(
          "id, nombres_apellidos, congregacion, qr_token, categoria, estado, orientacion_escaneado, orientacion_fecha_escaneo",
        )
        .in("categoria", ["nuevo_orientacion", "pendiente_programacion_punto"])
        .order("orientacion_fecha_escaneo", { ascending: false, nullsFirst: false });
      if (error) throw error;
      const lista = data || [];
      const asistidos = lista.filter((p) => p.orientacion_escaneado === true);
      const pendientes = lista.filter(
        (p) => p.categoria === "nuevo_orientacion" && !p.orientacion_escaneado,
      );
      const totalInvitados = asistidos.length + pendientes.length;
      const totalAsistidos = asistidos.length;
      const totalFaltantes = Math.max(totalInvitados - totalAsistidos, 0);
      const porcentajeAsistencia = totalInvitados
        ? Math.round((totalAsistidos / totalInvitados) * 100)
        : 0;
      const porcentajeFaltantes = totalInvitados
        ? Math.round((totalFaltantes / totalInvitados) * 100)
        : 0;
      setMetricas({
        totalInvitados,
        asistidos: totalAsistidos,
        faltantes: totalFaltantes,
        porcentajeAsistencia,
        porcentajeFaltantes,
        ultimosIngresos: asistidos.slice(0, 8),
      });
    } catch (err) {
      console.error("Error cargando métricas:", err);
    } finally {
      setCargandoMetricas(false);
    }
  }, []);

  const buscarParticipante = useCallback(async (valorRecibido) => {
    const valor = (valorRecibido || "").trim();
    if (!valor) {
      setError("Ingresa o escanea un código antes de buscar.");
      setParticipante(null);
      return;
    }

    try {
      setCargando(true);
      setError("");
      setErrorCamara("");
      setParticipante(null);

      const { data, error } = await supabase
        .from("participantes")
        .select(
          "id, nombres_apellidos, congregacion, qr_token, categoria, estado, orientacion_escaneado, orientacion_fecha_escaneo",
        )
        .eq("categoria", "nuevo_orientacion")
        .eq("qr_token", valor)
        .maybeSingle();

      if (error) throw error;

      if (!data) {
        setError(
          "No encontramos un participante de orientación con ese código.",
        );
        return;
      }

      setParticipante(data);
    } catch (err) {
      console.error("Error buscando participante:", err);
      setError("Ocurrió un problema consultando la base de datos.");
    } finally {
      setCargando(false);
      procesandoScanRef.current = false;
    }
  }, []);

  const apagarCamara = useCallback(() => {
    setCamaraLista(false);
    const scanner = scannerRef.current;
    if (scanner) {
      scannerRef.current = null;
      try {
        Promise.resolve()
          .then(() => scanner.clear())
          .catch((err) => {
            console.error("Error limpiando scanner:", err);
          });
      } catch (err) {
        console.error("Error limpiando scanner:", err);
      }
    }
  }, []);

  const manejarScanExitoso = useCallback(
    (decodedText) => {
      const codigoDetectado = (decodedText || "").trim();
      if (
        !codigoDetectado ||
        procesandoScanRef.current ||
        ultimoCodigoRef.current === codigoDetectado
      )
        return;
      procesandoScanRef.current = true;
      ultimoCodigoRef.current = codigoDetectado;
      setCodigo(codigoDetectado);
      setBusqueda("");
      buscarParticipante(codigoDetectado);
      setTimeout(() => {
        ultimoCodigoRef.current = "";
      }, 2500);
    },
    [buscarParticipante],
  );

  const manejarErrorScan = useCallback(() => {}, []);

  useEffect(() => {
    cargarMetricas();
    const channel = supabase
      .channel("scanner-orientacion-metricas")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participantes",
        },
        () => {
          cargarMetricas();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [cargarMetricas]);

  useEffect(() => {
    if (!camaraActiva) {
      apagarCamara();
      return;
    }

    let cancelado = false;

    const iniciarScanner = async () => {
      try {
        setErrorCamara("");
        setCamaraLista(false);

        const instancia = new Html5QrcodeScanner(
          "reader-orientacion",
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1.3333333,
            rememberLastUsedCamera: true,
            supportedScanTypes: [0],
          },
          false,
        );

        scannerRef.current = instancia;
        instancia.render(
          (decodedText) => {
            if (!cancelado) {
              setCamaraLista(true);
              manejarScanExitoso(decodedText);
            }
          },
          (scanError) => {
            if (!cancelado) manejarErrorScan(scanError);
          },
        );
      } catch (err) {
        console.error("Error iniciando cámara:", err);
        setErrorCamara(
          "No fue posible iniciar la cámara. Verifica permisos y que estés en HTTPS o localhost.",
        );
        setCamaraActiva(false);
      }
    };

    const timer = setTimeout(iniciarScanner, 150);
    return () => {
      cancelado = true;
      clearTimeout(timer);
      apagarCamara();
    };
  }, [camaraActiva, apagarCamara, manejarErrorScan, manejarScanExitoso]);

  useEffect(() => {
    const manejarEnterGlobal = (e) => {
      const tag = document.activeElement?.tagName?.toLowerCase();
      if (e.key === "Enter" && tag !== "textarea") {
        e.preventDefault();
        buscarParticipante(valorBusqueda);
      }
    };

    window.addEventListener("keydown", manejarEnterGlobal);
    return () => window.removeEventListener("keydown", manejarEnterGlobal);
  }, [buscarParticipante, valorBusqueda]);

  const marcarIngreso = async () => {
    if (!participante?.id) return;

    try {
      setGuardando(true);
      setError("");
      const fechaEscaneo = new Date().toISOString();
      const { error } = await supabase
        .from("participantes")
        .update({
          orientacion_escaneado: true,
          orientacion_fecha_escaneo: fechaEscaneo,
          categoria: "pendiente_programacion_punto",
        })
        .eq("id", participante.id);

      if (error) throw error;

      setParticipante((prev) => ({
        ...prev,
        orientacion_escaneado: true,
        orientacion_fecha_escaneo: fechaEscaneo,
        categoria: "pendiente_programacion_punto",
      }));
      await cargarMetricas();
    } catch (err) {
      console.error("Error marcando ingreso:", err);
      setError("No fue posible registrar el ingreso.");
    } finally {
      setGuardando(false);
    }
  };

  const reiniciarBusqueda = async () => {
    setCodigo("");
    setBusqueda("");
    setParticipante(null);
    setError("");
    setErrorCamara("");
    procesandoScanRef.current = false;
    ultimoCodigoRef.current = "";
  };

  const alternarCamara = async () => {
    if (camaraActiva) {
      setCamaraActiva(false);
      await apagarCamara();
    } else {
      setCamaraActiva(true);
    }
  };

  const exportarExcelResumen = async () => {
    try {
      setExportandoExcel(true);
      const { data, error } = await supabase
        .from("participantes")
        .select(
          "nombres_apellidos, congregacion, qr_token, categoria, estado, orientacion_escaneado, orientacion_fecha_escaneo",
        )
        .in("categoria", ["nuevo_orientacion", "pendiente_programacion_punto"])
        .order("nombres_apellidos", { ascending: true });

      if (error) throw error;

      const lista = data || [];
      const filasDetalle = lista.map((p) => ({
        Participante: p.nombres_apellidos || "",
        Congregacion: p.congregacion || "",
        QR_Token: p.qr_token || "",
        Categoria_Actual: p.categoria || "",
        Estado_General: p.estado || "",
        Asistio_Orientacion: p.orientacion_escaneado ? "SI" : "NO",
        Fecha_Escaneo: p.orientacion_fecha_escaneo
          ? new Date(p.orientacion_fecha_escaneo).toLocaleString("es-CO")
          : "",
      }));

      const filasResumen = [
        { Indicador: "Total invitados", Valor: metricas.totalInvitados },
        { Indicador: "Asistidos", Valor: metricas.asistidos },
        { Indicador: "Faltantes", Valor: metricas.faltantes },
        { Indicador: "% asistencia", Valor: `${metricas.porcentajeAsistencia}%` },
        { Indicador: "% faltantes", Valor: `${metricas.porcentajeFaltantes}%` },
        { Indicador: "Fecha reporte", Valor: new Date().toLocaleString("es-CO") },
      ];

      const wb = XLSX.utils.book_new();
      const wsResumen = XLSX.utils.json_to_sheet(filasResumen);
      const wsDetalle = XLSX.utils.json_to_sheet(filasDetalle);
      XLSX.utils.book_append_sheet(wb, wsResumen, "Resumen");
      XLSX.utils.book_append_sheet(wb, wsDetalle, "Detalle asistentes");
      XLSX.writeFile(
        wb,
        `Reporte_Orientacion_${new Date().toISOString().split("T")[0]}.xlsx`,
      );
    } catch (err) {
      console.error("Error exportando Excel:", err);
      setError("No fue posible generar el archivo Excel.");
    } finally {
      setExportandoExcel(false);
    }
  };

  const exportarPdfResumen = async () => {
    try {
      setExportandoPdf(true);
      const porcentaje = metricas.porcentajeAsistencia;
      const porcentajeFaltan = metricas.porcentajeFaltantes;
      const barraAsistencia = `
      <div style="margin-top: 10px;">
        <div style="display:flex; height:22px; border-radius:999px; overflow:hidden; background:#e5e7eb;">
          <div style="width:${porcentaje}%; background:#16a34a;"></div>
          <div style="width:${porcentajeFaltan}%; background:#f59e0b;"></div>
        </div>
      </div>
    `;
      const html = `
      <html>
        <head>
          <title>Resumen Orientación</title>
          <style>
            * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; font-family: Arial, sans-serif; }
            body { padding: 32px; color: #1f2937; }
            .header { border-bottom: 2px solid #2563eb; padding-bottom: 16px; margin-bottom: 24px; }
            .title { font-size: 28px; font-weight: 700; margin: 0; color: #1d4ed8; }
            .subtitle { margin-top: 6px; color: #6b7280; font-size: 14px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 24px; }
            .card { border: 1px solid #e5e7eb; border-radius: 14px; padding: 18px; background: #f9fafb; }
            .label { font-size: 12px; text-transform: uppercase; color: #6b7280; margin-bottom: 6px; font-weight: bold; }
            .value { font-size: 30px; font-weight: 700; }
            .section { margin-top: 28px; }
            .list { margin-top: 14px; border: 1px solid #e5e7eb; border-radius: 14px; overflow: hidden; }
            .row { display: flex; justify-content: space-between; gap: 12px; padding: 12px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; }
            .row:last-child { border-bottom: none; }
            .muted { color: #6b7280; }
            @media print { @page { size: A4; margin: 16mm; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1 class="title">Resumen gráfico de orientación</h1>
            <div class="subtitle">Generado el ${new Date().toLocaleString("es-CO")}</div>
          </div>
          <div class="grid">
            <div class="card"><div class="label">Total invitados</div><div class="value">${metricas.totalInvitados}</div></div>
            <div class="card"><div class="label">Asistidos</div><div class="value" style="color:#16a34a;">${metricas.asistidos}</div></div>
            <div class="card"><div class="label">Faltantes</div><div class="value" style="color:#d97706;">${metricas.faltantes}</div></div>
            <div class="card"><div class="label">Avance de aforo</div><div class="value">${metricas.porcentajeAsistencia}%</div></div>
          </div>
          <div class="section">
            <div class="label" style="font-size:14px; color:#111827;">Barra de avance</div>
            ${barraAsistencia}
            <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:13px;">
              <span style="color:#16a34a;">Asistidos: ${metricas.asistidos}</span>
              <span style="color:#d97706;">Faltan: ${metricas.faltantes}</span>
            </div>
          </div>
          <div class="section">
            <div class="label" style="font-size:14px; color:#111827;">Últimos ingresos registrados</div>
            <div class="list">
              ${metricas.ultimosIngresos.length ? metricas.ultimosIngresos.map((p) => `
                <div class="row">
                  <div>
                    <div><strong>${p.nombres_apellidos || "Sin nombre"}</strong></div>
                    <div class="muted">${p.congregacion || "Sin congregación"}</div>
                  </div>
                  <div class="muted">${p.orientacion_fecha_escaneo ? new Date(p.orientacion_fecha_escaneo).toLocaleString("es-CO") : ""}</div>
                </div>
              `).join("") : `<div class="row"><div class="muted">Aún no hay ingresos registrados.</div></div>`}
            </div>
          </div>
        </body>
      </html>
    `;
      const printWindow = window.open("", "_blank");
      if (!printWindow) throw new Error("No se pudo abrir la ventana de impresión.");
      printWindow.document.write(html);
      printWindow.document.close();
      setTimeout(() => {
        printWindow.focus();
        printWindow.print();
      }, 300);
    } catch (err) {
      console.error("Error generando PDF:", err);
      setError("No fue posible generar el resumen PDF.");
    } finally {
      setExportandoPdf(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Scanner Orientación
          </h1>
          <p className="text-gray-500 mt-1">
            Escanea con cámara o valida manualmente el qr_token para registrar
            ingresos.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={alternarCamara}
            className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl font-medium border ${camaraActiva ? "bg-red-50 border-red-200 text-red-700 hover:bg-red-100" : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"}`}
          >
            {camaraActiva ? <CameraOff size={18} /> : <Camera size={18} />}
            {camaraActiva ? "Apagar cámara" : "Encender cámara"}
          </button>
          <button
            onClick={reiniciarBusqueda}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          >
            <RefreshCw size={18} /> Nueva búsqueda
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <Users className="text-slate-600" size={18} />
            <p className="text-sm font-semibold text-gray-500">Invitados</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {cargandoMetricas ? "..." : metricas.totalInvitados}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-green-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="text-green-600" size={18} />
            <p className="text-sm font-semibold text-gray-500">Han asistido</p>
          </div>
          <p className="text-3xl font-bold text-green-700">
            {cargandoMetricas ? "..." : metricas.asistidos}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="text-amber-600" size={18} />
            <p className="text-sm font-semibold text-gray-500">Faltan</p>
          </div>
          <p className="text-3xl font-bold text-amber-700">
            {cargandoMetricas ? "..." : metricas.faltantes}
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-blue-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="text-blue-600" size={18} />
            <p className="text-sm font-semibold text-gray-500">Avance</p>
          </div>
          <p className="text-3xl font-bold text-blue-700">
            {cargandoMetricas ? "..." : `${metricas.porcentajeAsistencia}%`}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Aforo en vivo</h2>
            <p className="text-sm text-gray-500">
              Visual de asistentes registrados y personas pendientes por llegar.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={exportarExcelResumen}
              disabled={exportandoExcel || cargandoMetricas}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium disabled:opacity-50"
            >
              <FileSpreadsheet size={18} />
              {exportandoExcel ? "Generando Excel..." : "Exportar Excel"}
            </button>
            <button
              onClick={exportarPdfResumen}
              disabled={exportandoPdf || cargandoMetricas}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-medium disabled:opacity-50"
            >
              <Printer size={18} />
              {exportandoPdf ? "Preparando PDF..." : "Resumen PDF"}
            </button>
          </div>
        </div>

        <div className="w-full h-6 bg-gray-200 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-green-500 transition-all duration-500"
            style={{ width: `${metricas.porcentajeAsistencia}%` }}
          />
          <div
            className="h-full bg-amber-400 transition-all duration-500"
            style={{ width: `${metricas.porcentajeFaltantes}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap gap-4 text-sm font-medium">
          <span className="text-green-700">
            Asistidos: {metricas.asistidos} ({metricas.porcentajeAsistencia}%)
          </span>
          <span className="text-amber-700">
            Faltantes: {metricas.faltantes} ({metricas.porcentajeFaltantes}%)
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="font-bold text-gray-800 mb-3">Últimos ingresos</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
              {metricas.ultimosIngresos.length ? (
                metricas.ultimosIngresos.map((p) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-white border border-gray-100 px-3 py-2"
                  >
                    <div>
                      <p className="text-sm font-bold text-gray-800">
                        {p.nombres_apellidos}
                      </p>
                      <p className="text-xs text-gray-500">
                        {p.congregacion || "Sin congregación"}
                      </p>
                    </div>
                    <p className="text-xs text-gray-400 whitespace-nowrap">
                      {p.orientacion_fecha_escaneo
                        ? new Date(p.orientacion_fecha_escaneo).toLocaleTimeString("es-CO", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">Aún no hay ingresos registrados.</p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-gray-50 p-4">
            <h3 className="font-bold text-gray-800 mb-3">Lectura rápida</h3>
            <div className="space-y-3">
              <div className="rounded-xl bg-white border border-gray-100 p-3">
                <p className="text-xs uppercase font-bold text-gray-400">
                  Capacidad monitoreada
                </p>
                <p className="text-xl font-bold text-gray-900">
                  {metricas.totalInvitados} personas
                </p>
              </div>
              <div className="rounded-xl bg-white border border-gray-100 p-3">
                <p className="text-xs uppercase font-bold text-gray-400">
                  Estado actual
                </p>
                <p className="text-base font-semibold text-gray-800">
                  Han entrado {metricas.asistidos} y faltan {metricas.faltantes}.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="text-blue-600" size={20} />
              <h2 className="text-lg font-bold text-gray-800">
                Escaneo y validación
              </h2>
            </div>

            <div className="rounded-2xl border border-dashed border-blue-200 bg-slate-50 p-3">
              <div
                id="reader-orientacion"
                className="min-h-[280px] overflow-hidden rounded-xl"
              />
              {!camaraActiva && (
                <div className="mt-3 text-sm text-gray-500 text-center">
                  La cámara está apagada. Usa el botón{" "}
                  <span className="font-semibold">Encender cámara</span> para
                  escanear desde este dispositivo.
                </div>
              )}
              {camaraActiva && !camaraLista && !errorCamara && (
                <div className="mt-3 text-sm text-blue-600 text-center font-medium">
                  Esperando permisos y selección de cámara...
                </div>
              )}
              {errorCamara && (
                <div className="mt-3 text-sm text-red-600 text-center font-medium">
                  {errorCamara}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Código leído o digitado
              </label>
              <input
                type="text"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                placeholder="Ej: ORI-2026-001"
                className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Búsqueda manual
              </label>
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Pega aquí el qr_token"
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => buscarParticipante(valorBusqueda)}
              disabled={cargando || !valorBusqueda}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
            >
              <Search size={18} />{" "}
              {cargando ? "Consultando..." : "Validar acceso"}
            </button>

            <p className="text-xs text-gray-500 leading-relaxed">
              El lector de cámara envía automáticamente el resultado al
              consultar el <span className="font-semibold">qr_token</span>. Este
              módulo solo valida participantes
            </p>
          </div>
        </div>

        <div className="xl:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 min-h-[520px]">
            {error ? (
              <div className="h-full min-h-[460px] flex items-center justify-center">
                <div className="max-w-md text-center">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-red-50 flex items-center justify-center">
                    <AlertCircle className="text-red-500" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    Acceso no validado
                  </h3>
                  <p className="text-gray-500 mt-2">{error}</p>
                </div>
              </div>
            ) : participante ? (
              <div className="space-y-6">
                <div
                  className={`rounded-2xl p-5 border ${participante.orientacion_escaneado ? "bg-green-50 border-green-200" : "bg-blue-50 border-blue-200"}`}
                >
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-14 h-14 rounded-2xl flex items-center justify-center ${participante.orientacion_escaneado ? "bg-green-100" : "bg-blue-100"}`}
                      >
                        <CheckCircle2
                          className={
                            participante.orientacion_escaneado
                              ? "text-green-700"
                              : "text-blue-700"
                          }
                          size={28}
                        />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
                          Estado del acceso
                        </p>
                        <h2 className="text-2xl font-bold text-gray-800">
                          {participante.orientacion_escaneado
                            ? "Ingreso registrado"
                            : "Participante válido"}
                        </h2>
                      </div>
                    </div>
                    <div
                      className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-bold ${participante.orientacion_escaneado ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}
                    >
                      {participante.orientacion_escaneado
                        ? "Ya escaneado"
                        : "Pendiente de ingreso"}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <User className="text-gray-600" size={18} />
                      <h3 className="font-bold text-gray-800">Participante</h3>
                    </div>
                    <p className="text-xl font-bold text-gray-900">
                      {participante.nombres_apellidos}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Categoría: {participante.categoria}
                    </p>
                    <p className="text-sm text-gray-500">
                      Estado general: {participante.estado || "Sin estado"}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-gray-100 bg-gray-50 p-5">
                    <div className="flex items-center gap-2 mb-3">
                      <Building2 className="text-gray-600" size={18} />
                      <h3 className="font-bold text-gray-800">
                        Congregación y código
                      </h3>
                    </div>
                    <p className="text-lg font-bold text-gray-900">
                      {participante.congregacion || "Sin congregación"}
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      qr_token: {participante.qr_token}
                    </p>
                    <p className="text-sm text-gray-500">
                      Último escaneo: {" "}
                      {participante.orientacion_fecha_escaneo
                        ? new Date(
                            participante.orientacion_fecha_escaneo,
                          ).toLocaleString("es-CO")
                        : "Aún no registrado"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4">
                  <button
                    onClick={marcarIngreso}
                    disabled={guardando || participante.orientacion_escaneado}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 size={20} />
                    {participante.orientacion_escaneado
                      ? "Ingreso ya registrado"
                      : guardando
                        ? "Guardando..."
                        : "Registrar ingreso"}
                  </button>
                  <button
                    onClick={reiniciarBusqueda}
                    className="flex-1 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-bold py-3 px-4 rounded-xl"
                  >
                    Escanear otro participante
                  </button>
                </div>
              </div>
            ) : (
              <div className="h-full min-h-[460px] flex items-center justify-center">
                <div className="text-center max-w-md">
                  <div className="mx-auto mb-4 w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                    <QrCode className="text-blue-600" size={32} />
                  </div>
                  <h3 className="text-2xl font-bold text-gray-800">
                    Esperando escaneo
                  </h3>
                  <p className="text-gray-500 mt-2">
                    Enciende la cámara o pega manualmente el{" "}
                    <span className="font-semibold">qr_token</span> para validar
                    el acceso del invitado a orientación.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}