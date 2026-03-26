import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Save, AlertCircle, CheckCircle, Lock, Eye, EyeOff } from 'lucide-react' // <-- Agregamos Eye y EyeOff

export default function ForzarCambioClave({ onClaveCambiada }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false) // <-- Estado para el 1er campo
  const [showConfirmPassword, setShowConfirmPassword] = useState(false) // <-- Estado para el 2do campo
  const [loading, setLoading] = useState(false)
  const [mensaje, setMensaje] = useState(null)

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    
    if (password.length < 6) {
      setMensaje({ tipo: 'error', texto: 'La contraseña debe tener al menos 6 caracteres.' })
      return
    }

    if (password !== confirmPassword) {
      setMensaje({ tipo: 'error', texto: 'Las contraseñas no coinciden.' })
      return
    }

    if (password === 'PasswordTemporal123!') {
      setMensaje({ tipo: 'error', texto: 'Debes elegir una contraseña diferente a la temporal.' })
      return
    }

    setLoading(true)
    setMensaje(null)

    // Actualizamos la contraseña en Supabase
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setMensaje({ tipo: 'error', texto: error.message })
      setLoading(false)
    } else {
      setMensaje({ tipo: 'exito', texto: '¡Contraseña actualizada con éxito!' })
      // Le damos 2 segundos para que lea el mensaje de éxito antes de mandarlo al dashboard
      setTimeout(() => {
        onClaveCambiada()
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white p-8 rounded-3xl shadow-xl border border-gray-100 text-center">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
          <Lock size={32} />
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Bienvenido a la App</h2>
        <p className="text-gray-500 mb-8 text-sm">
          Por tu seguridad, debes cambiar la contraseña temporal por una nueva antes de continuar al sistema.
        </p>

        {mensaje && (
          <div className={`p-4 mb-6 rounded-xl text-sm font-medium flex items-center text-left ${
            mensaje.tipo === 'error' ? 'bg-red-50 text-red-700' : 'bg-green-50 text-green-700'
          }`}>
            {mensaje.tipo === 'error' ? <AlertCircle className="w-5 h-5 mr-2 flex-shrink-0" /> : <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0" />}
            {mensaje.texto}
          </div>
        )}

        <form onSubmit={handleUpdatePassword} className="space-y-4 text-left">
          
          {/* PRIMER CAMPO: NUEVA CONTRASEÑA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
            <div className="relative">
              <input 
                type={showPassword ? "text" : "password"} 
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Minimo 6 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          {/* SEGUNDO CAMPO: CONFIRMAR CONTRASEÑA */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmar Contraseña</label>
            <div className="relative">
              <input 
                type={showConfirmPassword ? "text" : "password"} 
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full p-3 pr-12 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Repite la contraseña"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-all mt-4 flex justify-center items-center disabled:opacity-50"
          >
            {loading ? 'Guardando...' : <><Save size={18} className="mr-2" /> Guardar y Continuar</>}
          </button>
        </form>
      </div>
    </div>
  )
}