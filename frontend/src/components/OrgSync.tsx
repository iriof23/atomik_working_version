/**
 * OrgSync Component
 * 
 * Watches the active Clerk organization and syncs it to the backend database.
 * This ensures organizations exist in the database before billing webhooks need them.
 * 
 * This component renders nothing - it just runs the sync effect.
 */
import { useEffect, useRef } from 'react'
import { useOrganization, useAuth } from '@clerk/clerk-react'
import { api } from '@/lib/api'

export default function OrgSync() {
    const { organization, isLoaded } = useOrganization()
    const { getToken } = useAuth()
    const lastSyncedOrgId = useRef<string | null>(null)

    useEffect(() => {
        const syncOrganization = async () => {
            // Wait for Clerk to load
            if (!isLoaded) return
            
            // No organization selected
            if (!organization) {
                lastSyncedOrgId.current = null
                return
            }
            
            // Already synced this org
            if (lastSyncedOrgId.current === organization.id) {
                return
            }
            
            try {
                // Get auth token
                const token = await getToken()
                if (!token) {
                    return
                }
                
                // Sync organization to backend
                await api.post(
                    '/v1/orgs/sync',
                    {
                        id: organization.id,
                        name: organization.name,
                        slug: organization.slug || organization.id,
                    },
                    {
                        headers: {
                            Authorization: `Bearer ${token}`
                        }
                    }
                )
                
                lastSyncedOrgId.current = organization.id
                
            } catch (error: any) {
                console.error('❌ Failed to sync organization:', error)
                console.error('Error details:', error.response?.data)
            }
        }
        
        syncOrganization()
    }, [organization, isLoaded, getToken])

    // This component renders nothing
    return null
}

