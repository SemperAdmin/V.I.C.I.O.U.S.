import { createClient, SupabaseClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// Create a mock client for when Supabase is not configured
const createMockClient = (): SupabaseClient => {
  const mockFn = () => {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY environment variables.')
  }
  const mockChannel = {
    on: () => mockChannel,
    subscribe: () => mockChannel,
    unsubscribe: () => {},
  }
  return {
    from: () => ({
      select: mockFn,
      insert: mockFn,
      update: mockFn,
      delete: mockFn,
      upsert: mockFn,
    }),
    auth: {
      signIn: mockFn,
      signOut: mockFn,
      getSession: mockFn,
    },
    channel: () => mockChannel,
    removeChannel: () => {},
  } as unknown as SupabaseClient
}

// Only create real client if both URL and key are provided
export const supabase = url && key ? createClient(url, key) : createMockClient()

