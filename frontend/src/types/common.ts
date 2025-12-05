/**
 * Common types and enums used across the application
 */

// Status types
export type ProjectStatus = 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled'
export type ClientStatus = 'Active' | 'Inactive' | 'Prospect' | 'Archived'
export type FindingStatus = 'Open' | 'In Progress' | 'Fixed' | 'Accepted Risk'
export type ReportStatus = 'DRAFT' | 'IN_PROGRESS' | 'REVIEW' | 'PUBLISHED'

// Priority and severity
export type Priority = 'Critical' | 'High' | 'Medium' | 'Low'
export type Severity = 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational'
export type RiskLevel = 'High' | 'Medium' | 'Low'

// Project types
export type ProjectType = 'External' | 'Internal' | 'Web App' | 'Mobile' | 'API' | 'Cloud' | 'Network'
export type CompanySize = 'Enterprise' | 'SMB' | 'Startup'

// Findings breakdown by severity
export interface FindingsBySeverity {
    critical: number
    high: number
    medium: number
    low: number
}

// Team member
export interface TeamMember {
    id: string
    name: string
    role?: string
    avatarUrl?: string
}

