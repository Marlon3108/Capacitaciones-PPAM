import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Eye, EyeOff } from 'lucide-react'

export default function Login() {
  // Estado para los campos del formulario
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  
  // Controla si la contraseña se muestra como texto o como puntos
  const [showPassword, setShowPassword] = useState(false)
  
  // Estado de carga mientras Supabase procesa el login
  const [loading, setLoading] = useState(false)
  
  // Mensaje de error si las credenciales son incorrectas
  const [error, setError] = useState(null)

  const handleLogin = async (e) => {
    e.preventDefault() // Evita que el formulario recargue la página
    setLoading(true)
    setError(null)

    // Le pedimos a Supabase que verifique el correo y contraseña.
    // Si son correctos, Supabase devuelve un JWT (token de sesión)
    // que queda guardado automáticamente en el navegador.
    // App.jsx escucha este cambio con onAuthStateChange y redirige al dashboard.
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    // Si Supabase rechaza las credenciales, mostramos el error
    if (error) {
      setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
      {/* Encabezado con ícono y nombre del sistema */}
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800">DC APP</h2>
        <p className="text-gray-500 text-sm mt-2">Sistema de Capacitadores PPAM</p>
      </div>

      <form onSubmit={handleLogin} className="space-y-6">
        {/* Campo de correo electrónico */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Correo Electrónico
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
            placeholder="admin@ejemplo.com"
            required
          />
        </div>

        {/* Campo de contraseña con botón para mostrar/ocultar */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Contraseña
          </label>
          <div className="relative">
            {/* El type cambia dinámicamente según showPassword */}
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-3 pr-12 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-colors"
              placeholder="••••••••"
              required
            />
            
            {/* Botón del ojo — type="button" es crítico para que no dispare el submit */}
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 pr-4 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none transition-colors"
            >
              {/* Alterna entre el ícono de ojo abierto y cerrado */}
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
        </div>

        {/* Mensaje de error — solo se muestra si Supabase devuelve un error */}
        {error && (
          <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm text-center">
            {/* Traducimos el error más común al español */}
            {error === 'Invalid login credentials' ? 'Credenciales incorrectas' : error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Iniciando sesión...' : 'Ingresar al sistema'}
        </button>
      </form>
    </div>
  )
}