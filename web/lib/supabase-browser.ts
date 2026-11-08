"use client"

import { createBrowserClient } from "@supabase/ssr"
import type { Database } from "./database.types"

let client: ReturnType<typeof createBrowserClient<Database>> | undefined

export function browserDb() {
  return (client ??= createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  ))
}
