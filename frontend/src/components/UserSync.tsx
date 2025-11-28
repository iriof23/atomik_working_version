/**
 * UserSync Component
 * 
 * Syncs the authenticated user's data from the backend to the global store.
 * This includes plan and credit balance for feature gating.
 * 
 * This component renders nothing - it just runs the sync effect.
 */
import { useEffect, useRef } from 'react'
import { useUser, useAuth } from '@clerk/clerk-react'
import { api } from '@/lib/api'
import { useBillingStore } from '@/lib/store'

export default function UserSync() {
    const { user, isLoaded: isUserLoaded } = useUser()
    const { getToken } = useAuth()
    const setAuthData = useBillingStore((state) => state.setAuthData)
    const setLoading = useBillingStore((state) => state.setLoading)
    const lastSyncedUserId = useRef<string | null>(null)

    useEffect(() => {
        const syncUserData = async () => {
            // Wait for Clerk to load
            if (!isUserLoaded) return
            
            // No user signed in
            if (!user) {
                useBillingStore.getState().reset()
                lastSyncedUserId.current = null
                return
            }
            
            // Already synced this user
            if (lastSyncedUserId.current === user.id) {
                return
            }
            
            try {
                setLoading(true)
                console.log('🔄 Syncing user data from backend...')
                
                // Get auth token
                const token = await getToken()
                if (!token) {
                    console.error('No auth token available for user sync')
                    setLoading(false)
                    return
                }
                
                // Fetch user data with organization from backend
                const response = await api.get('/auth/me', {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })
                
                const data = response.data
                console.log('✅ User data fetched:', data)
                
                // Update the billing store with plan and credits
                setAuthData({
                    plan: data.organization?.plan || 'FREE',
                    credits: data.organization?.creditBalance ?? data.creditBalance ?? 0,
                    organizationId: data.organization?.id || null,
                    subscriptionStatus: data.organization?.subscriptionStatus || null,
                })
                
                lastSyncedUserId.current = user.id
                console.log('✅ Billing store updated:', {
                    plan: data.organization?.plan || 'FREE',
                    credits: data.organization?.creditBalance ?? data.creditBalance ?? 0,
                })
                
            } catch (error: any) {
                console.error('❌ Failed to sync user data:', error)
                console.error('Error details:', error.response?.data)
                
                // Set default values on error
                setAuthData({
                    plan: 'FREE',
                    credits: 0,
                    organizationId: null,
                    subscriptionStatus: null,
                })
            } finally {
                setLoading(false)
            }
        }
        
        syncUserData()
    }, [user, isUserLoaded, getToken, setAuthData, setLoading])

    // This component renders nothing
    return null
}

