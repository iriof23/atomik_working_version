import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { FileText, AlertTriangle, Clock, Target, ChevronRight, ArrowUpRight, Users, Shield, Trash2, Loader2 } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { logProjectDeleted } from '@/lib/activityLog'

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
    const [selectedProject, setSelectedProject] = useState<Project | null>(null)
    const [statusFilter, setStatusFilter] = useState<'all' | 'In Progress' | 'Planning'>('all')
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
                    // Map API projects to the format expected by the UI (using findings_by_severity from API)
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
                        findingsBySeverity: p.findings_by_severity || { critical: 0, high: 0, medium: 0, low: 0 },
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

    // Filter projects
    const filteredProjects = projects.filter(project => {
        return statusFilter === 'all' || project.status === statusFilter
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
                return 'bg-slate-800 text-white shadow-sm border-0'
            case 'Planning':
                return 'bg-slate-200 text-slate-700 shadow-sm border-0'
            case 'Completed':
                return 'bg-emerald-600 text-white shadow-sm border-0'
            case 'On Hold':
                return 'bg-amber-600 text-white shadow-sm border-0'
            default:
                return 'bg-slate-200 text-slate-700 shadow-sm border-0'
        }
    }

    // Calculate viz percentages (using data from project directly)
    const getVizWidths = (projectId: string) => {
        const project = projects.find(p => p.id === projectId)
        const severity = project?.findingsBySeverity || { critical: 0, high: 0, medium: 0, low: 0 }
        const total = project?.findingsCount || 1
        return {
            critical: (severity.critical / total) * 100,
            high: (severity.high / total) * 100,
            medium: (severity.medium / total) * 100,
            low: (severity.low / total) * 100
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
            </div>

            {/* Two-Column Layout - Premium Split View */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1 min-h-0">
                {/* Left Column - Projects List (4 cols) */}
                <div className="lg:col-span-4 flex flex-col gap-4 min-h-0">
                    {/* Filters */}
                    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide flex-shrink-0">
                        {['all', 'In Progress', 'Planning'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setStatusFilter(status as any)}
                                className={cn(
                                    'px-3 py-1.5 text-xs font-medium rounded-full transition-all whitespace-nowrap',
                                    statusFilter === status
                                        ? 'bg-emerald-600 text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                                )}
                            >
                                {status === 'all' ? 'All' : status}
                            </button>
                        ))}
                    </div>

                    {/* Projects List - Premium Navigation Rail */}
                    <div className="space-y-1 overflow-y-auto flex-1 pr-2 scrollbar-thin">
                        {filteredProjects.map((project) => {
                            const isActive = selectedProject?.id === project.id
                            return (
                                <div
                                    key={project.id}
                                    onClick={() => setSelectedProject(project)}
                                    className={cn(
                                        'relative p-3 rounded-xl cursor-pointer transition-all duration-200 group',
                                        isActive
                                            ? 'bg-emerald-50/80'
                                            : 'hover:bg-slate-50'
                                    )}
                                >
                                    {/* Active Indicator Bar */}
                                    <div className={cn(
                                        "absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-full transition-all duration-200",
                                        isActive 
                                            ? "h-8 bg-emerald-500" 
                                            : "h-0 bg-transparent group-hover:h-4 group-hover:bg-slate-300"
                                    )} />
                                    
                                    <div className="flex items-center gap-3 pl-2">
                                        <Avatar className="h-10 w-10 rounded-xl flex-shrink-0">
                                            <AvatarFallback className={cn(
                                                "rounded-xl text-white text-xs font-semibold transition-all",
                                                isActive 
                                                    ? "bg-gradient-to-br from-emerald-500 to-teal-600" 
                                                    : "bg-slate-400 group-hover:bg-gradient-to-br group-hover:from-emerald-500 group-hover:to-teal-600"
                                            )}>
                                                {project.name.slice(0, 2).toUpperCase()}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="min-w-0 flex-1">
                                            <h3 className={cn(
                                                "text-sm font-semibold truncate transition-colors",
                                                isActive ? "text-emerald-700" : "text-slate-700 group-hover:text-slate-900"
                                            )}>
                                                {project.name}
                                            </h3>
                                            <p className="text-xs text-slate-500 truncate">
                                                {project.clientName}
                                            </p>
                                        </div>
                                        <ChevronRight className={cn(
                                            "w-4 h-4 flex-shrink-0 transition-all",
                                            isActive 
                                                ? "text-emerald-500 opacity-100" 
                                                : "text-slate-300 opacity-0 group-hover:opacity-100"
                                        )} />
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
                                    <Button 
                                        variant="ghost" 
                                        size="sm" 
                                        className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-9 gap-1.5"
                                        onClick={() => setDeleteDialogOpen(true)}
                                    >
                                        <Trash2 className="w-4 h-4 shrink-0" />
                                        <span>Delete</span>
                                    </Button>
                                    <Button 
                                        onClick={() => handleOpenReport(selectedProject.id)}
                                        disabled={isOpeningEditor}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold h-10 px-5 shadow-lg shadow-emerald-600/25 hover:shadow-emerald-600/30 transition-all gap-2"
                                    >
                                        {isOpeningEditor ? (
                                            <>
                                                <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                                                <span>Opening...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Open Editor</span>
                                                <ArrowUpRight className="w-4 h-4 shrink-0" />
                                            </>
                                        )}
                                    </Button>
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto p-6 space-y-8">
                                {(() => {
                                    // Use findings data directly from project (no extra API calls)
                                    const findings = { count: selectedProject.findingsCount, severity: selectedProject.findingsBySeverity }
                                    const viz = getVizWidths(selectedProject.id)
                                    return (
                                        <>
                                            {/* 2. Health Strip & 3. Risk Viz */}
                                            <div className="space-y-4">
                                                {/* Health Strip - Premium solid colors */}
                                                <div className="grid grid-cols-5 gap-3">
                                                    <div className="bg-slate-100 rounded-xl p-4 text-center">
                                                        <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mb-1">Total</div>
                                                        <div className="text-2xl font-bold text-slate-900">{findings.count}</div>
                                                    </div>
                                                    <div className="bg-gradient-to-br from-red-600 to-red-700 rounded-xl p-4 text-center shadow-sm">
                                                        <div className="text-[10px] text-white/80 font-semibold uppercase tracking-wider mb-1">Critical</div>
                                                        <div className="text-2xl font-bold text-white">{findings.severity.critical}</div>
                                                    </div>
                                                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-4 text-center shadow-sm">
                                                        <div className="text-[10px] text-white/80 font-semibold uppercase tracking-wider mb-1">High</div>
                                                        <div className="text-2xl font-bold text-white">{findings.severity.high}</div>
                                                    </div>
                                                    <div className="bg-gradient-to-br from-amber-500 to-amber-600 rounded-xl p-4 text-center shadow-sm">
                                                        <div className="text-[10px] text-white/80 font-semibold uppercase tracking-wider mb-1">Medium</div>
                                                        <div className="text-2xl font-bold text-white">{findings.severity.medium}</div>
                                                    </div>
                                                    <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-4 text-center shadow-sm">
                                                        <div className="text-[10px] text-white/80 font-semibold uppercase tracking-wider mb-1">Low</div>
                                                        <div className="text-2xl font-bold text-white">{findings.severity.low}</div>
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
                                                                        <AvatarFallback className="rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
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
                            className="bg-red-600 hover:bg-red-700 text-white gap-2"
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                                    <span>Deleting...</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 shrink-0" />
                                    <span>Delete Project</span>
                                </>
                            )}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}
