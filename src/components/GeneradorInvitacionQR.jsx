import React, { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '../supabaseClient';
import { QRCodeSVG } from 'qrcode.react';
import domtoimage from 'dom-to-image';
import { Download, Copy, Calendar, User, Search, CheckCircle2, Mail, AlertTriangle, X } from 'lucide-react';

export default function GeneradorInvitacionQR() {
  const [participantes, setParticipantes] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState('');
  const [participanteSeleccionado, setParticipanteSeleccionado] = useState(null);
  const [fechaReunion, setFechaReunion] = useState(() => localStorage.getItem('qr_fecha_reunion') || '');
  const [horaReunion, setHoraReunion] = useState(() => localStorage.getItem('qr_hora_reunion') || '');
  const [lugarReunion, setLugarReunion] = useState(() => localStorage.getItem('qr_lugar_reunion') || '');
  const [mensajeCopiado, setMensajeCopiado] = useState(false);
  const [guardandoSwitch, setGuardandoSwitch] = useState(false);
  const [modalConfirmacion, setModalConfirmacion] = useState({ abierto: false, participante: null });
  const tarjetaRef = useRef(null);

  useEffect(() => {
    cargarParticipantes();
  }, []);

  useEffect(() => { localStorage.setItem('qr_fecha_reunion', fechaReunion); }, [fechaReunion]);
  useEffect(() => { localStorage.setItem('qr_hora_reunion', horaReunion); }, [horaReunion]);
  useEffect(() => { localStorage.setItem('qr_lugar_reunion', lugarReunion.toUpperCase()); }, [lugarReunion]);

  const cargarParticipantes = async () => {
    try {
      setCargando(true);
      const { data, error } = await supabase
        .from('participantes')
        .select('id, nombres_apellidos, congregacion, estado, codigo_unico, qr_token, categoria, invitacion_orientacion_enviada, telefono')
        .eq('categoria', 'nuevo_orientacion')
        .order('nombres_apellidos', { ascending: true });

      if (error) throw error;

      const pendientes = (data || []).filter((p) => p.invitacion_orientacion_enviada !== true);
      setParticipantes(pendientes);

      if (pendientes.length === 0) {
        setParticipanteSeleccionado(null);
      } else if (!participanteSeleccionado) {
        setParticipanteSeleccionado(pendientes[0]);
      } else {
        const sigueVisible = pendientes.find((p) => p.id === participanteSeleccionado.id);
        setParticipanteSeleccionado(sigueVisible || pendientes[0]);
      }
    } catch (error) {
      console.error('Error cargando participantes:', error);
    } finally {
      setCargando(false);
    }
  };

  const participantesFiltrados = useMemo(() => {
    return participantes.filter(
      (p) =>
        (p.nombres_apellidos?.toLowerCase() || '').includes(busqueda.toLowerCase()) ||
        (p.congregacion?.toLowerCase() || '').includes(busqueda.toLowerCase()) ||
        (p.telefono?.toLowerCase() || '').includes(busqueda.toLowerCase())
    );
  }, [participantes, busqueda]);

  const abrirConfirmacionEnvio = (participante) => {
    setModalConfirmacion({ abierto: true, participante });
  };

  const cerrarConfirmacionEnvio = () => {
    if (guardandoSwitch) return;
    setModalConfirmacion({ abierto: false, participante: null });
  };

  const confirmarEnvioInvitacion = async () => {
    const participante = modalConfirmacion.participante;
    if (!participante?.id) return;

    try {
      setGuardandoSwitch(true);
      const { error } = await supabase
        .from('participantes')
        .update({ invitacion_orientacion_enviada: true })
        .eq('id', participante.id);

      if (error) throw error;

      const nuevaLista = participantes.filter((p) => p.id !== participante.id);
      setParticipantes(nuevaLista);

      if (participanteSeleccionado?.id === participante.id) {
        setParticipanteSeleccionado(nuevaLista[0] || null);
      }

      setModalConfirmacion({ abierto: false, participante: null });
    } catch (error) {
      console.error('Error actualizando invitación enviada:', error);
      alert('No fue posible actualizar el estado de la invitación.');
    } finally {
      setGuardandoSwitch(false);
    }
  };

  const descargarTarjeta = async () => {
    if (!tarjetaRef.current || !participanteSeleccionado) return;
    try {
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
        .replace(/[^\w-]/g, '');
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
    const codigo = participanteSeleccionado.qr_token || 'N/A';
    const textoBase = `¡Hola, ${nombre}!



Nos complace informarte que has sido invitado/a a la próxima reunión de orientación para el programa de la Metropolitana.



📅 *Fecha:* ${fechaFormateada}
⏰ *Hora:* ${horaReunion ? new Date(`1970-01-01T${horaReunion}:00`).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Por definir'}
📍 *Lugar:* ${(lugarReunion || 'Por definir').toUpperCase()}
⏰ *Hora:* ${horaReunion ? new Date(`1970-01-01T${horaReunion}:00`).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'Por definir'}



*IMPORTANTE:* Te enviamos adjunta una tarjeta digital con un código QR. Por favor, guárdala y preséntala el día del evento. Los acomodadores escanearán este código para permitirte el acceso.



Tu código manual de ingreso es: *${codigo}*



*SALÓN:* ${(lugarReunion || 'Por definir').toUpperCase()}



¡Te esperamos!`;
    navigator.clipboard.writeText(textoBase);
    setMensajeCopiado(true);
    setTimeout(() => setMensajeCopiado(false), 3000);
  };

  return (
    <>
      <div className="max-w-6xl mx-auto space-y-6 pb-10">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Generador de Invitaciones (Orientación)</h1>
          <p className="text-gray-500 mt-1">Aquí solo aparecen quienes aún no han sido marcados como invitados por WhatsApp para la reunión de orientación.</p>
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
                  <input type="date" value={fechaReunion} onChange={(e) => setFechaReunion(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Hora</label>
                  <input type="time" value={horaReunion} onChange={(e) => setHoraReunion(e.target.value)} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
                <div>
                  <label className="block text-gray-600 font-medium mb-1">Lugar</label>
                  <input type="text" placeholder="Ej: Salón de Asambleas" value={lugarReunion} onChange={(e) => setLugarReunion(e.target.value.toUpperCase())} className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col h-[500px]">
              <div className="mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                  <input type="text" placeholder="Buscar participante..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className="pl-10 pr-4 py-2 w-full border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm" />
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between rounded-xl bg-amber-50 border border-amber-100 px-3 py-2 text-xs text-amber-700 font-medium">
                <span>Pendientes por invitar</span>
                <span>{participantesFiltrados.length}</span>
              </div>

              <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                {cargando ? (
                  <p className="text-center text-gray-500 py-10">Cargando...</p>
                ) : participantesFiltrados.length === 0 ? (
                  <div className="text-center text-gray-500 py-10 space-y-2">
                    <p>No hay participantes pendientes en este módulo.</p>
                    <p className="text-xs text-gray-400">Los que ya fueron marcados como enviados pasan al flujo de Programación.</p>
                  </div>
                ) : (
                  participantesFiltrados.map((p) => (
                    <div
                      key={p.id}
                      onClick={() => setParticipanteSeleccionado(p)}
                      className={`w-full text-left p-3 rounded-xl border transition-all cursor-pointer ${participanteSeleccionado?.id === p.id ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300' : 'bg-white border-gray-100 hover:border-blue-200'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-gray-800 text-sm">{p.nombres_apellidos}</p>
                          <p className="text-xs text-gray-500 mt-1">{p.congregacion || 'Sin congregación'}</p>
                          {p.telefono && <p className="text-xs text-gray-400 mt-1">{p.telefono}</p>}
                        </div>
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                          Pendiente
                        </span>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-3">
                        <span className="text-xs text-gray-600 font-medium">Invitación enviada por WhatsApp</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            abrirConfirmacionEnvio(p);
                          }}
                          className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300 transition-colors hover:bg-gray-400"
                          aria-label={`Marcar invitación enviada para ${p.nombres_apellidos}`}
                        >
                          <span className="inline-block h-5 w-5 transform rounded-full bg-white translate-x-1 shadow" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            {participanteSeleccionado ? (
              <div className="flex flex-col items-center">
                <div ref={tarjetaRef} style={{ width: '100%', maxWidth: '384px', backgroundColor: '#ffffff', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 0 40px rgba(0,0,0,0.05)', border: '1px solid #e5e7eb', fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)' }}>
                  <div style={{ background: 'linear-gradient(135deg, #1d4ed8 0%, #1e3a8a 100%)', textAlign: 'center', padding: '24px 16px' }}>
                    <h2 style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff', letterSpacing: '0.1em', textTransform: 'uppercase', margin: 0 }}>Pase de Acceso</h2>
                    <p style={{ color: '#dbeafe', fontSize: '12px', marginTop: '4px', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 0 }}>Reunión de Orientación</p>
                  </div>
                  <div style={{ padding: '32px', textAlign: 'center' }}>
                    <div style={{ marginBottom: '24px' }}>
                      <p style={{ fontSize: '12px', fontWeight: '700', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.1em', margin: '0 0 4px 0' }}>Invitado Especial</p>
                      <h3 style={{ fontSize: '24px', fontWeight: '900', color: '#0f172a', lineHeight: '1.2', margin: 0 }}>{participanteSeleccionado.nombres_apellidos}</h3>
                      <p style={{ fontSize: '14px', fontWeight: '600', color: '#2563eb', marginTop: '8px', marginBottom: 0 }}>{participanteSeleccionado.congregacion || 'Sin congregación'}</p>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '22px' }}>
                      <div style={{ padding: '14px', borderRadius: '20px', background: 'linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)', border: '1px solid #e5e7eb', boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)' }}>
                        <QRCodeSVG value={String(participanteSeleccionado.qr_token || participanteSeleccionado.id)} size={188} level="H" fgColor="#0f172a" bgColor="#ffffff" />
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '10px', margin: '0 0 16px 0' }}>
                      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '12px 14px', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>Fecha</p>
                        <p style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{fechaReunion ? new Date(`${fechaReunion}T12:00:00`).toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : 'POR DEFINIR'}</p>
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '12px 14px', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>Hora</p>
                        <p style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{horaReunion ? new Date(`1970-01-01T${horaReunion}:00`).toLocaleTimeString('es-CO', { hour: 'numeric', minute: '2-digit', hour12: true }) : 'POR DEFINIR'}</p>
                      </div>
                      <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: '14px', padding: '12px 14px', textAlign: 'center' }}>
                        <p style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 4px 0' }}>Salón</p>
                        <p style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a', margin: 0 }}>{(lugarReunion || 'POR DEFINIR').toUpperCase()}</p>
                      </div>
                    </div>
                    <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e5e7eb', padding: '16px', borderRadius: '14px', textAlign: 'left' }}>
                      <p style={{ fontSize: '12px', color: '#6b7280', lineHeight: '1.5', textAlign: 'center', fontWeight: '500', margin: 0 }}>Muestra este código QR en la entrada el día del evento.<br />Es de único uso.</p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 mt-8 w-full max-w-sm">
                  <button onClick={copiarMensaje} disabled={!fechaReunion} className="flex-1 bg-white border-2 border-blue-600 text-blue-600 hover:bg-blue-50 font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {mensajeCopiado ? <CheckCircle2 size={20} className="mr-2" /> : <Copy size={20} className="mr-2" />}
                    {mensajeCopiado ? '¡Copiado!' : 'Copiar Texto'}
                  </button>
                  <button onClick={descargarTarjeta} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl flex items-center justify-center transition-colors shadow-lg">
                    <Download size={20} className="mr-2" />
                    Descargar Imagen
                  </button>
                </div>

                {!fechaReunion && (
                  <p className="text-red-500 text-sm font-medium mt-4 text-center">* Debes establecer la fecha programada antes de copiar el texto para WhatsApp.</p>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex items-center justify-center bg-white rounded-2xl shadow-sm border border-gray-100 border-dashed">
                <div className="text-center text-gray-400">
                  <User size={48} className="mx-auto mb-4 opacity-50" />
                  <h3 className="text-xl font-bold text-gray-600">No hay participante seleccionado</h3>
                  <p className="mt-2 text-sm max-w-sm">Selecciona una persona pendiente de invitación para generar su tarjeta y el mensaje de WhatsApp.</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {modalConfirmacion.abierto && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-slate-50">
              <div className="flex items-center gap-2">
                <AlertTriangle className="text-amber-500" size={20} />
                <h3 className="font-bold text-gray-800">Confirmar envío</h3>
              </div>
              <button onClick={cerrarConfirmacionEnvio} className="text-gray-400 hover:text-gray-600" disabled={guardandoSwitch}>
                <X size={18} />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-700 leading-relaxed">
                ¿Estás seguro de que ya enviaste la invitación por WhatsApp a
                <span className="font-bold"> {modalConfirmacion.participante?.nombres_apellidos}</span>?
              </p>
              <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 text-xs text-amber-700">
                Al confirmar, este participante dejará de aparecer en este módulo y continuará en el flujo de <span className="font-bold">Programación Capacitacón en Punto</span>.
              </div>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex flex-col sm:flex-row gap-3 justify-end">
              <button
                onClick={cerrarConfirmacionEnvio}
                disabled={guardandoSwitch}
                className="px-4 py-2 rounded-xl border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEnvioInvitacion}
                disabled={guardandoSwitch}
                className="px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white font-bold flex items-center justify-center gap-2"
              >
                <Mail size={16} />
                {guardandoSwitch ? 'Guardando...' : 'Sí, ya la envié'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
