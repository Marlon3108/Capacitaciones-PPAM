import { useState, useEffect } from 'react'
import { read, utils } from 'xlsx'
import { UploadCloud, Link as LinkIcon, CheckCircle2, AlertCircle, Loader2, ShieldAlert } from 'lucide-react'
import { supabase } from '../supabaseClient'

export default function ImportadorSheets() {
  const [datosBrutos, setDatosBrutos] = useState([])
  const [encabezados, setEncabezados] = useState([])
  const [archivo, setArchivo] = useState(null)
  
  // NUEVO ESTADO: Saber qué tipo de lista estamos subiendo
  const [tipoImportacion, setTipoImportacion] = useState('nuevos') // 'nuevos' o 'antiguos'

  const [columnaNombre, setColumnaNombre] = useState('')
  const [columnaCiudad, setColumnaCiudad] = useState('')
  const [columnaCongregacion, setColumnaCongregacion] = useState('')
  const [columnaTelefono, setColumnaTelefono] = useState('')
  const [columnaPrioridad, setColumnaPrioridad] = useState('')
  const [columnaPuntoFijo, setColumnaPuntoFijo] = useState('')
  
  const [cargando, setCargando] = useState(false)
  const [mensaje, setMensaje] = useState(null)
  const [isDragging, setIsDragging] = useState(false)

  // ESTADOS DE SEGURIDAD
  const [accesoDenegado, setAccesoDenegado] = useState(false)
  const [verificandoRol, setVerificandoRol] = useState(true)

  // EFECTO PARA VERIFICAR ROL AL CARGAR LA PÁGINA
  useEffect(() => {
    const verificarPermisos = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        setVerificandoRol(false)
        return
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('roles(nombre)')
        .eq('id', session.user.id)
        .single()

      const rol = userData?.roles?.nombre?.toLowerCase() || ''
      
      // Si NO es administrador, le bloqueamos la vista
      if (rol !== 'administrador') {
        setAccesoDenegado(true)
      }
      setVerificandoRol(false)
    }
    
    verificarPermisos()
  }, [])

  const procesarArchivo = async (file) => {
    if (!file) return
    setArchivo(file.name)
    setMensaje(null)

    const data = await file.arrayBuffer()
    const workbook = read(data)
    const worksheet = workbook.Sheets[workbook.SheetNames[0]]
    const jsonData = utils.sheet_to_json(worksheet, { header: 1 })
    
    if (jsonData.length > 1) {
      setEncabezados(jsonData[0])
      setDatosBrutos(jsonData.slice(1))
    }
  }

  const handleFileUpload = (e) => procesarArchivo(e.target.files[0])
  const handleDragOver = (e) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = (e) => { e.preventDefault(); setIsDragging(false) }
  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) procesarArchivo(e.dataTransfer.files[0])
  }

  const generarCodigoUnico = () => {
    const caracteres = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let codigo = ''
    for (let i = 0; i < 6; i++) codigo += caracteres.charAt(Math.floor(Math.random() * caracteres.length))
    return codigo
  }

  // LÓGICA INTELIGENTE ANTI-DUPLICADOS Y CATEGORÍAS
  const handleImportar = async () => {
    if (!columnaNombre || !columnaCiudad || !columnaCongregacion || !columnaTelefono || !columnaPrioridad) {
      setMensaje({ tipo: 'error', texto: 'Por favor, selecciona todas las columnas base requeridas (Nombre, Ciudad, Congregación, Teléfono y Prioridad).' })
      return
    }

    if (tipoImportacion === 'antiguos' && !columnaPuntoFijo) {
      setMensaje({ tipo: 'error', texto: 'Has indicado que son participantes Antiguos. Debes seleccionar la columna de Punto Fijo.' })
      return
    }

    setCargando(true)
    setMensaje(null)

    const indiceNombre = encabezados.indexOf(columnaNombre)
    const indiceCiudad = encabezados.indexOf(columnaCiudad)
    const indiceCongregacion = encabezados.indexOf(columnaCongregacion)
    const indiceTelefono = encabezados.indexOf(columnaTelefono)
    const indicePrioridad = encabezados.indexOf(columnaPrioridad)
    const indicePunto = tipoImportacion === 'antiguos' ? encabezados.indexOf(columnaPuntoFijo) : -1

    try {
      // 1. Traer los participantes que YA existen en Supabase (Ahora traemos categoría y punto_fijo)
      const { data: existentes, error: errorFetch } = await supabase
        .from('participantes')
        .select('id, nombres_apellidos, ciudad, congregacion, codigo_unico, estado, telefono, categoria, punto_fijo')

      if (errorFetch) throw errorFetch

      const nuevosAInsertar = []
      const existentesAActualizar = []

      // 2. Comparar el Excel con la Base de Datos
      datosBrutos.forEach(fila => {
        const nombreExcel = fila[indiceNombre] ? fila[indiceNombre].toString().trim() : ''
        if (!nombreExcel) return // Ignorar filas vacías

        const ciudadExcel = fila[indiceCiudad] ? fila[indiceCiudad].toString().trim() : 'No especificada'
        const congregacionExcel = fila[indiceCongregacion] ? fila[indiceCongregacion].toString().trim() : 'No especificada'
        const telefonoExcel = fila[indiceTelefono] ? fila[indiceTelefono].toString().trim() : null
        
        let prioridadExcel = false
        if (fila[indicePrioridad] !== undefined && fila[indicePrioridad] !== null) {
          const val = fila[indicePrioridad].toString().toUpperCase().trim()
          prioridadExcel = (val === 'TRUE' || val === 'VERDADERO' || val === 'SI' || val === '1')
        }

        // Determinar Categoría y Punto Fijo según el tipo de importación
        let categoriaCalculada = 'nuevo_orientacion'
        let puntoFijoCalculado = null

        if (tipoImportacion === 'antiguos') {
          const puntoExcel = fila[indicePunto] ? fila[indicePunto].toString().trim() : ''
          if (puntoExcel) {
            categoriaCalculada = 'viejo_punto_fijo'
            puntoFijoCalculado = puntoExcel
          } else {
            categoriaCalculada = 'viejo_sin_punto'
          }
        }

        // Buscar si ya existe alguien con ese mismo nombre exacto
        const pExistente = existentes.find(p => p.nombres_apellidos.toLowerCase() === nombreExcel.toLowerCase())

        if (pExistente) {
          // Si existe, verificamos si cambió algún dato, INCLUYENDO SU CATEGORÍA O PUNTO FIJO
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
            })
          }
        } else {
          // Es alguien totalmente nuevo
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
          })
        }
      })

      // 3. Ejecutar las operaciones en la base de datos
      if (nuevosAInsertar.length > 0) {
        const { error: errIn } = await supabase.from('participantes').insert(nuevosAInsertar)
        if (errIn) throw errIn
      }
      
      if (existentesAActualizar.length > 0) {
        const { error: errUp } = await supabase.from('participantes').upsert(existentesAActualizar)
        if (errUp) throw errUp
      }

      setMensaje({ 
        tipo: 'exito', 
        texto: `Proceso completado: Se agregaron ${nuevosAInsertar.length} nuevos y se actualizaron los datos de ${existentesAActualizar.length} existentes.` 
      })
      
      setTimeout(() => {
        setArchivo(null)
        setEncabezados([])
        setDatosBrutos([])
        setColumnaNombre(''); setColumnaCiudad(''); setColumnaCongregacion(''); setColumnaTelefono(''); setColumnaPrioridad(''); setColumnaPuntoFijo('')
      }, 5000)

    } catch (error) {
      console.error(error)
      setMensaje({ tipo: 'error', texto: 'Error de base de datos: ' + error.message })
    }
    
    setCargando(false)
  }

  if (verificandoRol) {
    return <div className="h-full flex items-center justify-center"><Loader2 className="animate-spin mr-2 text-blue-600" /> Verificando permisos...</div>
  }

  if (accesoDenegado) {
    return (
      <div className="bg-red-50 border border-red-200 p-8 rounded-2xl flex flex-col items-center justify-center text-center max-w-md mx-auto mt-10">
        <ShieldAlert size={48} className="text-red-500 mb-4" />
        <h2 className="text-xl font-bold text-red-800 mb-2">Acceso Restringido</h2>
        <p className="text-red-600">No tienes los permisos necesarios para importar bases de datos. Esta acción es exclusiva para Administradores.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Paso 1: Cargar Participantes</h2>
        <p className="text-gray-500 mb-6 text-sm">
          El sistema es inteligente: Si el participante ya existe, <strong>no lo duplicará</strong>, solo actualizará su información si detecta cambios. Si es nuevo, le generará un código.
        </p>

        <div className="flex items-center justify-center w-full">
          <label 
            onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}
            className={`flex flex-col items-center justify-center w-full h-48 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300 bg-gray-50 hover:bg-gray-100'
            }`}
          >
            <div className="flex flex-col items-center justify-center pt-5 pb-6 pointer-events-none">
              <UploadCloud className={`w-12 h-12 mb-3 ${isDragging ? 'text-blue-500' : 'text-gray-400'}`} />
              <p className="mb-2 text-sm text-gray-500">
                {isDragging ? <span className="font-semibold text-blue-600">¡Suelta el archivo aquí!</span> : <><span className="font-semibold">Haz clic para subir</span> o arrastra el archivo Excel/CSV</>}
              </p>
            </div>
            <input type="file" className="hidden" accept=".xlsx, .csv" onChange={handleFileUpload}/>
          </label>
        </div>

        {archivo && (
          <div className="mt-4 p-4 bg-green-50 border border-green-100 rounded-lg flex items-center text-green-700">
            <CheckCircle2 className="w-5 h-5 mr-2 flex-shrink-0" />
            <div className="truncate">Archivo cargado: <span className="font-medium ml-1">{archivo}</span></div>
            <span className="ml-auto text-sm font-medium flex-shrink-0">({datosBrutos.length} filas)</span>
          </div>
        )}
      </div>

      {encabezados.length > 0 && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
          
          <div className="mb-8 bg-blue-50 p-5 rounded-xl border border-blue-200">
            <h3 className="font-bold text-blue-900 mb-3 text-lg">Paso 2: ¿Qué tipo de lista estás subiendo?</h3>
            <div className="flex flex-col sm:flex-row gap-4">
              <label className={`flex-1 flex items-start p-4 rounded-xl border cursor-pointer transition-all ${tipoImportacion === 'nuevos' ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-100' : 'bg-blue-50/50 border-blue-200 hover:bg-white/60'}`}>
                <input type="radio" name="tipo" value="nuevos" checked={tipoImportacion === 'nuevos'} onChange={() => setTipoImportacion('nuevos')} className="mt-1 mr-3 w-5 h-5 text-blue-600 focus:ring-blue-500"/>
                <div>
                  <p className="font-bold text-gray-800 text-base">Nuevos</p>
                  <p className="text-xs text-gray-500 mt-1">Participantes recientes listos para ir a la reunión de orientación.</p>
                </div>
              </label>
              
              <label className={`flex-1 flex items-start p-4 rounded-xl border cursor-pointer transition-all ${tipoImportacion === 'antiguos' ? 'bg-white border-blue-500 shadow-md ring-2 ring-blue-100' : 'bg-blue-50/50 border-blue-200 hover:bg-white/60'}`}>
                <input type="radio" name="tipo" value="antiguos" checked={tipoImportacion === 'antiguos'} onChange={() => setTipoImportacion('antiguos')} className="mt-1 mr-3 w-5 h-5 text-blue-600 focus:ring-blue-500"/>
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
              <div className="w-10 flex justify-center text-gray-400"><LinkIcon size={16}/></div>
              <div className="w-1/2">
                <select value={columnaNombre} onChange={(e) => setColumnaNombre(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Selecciona --</option>
                  {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="w-1/3"><span className="font-medium text-gray-700 text-sm">Ciudad asignada <span className="text-red-500">*</span></span></div>
              <div className="w-10 flex justify-center text-gray-400"><LinkIcon size={16}/></div>
              <div className="w-1/2">
                <select value={columnaCiudad} onChange={(e) => setColumnaCiudad(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Selecciona --</option>
                  {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-gray-200 rounded-lg">
              <div className="w-1/3"><span className="font-medium text-gray-700 text-sm">Congregación <span className="text-red-500">*</span></span></div>
              <div className="w-10 flex justify-center text-gray-400"><LinkIcon size={16}/></div>
              <div className="w-1/2">
                <select value={columnaCongregacion} onChange={(e) => setColumnaCongregacion(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Selecciona --</option>
                  {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-blue-200 rounded-lg bg-blue-50/50">
              <div className="w-1/3"><span className="font-medium text-blue-900 text-sm">Teléfono / WhatsApp <span className="text-red-500">*</span></span></div>
              <div className="w-10 flex justify-center text-blue-400"><LinkIcon size={16}/></div>
              <div className="w-1/2">
                <select value={columnaTelefono} onChange={(e) => setColumnaTelefono(e.target.value)} className="w-full p-2 border border-blue-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">-- Selecciona --</option>
                  {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 border border-amber-200 rounded-lg bg-amber-50/50">
              <div className="w-1/3"><span className="font-medium text-amber-900 text-sm">Prioritario (Urgente) <span className="text-red-500">*</span></span></div>
              <div className="w-10 flex justify-center text-amber-400"><LinkIcon size={16}/></div>
              <div className="w-1/2">
                <select value={columnaPrioridad} onChange={(e) => setColumnaPrioridad(e.target.value)} className="w-full p-2 border border-amber-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-amber-500">
                  <option value="">-- Selecciona --</option>
                  {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                </select>
              </div>
            </div>

            {tipoImportacion === 'antiguos' && (
              <div className="flex items-center justify-between p-3 border border-indigo-200 rounded-lg bg-indigo-50 animate-in fade-in">
                <div className="w-1/3">
                  <span className="font-bold text-indigo-900 text-sm flex flex-col">
                    Punto Fijo Asignado <span className="text-xs text-indigo-500 font-normal">Si aplica</span>
                  </span>
                </div>
                <div className="w-10 flex justify-center text-indigo-400"><LinkIcon size={16}/></div>
                <div className="w-1/2">
                  <select value={columnaPuntoFijo} onChange={(e) => setColumnaPuntoFijo(e.target.value)} className="w-full p-2 border border-indigo-300 rounded-lg text-sm bg-white outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">-- Selecciona (Obligatorio) --</option>
                    {encabezados.map(enc => <option key={enc} value={enc}>{enc}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>

          {mensaje && (
            <div className={`p-4 mb-6 rounded-lg flex items-start text-sm border ${mensaje.tipo === 'error' ? 'bg-red-50 text-red-700 border-red-200' : 'bg-green-50 text-green-700 border-green-200'}`}>
              {mensaje.tipo === 'error' ? <AlertCircle className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0"/> : <CheckCircle2 className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0"/>}
              <div className="font-medium">{mensaje.texto}</div>
            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100">
            <button onClick={handleImportar} disabled={cargando} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-bold transition-all shadow-md flex items-center disabled:opacity-50 disabled:scale-100 transform hover:scale-[1.02]">
              {cargando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              {cargando ? 'Guardando en base de datos...' : 'Procesar e Importar Participantes'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}