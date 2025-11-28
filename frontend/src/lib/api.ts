/**
 * API client for backend communication
 */
import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

export const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
})

// Request interceptor to add auth token
// Note: For Clerk auth, the token should be set by the calling component
api.interceptors.request.use(
    (config) => {
        // Try legacy token first (for backwards compatibility)
        const legacyToken = localStorage.getItem('access_token')
        if (legacyToken && !config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${legacyToken}`
        }
        return config
    },
    (error) => {
        return Promise.reject(error)
    }
)

// Auth API
export const authApi = {
    login: async (email: string, password: string) => {
        const formData = new FormData()
        formData.append('username', email)
        formData.append('password', password)

        const response = await api.post('/auth/login', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        })
        return response.data
    },

    activateLicense: async (licenseKey: string, machineId: string) => {
        const response = await api.post('/auth/activate-license', {
            license_key: licenseKey,
            machine_id: machineId,
            hardware_info: {},
        })
        return response.data
    },

    getCurrentUser: async () => {
        const response = await api.get('/auth/me')
        return response.data
    },
}

// Clients API
export const clientsApi = {
    list: async () => {
        const response = await api.get('/clients')
        return response.data
    },

    create: async (data: any) => {
        const response = await api.post('/clients', data)
        return response.data
    },
}

// Projects API
export const projectsApi = {
    list: async () => {
        const response = await api.get('/projects')
        return response.data
    },

    create: async (data: any) => {
        const response = await api.post('/projects', data)
        return response.data
    },
}

// Findings API
export const findingsApi = {
    list: async () => {
        const response = await api.get('/findings')
        return response.data
    },

    create: async (data: any) => {
        const response = await api.post('/findings', data)
        return response.data
    },
}

// Reports API
export const reportsApi = {
    list: async () => {
        const response = await api.get('/reports')
        return response.data
    },

    create: async (data: any) => {
        const response = await api.post('/reports', data)
        return response.data
    },
}

// Billing API
export const billingApi = {
    // Get current user's billing info (plan, credits, subscription status)
    getBillingInfo: async (token?: string) => {
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await api.get('/billing/info', { headers })
        return response.data
    },

    // Get organization's billing info
    getOrganizationBilling: async (organizationId: string, token?: string) => {
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await api.get(`/billing/organization/${organizationId}`, { headers })
        return response.data
    },

    // Update subscription after Paddle webhook
    updateSubscription: async (data: any, token?: string) => {
        const headers = token ? { Authorization: `Bearer ${token}` } : {}
        const response = await api.post('/billing/subscription/update', data, { headers })
        return response.data
    },
}
