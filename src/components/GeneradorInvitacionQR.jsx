import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import domtoimage from 'dom-to-image';
import { Download, Copy, Calendar, User, Search, CheckCircle2 } from 'lucide-react';

export default function GeneradorInvitacionQR() {
  const [participantes, setParticipantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [participanteSeleccionado, setParticipanteSeleccionado] = useState(null);

  const [fechaReunion, setFechaReunion] = useState('');
  const [horaReunion, setHoraReunion] = useState('');
  const [lugarReunion, setLugarReunion] = useState('');

  const [mensajeCopiado, setMensajeCopiado] = useState(false);
  const tarjetaRef = useRef(null);

  useEffect(() => {
    cargarParticipantes();
  }, []);

  const cargarParticipantes = async () => {
    try {
      setCargando(true);

      const { data, error } = await supabase
        .from('participantes')
        .select('id, nombres_apellidos, congregacion, estado, codigo_unico')
        .order('nombres_apellidos', { ascending: true });

      if (error) throw error;

      setParticipantes(data || []);
    } catch (error) {
      console.error('Error cargando participantes:', error);
    } finally {
      setCargando(false);
    }
  };

  const participantesFiltrados = participantes.filter(
    (p) =>
      (p.nombres_apellidos?.toLowerCase() || '').includes(busqueda.toLowerCase()) ||
      (p.congregacion?.toLowerCase() || '').includes(busqueda.toLowerCase())
  );

  const descargarTarjeta = async () => {
    if (!tarjetaRef.current || !participanteSeleccionado) return;
    
    try {
      // Usamos dom-to-image. Aumentamos la calidad multiplicando el tamaño
      const scale = 2;
      const node = tarjetaRef.current;
      
      const style = {
        transform: `scale(${scale})`,
        transformOrigin: 'top left',
        width: node.offsetWidth + 'px',
        height: node.offsetHeight + 'px'
      };

      const dataUrl = await domtoimage.toPng(node, {
        height: node.offsetHeight * scale,
        width: node.offsetWidth * scale,
        style
      });

      const link = document.createElement('a');
      link.href = dataUrl;
      
      const nombreArchivo = (participanteSeleccionado.nombres_apellidos || 'Invitado')
        .replace(/\s+/g, '_')
        .replace(/[^\w\-]/g, '');

      link.download = `Invitacion_Orientacion_${nombreArchivo}.png`;
      link.click();
      
    } catch (error) {
      console.error('Error al generar la imagen:', error);
      alert('Hubo un problema al descargar la imagen. Revisa la consola.');
    }
  };

  const copiarMensaje = () => {
    if (!participanteSeleccionado || !fechaReunion) return;

    const fechaFormateada = new Date(`${fechaReunion}T12:00:00`).toLocaleDateString('es-CO', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });

    const nombre = participanteSeleccionado.nombres_apellidos || 'Invitado/a';
    // AQUÍ EXTRAEMOS EL CÓDIGO ÚNICO
    const codigo = participanteSeleccionado.codigo_unico || 'N/A';

    // AQUÍ AÑADIMOS EL CÓDIGO AL TEXTO
    const textoBase = `¡Hola, ${nombre}!\n\nNos complace informarte que has sido invitado/a a la próxima reunión de orientación para el programa de la Metropolitana.\n\n📅 *Fecha:* ${fechaFormateada}\n⏰ *Hora:* ${horaReunion || 'Por definir'}\n📍 *Lugar:* ${lugarReunion || 'Por definir'}\n\n*IMPORTANTE:* Te enviamos adjunta una tarjeta digital con un código QR. Por favor, guárdala y preséntala el día del evento. Los acomodadores escanearán este código para permitirte el acceso.\n\nTu código manual de ingreso es: *${codigo}*\n\n¡Te esperamos!`;

    navigator.clipboard.writeText(textoBase);
    setMensajeCopiado(true);
    setTimeout(() => setMensajeCopiado(false), 3000);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-10">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Generador de Invitaciones (Orientación)</h1>
        <p className="text-gray-500 mt-1">
          Crea y descarga las tarjetas digitales con QR para enviar por WhatsApp.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
              <Calendar className="mr-2 text-blue-600" size={20} />
              Datos de la Reunión
            </h2>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-gray-600 font-medium mb-1">Fecha Programada</label>
                <input
                  type="date"
                  value={fechaReunion}
                  onChange={(e) => setFechaReunion(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>

              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-gray-600 font-medium mb-1">Hora</label>
                  <input
                    type="time"
                    value={horaReunion}
                    onChange={(e) => setHoraReunion(e.target.value)}
                    className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-600 font-medium mb-1">Lugar</label>
                <input
                  type="text"
                  placeholder="Ej: Salón de Asambleas"
                  value={lugarReunion}
                  onChange={(e) => setLugarReunion(e.target.value)}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-[500px]">
            <div className="mb-4">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
                  size={18}
                />
                <input
                  type="text"
                  placeholder="Buscar participante..."
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 space-y-2">
              {cargando ? (
                <p className="text-center text-gray-500 py-10">Cargando...</p>
              ) : participantesFiltrados.length === 0 ? (
                <p className="text-center text-gray-500 py-10">No hay participantes pendientes.</p>
              ) : (
                participantesFiltrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setParticipanteSeleccionado(p)}
                    className={`w-full text-left p-3 rounded-xl border transition-all ${
                      participanteSeleccionado?.id === p.id
                        ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                        : 'bg-white border-gray-100 hover:border-blue-200'
                    }`}
                  >
                    <p className="font-bold text-gray-800 text-sm">{p.nombres_apellidos}</p>
                    <p className="text-xs text-gray-500 mt-1">{p.congregacion || 'Sin congregación'}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-2">
          {participanteSeleccionado ? (
            <div className="flex flex-col items-center">
              <div
                ref={tarjetaRef}
                style={{
                  width: '100%',
                  maxWidth: '384px',
                  backgroundColor: '#ffffff',
                  borderRadius: '24px',
                  overflow: 'hidden',
                  boxShadow: '0 0 40px rgba(0,0,0,0.05)',
                  border: '1px solid #e5e7eb',
                  fontFamily: 'Arial, sans-serif'
                }}
              >
                <div
                  style={{
                    backgroundColor: '#1e3a8a',
                    textAlign: 'center',
                    padding: '24px 16px'
                  }}
                >
                  <h2
                    style={{
                      fontSize: '20px',
                      fontWeight: '900',
                      color: '#ffffff',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      margin: 0
                    }}
                  >
                    Pase de Acceso
                  </h2>

                  <p
                    style={{
                      color: '#bfdbfe',
                      fontSize: '12px',
                      marginTop: '4px',
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      marginBottom: 0
                    }}
                  >
                    Reunión de Orientación
                  </p>
                </div>

                <div
                  style={{
                    padding: '32px',
                    textAlign: 'center',
                    backgroundColor: '#ffffff'
                  }}
                >
                  <div style={{ marginBottom: '24px' }}>
                    <p
                      style={{
                        fontSize: '12px',
                        fontWeight: '700',
                        color: '#9ca3af',
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        margin: '0 0 4px 0'
                      }}
                    >
                      Invitado Especial
                    </p>

                    <h3
                      style={{
                        fontSize: '24px',
                        fontWeight: '900',
                        color: '#1f2937',
                        lineHeight: '1.2',
                        margin: 0
                      }}
                    >
                      {participanteSeleccionado.nombres_apellidos}
                    </h3>

                    <p
                      style={{
                        fontSize: '14px',
                        fontWeight: '500',
                        color: '#2563eb',
                        marginTop: '8px',
                        marginBottom: 0
                      }}
                    >
                      {participanteSeleccionado.congregacion || 'Sin congregación'}
                    </p>
                  </div>

                  <div
                    style={{
                      display: 'inline-block',
                      padding: '16px',
                      border: '2px solid #f3f4f6',
                      borderRadius: '16px',
                      backgroundColor: '#ffffff',
                      marginBottom: '24px'
                    }}
                  >
                    {/* Volvemos a QRCodeSVG, dom-to-image lo renderiza perfecto */}
                    <QRCodeSVG
                      value={String(participanteSeleccionado.id)}
                      size={180}
                      level="H"
                      fgColor="#0f172a"
                      bgColor="#ffffff"
                    />
                  </div>
                  {/* ESTE ES EL NUEVO BLOQUE DEL CÓDIGO ÚNICO */}
                  <div style={{ marginTop: '12px', textAlign: 'center' }}>
                  <p style={{ 
                    fontSize: '11px', 
                    color: '#6b7280', 
                    textTransform: 'uppercase', 
                    letterSpacing: '0.05em', 
                    margin: '0 0 2px 0' 
                  }}>
                      Código de Ingreso
                  </p>
                  <p style={{ 
                    fontSize: '20px', 
                    fontWeight: '900', 
                    color: '#e11d48', // Color rojo para que resalte
                    letterSpacing: '0.1em', 
                    margin: 0 
                  }}>
                    {participanteSeleccionado.codigo_unico || 'N/A'}
                  </p>
                  </div>


                  <div
                    style={{
                      backgroundColor: '#f9fafb',
                      padding: '16px',
                      borderRadius: '12px',
                      textAlign: 'left'
                    }}
                  >
                    <p
                      style={{
                        fontSize: '12px',
                        color: '#6b7280',
                        lineHeight: '1.5',
                        textAlign: 'center',
                        fontWeight: '500',
                        margin: 0
                      }}
                    >
                      Muestra este código QR en la entrada el día del evento.
                      <br />
                      Es de único uso.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full max-w-sm">
                <button
                  onClick={copiarMensaje}
                  disabled={!fechaReunion}
                  className="flex-1 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {mensajeCopiado ? (
                    <CheckCircle2 size={20} className="mr-2" />
                  ) : (
                    <Copy size={20} className="mr-2" />
                  )}
                  {mensajeCopiado ? '¡Copiado!' : 'Copiar Texto'}
                </button>

                <button
                  onClick={descargarTarjeta}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors shadow-lg"
                >
                  <Download size={20} className="mr-2" />
                  Descargar Imagen
                </button>
              </div>

              {!fechaReunion && (
                <p className="text-red-500 text-sm font-medium mt-4 text-center">
                  * Debes establecer la "Fecha Programada" en el panel lateral antes de copiar el
                  texto para WhatsApp.
                </p>
              )}
            </div>
          ) : (
            <div className="h-full min-h-[400px] flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 border-dashed">
              <div className="text-center text-gray-400">
                <User size={48} className="mx-auto mb-4 opacity-50" />
                <h3 className="text-xl font-bold text-gray-600">Ningún participante seleccionado</h3>
                <p className="mt-2 text-sm max-w-sm">
                  Selecciona una persona de la lista lateral para generar su tarjeta y mensaje de
                  invitación.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}