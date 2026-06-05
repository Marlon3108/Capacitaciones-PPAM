import React, { useState, useEffect } from 'react';
import { read, utils } from 'xlsx';
import {
  UploadCloud,
  Link as LinkIcon,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ShieldAlert,
  UserPlus,
  FileSpreadsheet
} from 'lucide-react';
import { supabase } from '../supabaseClient';

export default function GestorNuevosParticipantes() {
  const [modoIngreso, setModoIngreso] = useState('masivo');
  const [datosBrutos, setDatosBrutos] = useState([]);
  const [encabezados, setEncabezados] = useState([]);
  const [archivo, setArchivo] = useState(null);
  const [tipoImportacion, setTipoImportacion] = useState('nuevos');
  const [columnaNombre, setColumnaNombre] = useState('');
  const [columnaCiudad, setColumnaCiudad] = useState('');
  const [columnaCongregacion, setColumnaCongregacion] = useState('');
  const [columnaTelefono, setColumnaTelefono] = useState('');
  const [columnaPrioridad, setColumnaPrioridad] = useState('');
  const [columnaPuntoFijo, setColumnaPuntoFijo] = useState('');
  const [isDragging, setIsDragging] = useState(false);

  const [manualTipo, setManualTipo] = useState('nuevos');
  const [manualNombre, setManualNombre] = useState('');
  const [manualCiudad, setManualCiudad] = useState('Cali');
  const [manualCongregacion, setManualCongregacion] = useState('');
  const [manualTelefono, setManualTelefono] = useState('');
  const [manualPrioridad, setManualPrioridad] = useState(false);
  const [manualPuntoFijo, setManualPuntoFijo] = useState('');

  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState(null);
  const [accesoDenegado, setAccesoDenegado] = useState(false);
  const [verificandoRol, setVerificandoRol] = useState(true);

  useEffect(() => {
    const verificarPermisos = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setVerificandoRol(false);
        return;
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('roles(nombre)')
        .eq('id', session.user.id)
        .single();

      const rol = userData?.roles?.nombre?.toLowerCase() || '';
      if (rol !== 'administrador' && rol !== 'coordinador') {
        setAccesoDenegado(true);
      }
      setVerificandoRol(false);
    };

    verificarPermisos();
  }, []);

  const generarCodigoUnico = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let codigo = '';
    for (let i = 0; i < 6; i++) {
      codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length));
    }
    return codigo;
  };

  const procesarArchivo = async (file) => {
    if (!file) return;
    setArchivo(file.name);
    setMensaje(null);

    const data = await file.arrayBuffer();
    const workbook = read(data);
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const jsonData = utils.sheet_to_json(worksheet, { header: 1 });

    if (jsonData.length > 1) {
      setEncabezados(jsonData[0]);
      setDatosBrutos(jsonData.slice(1));
    }
  };

  const handleFileUpload = (e) => procesarArchivo(e.target.files[0]);
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false); };
  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      procesarArchivo(e.dataTransfer.files[0]);
    }
  };

  const handleImportarMasivo = async () => {
    if (!columnaNombre || !columnaCiudad || !columnaCongregacion || !columnaTelefono || !columnaPrioridad) {
      setMensaje({
        tipo: 'error',
        texto: 'Por favor, selecciona todas las columnas base requeridas (Nombre, Ciudad, Congregación, Teléfono y Prioridad).'
      });
      return;
    }

    if (tipoImportacion === 'antiguos' && !columnaPuntoFijo) {
      setMensaje({
        tipo: 'error',
        texto: 'Has indicado que son participantes Antiguos. Debes seleccionar la columna de Punto Fijo.'
      });
      return;
    }

    setCargando(true);
    setMensaje(null);

    const indiceNombre = encabezados.indexOf(columnaNombre);
    const indiceCiudad = encabezados.indexOf(columnaCiudad);
    const indiceCongregacion = encabezados.indexOf(columnaCongregacion);
    const indiceTelefono = encabezados.indexOf(columnaTelefono);
    const indicePrioridad = encabezados.indexOf(columnaPrioridad);
    const indicePunto = tipoImportacion === 'antiguos' ? encabezados.indexOf(columnaPuntoFijo) : -1;

    try {
      const { data: existentes, error: errorFetch } = await supabase
        .from('participantes')
        .select('id, nombres_apellidos, ciudad, congregacion, codigo_unico, estado, telefono, categoria, punto_fijo');

      if (errorFetch) throw errorFetch;

      const nuevosAInsertar = [];
      const existentesAActualizar = [];

      datosBrutos.forEach(fila => {
        const nombreExcel = fila[indiceNombre] ? fila[indiceNombre].toString().trim() : '';
        if (!nombreExcel) return;

        const ciudadExcel = fila[indiceCiudad] ? fila[indiceCiudad].toString().trim() : 'No especificada';
        const congregacionExcel = fila[indiceCongregacion] ? fila[indiceCongregacion].toString().trim() : 'No especificada';
        const telefonoExcel = fila[indiceTelefono] ? fila[indiceTelefono].toString().trim() : null;

        let prioridadExcel = false;
        if (fila[indicePrioridad] !== undefined && fila[indicePrioridad] !== null) {
          const val = fila[indicePrioridad].toString().toUpperCase().trim();
          prioridadExcel = (val === 'TRUE' || val === 'VERDADERO' || val === 'SI' || val === '1');
        }

        let categoriaCalculada = tipoImportacion === 'nuevos' ? 'nuevo_orientacion' : 'viejo_sin_punto';
        let puntoFijoCalculado = null;

        if (tipoImportacion === 'antiguos') {
          const puntoExcel = fila[indicePunto] ? fila[indicePunto].toString().trim() : '';
          if (puntoExcel) {
            categoriaCalculada = 'viejo_punto_fijo';
            puntoFijoCalculado = puntoExcel;
          }
        }

        const pExistente = existentes.find(
          p => p.nombres_apellidos.toLowerCase() === nombreExcel.toLowerCase()
        );

        if (pExistente) {
          if (
            pExistente.ciudad !== ciudadExcel ||
            pExistente.congregacion !== congregacionExcel ||
            pExistente.telefono !== telefonoExcel ||
            pExistente.categoria !== categoriaCalculada ||
            pExistente.punto_fijo !== puntoFijoCalculado
          ) {
            existentesAActualizar.push({
              id: pExistente.id,
              nombres_apellidos: pExistente.nombres_apellidos,
              ciudad: ciudadExcel,
              congregacion: congregacionExcel,
              telefono: telefonoExcel,
              es_prioridad: prioridadExcel,
              categoria: categoriaCalculada,
              punto_fijo: puntoFijoCalculado,
              codigo_unico: pExistente.codigo_unico,
              estado: pExistente.estado
            });
          }
        } else {
          nuevosAInsertar.push({
            codigo_unico: generarCodigoUnico(),
            nombres_apellidos: nombreExcel,
            ciudad: ciudadExcel,
            congregacion: congregacionExcel,
            telefono: telefonoExcel,
            es_prioridad: prioridadExcel,
            categoria: categoriaCalculada,
            punto_fijo: puntoFijoCalculado,
            estado: 'pendiente'
          });
        }
      });

      if (nuevosAInsertar.length > 0) {
        const { error: errIn } = await supabase.from('participantes').insert(nuevosAInsertar);
        if (errIn) throw errIn;
      }

      if (existentesAActualizar.length > 0) {
        const { error: errUp } = await supabase.from('participantes').upsert(existentesAActualizar);
        if (errUp) throw errUp;
      }

      setMensaje({
        tipo: 'exito',
        texto: `Proceso completado: Se agregaron ${nuevosAInsertar.length} nuevos y se actualizaron los datos de ${existentesAActualizar.length} existentes.`
      });

      setTimeout(() => {
        setArchivo(null);
        setEncabezados([]);
        setDatosBrutos([]);
        setColumnaNombre('');
        setColumnaCiudad('');
        setColumnaCongregacion('');
        setColumnaTelefono('');
        setColumnaPrioridad('');
        setColumnaPuntoFijo('');
        setMensaje(null);
      }, 5000);
    } catch (error) {
      console.error(error);
      setMensaje({ tipo: 'error', texto: 'Error de base de datos: ' + error.message });
    }

    setCargando(false);
  };

  const handleGuardarManual = async (e) => {
    e.preventDefault();

    if (!manualNombre || !manualCongregacion || !manualTelefono) {
      setMensaje({ tipo: 'error', texto: 'Por favor completa Nombre, Congregación y Teléfono.' });
      return;
    }

    if (manualTipo === 'antiguos' && !manualPuntoFijo) {
      setMensaje({ tipo: 'error', texto: 'Para un participante antiguo, debes escribir su Punto Fijo.' });
      return;
    }

    setCargando(true);
    setMensaje(null);

    try {
      const { data: existente } = await supabase
        .from('participantes')
        .select('id')
        .ilike('nombres_apellidos', manualNombre.trim())
        .single();

      if (existente) {
        setMensaje({ tipo: 'error', texto: `El participante "${manualNombre}" ya existe en el sistema.` });
        setCargando(false);
        return;
      }

      let categoriaCalculada = manualTipo === 'nuevos' ? 'nuevo_orientacion' : 'viejo_sin_punto';
      let puntoFijoCalculado = null;

      if (manualTipo === 'antiguos') {
        if (manualPuntoFijo) {
          categoriaCalculada = 'viejo_punto_fijo';
          puntoFijoCalculado = manualPuntoFijo.trim();
        }
      }

      const nuevoRegistro = {
        nombres_apellidos: manualNombre.trim(),
        ciudad: manualCiudad,
        congregacion: manualCongregacion.trim(),
        telefono: manualTelefono.trim(),
        es_prioridad: manualPrioridad,
        categoria: categoriaCalculada,
        punto_fijo: puntoFijoCalculado,
        estado: 'pendiente',
        codigo_unico: generarCodigoUnico()
      };

      const { error } = await supabase.from('participantes').insert([nuevoRegistro]);
      if (error) throw error;

      setMensaje({ tipo: 'exito', texto: `¡Participante ${manualNombre} agregado correctamente!` });
      setManualNombre('');
      setManualCongregacion('');
      setManualTelefono('');
      setManualPrioridad(false);
      setManualPuntoFijo('');

      setTimeout(() => setMensaje(null), 4000);
    } catch (error) {
      console.error(error);
      setMensaje({ tipo: 'error', texto: 'Hubo un error al guardar el participante: ' + error.message });
    } finally {
      setCargando(false);
    }
  };

  if (verificandoRol) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="animate-spin mr-2 text-blue-600" /> Verificando permisos...
      </div>
    );
  }

  if (accesoDenegado) {
    return (
      <div className="bg-red-50 border border-red-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto mt-10">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-800 mb-2">Acceso Restringido</h2>
        <p className="text-red-600">
          No tienes los permisos necesarios para importar bases de datos. Esta acción es exclusiva para Administradores o Coordinadores.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Cargar Participantes</h1>
        <p className="text-gray-500 mt-1">Sube el archivo Excel o registra personas manualmente al sistema.</p>
      </div>

      <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1">
        <button
          onClick={() => { setModoIngreso('masivo'); setMensaje(null); }}
          className={`flex-1 py-3 rounded-lg font-medium ${modoIngreso === 'masivo' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
        >
          <FileSpreadsheet size={18} className="inline mr-2" /> Importar Sheets
        </button>
        <button
          onClick={() => { setModoIngreso('manual'); setMensaje(null); }}
          className={`flex-1 py-3 rounded-lg font-medium ${modoIngreso === 'manual' ? 'bg-blue-50 text-blue-700' : 'text-gray-500'}`}
        >
          <UserPlus size={18} className="inline mr-2" /> Ingreso Manual
        </button>
      </div>

      {mensaje && (
        <div className={`p-4 rounded-xl flex items-center text-sm font-medium ${mensaje.tipo === 'error' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-green-50 text-green-700 border border-green-100'}`}>
          {mensaje.tipo === 'error' ? <AlertCircle className="w-5 h-5 mr-2" /> : <CheckCircle2 className="w-5 h-5 mr-2" />}
          {mensaje.texto}
        </div>
      )}

      {modoIngreso === 'masivo' && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
          <h2 className="text-xl font-semibold text-gray-800 mb-4">Paso 1: Cargar Archivo</h2>

          <div className="flex items-center justify-center w-full">
            <label
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer ${
                isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50'
              }`}
            >
              <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
                <UploadCloud className={`w-12 h-12 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
                <p className="mb-2 text-sm text-gray-500">
                  {isDragging
                    ? <span className="font-semibold text-blue-600">¡Suelta el archivo aquí!</span>
                    : <><span className="font-semibold">Haz clic para subir</span> o arrastra el archivo Excel/CSV</>}
                </p>
              </div>
              <input type="file" className="hidden" accept=".xlsx, .csv" onChange={handleFileUpload} />
            </label>
          </div>

          {archivo && (
            <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg flex items-center text-green-700">
              <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
              <div className="truncate">
                Archivo cargado: <span className="font-medium ml-1">{archivo}</span>
              </div>
              <span className="ml-auto text-sm font-medium flex-shrink-0">({datosBrutos.length} filas)</span>
            </div>
          )}

          {encabezados.length > 0 && (
            <div className="mt-8 pt-8 border-t border-gray-100">
              <div className="mb-8 bg-blue-50 p-5 rounded-xl border border-blue-200">
                <h3 className="font-bold text-blue-900 mb-3 text-lg">Paso 2: ¿Qué tipo de lista estás subiendo?</h3>
                <div className="flex flex-col sm:flex-row gap-4">
                  <label className={`flex-1 flex items-start p-4 rounded-xl border cursor-pointer transition-all ${tipoImportacion === 'nuevos' ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-100' : 'bg-blue-50/50 border-blue-200 hover:bg-white/60'}`}>
                    <input
                      type="radio"
                      name="tipo"
                      value="nuevos"
                      checked={tipoImportacion === 'nuevos'}
                      onChange={() => setTipoImportacion('nuevos')}
                      className="mt-1 mr-3 w-5 h-5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-bold text-gray-800 text-base">Nuevos</p>
                      <p className="text-xs text-gray-500 mt-1">Participantes recientes listos para ir a la reunión de orientación.</p>
                    </div>
                  </label>

                  <label className={`flex-1 flex items-start p-4 rounded-xl border cursor-pointer transition-all ${tipoImportacion === 'antiguos' ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-100' : 'bg-blue-50/50 border-blue-200 hover:bg-white/60'}`}>
                    <input
                      type="radio"
                      name="tipo"
                      value="antiguos"
                      checked={tipoImportacion === 'antiguos'}
                      onChange={() => setTipoImportacion('antiguos')}
                      className="mt-1 mr-3 w-5 h-5 text-blue-600 focus:ring-blue-500"
                    />
                    <div>
                      <p className="font-bold text-gray-800 text-base">Antiguos (Viejos)</p>
                      <p className="text-xs text-gray-500 mt-1">Hermanos que ya servían y requieren capacitación en sitio.</p>
                    </div>
                  </label>
                </div>
              </div>

              <h2 className="text-xl font-semibold text-gray-800 mb-4">Paso 3: Emparejar Columnas</h2>
              <div className="space-y-4 max-w-2xl mb-8">
                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="w-1/3"><span className="font-medium text-gray-700 text-sm">Nombres y Apellidos <span className="text-red-500">*</span></span></div>
                  <div className="w-10 flex justify-center text-gray-400"><LinkIcon size={16} /></div>
                  <div className="w-1/2">
                    <select value={columnaNombre} onChange={(e) => setColumnaNombre(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">-- Selecciona --</option>
                      {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="w-1/3"><span className="font-medium text-gray-700 text-sm">Ciudad asignada <span className="text-red-500">*</span></span></div>
                  <div className="w-10 flex justify-center text-gray-400"><LinkIcon size={16} /></div>
                  <div className="w-1/2">
                    <select value={columnaCiudad} onChange={(e) => setColumnaCiudad(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">-- Selecciona --</option>
                      {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
                  <div className="w-1/3"><span className="font-medium text-gray-700 text-sm">Congregación <span className="text-red-500">*</span></span></div>
                  <div className="w-10 flex justify-center text-gray-400"><LinkIcon size={16} /></div>
                  <div className="w-1/2">
                    <select value={columnaCongregacion} onChange={(e) => setColumnaCongregacion(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">-- Selecciona --</option>
                      {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border border-blue-200 rounded-lg bg-blue-50/50">
                  <div className="w-1/3"><span className="font-medium text-blue-900 text-sm">Teléfono / WhatsApp <span className="text-red-500">*</span></span></div>
                  <div className="w-10 flex justify-center text-blue-400"><LinkIcon size={16} /></div>
                  <div className="w-1/2">
                    <select value={columnaTelefono} onChange={(e) => setColumnaTelefono(e.target.value)} className="w-full p-2 border border-blue-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                      <option value="">-- Selecciona --</option>
                      {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 border border-amber-200 rounded-lg bg-amber-50/50">
                  <div className="w-1/3"><span className="font-medium text-amber-900 text-sm">Prioritario (Urgente) <span className="text-red-500">*</span></span></div>
                  <div className="w-10 flex justify-center text-amber-400"><LinkIcon size={16} /></div>
                  <div className="w-1/2">
                    <select value={columnaPrioridad} onChange={(e) => setColumnaPrioridad(e.target.value)} className="w-full p-2 border border-amber-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500">
                      <option value="">-- Selecciona --</option>
                      {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                    </select>
                  </div>
                </div>

                {tipoImportacion === 'antiguos' && (
                  <div className="flex items-center justify-between p-3 border border-indigo-200 rounded-lg bg-indigo-50">
                    <div className="w-1/3">
                      <span className="font-bold text-indigo-900 text-sm flex flex-col">
                        Punto Fijo Asignado <span className="text-xs text-indigo-500 font-normal">Si aplica</span>
                      </span>
                    </div>
                    <div className="w-10 flex justify-center text-indigo-400"><LinkIcon size={16} /></div>
                    <div className="w-1/2">
                      <select value={columnaPuntoFijo} onChange={(e) => setColumnaPuntoFijo(e.target.value)} className="w-full p-2 border border-indigo-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                        <option value="">-- Selecciona (Obligatorio) --</option>
                        {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end pt-4 border-t border-gray-100">
                <button
                  onClick={handleImportarMasivo}
                  disabled={cargando}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md flex items-center disabled:opacity-50 disabled:scale-100 transform hover:scale-[1.02]"
                >
                  {cargando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
                  {cargando ? 'Procesando archivo...' : 'Procesar e Importar'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {modoIngreso === 'manual' && (
        <div className="bg-white p-6 md:p-8 rounded-2xl shadow-sm border border-gray-100 max-w-2xl mx-auto">
          <h2 className="text-xl font-semibold text-gray-800 mb-6 flex items-center">
            <UserPlus className="mr-2 text-blue-600" />
            Ingreso Manual Individual
          </h2>

          <div className="mb-6 bg-blue-50 p-4 rounded-xl border border-blue-200">
            <label className="block font-bold text-blue-900 mb-2">Categoría del Participante</label>
            <div className="flex gap-4">
              <label className="flex items-center text-sm cursor-pointer">
                <input
                  type="radio"
                  value="nuevos"
                  checked={manualTipo === 'nuevos'}
                  onChange={() => setManualTipo('nuevos')}
                  className="mr-2"
                />
                Nuevo (Para Orientación)
              </label>
              <label className="flex items-center text-sm cursor-pointer">
                <input
                  type="radio"
                  value="antiguos"
                  checked={manualTipo === 'antiguos'}
                  onChange={() => setManualTipo('antiguos')}
                  className="mr-2"
                />
                Antiguo (Viejo)
              </label>
            </div>
          </div>

          <form onSubmit={handleGuardarManual} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nombres y Apellidos <span className="text-red-500">*</span></label>
              <input
                type="text"
                required
                value={manualNombre}
                onChange={(e) => setManualNombre(e.target.value)}
                className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ej: Juan David Pérez"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Teléfono / WhatsApp <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={manualTelefono}
                  onChange={(e) => setManualTelefono(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: 3101234567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Congregación <span className="text-red-500">*</span></label>
                <input
                  type="text"
                  required
                  value={manualCongregacion}
                  onChange={(e) => setManualCongregacion(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ej: Central"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Ciudad</label>
                <select
                  value={manualCiudad}
                  onChange={(e) => setManualCiudad(e.target.value)}
                  className="w-full p-3 border border-gray-300 rounded-xl bg-white outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="Cali">Cali</option>
                  <option value="Palmira">Palmira</option>
                  <option value="Jamundí">Jamundí</option>
                  <option value="Yumbo">Yumbo</option>
                </select>
              </div>

              <div className="flex items-end pb-2">
                <label className="flex items-center cursor-pointer p-3 border border-amber-200 bg-amber-50 rounded-xl w-full">
                  <input
                    type="checkbox"
                    checked={manualPrioridad}
                    onChange={(e) => setManualPrioridad(e.target.checked)}
                    className="w-5 h-5 text-amber-600 rounded mr-3"
                  />
                  <span className="text-sm font-bold text-amber-900">¿Es Prioridad (Urgente)?</span>
                </label>
              </div>
            </div>

            {manualTipo === 'antiguos' && (
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-xl">
                <label className="block text-sm font-bold text-indigo-900 mb-1">
                  Punto Fijo Asignado <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={manualPuntoFijo}
                  onChange={(e) => setManualPuntoFijo(e.target.value)}
                  className="w-full p-3 border border-indigo-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ej: CAM"
                />
              </div>
            )}

            <div className="pt-6 border-t border-gray-100">
              <button
                type="submit"
                disabled={cargando}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-4 rounded-xl font-bold flex justify-center disabled:opacity-50"
              >
                {cargando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : 'Guardar Participante'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}