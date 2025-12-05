/**
 * Client-related types
 */
import { ClientStatus, RiskLevel, CompanySize, FindingsBySeverity } from './common'

/**
 * Full Client interface - used in Clients page and detail modals
 */
export interface Client {
    id: string
    name: string
    logoUrl?: string
    status: ClientStatus
    riskLevel: RiskLevel
    industry: string
    companySize: CompanySize
    primaryContact: string
    email: string
    phone?: string
    websiteUrl?: string
    lastActivity: string
    lastActivityDate: Date
    tags: string[]
    notes?: string
    projectsCount: number
    reportsCount: number
    totalFindings: number
    findingsBySeverity: FindingsBySeverity
    createdAt?: Date
    updatedAt?: Date
    hasPortalAccess?: boolean
}

/**
 * Minimal client reference - used in dropdowns, selects
 */
export interface ClientBasic {
    id: string
    name: string
    logoUrl?: string
}

/**
 * Client for creating/editing
 */
export interface ClientFormData {
    name: string
    industry: string
    companySize: CompanySize
    primaryContact: string
    email: string
    phone?: string
    websiteUrl?: string
    status: ClientStatus
    riskLevel: RiskLevel
    tags: string[]
    notes?: string
}

