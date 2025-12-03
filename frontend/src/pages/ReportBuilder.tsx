import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Search, FileText, AlertTriangle, Clock, Calendar, Target, ChevronRight, Download, Edit, ArrowUpRight, Users, Shield, Trash2, Loader2 } from 'lucide-react'
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
                
                const response = await api.get('/v1/projects/', {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                if (response.data && response.data.length > 0) {
                    // Map API projects to the format expected by the UI
                    const apiProjects = response.data.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        clientName: p.client_name || 'Unknown Client',
                        clientLogoUrl: '',
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

    // Load actual findings counts from API
    useEffect(() => {
        const fetchFindingsCounts = async () => {
            const token = await getToken()
            if (!token || projects.length === 0) return
            
        const data: Record<string, any> = {}
            
            // Fetch findings for each project in parallel
            await Promise.all(projects.map(async (project) => {
                try {
                    const response = await api.get(`/findings/?project_id=${project.id}`, {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    
                    if (response.data && Array.isArray(response.data)) {
                        const findings = response.data
                    const breakdown = { critical: 0, high: 0, medium: 0, low: 0 }
                    findings.forEach((f: any) => {
                            const severity = f.severity?.toUpperCase()
                            if (severity === 'CRITICAL') breakdown.critical++
                            else if (severity === 'HIGH') breakdown.high++
                            else if (severity === 'MEDIUM') breakdown.medium++
                            else if (severity === 'LOW') breakdown.low++
                    })
                    data[project.id] = { count: findings.length, severity: breakdown }
                    } else {
                        data[project.id] = { count: 0, severity: { critical: 0, high: 0, medium: 0, low: 0 } }
                    }
                } catch (e) {
                    console.error(`Failed to fetch findings for project ${project.id}:`, e)
                    data[project.id] = { count: 0, severity: { critical: 0, high: 0, medium: 0, low: 0 } }
                }
            }))
            
        setProjectFindingsData(data)
        }
        
        fetchFindingsCounts()
    }, [projects, getToken])

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
                return 'bg-emerald-100 text-emerald-700 border-emerald-200'
            case 'Planning':
                return 'bg-violet-100 text-violet-700 border-violet-200'
            case 'Completed':
                return 'bg-slate-100 text-slate-700 border-slate-200'
            case 'On Hold':
                return 'bg-amber-100 text-amber-700 border-amber-200'
            default:
                return 'bg-slate-100 text-slate-600 border-slate-200'
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
                    <h1 className="text-2xl font-semibold text-slate-900">Reports</h1>
                    <p className="text-sm text-slate-500 mt-1">
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
                                    clientLogoUrl: '',
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
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <Input
                                placeholder="Search projects..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9 h-10 bg-white border-slate-200 text-slate-900 placeholder:text-slate-400"
                            />
                        </div>
                        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                            {['all', 'In Progress', 'Planning'].map((status) => (
                                <button
                                    key={status}
                                    onClick={() => setStatusFilter(status as any)}
                                    className={cn(
                                        'px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap',
                                        statusFilter === status
                                            ? 'bg-violet-600 text-white shadow-sm'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
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
                                        'p-3 rounded-xl cursor-pointer transition-all duration-200 group',
                                        isActive
                                            ? 'bg-violet-50 ring-1 ring-violet-200 shadow-sm'
                                            : 'hover:bg-slate-50'
                                    )}
                                >
                                    <div className="flex items-center gap-3">
                                        <Avatar className="h-10 w-10 rounded-xl flex-shrink-0">
                                            <AvatarFallback className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                                                {project.name.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <h3 className={cn(
                                                "text-sm font-semibold truncate",
                                                isActive ? "text-violet-700" : "text-slate-900 group-hover:text-violet-700"
                                            )}>
                                                {project.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 truncate">
                                                {project.clientName}
                                            </p>
                                        </div>
                                        {isActive && <ChevronRight className="w-4 h-4 text-violet-500 flex-shrink-0" />}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>

                {/* Right Column - Project Preview (8 cols) - Premium Bespoke View */}
                <div className="lg:col-span-8 flex flex-col min-h-0">
                    {selectedProject ? (
                        <Card className="h-full overflow-hidden flex flex-col">
                            
                            {/* 1. The Header (Top Row) */}
                            <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-3">
                                        <h2 className="text-xl font-semibold text-slate-900">
                                            {selectedProject.name}
                                        </h2>
                                        <Badge className={cn("text-xs", getStatusColor(selectedProject.status))}>
                                            {selectedProject.status}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-slate-500 flex items-center gap-2">
                                        <span className="font-medium text-slate-700">{selectedProject.clientName}</span>
                                        <span className="w-1 h-1 rounded-full bg-slate-300" />
                                        <span>Last modified {selectedProject.lastModified.toLocaleDateString()}</span>
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="sm" className="text-slate-600 border-slate-200 h-9">
                                        <Download className="w-4 h-4 mr-2" />
                                        Export
                                    </Button>
                                    <Button 
                                        variant="outline" 
                                        size="sm" 
                                        className="text-red-600 border-red-200 hover:bg-red-50 h-9"
                                        onClick={() => setDeleteDialogOpen(true)}
                                    >
                                        <Trash2 className="w-4 h-4 mr-2" />
                                        Delete
                                    </Button>
                                    <Button 
                                        onClick={() => handleOpenReport(selectedProject.id)}
                                        disabled={isOpeningEditor}
                                        className="bg-violet-600 hover:bg-violet-700 text-white font-medium h-9 px-4"
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

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {(() => {
                                    const findings = projectFindingsData[selectedProject.id] || { count: 0, severity: { critical: 0, high: 0, medium: 0, low: 0 } }
                                    const viz = getVizWidths(selectedProject.id)
                                    return (
                                        <>
                                            {/* 2. Health Strip & 3. Risk Viz */}
                                            <div className="space-y-4">
                                                {/* Health Strip */}
                                                <div className="grid grid-cols-5 gap-4">
                                                    <div className="bg-slate-50 rounded-xl p-4 text-center">
                                                        <div className="text-xs text-slate-500 font-medium mb-1">Total</div>
                                                        <div className="text-2xl font-bold text-slate-900">{findings.count}</div>
                                                    </div>
                                                    <div className="bg-red-50 rounded-xl p-4 text-center">
                                                        <div className="text-xs text-red-600 font-medium mb-1">Critical</div>
                                                        <div className="text-2xl font-bold text-red-600">{findings.severity.critical}</div>
                                                    </div>
                                                    <div className="bg-orange-50 rounded-xl p-4 text-center">
                                                        <div className="text-xs text-orange-600 font-medium mb-1">High</div>
                                                        <div className="text-2xl font-bold text-orange-600">{findings.severity.high}</div>
                                                    </div>
                                                    <div className="bg-amber-50 rounded-xl p-4 text-center">
                                                        <div className="text-xs text-amber-600 font-medium mb-1">Medium</div>
                                                        <div className="text-2xl font-bold text-amber-600">{findings.severity.medium}</div>
                                                    </div>
                                                    <div className="bg-emerald-50 rounded-xl p-4 text-center">
                                                        <div className="text-xs text-emerald-600 font-medium mb-1">Low</div>
                                                        <div className="text-2xl font-bold text-emerald-600">{findings.severity.low}</div>
                                                    </div>
                                                </div>

                                                {/* Risk Viz Stacked Bar */}
                                                <div className="space-y-2">
                                                    <div className="flex justify-between text-xs text-slate-500 font-medium uppercase tracking-wider">
                                                        <span>Risk Distribution</span>
                                                        <span>{findings.count > 0 ? 'Analysis' : 'No Data'}</span>
                                                    </div>
                                                    <div className="h-2 w-full bg-slate-100 rounded-full flex overflow-hidden">
                                                        {findings.count > 0 ? (
                                                            <>
                                                                <div style={{ width: `${viz.critical}%` }} className="h-full bg-red-500 transition-all duration-500" />
                                                                <div style={{ width: `${viz.high}%` }} className="h-full bg-orange-500 transition-all duration-500" />
                                                                <div style={{ width: `${viz.medium}%` }} className="h-full bg-amber-500 transition-all duration-500" />
                                                                <div style={{ width: `${viz.low}%` }} className="h-full bg-emerald-500 transition-all duration-500" />
                                                            </>
                                                        ) : (
                                                            <div className="w-full h-full bg-slate-200" />
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {/* 4. Metadata Grid */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                                                        <Target className="w-4 h-4 text-slate-400" />
                                                        Scope & Methodology
                                                    </div>
                                                    <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                                                        <div>
                                                            <label className="text-xs text-slate-500 block mb-1">Primary Scope</label>
                                                            <p className="text-sm text-slate-700 leading-relaxed">{selectedProject.scope || 'Not specified'}</p>
                                                        </div>
                                                        <div>
                                                            <label className="text-xs text-slate-500 block mb-1">Methodology</label>
                                                            <p className="text-sm text-slate-700">OWASP Top 10, PTES</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-3">
                                                    <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                                                        <Clock className="w-4 h-4 text-slate-400" />
                                                        Timeline
                                                    </div>
                                                    <div className="bg-slate-50 p-4 rounded-xl space-y-3">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm text-slate-500">Start Date</span>
                                                            <span className="text-sm text-slate-900 font-medium">{selectedProject.startDate.toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-sm text-slate-500">End Date</span>
                                                            <span className="text-sm text-slate-900 font-medium">{selectedProject.endDate.toLocaleDateString()}</span>
                                                        </div>
                                                        <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                                                            <span className="text-sm text-slate-500">Duration</span>
                                                            <span className="text-sm text-slate-900 font-medium">3 Weeks</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {selectedProject.teamMembers.length > 0 && (
                                                    <div className="md:col-span-2 space-y-3">
                                                        <div className="flex items-center gap-2 text-slate-700 font-semibold text-xs uppercase tracking-wider">
                                                            <Users className="w-4 h-4 text-slate-400" />
                                                            Assigned Team
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                                            {selectedProject.teamMembers.map((member: { id: string, name: string }) => (
                                                                <div key={member.id} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
                                                                    <Avatar className="h-8 w-8 rounded-lg">
                                                                        <AvatarFallback className="rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                                                                            {member.name.split(' ').map((n: string) => n[0]).join('')}
                                                                        </AvatarFallback>
                                                                    </Avatar>
                                                                    <div>
                                                                        <p className="text-sm font-semibold text-slate-900">{member.name}</p>
                                                                        <p className="text-xs text-slate-500">Security Engineer</p>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </>
                                    )
                                })()}
                            </div>
                        </Card>
                    ) : (
                        <Card className="h-full flex items-center justify-center border-dashed">
                            <div className="text-center">
                                <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                                    <Shield className="w-6 h-6 text-slate-400" />
                                </div>
                                <h3 className="text-sm font-semibold text-slate-900">No Project Selected</h3>
                                <p className="text-xs text-slate-500 mt-1">Select a project from the list to view details.</p>
                            </div>
                        </Card>
                    )}
                </div>
            </div>

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
                <AlertDialogContent className="bg-white border-slate-200">
                    <AlertDialogHeader>
                        <AlertDialogTitle className="text-slate-900">Delete Project</AlertDialogTitle>
                        <AlertDialogDescription className="text-slate-500">
                            Are you sure you want to delete <span className="font-semibold text-slate-700">"{selectedProject?.name}"</span>? 
                            This will permanently delete the project and all associated reports and findings. 
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel 
                            className="border-slate-200 text-slate-600 hover:bg-slate-50"
                            disabled={isDeleting}
                        >
                            Cancel
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDeleteProject}
                            disabled={isDeleting}
                            className="bg-red-600 hover:bg-red-700 text-white"
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
