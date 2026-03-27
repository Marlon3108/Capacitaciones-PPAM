import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { supabase } from '../supabaseClient'
import { Save, AlertCircle, CheckCircle, Loader2, Lock, SaveAll } from 'lucide-react'
import BuscadorSelect from './BuscadorSelect'

const PUNTOS_METROPOLITANA = [
  { value: 'Cali- AVIANCA', label: 'Cali- AVIANCA' },
  { value: 'Cali- BUITRERA', label: 'Cali- BUITRERA' },
  { value: 'Cali- CANCHAS PANAMERICANAS', label: 'Cali- CANCHAS PANAMERICANAS' },
  { value: 'Cali- CARRERA OCTAVA', label: 'Cali- CARRERA OCTAVA' },
  { value: 'Cali- CAM', label: 'Cali- CAM' },
  { value: 'Cali- GOBERNACIÓN DEL VALLE', label: 'Cali- GOBERNACIÓN DEL VALLE' },
  { value: 'Cali- IMBANACO', label: 'Cali- IMBANACO' },
  { value: 'Cali- LA 14 CALIMA', label: 'Cali- LA 14 CALIMA' },
  { value: 'Cali- PLAZA CAYZEDO', label: 'Cali- PLAZA CAYZEDO' },
  { value: 'Jamundí', label: 'Jamundí' },
  { value: 'Palmira- BOLIVAR', label: 'Palmira- BOLIVAR' },
  { value: 'Palmira- LA FACTORÍA', label: 'Palmira- LA FACTORÍA' },
  { value: 'Yumbo', label: 'Yumbo' }
]

export default function FormularioLCCS({ preDatos = null }) {
  const [opcionesParticipantes, setOpcionesParticipantes] = useState([])
  const [enviando, setEnviando] = useState(false)
  const [hayBorrador, setHayBorrador] = useState(false)
  
  const [modalExito, setModalExito] = useState(false)
  const [errorSuperior, setErrorSuperior] = useState(null)
  
  const [nombreCapacitadorLogueado, setNombreCapacitadorLogueado] = useState('')

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm()
  
  const participanteId = watch('participante')
  const puntoMetropolitana = watch('punto')
  const formValues = watch()

  // 1. CARGAR DATOS INICIALES Y REVISAR BORRADORES
  useEffect(() => {
    const fetchDatosIniciales = async () => {
      // 1. SIEMPRE buscar al usuario logueado y fijarlo
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const { data: usuario } = await supabase.from('usuarios').select('id, nombre_completo').eq('id', session.user.id).single()
        if (usuario) {
          setNombreCapacitadorLogueado(usuario.nombre_completo)
          setValue('capacitador_id', usuario.id) // Fijamos su ID en el form oculto
        }
      }

      // 2. Si no hay preDatos (Entró por el menú libre)
      if (!preDatos) {
        const { data: partData } = await supabase.from('participantes').select('id, nombres_apellidos, codigo_unico').eq('estado', 'pendiente')
        if (partData) setOpcionesParticipantes(partData.map(p => ({ value: p.id, label: `${p.nombres_apellidos} (Cód: ${p.codigo_unico})` })))
      } 
      // 3. Si hay preDatos (Entró por el botón Iniciar Evaluación)
      else {
        if (preDatos.fecha_programada) {
          const fechaObj = new Date(preDatos.fecha_programada)
          setValue('fecha', fechaObj.toISOString().split('T')[0])
        }
        setValue('punto', preDatos.punto_programado || '')
        setValue('participante', preDatos.id)

        // Revisar borrador
        const borradorGuardado = localStorage.getItem(`borrador_lccs_${preDatos.id}`)
        if (borradorGuardado) {
          const datosParseados = JSON.parse(borradorGuardado)
          Object.keys(datosParseados).forEach(key => {
            if (!['fecha', 'punto', 'participante', 'capacitador_id'].includes(key)) {
              setValue(key, datosParseados[key])
            }
          })
          setHayBorrador(true)
          setTimeout(() => setHayBorrador(false), 5000)
        }
      }
    }
    
    fetchDatosIniciales()
  }, [preDatos, setValue])

  useEffect(() => {
    if (participanteId && Object.keys(formValues).length > 0) {
      const timer = setTimeout(() => {
        localStorage.setItem(`borrador_lccs_${participanteId}`, JSON.stringify(formValues))
      }, 1000)
      return () => clearTimeout(timer)
    }
  }, [formValues, participanteId])

  const onSubmit = async (data) => {
    if (!data.capacitador_id || !data.participante || !data.punto) return

    setEnviando(true)
    setErrorSuperior(null)
    
    const evaluacion = {
      participante_id: data.participante,
      capacitador_id: data.capacitador_id,
      punto_metropolitana: data.punto,
      tipo_capacitacion: data.tipoCapacitacion,
      fecha_capacitacion: data.fecha,
      resultado_aprobacion: data.resultadoAprobacion,
      observaciones_finales: data.observaciones,
      respuestas: data 
    }

    try {
      const { error: errorEval } = await supabase.from('evaluaciones_lccs').insert([evaluacion])
      if (errorEval) throw errorEval

      const { error: errorPart } = await supabase.from('participantes')
        .update({ estado: data.resultadoAprobacion || 'evaluado' })
        .eq('id', data.participante)
      if (errorPart) throw errorPart

      localStorage.removeItem(`borrador_lccs_${data.participante}`)
      setModalExito(true)
      
    } catch (error) {
      setErrorSuperior(error.message)
      window.scrollTo(0, 0)
    }
    setEnviando(false)
  }

  const reiniciarFormulario = () => {
    setModalExito(false)
    reset()
    if (!preDatos) {
      setValue('participante', null)
      setValue('punto', null)
    }
    window.scrollTo(0, 0)
  }

  const CheckboxItem = ({ name, label }) => (
    <label className="flex items-start cursor-pointer group mb-2">
      <div className="mt-1">
        <input type="checkbox" {...register(name)} className="w-5 h-5 text-blue-600 bg-blue-100 border-gray-400 rounded-sm focus:ring-blue-500 cursor-pointer" />
      </div>
      <span className="ml-3 text-sm text-gray-800 group-hover:text-black">{label}</span>
    </label>
  )

  const RadioItem = ({ name, value, label }) => (
    <label className="flex items-start cursor-pointer group mb-2">
      <div className="mt-1">
        <input type="radio" value={value} {...register(name)} className="w-5 h-5 text-blue-600 bg-blue-100 border-gray-400 focus:ring-blue-500 cursor-pointer" />
      </div>
      <span className="ml-3 text-sm text-gray-800 group-hover:text-black">{label}</span>
    </label>
  )

  const inputPDFClass = "w-full bg-blue-100/50 border border-gray-400 px-2 py-1 text-sm outline-none focus:bg-blue-100 focus:border-blue-600"

  return (
    <>
      <div className="max-w-4xl mx-auto bg-white p-8 md:p-12 shadow-xl border border-gray-200 relative">
        
        {hayBorrador && (
          <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-yellow-100 border border-yellow-300 text-yellow-800 px-4 py-2 rounded-full text-sm font-bold flex items-center shadow-md animate-bounce">
            <SaveAll size={16} className="mr-2" /> Se recuperó una evaluación sin terminar
          </div>
        )}

        {errorSuperior && (
          <div className="p-4 mb-6 rounded flex items-center bg-red-50 text-red-700">
            <AlertCircle className="w-5 h-5 mr-2"/>
            Error de conexión: {errorSuperior}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="text-center mb-6 pt-4">
            <h1 className="text-xl font-bold text-black uppercase">
              Informe de Capacitación del Nuevo Participante
            </h1>
          </div>

          <div className="border-2 border-black bg-blue-50/30 p-3 mb-6 text-sm text-justify text-gray-800">
            <strong>Nota al capacitador:</strong> Antes de iniciar la capacitación en sitio lea <em>Guía para los Capacitadores de la Metropolitana</em>. Utilice el siguiente informe como apoyo durante todo el proceso de capacitación de los nuevos participantes y marque cada casilla conforme se vaya realizando. En el recuadro "observaciones finales" escriba los aspectos que requieren mejora y léalos al participante cuando finalice el turno. Una vez concluido el proceso de capacitación, envíe el formulario al Departamento Capacitaciones.
          </div>

          <div className="space-y-4 mb-8">
            <div className="flex flex-col md:flex-row md:items-center">
              <span className="font-bold text-sm w-64 flex items-center">
                Fecha de la capacitación: {preDatos && <Lock size={12} className="ml-1 text-gray-400" />}
              </span>
              <div className="flex flex-col md:w-48">
                {preDatos ? (
                  <div className="w-full bg-gray-100 border border-gray-300 px-2 py-1 text-sm text-gray-600 h-[30px] flex items-center cursor-not-allowed">
                    {preDatos.fecha_programada ? new Date(preDatos.fecha_programada).toLocaleDateString() : 'Sin fecha asignada'}
                  </div>
                ) : (
                  <input type="date" {...register('fecha', { required: true })} className={`${inputPDFClass} ${errors.fecha ? 'border-red-500 bg-red-50' : ''} h-[30px]`} />
                )}
                {errors.fecha && !preDatos && <span className="text-red-500 text-xs mt-1">Obligatorio</span>}
              </div>
            </div>
            
            {/* AQUÍ ESTÁ EL CAMBIO DEL CAPACITADOR */}
            <div className="flex flex-col md:flex-row md:items-start pt-1">
              <span className="font-bold text-sm w-64 mt-1 flex items-center">
                Nombre del capacitador: <Lock size={12} className="ml-1 text-gray-400" />
              </span>
              <div className="flex flex-col flex-1">
                <input type="hidden" {...register('capacitador_id', { required: true })} />
                <div className="w-full bg-gray-100 border border-gray-300 px-2 py-1 text-sm text-gray-600 h-[30px] flex items-center cursor-not-allowed">
                  {nombreCapacitadorLogueado || 'Cargando...'}
                </div>
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start pt-1">
              <span className="font-bold text-sm w-64 mt-1 flex items-center">
                Nombres y apellidos del nuevo participante: {preDatos && <Lock size={12} className="ml-1 text-gray-400" />}
              </span>
              <div className="flex flex-col flex-1">
                {preDatos ? (
                  <div className="w-full bg-gray-100 border border-gray-300 px-2 py-1 text-sm text-gray-600 h-[30px] flex items-center cursor-not-allowed font-semibold">
                    {preDatos.nombres_apellidos}
                  </div>
                ) : (
                  <>
                    <input type="hidden" {...register('participante', { required: true })} />
                    <BuscadorSelect 
                      opciones={opcionesParticipantes}
                      valorSeleccionado={participanteId}
                      alSeleccionar={(val) => setValue('participante', val, { shouldValidate: true })}
                      placeholder="-- Buscar Participante --"
                      error={!participanteId && errors.participante}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-start pt-1">
              <span className="font-bold text-sm w-64 mt-1 flex items-center">
                Punto de la metropolitana: {preDatos && <Lock size={12} className="ml-1 text-gray-400" />}
              </span>
              <div className="flex flex-col flex-1">
                {preDatos ? (
                  <div className="w-full bg-gray-100 border border-gray-300 px-2 py-1 text-sm text-gray-600 h-[30px] flex items-center cursor-not-allowed">
                    {preDatos.punto_programado || 'Sin punto asignado'}
                  </div>
                ) : (
                  <>
                    <input type="hidden" {...register('punto', { required: true })} />
                    <BuscadorSelect 
                      opciones={PUNTOS_METROPOLITANA}
                      valorSeleccionado={puntoMetropolitana}
                      alSeleccionar={(val) => setValue('punto', val, { shouldValidate: true })}
                      placeholder="-- Buscar Punto / Estación --"
                      error={!puntoMetropolitana && errors.punto}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="flex flex-col md:flex-row md:items-center pt-2">
              <span className="font-bold text-sm w-24">Indique:</span>
              <div className="flex flex-col">
                <div className="flex flex-wrap gap-6 items-center">
                  <label className="flex items-center text-sm italic text-gray-700 cursor-pointer">
                    <span className="mr-2">Primera capacitación en sitio</span>
                    <input type="radio" value="Primera" {...register('tipoCapacitacion', { required: true })} className="w-5 h-5 bg-blue-100 border-gray-400" />
                  </label>
                  <label className="flex items-center text-sm italic text-gray-700 cursor-pointer">
                    <span className="mr-2">Refuerzo</span>
                    <input type="radio" value="Refuerzo" {...register('tipoCapacitacion', { required: true })} className="w-5 h-5 bg-blue-100 border-gray-400" />
                  </label>
                  <label className="flex items-center text-sm italic text-gray-700 cursor-pointer">
                    <span className="mr-2">Ultima capacitación en sitio</span>
                    <input type="radio" value="Ultima" {...register('tipoCapacitacion', { required: true })} className="w-5 h-5 bg-blue-100 border-gray-400" />
                  </label>
                </div>
                {errors.tipoCapacitacion && <span className="text-red-500 text-xs mt-1">Seleccione un tipo de capacitación</span>}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div>
              <h2 className="font-bold text-black uppercase mb-2">Antes de la Capacitación</h2>
              <div className="ml-4">
                <CheckboxItem name="antes_1" label="Ya se comunicó con el participante" />
                <CheckboxItem name="antes_2" label="Le comunicó al Hombre clave para informarle de la capacitación y la disponibilidad del turno" />
              </div>
            </div>

            <div>
              <h2 className="font-bold text-black uppercase mb-2">Durante la Capacitación</h2>
              <h3 className="font-bold text-black text-sm mb-1">Requisitos:</h3>
              <div className="ml-4 mb-3"><CheckboxItem name="durante_req_1" label="Se repasaron los requisitos que deben cumplir los participantes" /></div>

              <h3 className="font-bold text-black text-sm mb-1">Equipo de predicación:</h3>
              <div className="ml-4 mb-3">
                <CheckboxItem name="durante_eq_1" label="Se ha llevado al participante a conocer los lugares donde se guardan los exhibidores." />
                <CheckboxItem name="durante_eq_2" label="Se enseña a cómo transportar correctamente los exhibidores." />
                <CheckboxItem name="durante_eq_3" label="Se le enseña a enrollar y guardar correctamente el forro protector del exhibidor." />
                <CheckboxItem name="durante_eq_4" label="Se muestra cómo usar los elementos de limpieza." />
                <CheckboxItem name="durante_eq_5" label="Se explica la forma correcta de organizar las publicaciones y que los encargados son los que indican que publicaciones se colocan en los exhibidores." />
                <CheckboxItem name="durante_eq_6" label="Se muestra que cosas se guardan en la pequeña bodega que hay detrás del exhibidor." />
              </div>

              <h3 className="font-bold text-black text-sm mb-1">Seguridad:</h3>
              <div className="ml-4 mb-3">
                <CheckboxItem name="durante_seg_1" label="Se enseña la forma correcta de ubicar los exhibidores de tal manera que nadie pueda acercarse por detrás y se explica por qué." />
                <CheckboxItem name="durante_seg_2" label="Se explica cómo actuar ante un perturbador y qué hacer." />
                <CheckboxItem name="durante_seg_3" label="Se le ayuda a ver la importancia de la seguridad personal." />
              </div>

              <h3 className="font-bold text-black text-sm mb-1">Turnos:</h3>
              <div className="ml-4 mb-3">
                <CheckboxItem name="durante_tur_1" label="El participante llegó puntual a la cita" />
                <CheckboxItem name="durante_tur_2" label="Se le explica la importancia de estar comprometidos con la asignación." />
                <CheckboxItem name="durante_tur_3" label="Se le ayuda a saber qué hacer en caso de no poder cumplir el turno" />
                <CheckboxItem name="durante_tur_4" label="Se le explica cómo abordar a las personas" />
                <CheckboxItem name="durante_tur_5" label="Durante el turno, sonríe y tiene contacto visual con las personas." />
                <CheckboxItem name="durante_tur_6" label="Repasó la información sobre cómo iniciar conversaciones y hacerlo de forma natural." />
                <CheckboxItem name="durante_tur_7" label="Sabe cómo direccionar a las personas al sitio jw.org" />
                <CheckboxItem name="durante_tur_8" label="No habla demasiado con los demás participantes del turno" />
                <CheckboxItem name="durante_tur_9" label="Aprendió a usar las herramientas digitales" />
              </div>
            </div>

            <div>
              <h2 className="font-bold text-black uppercase mb-2">Después de la Capacitación</h2>
              <h3 className="font-bold text-black text-sm mb-1">Aprobación:</h3>
              <div className="ml-4 mb-4">
                <RadioItem name="resultadoAprobacion" value="aprobado" label="Participante aprobado" />
                <RadioItem name="resultadoAprobacion" value="requiere_refuerzo" label="Requiere refuerzo (en 1 mes)" />
                <RadioItem name="resultadoAprobacion" value="repetir_6_meses" label="Debe realizar nuevamente la capacitación (en 6 meses)" />
                <RadioItem name="resultadoAprobacion" value="no_cumple" label="Definitivamente no cumple los requisitos para la PPAM después de la capacitación a los 6 meses." />
                {errors.resultadoAprobacion && <span className="text-red-500 text-xs mt-1 font-bold">Debe seleccionar una decisión final</span>}
              </div>

              <h3 className="font-bold text-black text-sm mb-1">Observaciones finales:</h3>
              <textarea {...register('observaciones')} rows="5" className="w-full bg-blue-100/50 border border-gray-400 p-2 mb-4 outline-none focus:bg-blue-100 resize-none"></textarea>

              <h3 className="font-bold text-black text-sm mb-1">Informe:</h3>
              <div className="ml-4 mb-6">
                <CheckboxItem name="informe_1" label="Se le ha informado al participante la decisión" />
                <CheckboxItem name="informe_2" label="Se le informó al hombre clave y encargado de punto" />
                <CheckboxItem name="informe_3" label="Se informó al comité de servicio de la congregación del participante que debe llenar nuevamente la solicitud en 6 meses" />
                <CheckboxItem name="informe_4" label="Se informó al comité de servicio que el participante que no fue aprobado." />
              </div>
            </div>
          </div>

          <div className="border-t border-gray-300 pt-6 flex flex-col items-center">
            <span className="text-xs text-gray-500 mb-6">[Antes de enviar el formulario debe verificar toda la información]</span>
            
            <button type="submit" disabled={enviando} className="w-full md:w-auto flex items-center justify-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-10 rounded shadow-xl transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100">
              {enviando ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Save className="mr-2" />}
              {enviando ? 'Guardando evaluación...' : 'Enviar al Departamento Capacitaciones'}
            </button>
          </div>
        </form>
      </div>

      {modalExito && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4">
          <div className="bg-white rounded-3xl shadow-2xl p-10 max-w-sm w-full text-center">
            <div className="mx-auto w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6">
              <CheckCircle className="w-16 h-16 text-green-500" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2">¡Evaluación Guardada!</h2>
            <p className="text-gray-500 mb-8">El informe ha sido enviado con éxito al departamento.</p>
            <button onClick={reiniciarFormulario} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors">
              Comenzar nueva evaluación
            </button>
          </div>
        </div>
      )}
    </>
  )
}