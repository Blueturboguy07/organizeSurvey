import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: any) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: any) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isOrgAccount = user?.user_metadata?.is_org_account

  // Protect student routes that require authentication
  const studentProtectedRoutes = ['/survey', '/dashboard', '/profile']
  const isStudentProtectedRoute = studentProtectedRoutes.some(route => 
    pathname.startsWith(route)
  )
  
  // Protect org routes that require authentication
  const orgProtectedRoutes = ['/org/dashboard']
  const isOrgProtectedRoute = orgProtectedRoutes.some(route => 
    pathname.startsWith(route)
  )

  // Redirect unauthenticated users from protected routes
  if ((isStudentProtectedRoute || isOrgProtectedRoute) && !user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Redirect org users trying to access student routes to org dashboard
  // Exception: allow org accounts to access /dashboard/chat/ for org chat
  if (isStudentProtectedRoute && isOrgAccount && !pathname.startsWith('/dashboard/chat/')) {
    return NextResponse.redirect(new URL('/org/dashboard', request.url))
  }

  // Redirect student users trying to access org routes to student dashboard
  if (isOrgProtectedRoute && !isOrgAccount && user) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Redirect authenticated users away from auth pages (but not org setup)
  if (user && (pathname === '/login' || pathname === '/register')) {
    // Redirect to appropriate dashboard based on account type
    const redirectUrl = isOrgAccount ? '/org/dashboard' : '/dashboard'
    return NextResponse.redirect(new URL(redirectUrl, request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

