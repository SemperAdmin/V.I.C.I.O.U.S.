import { create } from 'zustand'
import { User } from '@/types'

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (user: User) => void
  logout: () => void
}

const saved = typeof window !== 'undefined' ? localStorage.getItem('user') : null
let initialUser: User | null = null
let initialAuthenticated = false
try {
  if (saved) {
    initialUser = JSON.parse(saved)
    initialAuthenticated = !!initialUser
  }
} catch {}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: initialUser,
  isAuthenticated: initialAuthenticated,
  
  login: (user: User) => {
    set({ user, isAuthenticated: true })
    localStorage.setItem('user', JSON.stringify(user))
  },
  
  logout: () => {
    set({ user: null, isAuthenticated: false })
    localStorage.removeItem('user')
  },
}))
