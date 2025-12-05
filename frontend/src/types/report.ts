/**
 * Report-related types
 */
import { ReportStatus } from './common'

/**
 * Report summary - used in report builder list
 */
export interface Report {
    id: string
    title: string
    project_id: string
    status: string
    created_at: string
    updated_at: string
}

/**
 * Full report detail
 */
export interface ReportDetail {
    id: string
    title: string
    projectId: string
    status: ReportStatus
    htmlContent?: string
    settings?: ReportSettings
    createdAt: string
    updatedAt: string
}

/**
 * Report settings
 */
export interface ReportSettings {
    reportTitle?: string
    clientLogo?: string
    primaryColor?: string
    headerText?: string
    footerText?: string
    confidentialityLevel?: string
    pdfTemplate?: string
}

/**
 * Narrative content for report
 */
export interface NarrativeContent {
    executiveSummary: string
    methodology: string
    scope: string
}

