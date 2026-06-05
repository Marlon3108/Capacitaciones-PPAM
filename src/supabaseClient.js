// Importamos la función para crear el cliente de Supabase
import { createClient } from '@supabase/supabase-js'

// Leemos las credenciales desde las variables de entorno (.env)
// Estas variables NUNCA deben escribirse directamente en el código
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL         // URL del proyecto en Supabase
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY // Clave pública anónima

// Creamos y exportamos el cliente de Supabase.
// Este objeto es el punto de entrada único para todo:
// autenticación, consultas a la base de datos y storage.
// Se importa en cualquier componente que necesite hablar con el backend.
export const supabase = createClient(supabaseUrl, supabaseAnonKey)