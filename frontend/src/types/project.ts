/**
 * Project-related types
 */
import { 
    ProjectStatus, 
    ProjectType, 
    Priority, 
    FindingsBySeverity, 
    TeamMember 
} from './common'

/**
 * Full Project interface - used in Projects page and detail modals
 */
export interface Project {
    id: string
    name: string
    clientId: string
    clientName: string
    clientLogoUrl?: string

    // Project details
    type: ProjectType
    status: ProjectStatus
    priority: Priority

    // Timeline
    startDate: Date
    endDate: Date
    progress: number // 0-100

    // Scope
    scope: string[]
    methodology: string // e.g., "OWASP", "PTES", "NIST"
    description?: string

    // Team
    teamMembers: TeamMember[]
    leadTester: string

    // Metrics
    findingsCount: number
    findingsBySeverity: FindingsBySeverity

    // Compliance/Tags
    complianceFrameworks?: string[]
    projectTags?: string[]

    // Metadata
    lastActivity?: string
    lastActivityDate?: Date
    createdAt?: Date
    updatedAt?: Date
    
    // Retest fields
    isRetest?: boolean
    parentProjectId?: string
    parentProjectName?: string
    retestCount?: number
}

/**
 * Lightweight project for lists/dropdowns
 */
export interface ProjectSummary {
    id: string
    name: string
    clientName: string
    status: ProjectStatus
    priority: Priority | string
    progress: number
    endDate: string | Date
    updatedAt?: string | Date
}

/**
 * Project for report builder with additional report-specific fields
 */
export interface ReportProject extends Omit<Project, 'scope'> {
    scope: string // Single string in reports context
    lastModified: Date
}

