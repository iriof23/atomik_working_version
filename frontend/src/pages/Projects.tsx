import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { api } from '@/lib/api'
import { logProjectCreated, logProjectUpdated, logProjectDeleted, logProjectCompleted } from '@/lib/activityLog'
import {
    FolderKanban,
    CheckCircle2,
    AlertCircle,
    Calendar,
    LayoutGrid,
    Table2,
    Plus,
    Filter,
    Download,
    Building2,
    Target,
    PlayCircle,
    MoreVertical,
    Edit,
    Trash2,
    Eye,
    FileText,
    X,
    ArrowUpDown,
    ArrowUp,
    ArrowDown,
    Loader2
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { AddProjectDialog } from '@/components/AddProjectDialog'
import ProjectDetailModal from '@/components/ProjectDetailModal'
import { cn } from '@/lib/utils'
import { StatCard } from '@/components/StatCard'
import { FilterDialog, FilterConfig, ActiveFilters } from '@/components/FilterDialog'
import { useToast } from '@/components/ui/use-toast'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
    differenceInDays,
    startOfMonth,
    endOfMonth,
    addMonths,
    format
} from 'date-fns'

// Project interface
export interface Project {
    id: string
    name: string
    clientId: string
    clientName: string
    clientLogoUrl?: string

    // Project details
    type: 'External' | 'Internal' | 'Web App' | 'Mobile' | 'API' | 'Cloud' | 'Network'
    status: 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled'
    priority: 'Critical' | 'High' | 'Medium' | 'Low'

    // Timeline
    startDate: Date
    endDate: Date
    progress: number // 0-100

    // Scope
    scope: string[]
    methodology: string // e.g., "OWASP", "PTES", "NIST"

    // Team
    teamMembers: {
        id: string
        name: string
        role: string
        avatarUrl?: string
    }[]
    leadTester: string

    // Metrics
    findingsCount: number
    findingsBySeverity: {
        critical: number
        high: number
        medium: number
        low: number
    }

    // Compliance
    complianceFrameworks: string[] // e.g., ["PCI-DSS", "SOC2"]

    // Metadata
    description: string
    lastActivity: string
    lastActivityDate: Date
    createdAt: Date
    updatedAt: Date
    
    // Retest fields
    isRetest?: boolean
    parentProjectId?: string
    parentProjectName?: string
    retestCount?: number
}


type ViewMode = 'card' | 'table' | 'timeline'

const getStatusColor = (status: Project['status']) => {
    switch (status) {
        case 'In Progress': return 'bg-slate-800 text-white shadow-sm border-0'
        case 'Planning': return 'bg-slate-200 text-slate-700 shadow-sm border-0'
        case 'On Hold': return 'bg-amber-600 text-white shadow-sm border-0'
        case 'Completed': return 'bg-emerald-600 text-white shadow-sm border-0'
        case 'Cancelled': return 'bg-slate-500 text-white shadow-sm border-0'
    }
}

const getPriorityColor = (priority: Project['priority']) => {
    switch (priority) {
        case 'Critical': return 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-sm border-0'
        case 'High': return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm border-0'
        case 'Medium': return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm border-0'
        case 'Low': return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm border-0'
    }
}

export default function Projects() {
    const [viewMode, setViewMode] = useState<ViewMode>('table')
    const [isLoading, setIsLoading] = useState(true)
    const [activeFilters, setActiveFilters] = useState<Array<{ id: string, label: string, value: string }>>([])
    const navigate = useNavigate()
    const { toast } = useToast()
    const [projects, setProjects] = useState<Project[]>([])
    const [addProjectDialogOpen, setAddProjectDialogOpen] = useState(false)
    const [editingProject, setEditingProject] = useState<Project | null>(null)
    const [viewingProject, setViewingProject] = useState<Project | null>(null)
    const [deletingProject, setDeletingProject] = useState<Project | null>(null)
    const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null)
    const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
    const [filterDialogOpen, setFilterDialogOpen] = useState(false)
    const [appliedFilters, setAppliedFilters] = useState<ActiveFilters>({})
    
    // Real clients from API
    const [clients, setClients] = useState<any[]>([])
    const [loadingClients, setLoadingClients] = useState(false)
    const { getToken } = useAuth()
    
    // Fetch clients when dialog opens
    useEffect(() => {
        const fetchClients = async () => {
            if (!addProjectDialogOpen) return
            
            setLoadingClients(true)
            try {
                const token = await getToken()
                if (!token) {
                    console.error('No auth token available for fetching clients')
                    setClients([])
                    return
                }
                console.log('Fetching clients from API...')
                // Use trailing slash to avoid 307 redirect
                const response = await api.get('/clients/', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                console.log('API response:', response.data)
                
                // Map API response to expected format
                if (Array.isArray(response.data) && response.data.length > 0) {
                    const mappedClients = response.data.map((c: any) => ({
                        id: c.id,
                        name: c.name,
                        logoUrl: '' // No default icon
                    }))
                    console.log('Fetched clients for dropdown:', mappedClients)
                    setClients(mappedClients)
                } else {
                    console.warn('No clients returned from API')
                    setClients([])
                }
            } catch (error: any) {
                console.error('Failed to fetch clients:', error)
                if (error.response) {
                    console.error('Error response:', error.response.status, error.response.data)
                }
                setClients([])
            } finally {
                setLoadingClients(false)
            }
        }
        
        fetchClients()
    }, [addProjectDialogOpen, getToken])

    const parseScopeField = (rawScope: any): string[] => {
        if (!rawScope) return []
        if (Array.isArray(rawScope)) return rawScope.filter(Boolean)
        
        if (typeof rawScope === 'string') {
            try {
                const parsed = JSON.parse(rawScope)
                if (Array.isArray(parsed)) {
                    return parsed.filter(Boolean)
                }
            } catch {
                // legacy format: plain string or comma/newline-separated values
                return rawScope
                    .split(/[\n,]+/)
                    .map(item => item.trim())
                    .filter(Boolean)
            }
            
            // If JSON.parse succeeded but result wasn't an array, fall through
            return rawScope ? [rawScope].filter(Boolean) : []
        }
        
        return []
    }
    
    // Fetch real projects from API on page load
    useEffect(() => {
        const fetchProjects = async () => {
            setIsLoading(true)
            try {
                const token = await getToken()
                if (!token) {
                    console.warn('No auth token available')
                    setProjects([])
                    return
                }
                
                console.log('Fetching projects from API...')
                const response = await api.get('/projects/', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                console.log('API projects response:', response.data)
                
                if (Array.isArray(response.data) && response.data.length > 0) {
                    // Map API response to frontend Project format
                    const apiProjects: Project[] = response.data.map((p: any) => {
                        // Parse JSON strings for scope and complianceFrameworks
                        const parsedScope = parseScopeField(p.scope)
                        
                        let parsedComplianceFrameworks: string[] = []
                        if (p.compliance_frameworks) {
                            try {
                                parsedComplianceFrameworks = typeof p.compliance_frameworks === 'string' 
                                    ? JSON.parse(p.compliance_frameworks) 
                                    : p.compliance_frameworks
                            } catch { parsedComplianceFrameworks = [] }
                        }
                        
                        // Map priority from API
                        const mapPriority = (priority: string): Project['priority'] => {
                            const priorityMap: Record<string, Project['priority']> = {
                                'Low': 'Low', 'Medium': 'Medium', 'High': 'High', 'Critical': 'Critical'
                            }
                            return priorityMap[priority] || 'Medium'
                        }
                        
                        // Map project type from API
                        const mapType = (type: string): Project['type'] => {
                            const typeMap: Record<string, Project['type']> = {
                                'External': 'External', 'Internal': 'Internal', 'Web App': 'Web App',
                                'Mobile': 'Mobile', 'API': 'API', 'Cloud': 'Cloud', 'Network': 'Network'
                            }
                            return typeMap[type] || 'Web App'
                        }
                        
                        // Get severity breakdown from API (avoids extra API calls)
                        const severityCounts = p.findings_by_severity || { critical: 0, high: 0, medium: 0, low: 0 }
                        
                        return {
                            id: p.id,
                            name: p.name,
                            clientId: p.client_id,
                            clientName: p.client_name,
                            clientLogoUrl: '',
                            type: mapType(p.project_type),
                            status: mapApiStatus(p.status),
                            priority: mapPriority(p.priority),
                            startDate: p.start_date ? new Date(p.start_date) : new Date(),
                            endDate: p.end_date ? new Date(p.end_date) : new Date(),
                            progress: 0,
                            findingsCount: p.finding_count || 0,
                            findingsBySeverity: severityCounts,
                            teamMembers: [],
                            lastActivity: 'Just now',
                            lastActivityDate: new Date(p.updated_at),
                            createdAt: new Date(p.created_at),
                            updatedAt: new Date(p.updated_at),
                            // Additional required fields
                            description: p.description || '',
                            scope: parsedScope,
                            methodology: p.methodology || 'OWASP Testing Guide v4',
                            leadTester: p.lead_name || '',
                            complianceFrameworks: parsedComplianceFrameworks,
                            // Retest fields
                            isRetest: p.is_retest || false,
                            parentProjectId: p.parent_project_id || undefined,
                            parentProjectName: p.parent_project_name || undefined,
                            retestCount: p.retest_count || 0,
                        }
                    })
                    
                    console.log(`Loaded ${apiProjects.length} real projects from API`)
                    setProjects(apiProjects)
                } else {
                    console.log('No projects from API')
                    setProjects([])
                }
            } catch (error) {
                console.error('Failed to fetch projects:', error)
                setProjects([])
            } finally {
                setIsLoading(false)
            }
        }
        
        fetchProjects()
    }, [getToken])
    
    // Helper to map API status to frontend status
    const mapApiStatus = (status: string): Project['status'] => {
        const statusMap: Record<string, Project['status']> = {
            'PLANNING': 'Planning',
            'IN_PROGRESS': 'In Progress',
            'REVIEW': 'In Progress',
            'COMPLETED': 'Completed',
            'ARCHIVED': 'Completed',
            'ON_HOLD': 'On Hold',
            'CANCELLED': 'Cancelled',
        }
        return statusMap[status?.toUpperCase()] || 'Planning'
    }

    // Load saved view mode from localStorage (defaults to 'table' if not set)
    useEffect(() => {
        const saved = localStorage.getItem('projectsViewMode')
        if (saved && (saved === 'card' || saved === 'table' || saved === 'timeline')) {
            setViewMode(saved)
        } else {
            // Ensure default is 'table' and save it
            setViewMode('table')
            localStorage.setItem('projectsViewMode', 'table')
        }
    }, [])

    // Save view mode to localStorage
    useEffect(() => {
        localStorage.setItem('projectsViewMode', viewMode)
    }, [viewMode])

    // Filter management functions
    const removeFilter = (id: string) => {
        setActiveFilters(activeFilters.filter(f => f.id !== id))
    }

    const clearAllFilters = () => {
        setActiveFilters([])
    }



    const openAddProjectDialog = () => {
        setAddProjectDialogOpen(true)
    }

    const handleProjectAdded = (newProject: any) => {
        // Map the status to title case (API returns uppercase like "PLANNING")
        const mappedProject = {
            ...newProject,
            status: mapApiStatus(newProject.status)
        }
        
        if (editingProject) {
            // Update existing project in state (API already saved it)
            const updatedProjects = projects.map(p => p.id === editingProject.id ? { ...p, ...mappedProject, id: editingProject.id } : p)
            setProjects(updatedProjects)
            setEditingProject(null)
            // Log update activity
            logProjectUpdated(newProject.name || editingProject.name, editingProject.id)
        } else {
            // Add new project to state (API already saved it)
            const updatedProjects = [...projects, mappedProject]
            setProjects(updatedProjects)
            // Log create activity
            logProjectCreated(newProject.name, newProject.client_name || newProject.clientName || 'Unknown', newProject.id)
        }
    }

    const handleViewDetails = (project: Project) => {
        setViewingProject(project)
    }    // Could navigate to a detail page or expand the card


    const handleEditProject = (project: Project) => {
        setEditingProject(project)
        setAddProjectDialogOpen(true)
    }

    const handleGenerateReport = (project: Project) => {
        navigate(`/reports/${project.id}`)
    }

    const handleDeleteProject = (project: Project) => {
        setDeletingProject(project)
    }

    const [isCreatingRetest, setIsCreatingRetest] = useState(false)

    const handleStartRetest = async (project: Project) => {
        setIsCreatingRetest(true)
        try {
            const token = await getToken()
            if (!token) {
                toast({
                    title: "Error",
                    description: "Authentication required",
                    variant: "destructive",
                })
                return
            }

            const response = await api.post(`/projects/${project.id}/retest`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (response.data) {
                // Map the new retest project to the frontend format
                const newRetest: Project = {
                    id: response.data.id,
                    name: response.data.name,
                    clientId: response.data.client_id,
                    clientName: response.data.client_name,
                    clientLogoUrl: '',
                    type: (response.data.project_type || 'Web App') as Project['type'],
                    status: mapApiStatus(response.data.status),
                    priority: (response.data.priority || 'Medium') as Project['priority'],
                    startDate: response.data.start_date ? new Date(response.data.start_date) : new Date(),
                    endDate: response.data.end_date ? new Date(response.data.end_date) : new Date(),
                    progress: 0,
                    findingsCount: response.data.finding_count || 0,
                    findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                    teamMembers: [],
                    lastActivity: 'Just now',
                    lastActivityDate: new Date(response.data.updated_at),
                    createdAt: new Date(response.data.created_at),
                    updatedAt: new Date(response.data.updated_at),
                    description: response.data.description || '',
                    scope: [],
                    methodology: response.data.methodology || 'OWASP Testing Guide v4',
                    leadTester: response.data.lead_name || '',
                    complianceFrameworks: [],
                    isRetest: true,
                    parentProjectId: response.data.parent_project_id,
                    parentProjectName: response.data.parent_project_name,
                    retestCount: 0,
                }

                // Add the new retest project to the list
                setProjects(prev => [newRetest, ...prev])
                setViewingProject(null)

                toast({
                    title: "Retest Created",
                    description: `"${newRetest.name}" has been created with ${response.data.finding_count} findings cloned for re-verification.`,
                })

                // Navigate to the new retest project
                navigate(`/projects`)
            }
        } catch (error: any) {
            console.error('Failed to create retest:', error)
            toast({
                title: "Error",
                description: error.response?.data?.detail || "Failed to create retest. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsCreatingRetest(false)
        }
    }

    const [isDeletingProject, setIsDeletingProject] = useState(false)

    const confirmDeleteProject = async () => {
        if (!deletingProject) return
        
        setIsDeletingProject(true)
        try {
            const token = await getToken()
            if (!token) {
                toast({
                    title: "Error",
                    description: "Authentication required",
                    variant: "destructive",
                })
                return
            }

            // Call the backend API to delete the project
            await api.delete(`/projects/${deletingProject.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            // Log delete activity
            logProjectDeleted(deletingProject.name, deletingProject.id)
            
            // Remove from local state
            const updatedProjects = projects.filter(p => p.id !== deletingProject.id)
            setProjects(updatedProjects)
            
            toast({
                title: "Project Deleted",
                description: `${deletingProject.name} has been permanently removed.`,
            })
        } catch (error: any) {
            console.error('Failed to delete project:', error)
            toast({
                title: "Error",
                description: error.response?.data?.detail || "Failed to delete project. Please try again.",
                variant: "destructive",
            })
        } finally {
            setIsDeletingProject(false)
            setDeletingProject(null)
        }
    }

    const openFilterDialog = () => {
        setFilterDialogOpen(true)
    }

    const handleExportProjects = () => {
        // Get the projects to export (use filtered projects if filters are active, otherwise all)
        const projectsToExport = filteredProjects.length > 0 ? filteredProjects : projects
        
        if (projectsToExport.length === 0) {
            toast({
                title: "No Projects to Export",
                description: "There are no projects to export.",
                variant: "destructive",
            })
            return
        }

        // Define CSV headers
        const headers = [
            'Project Name',
            'Client Name',
            'Type',
            'Status',
            'Priority',
            'Start Date',
            'End Date',
            'Findings Count',
            'Critical Findings',
            'High Findings',
            'Medium Findings',
            'Low Findings',
            'Lead Tester',
            'Team Members',
            'Methodology',
            'Project Tags',
            'Scope',
            'Description',
            'Last Activity'
        ]

        // Convert projects to CSV rows
        const csvRows = [
            headers.join(','),
            ...projectsToExport.map(project => {
                // Use severity data from project directly (no extra API calls needed)
                const findingsData = { count: project.findingsCount, severity: project.findingsBySeverity }
                const teamMembers = project.teamMembers?.map(m => m.name).join('; ') || ''
                const complianceFrameworks = project.complianceFrameworks?.join('; ') || ''
                const scope = project.scope?.join('; ') || ''
                
                // Escape commas and quotes in CSV values
                const escapeCSV = (value: any) => {
                    if (value === null || value === undefined) return ''
                    const str = String(value)
                    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
                        return `"${str.replace(/"/g, '""')}"`
                    }
                    return str
                }

                return [
                    escapeCSV(project.name),
                    escapeCSV(project.clientName),
                    escapeCSV(project.type),
                    escapeCSV(project.status),
                    escapeCSV(project.priority),
                    escapeCSV(project.startDate.toLocaleDateString()),
                    escapeCSV(project.endDate.toLocaleDateString()),
                    escapeCSV(findingsData.count),
                    escapeCSV(findingsData.severity.critical),
                    escapeCSV(findingsData.severity.high),
                    escapeCSV(findingsData.severity.medium),
                    escapeCSV(findingsData.severity.low),
                    escapeCSV(project.leadTester),
                    escapeCSV(teamMembers),
                    escapeCSV(project.methodology),
                    escapeCSV(complianceFrameworks),
                    escapeCSV(scope),
                    escapeCSV(project.description),
                    escapeCSV(project.lastActivity)
                ].join(',')
            })
        ]

        // Create CSV content
        const csvContent = csvRows.join('\n')

        // Create blob and download
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        const url = URL.createObjectURL(blob)
        link.setAttribute('href', url)
        link.setAttribute('download', `projects_export_${new Date().toISOString().split('T')[0]}.csv`)
        link.style.visibility = 'hidden'
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const projectFilterConfig: FilterConfig = {
        status: {
            label: 'Status',
            type: 'multiselect',
            options: ['Planning', 'In Progress', 'On Hold', 'Completed', 'Cancelled']
        },
        priority: {
            label: 'Priority',
            type: 'select',
            options: ['Critical', 'High', 'Medium', 'Low']
        },
        type: {
            label: 'Type',
            type: 'multiselect',
            options: ['External', 'Internal', 'Compliance']
        }
    }

    // Calculate stats (using data from projects directly)
    const stats = {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'In Progress').length,
        completedProjects: projects.filter(p => p.status === 'Completed').length,
        overdueProjects: projects.filter(p => p.endDate < new Date() && p.status !== 'Completed').length,
        totalFindings: projects.reduce((sum, p) => sum + p.findingsCount, 0),
        criticalFindings: projects.reduce((sum, p) => sum + (p.findingsBySeverity?.critical || 0), 0)
    }

    // Filter projects based on search
    const filteredProjects = useMemo(() => {
        let result = projects.filter(project => {
            const matchesFilters = Object.entries(appliedFilters).every(([key, value]) => {
                if (!value || (Array.isArray(value) && value.length === 0)) return true

                // Handle specific filter keys
                if (key === 'status') {
                    return (value as string[]).includes(project.status)
                }
                if (key === 'priority') {
                    return project.priority === (value as string)
                }
                if (key === 'type') {
                    return (value as string[]).includes(project.type)
                }

                return true
            })

            return matchesFilters
        })

        // Apply sorting
        if (sortConfig) {
            result.sort((a, b) => {
                const { key, direction } = sortConfig
                let comparison = 0

                switch (key) {
                    case 'name':
                    case 'clientName':
                    case 'status':
                        comparison = a[key].localeCompare(b[key])
                        break
                    case 'priority':
                        const priorityOrder: Record<string, number> = { Critical: 3, High: 2, Medium: 1, Low: 0 }
                        comparison = (priorityOrder[a.priority] || 0) - (priorityOrder[b.priority] || 0)
                        break
                    case 'progress':
                        comparison = a.progress - b.progress
                        break
                    case 'startDate': // Timeline
                        comparison = a.startDate.getTime() - b.startDate.getTime()
                        break
                    case 'teamMembers': // Team - sort by lead tester
                        comparison = a.leadTester.localeCompare(b.leadTester)
                        break
                    default:
                        comparison = 0
                }

                return direction === 'asc' ? comparison : -comparison
            })
        }

        return result
    }, [projects, appliedFilters, sortConfig])

    const handleSort = (key: string) => {
        setSortConfig(current => {
            if (current?.key === key) {
                return current.direction === 'asc'
                    ? { key, direction: 'desc' }
                    : null
            }
            return { key, direction: 'asc' }
        })
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Manage penetration testing projects and engagements
                    </p>
                </div>
                <Button onClick={openAddProjectDialog} className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>New Project</span>
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<FolderKanban className="w-5 h-5 text-slate-600" />}
                    label="Total Projects"
                    value={stats.totalProjects}
                    variant="default"
                />
                <StatCard
                    icon={<PlayCircle className="w-5 h-5 text-emerald-600" />}
                    label="Active Projects"
                    value={stats.activeProjects}
                    variant="success"
                />
                <StatCard
                    icon={<CheckCircle2 className="w-5 h-5 text-amber-600" />}
                    label="Completed"
                    value={stats.completedProjects}
                    variant="warning"
                />
                <StatCard
                    icon={<AlertCircle className="w-5 h-5 text-red-600" />}
                    label="Critical Findings"
                    value={stats.criticalFindings}
                    badge={stats.overdueProjects > 0 ? stats.overdueProjects : undefined}
                    badgeLabel="Overdue"
                    variant="destructive"
                />
            </div>

            {/* Toolbar */}
            <Card className="p-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex items-center gap-2">
                        {/* Filter Button */}
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={openFilterDialog}
                            className="text-slate-600 border-slate-200 gap-2"
                        >
                            <Filter className="h-4 w-4 shrink-0" />
                            <span>Filter</span>
                            {Object.keys(appliedFilters).length > 0 && (
                                <span className="bg-emerald-600 text-white text-[10px] font-semibold rounded-full w-4 h-4 flex items-center justify-center shrink-0">
                                    {Object.keys(appliedFilters).length}
                                </span>
                            )}
                        </Button>

                        {/* Export Button */}
                        <Button variant="outline" size="sm" onClick={handleExportProjects} className="text-slate-600 border-slate-200 gap-2">
                            <Download className="w-4 h-4 shrink-0" />
                            <span>Export</span>
                        </Button>

                        {/* View Mode Switcher */}
                        <TooltipProvider>
                            <div className="flex items-center bg-slate-100 rounded-lg p-1">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setViewMode('table')}
                                            className={cn(
                                                "p-1.5 rounded-md transition-all",
                                                viewMode === 'table'
                                                    ? "bg-white shadow-sm text-slate-900"
                                                    : "text-slate-500 hover:text-slate-700"
                                            )}
                                        >
                                            <Table2 className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Table View</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setViewMode('card')}
                                            className={cn(
                                                "p-1.5 rounded-md transition-all",
                                                viewMode === 'card'
                                                    ? "bg-white shadow-sm text-slate-900"
                                                    : "text-slate-500 hover:text-slate-700"
                                            )}
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Card View</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <button
                                            onClick={() => setViewMode('timeline')}
                                            className={cn(
                                                "p-1.5 rounded-md transition-all",
                                                viewMode === 'timeline'
                                                    ? "bg-white shadow-sm text-slate-900"
                                                    : "text-slate-500 hover:text-slate-700"
                                            )}
                                        >
                                            <Calendar className="h-4 w-4" />
                                        </button>
                                    </TooltipTrigger>
                                    <TooltipContent>Timeline View</TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Active Filters Display */}
                {Object.keys(appliedFilters).length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-slate-100">
                        <span className="text-xs font-medium text-slate-500">Active filters:</span>
                        {Object.entries(appliedFilters).map(([key, value]) => {
                            let displayValue = ''
                            if (Array.isArray(value)) {
                                displayValue = value.join(', ')
                            } else if (typeof value === 'string') {
                                displayValue = value
                            } else if (value && typeof value === 'object') {
                                displayValue = JSON.stringify(value)
                            }
                            return (
                                <Badge
                                    key={key}
                                    variant="secondary"
                                    className="gap-1.5 pl-2 pr-1 py-0.5 bg-slate-100 text-slate-700 text-xs"
                                >
                                    {key}: {displayValue}
                                </Badge>
                            )
                        })}
                        <button
                            onClick={clearAllFilters}
                            className="text-xs text-slate-500 hover:text-slate-700 ml-2"
                        >
                            Clear all
                        </button>
                    </div>
                )}
            </Card>

            {/* Loading Skeletons */}
            {isLoading && (
                <Card className="p-0">
                    <div className="divide-y divide-slate-100">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="p-4 flex items-center gap-4">
                                <Skeleton className="h-10 w-10 rounded-xl" />
                                <div className="flex-1 space-y-2">
                                    <Skeleton className="h-4 w-48" />
                                    <Skeleton className="h-3 w-32" />
                                </div>
                                <Skeleton className="h-6 w-20 rounded-full" />
                                <Skeleton className="h-6 w-16 rounded-full" />
                            </div>
                        ))}
                    </div>
                </Card>
            )}

            {/* Content Views */}
            {!isLoading && filteredProjects.length > 0 && (
                <>
                    {viewMode === 'card' && <CardView
                        projects={filteredProjects}
                        selectedProjectId={selectedProjectId}
                        setSelectedProjectId={setSelectedProjectId}
                        onViewDetails={handleViewDetails}
                        onEditProject={handleEditProject}
                        onGenerateReport={handleGenerateReport}
                        onDeleteProject={handleDeleteProject}
                    />}
                    {viewMode === 'table' && (
                        <TableView
                            projects={filteredProjects}
                            onViewDetails={handleViewDetails}
                            onEditProject={handleEditProject}
                            onGenerateReport={handleGenerateReport}
                            onDeleteProject={handleDeleteProject}
                            onSort={handleSort}
                            sortConfig={sortConfig}
                        />
                    )}

                    {viewMode === 'timeline' && (
                        <TimelineView
                            projects={filteredProjects}
                            onViewDetails={handleViewDetails}
                            onEditProject={handleEditProject}
                            onGenerateReport={handleGenerateReport}
                            onDeleteProject={handleDeleteProject}
                        />
                    )}
                </>
            )}

            {/* Empty State: No projects exist */}
            {!isLoading && projects.length === 0 && (
                <Card className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
                        <FolderKanban className="h-8 w-8 text-slate-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900 mb-2">No projects yet</h3>
                    <p className="text-slate-500 mb-6 max-w-sm">
                        Get started by creating your first penetration testing project.
                    </p>
                    <Button onClick={openAddProjectDialog} size="lg" className="bg-emerald-600 hover:bg-emerald-700 gap-2">
                        <Plus className="h-5 w-5 shrink-0" />
                        <span>Create Project</span>
                    </Button>
                </Card>
            )}

            {/* Empty State: No filter results */}
            {!isLoading && filteredProjects.length === 0 && Object.keys(appliedFilters).length > 0 && projects.length > 0 && (
                <Card className="flex flex-col items-center justify-center py-16 text-center">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-4">
                        <Filter className="h-6 w-6 text-slate-400" />
                    </div>
                    <h3 className="text-sm font-semibold text-slate-900 mb-1">No projects found</h3>
                    <p className="text-xs text-slate-500 mb-4 max-w-sm">
                        No projects match your current filters. Try adjusting your filters.
                    </p>
                    <Button variant="outline" size="sm" onClick={clearAllFilters} className="gap-2">
                        <X className="h-4 w-4 shrink-0" />
                        <span>Clear Filters</span>
                    </Button>
                </Card>
            )}

            <AddProjectDialog
                open={addProjectDialogOpen}
                onOpenChange={(open) => {
                    setAddProjectDialogOpen(open)
                    if (!open) setEditingProject(null)
                }}
                onProjectAdded={handleProjectAdded}
                clients={clients}
                editingProject={editingProject}
            />

            {/* Project Detail Modal */}
            <ProjectDetailModal
                project={viewingProject}
                open={!!viewingProject}
                onClose={() => setViewingProject(null)}
                onEdit={(project) => {
                    setViewingProject(null)
                    handleEditProject(project)
                }}
                onGenerateReport={(project) => {
                    setViewingProject(null)
                    handleGenerateReport(project)
                }}
                onDelete={(project) => {
                    setViewingProject(null)
                    handleDeleteProject(project)
                }}
                onStartRetest={handleStartRetest}
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && !isDeletingProject && setDeletingProject(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deletingProject?.name}"? This action cannot be undone and will also permanently delete all associated findings and reports.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeletingProject}>Cancel</AlertDialogCancel>
                        <AlertDialogAction 
                            onClick={confirmDeleteProject} 
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeletingProject}
                        >
                            {isDeletingProject ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                'Delete Project'
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Filter Dialog */}
            <FilterDialog
                open={filterDialogOpen}
                onOpenChange={setFilterDialogOpen}
                filterConfig={projectFilterConfig}
                activeFilters={appliedFilters}
                onApplyFilters={setAppliedFilters}
                title="Filter Projects"
                description="Apply filters to refine your project list"
            />
        </div>
    )
}

// Card View Component
function CardView({
    projects,
    selectedProjectId,
    setSelectedProjectId,
    onViewDetails,
    onEditProject,
    onGenerateReport,
    onDeleteProject
}: {
    projects: Project[]
    selectedProjectId: string | null
    setSelectedProjectId: (id: string | null) => void
    onViewDetails: (project: Project) => void
    onEditProject: (project: Project) => void
    onGenerateReport: (project: Project) => void
    onDeleteProject: (project: Project) => void
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((project) => (
                <ProjectCard
                    key={project.id}
                    project={project}
                    isSelected={selectedProjectId === project.id}
                    onSelect={() => setSelectedProjectId(project.id)}
                    findingsCount={project.findingsCount}
                    findingsSeverity={project.findingsBySeverity}
                    onViewDetails={onViewDetails}
                    onEditProject={onEditProject}
                    onGenerateReport={onGenerateReport}
                    onDeleteProject={onDeleteProject}
                />
            ))}
        </div>
    )
}

// Project Card Component
function ProjectCard({
    project,
    isSelected,
    onSelect,
    findingsCount,
    findingsSeverity,
    onViewDetails,
    onEditProject,
    onGenerateReport,
    onDeleteProject
}: {
    project: Project
    isSelected: boolean
    onSelect: () => void
    findingsCount: number
    findingsSeverity?: { critical: number, high: number, medium: number, low: number }
    onViewDetails: (project: Project) => void
    onEditProject: (project: Project) => void
    onGenerateReport: (project: Project) => void
    onDeleteProject: (project: Project) => void
}) {
    return (
        <Card
            className={cn(
                "hover:shadow-card-hover transition-all cursor-pointer group",
                isSelected && "ring-2 ring-emerald-500"
            )}
            onClick={() => onViewDetails(project)}
        >
            <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10 rounded-xl">
                            <AvatarFallback className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                                {project.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-emerald-700 transition-colors">
                                {project.name}
                            </h3>
                            <p className="text-xs text-slate-500 flex items-center gap-1">
                                <Building2 className="w-3 h-3" />
                                {project.clientName}
                            </p>
                        </div>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onViewDetails(project); }}>
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEditProject(project); }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Project
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onGenerateReport(project); }}>
                                <FileText className="h-4 w-4 mr-2" />
                                Generate Report
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-red-600" onClick={(e) => { e.stopPropagation(); onDeleteProject(project); }}>
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Project
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>

                {/* Status and Priority */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                    <Badge className={cn('text-[10px] font-medium px-1.5 py-0', getStatusColor(project.status))}>
                        {project.status}
                    </Badge>
                    <Badge variant="outline" className={cn('text-[10px] font-medium px-1.5 py-0', getPriorityColor(project.priority))}>
                        {project.priority}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0 bg-slate-100 text-slate-600">
                        {project.type}
                    </Badge>
                </div>

                {/* Timeline */}
                <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-3">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{format(project.startDate, 'MMM d')} — {format(project.endDate, 'MMM d')}</span>
                </div>

                {/* Findings Summary */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-xs">
                        <Target className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm font-semibold text-slate-900">{findingsCount}</span>
                        <span className="text-slate-500">findings</span>
                    </div>
                    <div className="flex gap-1">
                        {(findingsSeverity?.critical ?? project.findingsBySeverity.critical) > 0 && (
                            <Badge variant="critical" className="text-[10px] px-1.5 py-0">
                                {findingsSeverity?.critical ?? project.findingsBySeverity.critical}
                            </Badge>
                        )}
                        {(findingsSeverity?.high ?? project.findingsBySeverity.high) > 0 && (
                            <Badge variant="high" className="text-[10px] px-1.5 py-0">
                                {findingsSeverity?.high ?? project.findingsBySeverity.high}
                            </Badge>
                        )}
                        {(findingsSeverity?.medium ?? project.findingsBySeverity.medium) > 0 && (
                            <Badge variant="medium" className="text-[10px] px-1.5 py-0">
                                {findingsSeverity?.medium ?? project.findingsBySeverity.medium}
                            </Badge>
                        )}
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

const getStatusDotColor = (status: string) => {
    switch (status) {
        case 'In Progress': return 'bg-emerald-500'
        case 'Completed': return 'bg-blue-500'
        case 'Planning': return 'bg-teal-500'
        case 'On Hold': return 'bg-orange-500'
        case 'Cancelled': return 'bg-zinc-500'
        default: return 'bg-zinc-500'
    }
}

// Table View Component
function TableView({
    projects,
    onViewDetails,
    onEditProject,
    onGenerateReport,
    onDeleteProject,
    onSort,
    sortConfig
}: {
    projects: Project[]
    onViewDetails: (project: Project) => void
    onEditProject: (project: Project) => void
    onGenerateReport: (project: Project) => void
    onDeleteProject: (project: Project) => void
    onSort: (key: string) => void
    sortConfig: { key: string; direction: 'asc' | 'desc' } | null
}) {
    const SortIcon = ({ columnKey }: { columnKey: string }) => {
        if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-50" />
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-600" />
            : <ArrowDown className="w-3 h-3 ml-1 text-emerald-600" />
    }

    return (
        <Card>
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead>
                        <tr className="border-b border-slate-100">
                            <th 
                                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                                onClick={() => onSort('name')}
                            >
                                <div className="flex items-center">Project <SortIcon columnKey="name" /></div>
                            </th>
                            <th 
                                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                                onClick={() => onSort('clientName')}
                            >
                                <div className="flex items-center">Client <SortIcon columnKey="clientName" /></div>
                            </th>
                            <th 
                                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                                onClick={() => onSort('status')}
                            >
                                <div className="flex items-center">Status <SortIcon columnKey="status" /></div>
                            </th>
                            <th 
                                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                                onClick={() => onSort('priority')}
                            >
                                <div className="flex items-center">Priority <SortIcon columnKey="priority" /></div>
                            </th>
                            <th 
                                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                                onClick={() => onSort('startDate')}
                            >
                                <div className="flex items-center">Timeline <SortIcon columnKey="startDate" /></div>
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                        {projects.map((project) => {
                            const daysLeft = differenceInDays(project.endDate, new Date())
                            const isDueSoon = daysLeft >= 0 && daysLeft <= 5 && project.status !== 'Completed'

                            return (
                                <tr 
                                    key={project.id} 
                                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                                    onClick={() => onViewDetails(project)}
                                >
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-3">
                                            <Avatar className="h-10 w-10 rounded-xl">
                                                <AvatarFallback className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                                                    {project.name.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div>
                                                <div className="text-sm font-semibold text-slate-900">{project.name}</div>
                                                <div className="text-xs text-slate-500">{project.type}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-4 h-4 text-slate-400" />
                                            <span className="text-sm text-slate-700">{project.clientName}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", getStatusDotColor(project.status))} />
                                            <span className="text-sm text-slate-700">{project.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge variant="outline" className={cn('text-[10px] font-medium', getPriorityColor(project.priority))}>
                                            {project.priority}
                                        </Badge>
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="text-sm text-slate-700">
                                            {format(project.startDate, 'MMM d')} — {format(project.endDate, 'MMM d')}
                                        </div>
                                        {isDueSoon && (
                                            <div className="text-[10px] text-amber-600 font-medium mt-0.5">
                                                Due in {daysLeft} days
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-4 py-3">
                                        <div className="flex items-center justify-end gap-1">
                                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); onViewDetails(project); }}>
                                                <Eye className="w-4 h-4" />
                                            </Button>
                                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); onEditProject(project); }}>
                                                <Edit className="w-4 h-4" />
                                            </Button>
                                            <DropdownMenu>
                                                <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                    <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600">
                                                        <MoreVertical className="w-4 h-4" />
                                                    </Button>
                                                </DropdownMenuTrigger>
                                                <DropdownMenuContent align="end">
                                                    <DropdownMenuItem onClick={() => onGenerateReport(project)}>
                                                        <FileText className="h-4 w-4 mr-2" />
                                                        Generate Report
                                                    </DropdownMenuItem>
                                                    <DropdownMenuSeparator />
                                                    <DropdownMenuItem className="text-red-600" onClick={() => onDeleteProject(project)}>
                                                        <Trash2 className="h-4 w-4 mr-2" />
                                                        Delete Project
                                                    </DropdownMenuItem>
                                                </DropdownMenuContent>
                                            </DropdownMenu>
                                        </div>
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    )
}

// Timeline View Component
function TimelineView({
    projects,
    onViewDetails,
    onEditProject,
    onGenerateReport,
    onDeleteProject
}: {
    projects: Project[]
    onViewDetails: (project: Project) => void
    onEditProject: (project: Project) => void
    onGenerateReport: (project: Project) => void
    onDeleteProject: (project: Project) => void
}) {
    if (projects.length === 0) return null

    // Calculate timeline range based on projects
    const startDate = startOfMonth(new Date(Math.min(...projects.map(p => p.startDate.getTime()))))
    const maxEndDate = new Date(Math.max(...projects.map(p => p.endDate.getTime())))
    const minEndDate = addMonths(startDate, 5)
    const endDate = endOfMonth(maxEndDate > minEndDate ? maxEndDate : minEndDate)

    const totalDays = differenceInDays(endDate, startDate) + 1

    const months: Date[] = []
    let current = startDate
    while (current <= endDate) {
        months.push(current)
        current = addMonths(current, 1)
    }

    const getBarColor = (status: string) => {
        switch (status) {
            case 'In Progress': return 'bg-emerald-500'
            case 'Completed': return 'bg-emerald-500'
            case 'Planning': return 'bg-teal-500'
            case 'On Hold': return 'bg-amber-500'
            case 'Cancelled': return 'bg-slate-400'
            default: return 'bg-slate-400'
        }
    }

    return (
        <Card className="overflow-hidden">
            <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                    {/* Header */}
                    <div className="flex border-b border-slate-100">
                        <div className="w-64 flex-shrink-0 px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider border-r border-slate-100 sticky left-0 bg-white z-10">
                            Project
                        </div>
                        <div className="flex-1 flex">
                            {months.map(month => (
                                <div key={month.toString()} className="flex-1 px-2 py-3 text-center text-xs font-medium text-slate-500 border-r border-slate-100 last:border-r-0">
                                    {format(month, 'MMM yyyy')}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="divide-y divide-slate-50">
                        {projects.map(project => {
                            const startOffset = differenceInDays(project.startDate, startDate)
                            const duration = differenceInDays(project.endDate, project.startDate) + 1
                            const left = (startOffset / totalDays) * 100
                            const width = (duration / totalDays) * 100

                            return (
                                <div key={project.id} className="flex hover:bg-slate-50/50 transition-colors group cursor-pointer" onClick={() => onViewDetails(project)}>
                                    <div className="w-64 flex-shrink-0 p-4 border-r border-slate-100 flex items-center justify-between sticky left-0 bg-white z-10 group-hover:bg-slate-50/50 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <Avatar className="h-10 w-10 rounded-xl">
                                                <AvatarFallback className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                                                    {project.name.slice(0, 2).toUpperCase()}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="min-w-0">
                                                <div className="text-sm font-semibold text-slate-900 truncate">{project.name}</div>
                                                <div className="text-xs text-slate-500 truncate">{project.clientName}</div>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start">
                                                <DropdownMenuItem onClick={() => onViewDetails(project)}>
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View Details
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onEditProject(project)}>
                                                    <Edit className="h-4 w-4 mr-2" />
                                                    Edit Project
                                                </DropdownMenuItem>
                                                <DropdownMenuItem onClick={() => onGenerateReport(project)}>
                                                    <FileText className="h-4 w-4 mr-2" />
                                                    Generate Report
                                                </DropdownMenuItem>
                                                <DropdownMenuSeparator />
                                                <DropdownMenuItem className="text-red-600" onClick={() => onDeleteProject(project)}>
                                                    <Trash2 className="h-4 w-4 mr-2" />
                                                    Delete Project
                                                </DropdownMenuItem>
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                    <div className="flex-1 relative h-16">
                                        {/* Grid lines */}
                                        <div className="absolute inset-0 flex pointer-events-none">
                                            {months.map(month => (
                                                <div key={month.toString()} className="flex-1 border-r border-slate-100/50 last:border-r-0" />
                                            ))}
                                        </div>

                                        {/* Project Bar */}
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className={cn(
                                                            "absolute top-1/2 -translate-y-1/2 h-7 rounded-lg shadow-sm cursor-pointer hover:brightness-95 transition-all",
                                                            getBarColor(project.status)
                                                        )}
                                                        style={{
                                                            left: `${Math.max(0, left)}%`,
                                                            width: `${Math.min(100 - Math.max(0, left), width)}%`
                                                        }}
                                                    >
                                                        {width > 8 && (
                                                            <div className="px-2 h-full flex items-center text-[10px] font-semibold text-white truncate">
                                                                {project.name}
                                                            </div>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="text-xs">
                                                        <div className="font-semibold">{project.name}</div>
                                                        <div className="text-slate-400">{format(project.startDate, 'MMM d')} — {format(project.endDate, 'MMM d, yyyy')}</div>
                                                        <div className="mt-1">{project.status}</div>
                                                    </div>
                                                </TooltipContent>
                                            </Tooltip>
                                        </TooltipProvider>
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </div>
        </Card>
    )
}
