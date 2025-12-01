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
    Search,
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
    ArrowDown
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
}


type ViewMode = 'card' | 'table' | 'timeline'

const getStatusColor = (status: Project['status']) => {
    switch (status) {
        case 'In Progress': return 'bg-blue-500 hover:bg-blue-600'
        case 'Planning': return 'bg-purple-500 hover:bg-purple-600'
        case 'On Hold': return 'bg-yellow-500 hover:bg-yellow-600 text-black'
        case 'Completed': return 'bg-green-500 hover:bg-green-600'
        case 'Cancelled': return 'bg-gray-500 hover:bg-gray-600'
    }
}

const getPriorityColor = (priority: Project['priority']) => {
    switch (priority) {
        case 'Critical': return 'border-red-500 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300'
        case 'High': return 'border-orange-500 bg-orange-50 dark:bg-orange-950 text-orange-700 dark:text-orange-300'
        case 'Medium': return 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300'
        case 'Low': return 'border-green-500 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300'
    }
}

export default function Projects() {
    const [viewMode, setViewMode] = useState<ViewMode>('table')
    const [searchQuery, setSearchQuery] = useState('')
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
    const [projectFindingsData, setProjectFindingsData] = useState<Record<string, { count: number, severity: { critical: number, high: number, medium: number, low: number } }>>({})
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
                        logoUrl: '🏢' // Default icon
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
                    const apiProjects: Project[] = response.data.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        clientId: p.client_id,
                        clientName: p.client_name,
                        clientLogoUrl: '🏢',
                        type: 'Web App' as const,
                        status: mapApiStatus(p.status),
                        priority: 'Medium' as const,
                        startDate: p.start_date ? new Date(p.start_date) : new Date(),
                        endDate: p.end_date ? new Date(p.end_date) : new Date(),
                        progress: 0,
                        findingsCount: p.finding_count || 0,
                        findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                        teamMembers: [],
                        lastActivity: 'Just now',
                        lastActivityDate: new Date(p.updated_at),
                        createdAt: new Date(p.created_at),
                        updatedAt: new Date(p.updated_at),
                        // Additional required fields
                        description: p.description || '',
                        scope: [],
                        methodology: 'OWASP Testing Guide v4',
                        leadTester: p.lead_name || '',
                        complianceFrameworks: [],
                    }))
                    
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

    // Load actual findings counts and severity from localStorage
    useEffect(() => {
        const data: Record<string, any> = {}
        projects.forEach(project => {
            const storageKey = `findings_${project.id}`
            const stored = localStorage.getItem(storageKey)
            if (stored) {
                try {
                    const findings = JSON.parse(stored)
                    const breakdown = { critical: 0, high: 0, medium: 0, low: 0 }
                    findings.forEach((f: any) => {
                        const s = f.severity.toLowerCase() as keyof typeof breakdown
                        if (breakdown[s] !== undefined) breakdown[s]++
                    })
                    data[project.id] = { count: findings.length, severity: breakdown }
                } catch (e) {
                    data[project.id] = { count: 0, severity: { critical: 0, high: 0, medium: 0, low: 0 } }
                }
            } else {
                data[project.id] = { count: 0, severity: { critical: 0, high: 0, medium: 0, low: 0 } }
            }
        })
        setProjectFindingsData(data)
    }, [projects])

    // Filter management functions
    const removeFilter = (id: string) => {
        setActiveFilters(activeFilters.filter(f => f.id !== id))
    }

    const clearAllFilters = () => {
        setActiveFilters([])
        setSearchQuery('')
    }

    const clearSearch = () => {
        setSearchQuery('')
    }



    const openAddProjectDialog = () => {
        setAddProjectDialogOpen(true)
    }

    const handleProjectAdded = (newProject: any) => {
        if (editingProject) {
            // Update existing project
            const updatedProjects = projects.map(p => p.id === editingProject.id ? { ...p, ...newProject, id: editingProject.id } : p)
            setProjects(updatedProjects)
            localStorage.setItem('projects', JSON.stringify(updatedProjects))
            setEditingProject(null)
            // Log update activity
            logProjectUpdated(newProject.name || editingProject.name, editingProject.id)
        } else {
            // Add new project
            const updatedProjects = [...projects, newProject]
            setProjects(updatedProjects)
            // Log create activity
            logProjectCreated(newProject.name, newProject.client_name || newProject.clientName || 'Unknown', newProject.id)
            localStorage.setItem('projects', JSON.stringify(updatedProjects))
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

    const confirmDeleteProject = () => {
        if (deletingProject) {
            // Log delete activity
            logProjectDeleted(deletingProject.name, deletingProject.id)
            
            const updatedProjects = projects.filter(p => p.id !== deletingProject.id)
            setProjects(updatedProjects)
            localStorage.setItem('projects', JSON.stringify(updatedProjects))
            // Also delete associated findings
            localStorage.removeItem(`findings_${deletingProject.id}`)
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
            'Progress (%)',
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
            'Compliance Frameworks',
            'Scope',
            'Description',
            'Last Activity'
        ]

        // Convert projects to CSV rows
        const csvRows = [
            headers.join(','),
            ...projectsToExport.map(project => {
                const findingsData = projectFindingsData[project.id] || { count: 0, severity: { critical: 0, high: 0, medium: 0, low: 0 } }
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
                    escapeCSV(project.progress),
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

    // Calculate stats
    const stats = {
        totalProjects: projects.length,
        activeProjects: projects.filter(p => p.status === 'In Progress').length,
        completedProjects: projects.filter(p => p.status === 'Completed').length,
        overdueProjects: projects.filter(p => p.endDate < new Date() && p.status !== 'Completed').length,
        totalFindings: Object.values(projectFindingsData).reduce((sum, data) => sum + data.count, 0),
        criticalFindings: Object.values(projectFindingsData).reduce((sum, data) => sum + data.severity.critical, 0)
    }

    // Filter projects based on search
    const filteredProjects = useMemo(() => {
        let result = projects.filter(project => {
            const lowerCaseSearchQuery = searchQuery.toLowerCase();
            const matchesSearch = project.name.toLowerCase().includes(lowerCaseSearchQuery) ||
                project.clientName.toLowerCase().includes(lowerCaseSearchQuery) ||
                project.type.toLowerCase().includes(lowerCaseSearchQuery) ||
                project.methodology.toLowerCase().includes(lowerCaseSearchQuery) ||
                project.complianceFrameworks.some(f => f.toLowerCase().includes(lowerCaseSearchQuery));

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

            return matchesSearch && matchesFilters
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
    }, [projects, searchQuery, appliedFilters, sortConfig])

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
                    <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Projects</h1>
                    <p className="mt-2 text-gray-600 dark:text-gray-400">
                        Manage penetration testing projects and track progress
                    </p>
                </div>
                <Button onClick={openAddProjectDialog} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="w-4 h-4 mr-2" />
                    New Project
                </Button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    icon={<FolderKanban className="w-6 h-6" />}
                    label="Total Projects"
                    value={stats.totalProjects}
                    trend="+15%"
                    trendUp={true}
                    variant="default"
                />
                <StatCard
                    icon={<PlayCircle className="w-6 h-6" />}
                    label="Active Projects"
                    value={stats.activeProjects}
                    trend="+8%"
                    trendUp={true}
                    variant="default"
                />
                <StatCard
                    icon={<CheckCircle2 className="w-6 h-6" />}
                    label="Completed"
                    value={stats.completedProjects}
                    trend="+12%"
                    trendUp={true}
                    variant="default"
                />
                <StatCard
                    icon={<AlertCircle className="w-6 h-6" />}
                    label="Critical Findings"
                    value={stats.criticalFindings}
                    badge={stats.overdueProjects}
                    badgeLabel="Overdue"
                    variant="destructive"
                />
            </div>

            {/* Toolbar */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                    <div className="flex-1 w-full sm:w-auto">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
                            <input
                                type="text"
                                placeholder="Search projects by name, client, type, or compliance..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground placeholder:text-muted-foreground"
                            />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant={activeFilters.length > 0 ? "default" : "outline"}
                            size="sm"
                            onClick={openFilterDialog}
                            className="relative"
                        >
                            <Filter className="h-4 w-4 mr-2" />
                            Filter
                            {activeFilters.length > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary-foreground text-primary font-bold"
                                >
                                    {activeFilters.length}
                                </Badge>
                            )}
                        </Button>

                        <Button variant="outline" size="sm" onClick={handleExportProjects}>
                            <Download className="w-4 h-4 mr-2" />
                            Export
                        </Button>

                        {/* View Mode Switcher with Tooltips */}
                        <TooltipProvider>
                            <div className="flex items-center gap-1 border rounded-md p-1 border-border bg-card">
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={viewMode === 'table' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewMode('table')}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Table2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Table View</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={viewMode === 'card' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewMode('card')}
                                            className="h-8 w-8 p-0"
                                        >
                                            <LayoutGrid className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Card View</TooltipContent>
                                </Tooltip>

                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant={viewMode === 'timeline' ? 'default' : 'ghost'}
                                            size="sm"
                                            onClick={() => setViewMode('timeline')}
                                            className="h-8 w-8 p-0"
                                        >
                                            <Calendar className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Timeline View</TooltipContent>
                                </Tooltip>
                            </div>
                        </TooltipProvider>
                    </div>
                </div>

                {/* Active Filters Display */}
                {activeFilters.length > 0 && (
                    <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/50 rounded-lg border border-border">
                        <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
                        {activeFilters.map((filter) => (
                            <Badge
                                key={filter.id}
                                variant="secondary"
                                className="gap-1.5 pl-2 pr-1 py-1 hover:bg-secondary/80"
                            >
                                {filter.label}: {filter.value}
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 hover:bg-transparent"
                                    onClick={() => removeFilter(filter.id)}
                                >
                                    <X className="h-3 w-3" />
                                </Button>
                            </Badge>
                        ))}
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={clearAllFilters}
                            className="text-xs h-7"
                        >
                            Clear all
                        </Button>
                    </div>
                )}
            </div>

            {/* Loading Skeletons */}
            {isLoading && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map((i) => (
                        <div key={i} className="p-6 border rounded-lg border-border bg-card">
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <Skeleton className="h-6 w-48" />
                                    <Skeleton className="h-5 w-20" />
                                </div>
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-2 w-full" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-6 w-6 rounded-full" />
                                    <Skeleton className="h-6 w-6 rounded-full" />
                                    <Skeleton className="h-6 w-6 rounded-full" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Content Views */}
            {!isLoading && filteredProjects.length > 0 && (
                <>
                    {viewMode === 'card' && <CardView
                        projects={filteredProjects}
                        selectedProjectId={selectedProjectId}
                        setSelectedProjectId={setSelectedProjectId}
                        projectFindingsData={projectFindingsData}
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
            {!isLoading && projects.length === 0 && !searchQuery && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <FolderKanban className="h-16 w-16 text-muted-foreground mb-4 animate-pulse" />
                    <h3 className="text-lg font-semibold mb-2">No projects yet</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        Get started by creating your first penetration testing project
                    </p>
                    <Button onClick={openAddProjectDialog} size="lg">
                        <Plus className="h-5 w-5 mr-2" />
                        Create Your First Project
                    </Button>
                </div>
            )}

            {/* Empty State: No search results */}
            {!isLoading && filteredProjects.length === 0 && searchQuery && (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                    <Search className="h-16 w-16 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No projects found</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm">
                        No projects match your search "{searchQuery}". Try adjusting your filters or search terms.
                    </p>
                    <Button variant="outline" onClick={clearSearch}>
                        <X className="h-4 w-4 mr-2" />
                        Clear Search
                    </Button>
                </div>
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
            />

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deletingProject} onOpenChange={(open) => !open && setDeletingProject(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete Project</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete "{deletingProject?.name}"? This action cannot be undone and will also delete all associated findings.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeleteProject} className="bg-red-600 hover:bg-red-700">
                            Delete
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
    projectFindingsData,
    onViewDetails,
    onEditProject,
    onGenerateReport,
    onDeleteProject
}: {
    projects: Project[]
    selectedProjectId: string | null
    setSelectedProjectId: (id: string | null) => void
    projectFindingsData: Record<string, { count: number, severity: { critical: number, high: number, medium: number, low: number } }>
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
                    findingsCount={projectFindingsData[project.id]?.count ?? 0}
                    findingsSeverity={projectFindingsData[project.id]?.severity}
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
                "hover:shadow-lg transition-all cursor-pointer group relative",
                isSelected
                    ? "border-2 border-primary shadow-md bg-primary/5"
                    : "hover:border-primary/50"
            )}
            onClick={() => onViewDetails(project)}
        >
            {isSelected && (
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-primary rounded-l-lg" />
            )}
            <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-foreground truncate">
                            {project.name}
                        </h3>
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <Building2 className="w-3 h-3" />
                            {project.clientName}
                        </p>
                    </div>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
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
                    <Badge variant="outline" className={cn('text-[10px] font-medium border px-1.5 py-0', getPriorityColor(project.priority))}>
                        {project.priority}
                    </Badge>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {project.type}
                    </Badge>
                </div>

                {/* Progress Bar */}
                <div className="mb-3">
                    <div className="flex items-center justify-between text-xs mb-1.5">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-semibold text-foreground">{project.progress}%</span>
                    </div>
                    <div className="w-full bg-muted rounded-full h-1.5">
                        <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${project.progress}%` }}
                        />
                    </div>
                </div>

                {/* Timeline */}
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                    <Calendar className="w-4 h-4" />
                    <span>{project.startDate.toLocaleDateString()} - {project.endDate.toLocaleDateString()}</span>
                </div>

                {/* Findings Summary - Use dynamic count */}
                <div className="flex items-center justify-between pt-3 border-t border-border">
                    <div className="flex items-center gap-1.5 text-xs">
                        <Target className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold text-foreground">{findingsCount}</span>
                        <span className="text-muted-foreground">Finding{findingsCount !== 1 ? 's' : ''}</span>
                    </div>
                    <div className="flex gap-1">
                        {(findingsSeverity?.critical ?? project.findingsBySeverity.critical) > 0 && (
                            <Badge variant="destructive" className="text-[10px] px-1 py-0">
                                {findingsSeverity?.critical ?? project.findingsBySeverity.critical} C
                            </Badge>
                        )}
                        {(findingsSeverity?.high ?? project.findingsBySeverity.high) > 0 && (
                            <Badge className="text-[10px] px-1 py-0 bg-orange-500 hover:bg-orange-600">
                                {findingsSeverity?.high ?? project.findingsBySeverity.high} H
                            </Badge>
                        )}
                        {(findingsSeverity?.medium ?? project.findingsBySeverity.medium) > 0 && (
                            <Badge className="text-[10px] px-1 py-0 bg-yellow-500 hover:bg-yellow-600 text-black">
                                {findingsSeverity?.medium ?? project.findingsBySeverity.medium} M
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
        case 'Planning': return 'bg-purple-500'
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
        if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        return sortConfig.direction === 'asc'
            ? <ArrowUp className="w-4 h-4 ml-1 text-blue-600" />
            : <ArrowDown className="w-4 h-4 ml-1 text-blue-600" />
    }

    const renderHeader = (label: string, key: string) => (
        <th
            className="px-6 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer group hover:bg-muted transition-colors select-none"
            onClick={() => onSort(key)}
        >
            <div className="flex items-center">
                {label}
                <SortIcon columnKey={key} />
            </div>
        </th>
    )

    return (
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full">
                    <thead className="bg-muted/50 border-b border-border">
                        <tr>
                            {renderHeader('Project', 'name')}
                            {renderHeader('Client', 'clientName')}
                            {renderHeader('Status', 'status')}
                            {renderHeader('Priority', 'priority')}
                            {renderHeader('Progress', 'progress')}
                            {renderHeader('Timeline', 'startDate')}
                            {renderHeader('Team', 'teamMembers')}
                            <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Actions
                            </th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                        {projects.map((project) => {
                            const daysLeft = differenceInDays(project.endDate, new Date())
                            const isDueSoon = daysLeft >= 0 && daysLeft <= 5 && project.status !== 'Completed'

                            return (
                                <tr key={project.id} className="hover:bg-muted/50 transition-colors">
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="font-medium text-foreground">{project.name}</div>
                                        <div className="text-xs text-muted-foreground">{project.type}</div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <span className="text-zinc-500"><Building2 className="w-4 h-4" /></span>
                                            <span className="text-sm text-zinc-300">{project.clientName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <div className={cn("w-2 h-2 rounded-full", getStatusDotColor(project.status))} />
                                            <span className="text-sm text-zinc-300">{project.status}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <Badge variant="outline" className={cn('text-xs font-medium border-2', getPriorityColor(project.priority))}>
                                            {project.priority}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap align-middle">
                                        <div className="w-24">
                                            <div className="flex items-center justify-between text-xs mb-1">
                                                <span className="text-muted-foreground">{project.progress}%</span>
                                            </div>
                                            <div className="w-full bg-zinc-800 rounded-full h-1.5">
                                                <div
                                                    className="bg-emerald-500 h-1.5 rounded-full"
                                                    style={{ width: `${project.progress}% ` }}
                                                />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                                        <div className="flex flex-col">
                                            <span>{format(project.startDate, 'MMM d')} - {format(project.endDate, 'MMM d')}</span>
                                            {isDueSoon && <span className="text-orange-500 text-xs font-medium mt-0.5">Due in {daysLeft} days</span>}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap">
                                        <div className="flex -space-x-2">
                                            {project.teamMembers.slice(0, 3).map((member) => (
                                                <Avatar key={member.id} className="h-6 w-6 border-2 border-background">
                                                    <AvatarFallback className="bg-gradient-to-br from-primary to-purple-600 text-white text-[10px]">
                                                        {member.name.split(' ').map(n => n[0]).join('')}
                                                    </AvatarFallback>
                                                </Avatar>
                                            ))}
                                            {project.teamMembers.length > 3 && (
                                                <div className="h-6 w-6 rounded-full bg-muted border-2 border-background flex items-center justify-center text-[10px] font-medium text-foreground">
                                                    +{project.teamMembers.length - 3}
                                                </div>
                                            )}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                                                    <MoreVertical className="w-4 h-4" />
                                                </button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="end">
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
                                    </td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    )
}

// Timeline View Component
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
    // Show at least 6 months, or up to the max end date + 1 month
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

    return (
        <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <div className="overflow-x-auto">
                <div className="min-w-[800px]">
                    {/* Header */}
                    <div className="flex border-b border-border bg-muted/50">
                        <div className="w-64 flex-shrink-0 p-4 font-medium text-sm text-muted-foreground border-r border-border sticky left-0 bg-muted/50 z-10">
                            Project
                        </div>
                        <div className="flex-1 flex">
                            {months.map(month => (
                                <div key={month.toString()} className="flex-1 p-2 text-center text-xs font-medium text-muted-foreground border-r border-border last:border-r-0">
                                    {format(month, 'MMM yyyy')}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="divide-y divide-border">
                        {projects.map(project => {
                            const startOffset = differenceInDays(project.startDate, startDate)
                            const duration = differenceInDays(project.endDate, project.startDate) + 1
                            const left = (startOffset / totalDays) * 100
                            const width = (duration / totalDays) * 100

                            return (
                                <div key={project.id} className="flex hover:bg-muted/50 transition-colors group">
                                    <div className="w-64 flex-shrink-0 p-4 border-r border-border flex items-center justify-between sticky left-0 bg-card z-10 group-hover:bg-muted/50 transition-colors">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className="text-xl">{project.clientLogoUrl}</div>
                                            <div className="min-w-0">
                                                <div className="font-medium text-sm text-foreground truncate">{project.name}</div>
                                                <div className="text-xs text-muted-foreground truncate">{project.clientName}</div>
                                            </div>
                                        </div>
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <button className="p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors opacity-0 group-hover:opacity-100">
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
                                                <div key={month.toString()} className="flex-1 border-r border-border/50 last:border-r-0" />
                                            ))}
                                        </div>

                                        {/* Project Bar */}
                                        <TooltipProvider>
                                            <Tooltip>
                                                <TooltipTrigger asChild>
                                                    <div
                                                        className={cn(
                                                            "absolute top-1/2 -translate-y-1/2 h-8 rounded-md shadow-sm cursor-pointer hover:brightness-95 transition-all border border-white/20",
                                                            project.status === 'In Progress' ? "bg-blue-500" :
                                                                project.status === 'Completed' ? "bg-green-500" :
                                                                    project.status === 'Planning' ? "bg-purple-500" :
                                                                        project.status === 'On Hold' ? "bg-orange-500" :
                                                                            "bg-gray-400"
                                                        )}
                                                        style={{
                                                            left: `${Math.max(0, left)}% `,
                                                            width: `${Math.min(100 - Math.max(0, left), width)}% `
                                                        }}
                                                    >
                                                        {width > 5 && (
                                                            <div className="px-2 h-full flex items-center text-xs font-medium text-white truncate">
                                                                {project.progress}%
                                                            </div>
                                                        )}
                                                    </div>
                                                </TooltipTrigger>
                                                <TooltipContent>
                                                    <div className="text-xs">
                                                        <div className="font-semibold">{project.name}</div>
                                                        <div>{format(project.startDate, 'MMM d')} - {format(project.endDate, 'MMM d, yyyy')}</div>
                                                        <div>{project.status} • {project.progress}%</div>
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
        </div>
    )
}
