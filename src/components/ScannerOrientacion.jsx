import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Html5QrcodeScanner } from "html5-qrcode";
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

  const scannerRef = useRef(null);
  const ultimoCodigoRef = useRef("");
  const procesandoScanRef = useRef(false);

  const valorBusqueda = useMemo(
    () => (codigo || busqueda).trim(),
    [codigo, busqueda],
  );

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
                      Último escaneo:{" "}
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
