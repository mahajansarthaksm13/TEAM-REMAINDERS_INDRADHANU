import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

// Refreshes the Supabase session on every matched request (cookies), then:
//   /app/* without a user  -> /login?next=<path>
//   /login with a user     -> /app/live
export async function proxy(req: NextRequest) {
  let res = NextResponse.next({ request: req })
  const sb = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
    cookies: {
      getAll: () => req.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => req.cookies.set(name, value))
        res = NextResponse.next({ request: req })
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options))
      },
    },
  })
  const {
    data: { user },
  } = await sb.auth.getUser()

  const { pathname, search } = req.nextUrl
  if (pathname.startsWith("/app") && !user) {
    const url = new URL("/login", req.url)
    url.searchParams.set("next", pathname + search)
    return NextResponse.redirect(url)
  }
  if (pathname === "/login" && user && !req.nextUrl.searchParams.has("error")) return NextResponse.redirect(new URL("/app/live", req.url))
  return res
}

export const config = { matcher: ["/app/:path*", "/login", "/api/:path*"] }
