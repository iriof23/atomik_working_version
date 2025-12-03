/**
 * Global state management with Zustand
 */
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface User {
    id: string
    email: string
    name: string
    role: string
    organization_id?: string
}

interface AuthState {
    user: User | null
    accessToken: string | null
    refreshToken: string | null
    deploymentMode: 'desktop' | 'docker'
    isAuthenticated: boolean
    setAuth: (user: User, accessToken: string, refreshToken: string) => void
    logout: () => void
    setDeploymentMode: (mode: 'desktop' | 'docker') => void
}

export const useAuthStore = create<AuthState>()(
    persist(
        (set) => ({
            user: null,
            accessToken: null,
            refreshToken: null,
            deploymentMode: 'docker', // Default to docker mode
            isAuthenticated: false,

            setAuth: (user, accessToken, refreshToken) => {
                localStorage.setItem('access_token', accessToken)
                localStorage.setItem('refresh_token', refreshToken)
                set({ user, accessToken, refreshToken, isAuthenticated: true })
            },

            logout: () => {
                localStorage.removeItem('access_token')
                localStorage.removeItem('refresh_token')
                set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
            },

            setDeploymentMode: (mode) => {
                set({ deploymentMode: mode })
            },
        }),
        {
            name: 'auth-storage',
            partialize: (state) => ({
                user: state.user,
                deploymentMode: state.deploymentMode,
                isAuthenticated: state.isAuthenticated,
            }),
        }
    )
)

// Theme store
type Theme = 'light' | 'dark' | 'system'

interface ThemeState {
    theme: Theme
    setTheme: (theme: Theme) => void
    initializeTheme: () => void
}

export const useThemeStore = create<ThemeState>()(
    persist(
        (set, get) => ({
            theme: 'light',  // Default to light mode for Apple/Linear aesthetic

            setTheme: (theme: Theme) => {
                set({ theme })
                applyTheme(theme)
            },

            initializeTheme: () => {
                const { theme } = get()
                applyTheme(theme)
            },
        }),
        {
            name: 'atomik-theme-v2',  // New key to reset all users to light mode
        }
    )
)

// Helper function to apply theme to DOM
function applyTheme(theme: Theme) {
    const root = document.documentElement
    const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
    const effectiveTheme = theme === 'system' ? systemTheme : theme

    if (effectiveTheme === 'dark') {
        root.classList.add('dark')
    } else {
        root.classList.remove('dark')
    }
}

// Listen for system theme changes
if (typeof window !== 'undefined') {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        const { theme } = useThemeStore.getState()
        if (theme === 'system') {
            applyTheme('system')
        }
    })
}

// ============== Billing Store ==============
// Stores user's plan and credit balance for feature gating

type Plan = 'FREE' | 'PRO' | 'AGENCY'

interface BillingState {
    plan: Plan
    credits: number
    isLoading: boolean
    isInitialized: boolean  // Tracks if initial data fetch has completed
    organizationId: string | null
    subscriptionStatus: string | null
    
    // Actions
    setAuthData: (data: { 
        plan: Plan
        credits: number
        organizationId?: string | null
        subscriptionStatus?: string | null
    }) => void
    decrementCredits: (amount: number) => void
    incrementCredits: (amount: number) => void
    setLoading: (loading: boolean) => void
    setInitialized: (initialized: boolean) => void
    reset: () => void
}

export const useBillingStore = create<BillingState>()(
    persist(
        (set, get) => ({
            plan: 'FREE',
            credits: 0,
            isLoading: true,
            isInitialized: false,
            organizationId: null,
            subscriptionStatus: null,

            setAuthData: (data) => {
                set({
                    plan: data.plan,
                    credits: data.credits,
                    organizationId: data.organizationId ?? null,
                    subscriptionStatus: data.subscriptionStatus ?? null,
                    isLoading: false,
                    isInitialized: true,  // Mark as initialized when data is set
                })
            },

            decrementCredits: (amount) => {
                const { credits } = get()
                set({ credits: Math.max(0, credits - amount) })
            },

            incrementCredits: (amount) => {
                const { credits } = get()
                set({ credits: credits + amount })
            },

            setLoading: (loading) => {
                set({ isLoading: loading })
            },

            setInitialized: (initialized) => {
                set({ isInitialized: initialized })
            },

            reset: () => {
                set({
                    plan: 'FREE',
                    credits: 0,
                    isLoading: false,
                    isInitialized: false,
                    organizationId: null,
                    subscriptionStatus: null,
                })
            },
        }),
        {
            name: 'billing-storage',
            partialize: (state) => ({
                plan: state.plan,
                credits: state.credits,
                organizationId: state.organizationId,
                subscriptionStatus: state.subscriptionStatus,
                isInitialized: state.isInitialized,
            }),
        }
    )
)

// ============== Helper Hooks ==============

/**
 * Check if user has access to Pro features
 */
export const useIsPro = () => {
    const plan = useBillingStore((state) => state.plan)
    return plan === 'PRO' || plan === 'AGENCY'
}

/**
 * Check if user has access to Agency features
 */
export const useIsAgency = () => {
    const plan = useBillingStore((state) => state.plan)
    return plan === 'AGENCY'
}

/**
 * Check if user has enough credits for an action
 */
export const useHasCredits = (required: number = 1) => {
    const credits = useBillingStore((state) => state.credits)
    return credits >= required
}

/**
 * Check if billing data has been initialized (prevents flash of default content)
 */
export const useBillingReady = () => {
    const isInitialized = useBillingStore((state) => state.isInitialized)
    const isLoading = useBillingStore((state) => state.isLoading)
    return isInitialized && !isLoading
}

