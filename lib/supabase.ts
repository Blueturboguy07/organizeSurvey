import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// Validate env vars at runtime (not during build)
// During Vercel build, env vars aren't available yet - they're injected at runtime
function validateEnvVars() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your Vercel environment variables.'
    )
  }
  
  // Validate URL format
  if (supabaseUrl && !supabaseUrl.startsWith('https://')) {
    console.warn('⚠️ Supabase URL should start with https://. Current URL:', supabaseUrl)
  }
  
  // Check for placeholder values (indicates env vars not set)
  if (supabaseUrl === 'https://placeholder.supabase.co' || supabaseAnonKey === 'placeholder-anon-key') {
    console.error('❌ Supabase environment variables are using placeholder values. Please set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY')
  }
}

// Client for client-side (uses anon key) - with session persistence
// Use placeholder values during build - will be validated at runtime
export const supabase: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
)

// Browser client singleton for use in client components (with SSR support)
// Use a singleton to avoid multiple GoTrueClient instances
let browserClient: SupabaseClient | null = null

export function createClientComponentClient() {
  // Validate env vars in development
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    if (!supabaseUrl || supabaseUrl === 'https://placeholder.supabase.co') {
      console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not set or using placeholder. Please check your .env.local file.')
    }
    if (!supabaseAnonKey || supabaseAnonKey === 'placeholder-anon-key') {
      console.error('❌ NEXT_PUBLIC_SUPABASE_ANON_KEY is not set or using placeholder. Please check your .env.local file.')
    }
  }
  
  // Return singleton if it exists
  if (browserClient) {
    return browserClient
  }
  
  // Create new client only if it doesn't exist
  browserClient = createBrowserClient(
    supabaseUrl || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key'
  )
  
  return browserClient
}

// Client for server-side API routes (uses service role key, bypasses RLS)
// Falls back to anon key if service key not provided (for development)
export const supabaseAdmin: SupabaseClient = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceKey || supabaseAnonKey || 'placeholder-service-key',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
)

// Export validation function for runtime checks
export { validateEnvVars }

