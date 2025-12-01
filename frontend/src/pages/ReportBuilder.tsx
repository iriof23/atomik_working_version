import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Search, FileText, AlertTriangle, Clock, Calendar, Target, ChevronRight, Download, Share2, Edit, ArrowUpRight, Users, Shield, Trash2, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
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
import { cn } from '@/lib/utils'
import { NewReportDialog } from '@/components/reports/NewReportDialog'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { logProjectDeleted, logReportDeleted } from '@/lib/activityLog'

interface Project {
    id: string
    name: string
    clientName: string
    clientLogoUrl: string
    status: 'Planning' | 'In Progress' | 'Completed' | 'On Hold'
    progress: number
    findingsCount: number
    findingsBySeverity: { critical: number, high: number, medium: number, low: number }
    teamMembers: Array<{ id: string, name: string }>
    leadTester: string
    startDate: Date
    endDate: Date
    lastModified: Date
    scope: string
    priority: 'High' | 'Medium' | 'Low'
}

interface Report {
    id: string
    title: string
    project_id: string
    status: string
    created_at: string
    updated_at: string
}

export default function ReportBuilder() {
    const navigate = useNavigate()
    const { getToken } = useAuth()
    const { toast } = useToast()
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'In Progress' | 'Planning'>('all')
    const [projectFindingsData, setProjectFindingsData] = useState<Record<string, { count: number, severity: { critical: number, high: number, medium: number, low: number } }>>({})
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)
    const [projects, setProjects] = useState<Project[]>([])
    const [projectReports, setProjectReports] = useState<Record<string, Report[]>>({})
    const [isOpeningEditor, setIsOpeningEditor] = useState(false)
    const [isLoadingProjects, setIsLoadingProjects] = useState(true)

    // Fetch real projects from API
    useEffect(() => {
        const fetchProjects = async () => {
            setIsLoadingProjects(true)
            try {
                const token = await getToken()
                if (!token) {
                    setProjects([])
                    setSelectedProject(null)
                    return
                }
                
                const response = await api.get('/v1/projects', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                if (response.data && response.data.length > 0) {
                    // Map API projects to the format expected by the UI
                    const apiProjects = response.data.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        clientName: p.client_name || 'Unknown Client',
                        clientLogoUrl: '🏢',
                        status: p.status === 'PLANNING' ? 'Planning' : 
                                p.status === 'IN_PROGRESS' ? 'In Progress' : 
                                p.status === 'COMPLETED' ? 'Completed' : 'In Progress',
                        progress: 0,
                        findingsCount: p.finding_count || 0,
                        findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                        teamMembers: [],
                        leadTester: p.lead_name || '',
                        startDate: p.start_date ? new Date(p.start_date) : new Date(),
                        endDate: p.end_date ? new Date(p.end_date) : new Date(),
                        lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
                        scope: p.description || '',
                        priority: 'Medium' as const
                    }))
                    
                    setProjects(apiProjects)
                    setSelectedProject(apiProjects[0] || null)
                } else {
                    // No real projects
                    setProjects([])
                    setSelectedProject(null)
                }
            } catch (error) {
                console.error('Failed to fetch projects:', error)
                setProjects([])
                setSelectedProject(null)
            } finally {
                setIsLoadingProjects(false)
            }
        }
        
        fetchProjects()
    }, [getToken])

    // Fetch reports for all projects
    useEffect(() => {
        const fetchReports = async () => {
            try {
                const token = await getToken()
                if (!token) return
                
                const response = await api.get('/v1/reports/', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                // Group reports by project ID
                const reportsByProject: Record<string, Report[]> = {}
                response.data.forEach((report: Report) => {
                    if (!reportsByProject[report.project_id]) {
                        reportsByProject[report.project_id] = []
                    }
                    reportsByProject[report.project_id].push(report)
                })
                
                setProjectReports(reportsByProject)
            } catch (error) {
                console.error('Failed to fetch reports:', error)
            }
        }
        
        fetchReports()
    }, [getToken])

    // Delete project handler
    const handleDeleteProject = async () => {
        if (!selectedProject) return
        
        setIsDeleting(true)
        try {
            const token = await getToken()
            if (!token) {
                toast({
                    title: 'Error',
                    description: 'Authentication required',
                    variant: 'destructive',
                })
                return
            }

            await api.delete(`/projects/${selectedProject.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            // Log activity
            logProjectDeleted(selectedProject.name, selectedProject.id)

            // Remove from local state
            const updatedProjects = projects.filter(p => p.id !== selectedProject.id)
            setProjects(updatedProjects)
            
            // Select the first remaining project or null
            setSelectedProject(updatedProjects[0] || null)
            
            toast({
                title: 'Project Deleted',
                description: `${selectedProject.name} has been deleted successfully.`,
            })
        } catch (error: any) {
            console.error('Failed to delete project:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to delete project',
                variant: 'destructive',
            })
        } finally {
            setIsDeleting(false)
            setDeleteDialogOpen(false)
        }
    }

    // Load actual findings counts from localStorage
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

    // Filter projects
    const filteredProjects = projects.filter(project => {
        const matchesSearch = project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            project.clientName.toLowerCase().includes(searchQuery.toLowerCase())
        const matchesStatus = statusFilter === 'all' || project.status === statusFilter
        return matchesSearch && matchesStatus
    })

    const handleOpenReport = async (projectId: string) => {
        
        setIsOpeningEditor(true)
        try {
            const token = await getToken()
            if (!token) {
                toast({
                    title: 'Error',
                    description: 'Authentication required',
                    variant: 'destructive',
                })
                setIsOpeningEditor(false)
                return
            }
            
            const project = projects.find(p => p.id === projectId)
            if (!project) {
                toast({
                    title: 'Error',
                    description: 'Project not found',
                    variant: 'destructive',
                })
                setIsOpeningEditor(false)
                return
            }
            
            // First, check if a report already exists for this project by querying the API
            try {
                const reportsResponse = await api.get(`/v1/reports/?project_id=${projectId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                if (reportsResponse.data && reportsResponse.data.length > 0) {
                    // Report exists - navigate to the most recent one
                    const sortedReports = reportsResponse.data.sort((a: any, b: any) => 
                        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                    )
                    navigate(`/reports/${sortedReports[0].id}`)
                    return
                }
            } catch (e) {
                console.log('No existing reports found, will create new one')
            }
            
            // Create a new report for this project
            const response = await api.post('/v1/reports/', {
                project_id: projectId,
                title: `${project.name} Report`,
                report_type: 'PENTEST'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            // Navigate to the new report
            navigate(`/reports/${response.data.id}`)
        } catch (error: any) {
            console.error('Failed to create report:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to create report',
                variant: 'destructive',
            })
        } finally {
            setIsOpeningEditor(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'In Progress':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
            case 'Planning':
                return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
            case 'Completed':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            default:
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }
    }

    // Calculate viz percentages
    const getVizWidths = (projectId: string) => {
        const data = projectFindingsData[projectId] || { count: 0, severity: { critical: 0, high: 0, medium: 0, low: 0 } }
        const total = data.count || 1
        return {
            critical: (data.severity.critical / total) * 100,
            high: (data.severity.high / total) * 100,
            medium: (data.severity.medium / total) * 100,
            low: (data.severity.low / total) * 100
        }
    }

    return (
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between flex-shrink-0">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">Reports</h1>
                    <p className="text-muted-foreground mt-1">
                        Select a project to manage findings and generate reports
                    </p>
                </div>
                <NewReportDialog onReportCreated={() => {
                    // Refresh both projects and reports after a new report is created
                    const refreshData = async () => {
                        try {
                            const token = await getToken()
                            if (!token) return
                            
                            // Refresh projects
                            const projectsResponse = await api.get('/v1/projects', {
                                headers: { Authorization: `Bearer ${token}` }
                            })
                            
                            if (projectsResponse.data && projectsResponse.data.length > 0) {
                                const apiProjects = projectsResponse.data.map((p: any) => ({
                                    id: p.id,
                                    name: p.name,
                                    clientName: p.client_name || 'Unknown Client',
                                    clientLogoUrl: '🏢',
                                    status: p.status === 'PLANNING' ? 'Planning' : 
                                            p.status === 'IN_PROGRESS' ? 'In Progress' : 
                                            p.status === 'COMPLETED' ? 'Completed' : 'In Progress',
                                    progress: 0,
                                    findingsCount: p.finding_count || 0,
                                    findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                                    teamMembers: [],
                                    leadTester: p.lead_name || '',
                                    startDate: p.start_date ? new Date(p.start_date) : new Date(),
                                    endDate: p.end_date ? new Date(p.end_date) : new Date(),
                                    lastModified: p.updated_at ? new Date(p.updated_at) : new Date(),
                                    scope: p.description || '',
                                    priority: 'Medium' as const
                                }))
                                
                                setProjects(apiProjects)
                            }
                            
                            // Refresh reports
                            const reportsResponse = await api.get('/v1/reports/', {
                                headers: { Authorization: `Bearer ${token}` }
                            })
                            
                            const reportsByProject: Record<string, Report[]> = {}
                            reportsResponse.data.forEach((report: Report) => {
                                if (!reportsByProject[report.project_id]) {
                                    reportsByProject[report.project_id] = []
                                }
                                reportsByProject[report.project_id].push(report)
                            })
                            
                            setProjectReports(reportsByProject)
                        } catch (error) {
                            console.error('Failed to refresh data:', error)
                        }
                    }
                    refreshData()
                }} />
            </div>

            {/* Two-Column Layout - Premium Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Left Column - Projects List (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
                    {/* Search and Filters */}
                    <div className="space-y-3 flex-shrink-0">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 bg-muted/50 border-border"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {['all', 'In Progress', 'Planning'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status as any)}
                                    className={cn(
                                        'px-3 py-1 text-xs font-medium rounded-full transition-all whitespace-nowrap',
                                        statusFilter === status
                                            ? 'bg-zinc-800 text-white shadow-sm'
                                            : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                                    )}
                                >
                                    {status === 'all' ? 'All' : status}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Projects List - Refined */}
                    <div className="space-y-2 overflow-y-auto flex-1 pr-2 custom-scrollbar">
                        {filteredProjects.map((project) => {
                            const isActive = selectedProject?.id === project.id
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    className={cn(
                                        'p-4 rounded-lg cursor-pointer transition-all duration-200 group',
                                        isActive
                                            ? 'bg-zinc-800/50 text-white shadow-sm ring-1 ring-zinc-700'
                                            : 'bg-transparent hover:bg-zinc-900/30 text-zinc-400 hover:text-zinc-200'
                                    )}
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <div className="text-2xl flex-shrink-0 bg-zinc-900/50 w-10 h-10 flex items-center justify-center rounded-md border border-zinc-800">
                                                {project.clientLogoUrl}
                                            </div>
                                            <div className="min-w-0">
                                                <h3 className={cn("font-medium text-sm truncate", isActive ? "text-zinc-100" : "text-zinc-300 group-hover:text-zinc-100")}>
                                                    {project.name}
                                                </h3>
                                                <p className="text-xs text-zinc-500 truncate mt-0.5">
                                                    {project.clientName}
                                                </p>
                                            </div>
                                        </div>
                                        {isActive && <ChevronRight className="w-4 h-4 text-zinc-500" />}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Right Column - Project Preview (8 cols) - Premium Bespoke View */}
                <div className="lg:col-span-8 flex flex-col min-h-0">
                    {selectedProject ? (
                        <div className="bg-zinc-950/50 border border-zinc-800 rounded-xl h-full overflow-hidden flex flex-col shadow-sm">
                            
                            {/* 1. The Header (Top Row) */}
                            <div className="p-8 border-b border-zinc-800 flex flex-col sm:flex-row sm:items-start justify-between gap-6 bg-zinc-900/20">
                                <div className="space-y-3">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-2xl font-bold tracking-tight text-white">
                                            {selectedProject.name}
                                        </h2>
                                        <Badge className={cn("border bg-transparent", getStatusColor(selectedProject.status))}>
                                            {selectedProject.status}
                                        </Badge>
                                    </div>
                                    <p className="text-zinc-400 text-sm flex items-center gap-2">
                                        <span className="font-medium text-zinc-300">{selectedProject.clientName}</span>
                                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                                        <span>Last modified {selectedProject.lastModified.toLocaleDateString()}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 h-9">
                                        <Share2 className="w-4 h-4 mr-2" />
                                        Share
                                    </Button>
                                    <Button variant="ghost" size="sm" className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 h-9">
                                        <Download className="w-4 h-4 mr-2" />
                                        Export
                                    </Button>
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-red-400 hover:text-red-300 hover:bg-red-950/50 h-9"
                                        onClick={() => setDeleteDialogOpen(true)}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                    </Button>
                                    <Button 
                                        onClick={() => handleOpenReport(selectedProject.id)}
                                        disabled={isOpeningEditor}
                                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium h-9 px-4 shadow-lg shadow-emerald-900/20"
                                    >
                                        {isOpeningEditor ? (
                                            <>
                                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                                Opening...
                                            </>
                                        ) : (
                                            <>
                                                Open Editor
                                                <ArrowUpRight className="w-4 h-4 ml-2" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-8 space-y-10">
                                {(() => {
                                    const findings = projectFindingsData[selectedProject.id] || { count: 0, severity: { critical: 0, high: 0, medium: 0, low: 0 } }
                                    const viz = getVizWidths(selectedProject.id)
                                    return (
                                        <>
                                            {/* 2. Health Strip & 3. Risk Viz */}
                                            <div className="space-y-6">
                                                {/* Health Strip */}
                                                <div className="flex items-center py-4 border-y border-zinc-800/50 divide-x divide-zinc-800">
                                                    <div className="px-6 first:pl-0">
                                                        <div className="text-sm text-zinc-500 font-medium mb-1">Total Findings</div>
                                                        <div className="text-3xl font-bold text-white">{findings.count}</div>
                                                    </div>
                                                    <div className="px-6">
                                                        <div className="text-sm text-red-500/80 font-medium mb-1">Critical</div>
                                                        <div className="text-3xl font-bold text-red-500">{findings.severity.critical}</div>
                                                    </div>
                                                    <div className="px-6">
                                                        <div className="text-sm text-orange-500/80 font-medium mb-1">High</div>
                                                        <div className="text-3xl font-bold text-orange-500">{findings.severity.high}</div>
                                                    </div>
                                                    <div className="px-6">
                                                        <div className="text-sm text-yellow-500/80 font-medium mb-1">Medium</div>
                                                        <div className="text-3xl font-bold text-yellow-500">{findings.severity.medium}</div>
                                                    </div>
                                                    <div className="px-6">
                                                        <div className="text-sm text-blue-500/80 font-medium mb-1">Low</div>
                                                        <div className="text-3xl font-bold text-blue-500">{findings.severity.low}</div>
                                                    </div>
                                                </div>

                                                {/* Risk Viz Stacked Bar */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs text-zinc-500 font-medium uppercase tracking-wider">
                                                        <span>Risk Distribution</span>
                                                        <span>{findings.count > 0 ? 'Analysis' : 'No Data'}</span>
                                                    </div>
                                                    <div className="h-2.5 w-full bg-zinc-900 rounded-full flex overflow-hidden ring-1 ring-zinc-800">
                                                        {findings.count > 0 ? (
                                                            <>
                                                                <div style={{ width: `${viz.critical}%` }} className="h-full bg-red-600 transition-all duration-500" />
                                                                <div style={{ width: `${viz.high}%` }} className="h-full bg-orange-500 transition-all duration-500" />
                                                                <div style={{ width: `${viz.medium}%` }} className="h-full bg-yellow-500 transition-all duration-500" />
                                                                <div style={{ width: `${viz.low}%` }} className="h-full bg-blue-500 transition-all duration-500" />
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full bg-zinc-800/50" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 4. Metadata Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm uppercase tracking-wider">
                                                        <Target className="w-4 h-4 text-zinc-500" />
                                                        Scope & Methodology
                                                    </div>
                                                    <div className="bg-zinc-900/30 p-4 rounded-lg border border-zinc-800/50 space-y-3">
                                                        <div>
                                                            <label className="text-xs text-zinc-500 block mb-1">Primary Scope</label>
                                                            <p className="text-sm text-zinc-300 leading-relaxed">{selectedProject.scope}</p>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-zinc-500 block mb-1">Methodology</label>
                                                            <p className="text-sm text-zinc-300">OWASP Top 10, PTES</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-4">
                                                    <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm uppercase tracking-wider">
                                                        <Clock className="w-4 h-4 text-zinc-500" />
                                                        Timeline
                                                    </div>
                                                    <div className="bg-zinc-900/30 p-4 rounded-lg border border-zinc-800/50 space-y-4">
                                                        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3 last:border-0 last:pb-0">
                                                            <span className="text-sm text-zinc-400">Start Date</span>
                                                            <span className="text-sm text-zinc-200 font-mono">{selectedProject.startDate.toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center border-b border-zinc-800/50 pb-3 last:border-0 last:pb-0">
                                                            <span className="text-sm text-zinc-400">End Date</span>
                                                            <span className="text-sm text-zinc-200 font-mono">{selectedProject.endDate.toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm text-zinc-400">Duration</span>
                                                            <span className="text-sm text-zinc-200 font-mono">3 Weeks</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="md:col-span-2 space-y-4">
                                                    <div className="flex items-center gap-2 text-zinc-100 font-semibold text-sm uppercase tracking-wider">
                                                        <Users className="w-4 h-4 text-zinc-500" />
                                                        Assigned Team
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                                        {selectedProject.teamMembers.map((member: { id: string, name: string }) => (
                                                            <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg border border-zinc-800 bg-zinc-900/20">
                                                                <Avatar className="h-8 w-8 border border-zinc-700">
                                                                    <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xs">
                                                                        {member.name.split(' ').map((n: string) => n[0]).join('')}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <div>
                                                                    <p className="text-sm font-medium text-zinc-200">{member.name}</p>
                                                                    <p className="text-xs text-zinc-500">Security Engineer</p>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </>
                                    )
                                })()}
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex items-center justify-center bg-zinc-950/30 border border-zinc-800 rounded-xl border-dashed">
                            <div className="text-center">
                                <Shield className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-zinc-400">No Project Selected</h3>
                                <p className="text-sm text-zinc-600 mt-1">Select a project from the sidebar to view details.</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="bg-zinc-900 border-zinc-800">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-zinc-100">Delete Project</AlertDialogTitle>
                        <AlertDialogDescription className="text-zinc-400">
                            Are you sure you want to delete <span className="font-semibold text-zinc-300">"{selectedProject?.name}"</span>? 
                            This will permanently delete the project and all associated reports and findings. 
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel 
                            className="bg-zinc-800 border-zinc-700 text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100"
                            disabled={isDeleting}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteProject}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-500 text-white"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Project
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
