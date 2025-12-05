/**
 * Finding-related types
 */
import { Severity, FindingStatus } from './common'

/**
 * Affected asset in a finding
 */
export interface AffectedAsset {
    url: string
    description: string
    instanceCount: number
}

/**
 * Screenshot/evidence attachment
 */
export interface Screenshot {
    id: string
    url: string
    caption: string
}

/**
 * Full Finding interface - used in findings tab, edit modal
 */
export interface ProjectFinding {
    id: string
    referenceId?: string  // Professional Finding ID (e.g., "ACME-001")
    owaspId: string
    title: string
    severity: Severity
    cvssScore?: number
    cvssVector?: string
    status: FindingStatus
    description: string
    recommendations: string
    evidence?: string
    references?: string
    affectedAssets: AffectedAsset[]
    screenshots: Screenshot[]
    project?: {
        client?: {
            name?: string
            code?: string
        }
    }
}

/**
 * Finding template - used in Findings Database
 */
export interface FindingTemplate {
    id: string
    title: string
    severity: string
    category: string
    description: string
    remediation?: string
    recommendation?: string
    evidence?: string
    owasp_reference?: string
    cvss_score?: number
    cvss_vector?: string
    cvssScore?: number
    cvssVector?: string
    references?: string
    isCustom?: boolean
    createdAt?: string
}

/**
 * Finding for API responses
 */
export interface FindingResponse {
    id: string
    referenceId: string
    title: string
    severity: string
    status: string
    description: string
    remediation?: string
    evidence?: string
    affectedSystems?: string
    affectedAssetsCount?: number
    cvssScore?: number
    cvssVector?: string
    createdAt: string
    updatedAt: string
}

