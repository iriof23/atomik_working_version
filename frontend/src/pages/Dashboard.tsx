import React, { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/lib/store'
import { useUser, useAuth } from '@clerk/clerk-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { AddClientDialog } from '@/components/AddClientDialog'
import { AddFindingDialog } from '@/components/AddFindingDialog'
import { AddProjectDialog } from '@/components/AddProjectDialog'
import ProjectDetailModal from '@/components/ProjectDetailModal'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { getActivityLog, type ActivityEvent, logClientCreated, logProjectCreated, logFindingAdded } from '@/lib/activityLog'
import {
    Play,
    ArrowRight,
    AlertTriangle,
    Clock,
    TrendingUp,
    TrendingDown,
    CheckCircle2,
    Plus,
    Search,
    FileText,
    Users,
    Zap,
    Calendar,
    MoreHorizontal,
    Activity,
    Shield,
    Loader2,
    ScrollText,
    FolderKanban,
    Flag,
    ChevronRight,
    Sparkles,
    BarChart3,
    MessageSquare,
    GitCommit,
    ExternalLink,
    Eye,
    Pencil
} from 'lucide-react'

// --- Helper Functions ---

function formatRelativeTime(date: Date): string {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    const diffHours = Math.floor(diffMinutes / 60)
    const diffDays = Math.floor(diffHours / 24)
    
    if (diffSeconds < 60) return 'Just now'
    if (diffMinutes < 60) return `${diffMinutes}m ago`
    if (diffHours < 24) return `${diffHours}h ago`
    if (diffDays === 1) return '1d ago'
    if (diffDays < 7) return `${diffDays}d ago`
    
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

function formatDate(dateString: string): string {
    const date = new Date(dateString)
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: '2-digit' })
}

// --- Types ---

interface Project {
    id: string
    name: string
    clientName: string
    status: string
    priority: string
    progress: number
    endDate: string
    updatedAt: string
    findings?: any[]
}

interface DashboardData {
    activeProject: Project | null
    upcomingProjects: Project[]
    stats: {
        totalFindings: number
        criticalFindings: number
        activeClients: number
        completedProjects: number
    }
    recentActivity: Array<{
        id: string
        type: 'project' | 'finding' | 'report' | 'client'
        title: string
        description: string
        timestamp: string
        timestampText?: string
        icon: React.ReactNode
        severity?: string
    }>
}

// --- Dashboard Store Hook (Fetches real data from API) ---

const useDashboardStore = (getToken: () => Promise<string | null>) => {
    const [data, setData] = useState<DashboardData>({
        activeProject: null,
        upcomingProjects: [],
        stats: {
            totalFindings: 0,
            criticalFindings: 0,
            activeClients: 0,
            completedProjects: 0
        },
        recentActivity: []
    })
    const [allProjects, setAllProjects] = useState<Project[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        const fetchDashboardData = async () => {
            setIsLoading(true)
            
            let projects: Project[] = []
            let clients: any[] = []
            let reports: any[] = []
            
            try {
                const token = await getToken()
                if (token) {
                    // Fetch real projects from API
                    try {
                        const projectsRes = await api.get('/v1/projects/', {
                            headers: { Authorization: `Bearer ${token}` }
                        })
                        if (projectsRes.data && Array.isArray(projectsRes.data)) {
                            projects = projectsRes.data.map((p: any) => ({
                                id: p.id,
                                name: p.name,
                                clientName: p.client_name || 'Unknown Client',
                                status: p.status === 'PLANNING' ? 'Planning' :
                                        p.status === 'IN_PROGRESS' ? 'In Progress' :
                                        p.status === 'COMPLETED' ? 'Completed' :
                                        p.status === 'REVIEW' ? 'In Review' : p.status,
                                priority: p.priority || 'Medium',
                                progress: p.status === 'COMPLETED' ? 100 :
                                          p.status === 'IN_PROGRESS' ? 50 :
                                          p.status === 'REVIEW' ? 75 :
                                          p.status === 'PLANNING' ? 10 : 0,
                                endDate: p.end_date || new Date().toISOString(),
                                updatedAt: p.updated_at || new Date().toISOString(),
                                findings: []
                            }))
                        }
                    } catch (e) {
                        console.error('Failed to fetch projects:', e)
                    }
                    
                    // Fetch real clients from API
                    try {
                        const clientsRes = await api.get('/clients/', {
                            headers: { Authorization: `Bearer ${token}` }
                        })
                        if (clientsRes.data && Array.isArray(clientsRes.data)) {
                            clients = clientsRes.data
                        }
                    } catch (e) {
                        console.error('Failed to fetch clients:', e)
                    }
                    
                    // Fetch reports from API
                    try {
                        const reportsRes = await api.get('/v1/reports/', {
                            headers: { Authorization: `Bearer ${token}` }
                        })
                        if (reportsRes.data && Array.isArray(reportsRes.data)) {
                            reports = reportsRes.data
                        }
                    } catch (e) {
                        console.error('Failed to fetch reports:', e)
                    }
                }
            } catch (e) {
                console.error('Failed to get auth token:', e)
            }

            // Calculate Stats from localStorage findings (for each project)
            let totalFindings = 0
            let criticalFindings = 0

            projects.forEach((p: any) => {
                const findingsKey = `findings_${p.id}`
                const storedFindings = localStorage.getItem(findingsKey)
                if (storedFindings) {
                    try {
                        const findings = JSON.parse(storedFindings)
                        totalFindings += findings.length
                        findings.forEach((f: any) => {
                            if (f.severity === 'Critical') criticalFindings++
                        })
                    } catch (e) { }
                }
            })

            // Active Project (Most recently updated 'In Progress' project)
            const activeProjects = projects.filter(p => 
                p.status === 'In Progress' || p.status === 'IN_PROGRESS' || p.status === 'In Review'
            )
            const sortedActive = [...activeProjects].sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
            )
            const activeProject = sortedActive.length > 0 ? sortedActive[0] : (projects[0] || null)

            // Upcoming Deadlines - Projects with future end dates, not completed
            const upcoming = [...projects]
                .filter(p => p.status !== 'Completed' && p.status !== 'COMPLETED' && new Date(p.endDate) > new Date())
                .sort((a, b) => new Date(a.endDate).getTime() - new Date(b.endDate).getTime())
                .slice(0, 3)

            // Recent Activity - Build comprehensive activity feed
            const activityList: Array<any> = []
            
            // Add project activities
            projects.forEach(p => {
                activityList.push({
                    id: `proj-${p.id}`,
                    type: 'project' as const,
                    title: p.status === 'Completed' || p.status === 'COMPLETED' ? 'Project Completed' : 
                           p.status === 'In Progress' || p.status === 'IN_PROGRESS' ? 'Project In Progress' :
                           'Project Created',
                    description: `${p.name} • ${p.clientName}`,
                    timestamp: new Date(p.updatedAt).toISOString(),
                    timestampText: formatRelativeTime(new Date(p.updatedAt)),
                    icon: <Activity className="w-4 h-4 text-blue-400" />,
                    severity: p.status
                })
            })
            
            // Add findings from all projects (from localStorage)
            projects.forEach(p => {
                const findingsKey = `findings_${p.id}`
                const storedFindings = localStorage.getItem(findingsKey)
                if (storedFindings) {
                    try {
                        const findings = JSON.parse(storedFindings)
                        findings.forEach((f: any) => {
                            activityList.push({
                                id: `find-${f.id}`,
                                type: 'finding' as const,
                                title: f.severity === 'Critical' ? 'Critical Finding Detected' :
                                       f.severity === 'High' ? 'High Severity Finding' :
                                       'Finding Added',
                                description: `${f.title} • ${p.name}`,
                                timestamp: f.createdAt || new Date().toISOString(),
                                timestampText: formatRelativeTime(new Date(f.createdAt || new Date())),
                                icon: f.severity === 'Critical' ? <AlertTriangle className="w-4 h-4 text-red-400" /> :
                                      f.severity === 'High' ? <AlertTriangle className="w-4 h-4 text-orange-400" /> :
                                      <Shield className="w-4 h-4 text-yellow-400" />,
                                severity: f.severity
                            })
                        })
                    } catch (e) { }
                }
            })
            
            // Add client activities
            clients.forEach((c: any) => {
                activityList.push({
                    id: `client-${c.id}`,
                    type: 'client' as const,
                    title: 'Client Added',
                    description: `${c.name} added to portfolio`,
                    timestamp: c.created_at || c.createdAt || new Date().toISOString(),
                    timestampText: formatRelativeTime(new Date(c.created_at || c.createdAt || new Date())),
                    icon: <Users className="w-4 h-4 text-emerald-400" />,
                    severity: c.status
                })
            })
            
            // Add report activities
            reports.forEach((r: any) => {
                activityList.push({
                    id: `report-${r.id}`,
                    type: 'report' as const,
                    title: r.status === 'COMPLETED' ? 'Report Completed' : 'Report Created',
                    description: `${r.title} • ${r.project_name || 'Project'}`,
                    timestamp: r.updated_at || r.created_at || new Date().toISOString(),
                    timestampText: formatRelativeTime(new Date(r.updated_at || r.created_at || new Date())),
                    icon: <FileText className="w-4 h-4 text-purple-400" />,
                    severity: r.status
                })
            })
            
            // Sort by most recent and take top 5
            const activity = activityList
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 5)

            setAllProjects(projects)
            setData({
                activeProject,
                upcomingProjects: upcoming,
                stats: {
                    totalFindings,
                    criticalFindings,
                    activeClients: clients.length,
                    completedProjects: projects.filter(p => p.status === 'Completed' || p.status === 'COMPLETED').length
                },
                recentActivity: activity
            })
            
            setIsLoading(false)
        }
        
        fetchDashboardData()
    }, [getToken])

    return { data, allProjects, isLoading }
}

// --- NEW COMPONENTS (Apple/Linear Style) ---

// Stat Widget Card (like screenshot's "Task Status" and "Comments")
interface StatWidgetProps {
    title: string
    icon: React.ReactNode
    children: React.ReactNode
    actions?: React.ReactNode
}

const StatWidget = ({ title, icon, children, actions }: StatWidgetProps) => (
    <Card className="hover:shadow-card-hover transition-shadow">
        <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2 text-slate-600">
                {icon}
                <span className="text-sm font-medium">{title}</span>
            </div>
            {actions && <div className="flex items-center gap-1">{actions}</div>}
        </CardHeader>
        <CardContent>{children}</CardContent>
    </Card>
)

// Mini Sparkline Bar Chart
const SparklineBar = ({ values, color = 'bg-violet-400' }: { values: number[], color?: string }) => {
    const max = Math.max(...values, 1)
    return (
        <div className="flex items-end gap-0.5 h-8">
            {values.map((v, i) => (
                <div
                    key={i}
                    className={cn("w-1.5 rounded-t transition-all", color)}
                    style={{ height: `${(v / max) * 100}%`, opacity: 0.4 + (i / values.length) * 0.6 }}
                />
            ))}
        </div>
    )
}

// Project Status Overview Card
const ProjectStatusCard = ({ projects }: { projects: Project[] }) => {
    const planning = projects.filter(p => p.status === 'Planning').length
    const inProgress = projects.filter(p => p.status === 'In Progress' || p.status === 'IN_PROGRESS').length
    const inReview = projects.filter(p => p.status === 'In Review' || p.status === 'REVIEW').length
    const completed = projects.filter(p => p.status === 'Completed' || p.status === 'COMPLETED').length
    const total = projects.length

    // Generate fake sparkline data based on actual counts
    const sparklineData = [planning * 2, inProgress * 3, inReview * 2, completed, planning, inProgress * 2, completed * 2]

    return (
        <StatWidget 
            title="Project Status" 
            icon={<FolderKanban className="w-4 h-4" />}
            actions={
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                </Button>
            }
        >
            <div className="space-y-4">
                {/* Stats Row */}
                <div className="flex items-baseline gap-6">
                    <div>
                        <span className="text-3xl font-bold text-slate-900">{planning}</span>
                        <span className="text-sm text-slate-500 ml-2">Planning <FolderKanban className="w-3 h-3 inline text-slate-400" /></span>
                    </div>
                    <div>
                        <span className="text-3xl font-bold text-slate-900">{inProgress}</span>
                        <span className="text-sm text-slate-500 ml-2">In Progress <Zap className="w-3 h-3 inline text-violet-500" /></span>
                    </div>
                    <div>
                        <span className="text-3xl font-bold text-slate-900">{inReview}</span>
                        <span className="text-sm text-slate-500 ml-2">Review <Sparkles className="w-3 h-3 inline text-amber-500" /></span>
                    </div>
                </div>

                {/* Progress Bar */}
                <div className="space-y-2">
                    <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                        {planning > 0 && (
                            <div 
                                className="h-full bg-slate-400 transition-all" 
                                style={{ width: `${(planning / Math.max(total, 1)) * 100}%` }} 
                            />
                        )}
                        {inProgress > 0 && (
                            <div 
                                className="h-full bg-gradient-to-r from-violet-500 to-purple-500 transition-all" 
                                style={{ width: `${(inProgress / Math.max(total, 1)) * 100}%` }} 
                            />
                        )}
                        {inReview > 0 && (
                            <div 
                                className="h-full bg-amber-400 transition-all" 
                                style={{ width: `${(inReview / Math.max(total, 1)) * 100}%` }} 
                            />
                        )}
                        {completed > 0 && (
                            <div 
                                className="h-full bg-emerald-500 transition-all" 
                                style={{ width: `${(completed / Math.max(total, 1)) * 100}%` }} 
                            />
                        )}
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                        <span>1d</span>
                        <span>7d</span>
                    </div>
                </div>
            </div>
        </StatWidget>
    )
}

// Findings Overview Widget
const FindingsWidget = ({ stats }: { stats: DashboardData['stats'] }) => {
    const change = stats.criticalFindings > 0 ? -10.2 : 0
    
    return (
        <StatWidget 
            title="Findings" 
            icon={<Shield className="w-4 h-4" />}
            actions={
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600">
                    <MoreHorizontal className="w-4 h-4" />
                </Button>
            }
        >
            <div className="flex items-center justify-between">
                <div>
                    <div className="text-3xl font-bold text-slate-900">{stats.totalFindings}</div>
                    <div className={cn(
                        "text-sm flex items-center gap-1 mt-1",
                        change < 0 ? "text-red-500" : "text-emerald-500"
                    )}>
                        {change < 0 ? <TrendingDown className="w-3 h-3" /> : <TrendingUp className="w-3 h-3" />}
                        {Math.abs(change)}% (7d)
                    </div>
                </div>
                <SparklineBar values={[3, 5, 2, 8, 4, 6, 5]} color="bg-violet-400" />
            </div>
        </StatWidget>
    )
}

// Critical Issues Widget
const CriticalWidget = ({ count }: { count: number }) => (
    <StatWidget 
        title="Critical Issues" 
        icon={<AlertTriangle className="w-4 h-4" />}
        actions={
            <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-600">
                <MoreHorizontal className="w-4 h-4" />
            </Button>
        }
    >
        <div className="flex items-center justify-between">
            <div>
                <div className={cn(
                    "text-3xl font-bold",
                    count > 0 ? "text-red-600" : "text-emerald-600"
                )}>{count}</div>
                <div className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                    {count > 0 ? (
                        <>
                            <span className="text-red-500">▼</span> 2.9% (7d)
                        </>
                    ) : (
                        <>
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> All clear
                        </>
                    )}
                </div>
            </div>
            <SparklineBar 
                values={[2, 1, 3, 1, 2, 1, count]} 
                color={count > 0 ? "bg-red-400" : "bg-emerald-400"} 
            />
        </div>
    </StatWidget>
)

// Project Kanban Card
const ProjectCard = ({ 
    project, 
    onViewDetails,
    onResumeReport 
}: { 
    project: Project
    onViewDetails: (p: Project) => void
    onResumeReport: (p: Project) => void
}) => {
    const getPriorityBadge = (priority: string) => {
        switch (priority?.toLowerCase()) {
            case 'high':
            case 'urgent':
                return <Badge variant="urgent" className="text-[10px] px-1.5 py-0">Urgent</Badge>
            case 'low':
                return <Badge variant="low" className="text-[10px] px-1.5 py-0">Low</Badge>
            default:
                return <Badge variant="normal" className="text-[10px] px-1.5 py-0">Normal</Badge>
        }
    }

    return (
        <Card className="group hover:shadow-card-hover hover:border-slate-300 transition-all cursor-pointer">
            <CardContent className="p-4">
                {/* Header */}
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                        <span className="font-mono">PRJ-{project.id.slice(0, 4).toUpperCase()}</span>
                        {getPriorityBadge(project.priority)}
                    </div>
                </div>

                {/* Title */}
                <h4 className="font-semibold text-slate-900 mb-1 group-hover:text-violet-700 transition-colors">
                    {project.name}
                </h4>
                <p className="text-sm text-slate-500 flex items-center gap-1 mb-3">
                    <Users className="w-3 h-3" />
                    {project.clientName}
                </p>

                {/* Due Date */}
                <div className="flex items-center gap-1 text-xs text-slate-500 mb-4">
                    <Calendar className="w-3 h-3" />
                    Due: {formatDate(project.endDate)}
                </div>

                {/* Progress */}
                <div className="space-y-1.5 mb-4">
                    <div className="flex justify-between text-xs">
                        <span className="text-slate-500">Progress</span>
                        <span className="font-medium text-slate-700">{project.progress}%</span>
                    </div>
                    <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-gradient-to-r from-violet-500 to-purple-500 rounded-full transition-all"
                            style={{ width: `${project.progress}%` }}
                        />
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                    <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(new Date(project.updatedAt))}
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                                e.stopPropagation()
                                onViewDetails(project)
                            }}
                        >
                            <Eye className="w-3 h-3 mr-1" />
                            View
                        </Button>
                        <Button 
                            variant="default" 
                            size="sm" 
                            className="h-7 px-2 text-xs"
                            onClick={(e) => {
                                e.stopPropagation()
                                onResumeReport(project)
                            }}
                        >
                            <Play className="w-3 h-3 mr-1" />
                            Report
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// Kanban Column
const KanbanColumn = ({ 
    title, 
    count, 
    icon,
    projects,
    onViewDetails,
    onResumeReport
}: { 
    title: string
    count: number
    icon: React.ReactNode
    projects: Project[]
    onViewDetails: (p: Project) => void
    onResumeReport: (p: Project) => void
}) => (
    <div className="flex-1 min-w-[280px]">
        <div className="flex items-center gap-2 mb-4 px-1">
            {icon}
            <span className="font-medium text-slate-700">{title}</span>
            <span className="text-sm text-slate-400 ml-1">{count}</span>
        </div>
        <div className="space-y-3">
            {projects.map(project => (
                <ProjectCard 
                    key={project.id} 
                    project={project} 
                    onViewDetails={onViewDetails}
                    onResumeReport={onResumeReport}
                />
            ))}
            {projects.length === 0 && (
                <div className="text-center py-8 text-slate-400 text-sm border-2 border-dashed border-slate-200 rounded-xl">
                    No projects
                </div>
            )}
        </div>
    </div>
)

// Activity Item
const ActivityItem = ({ event }: { event: any }) => {
    const getTypeColor = (type: string) => {
        switch (type) {
            case 'client': return 'bg-emerald-100 text-emerald-700'
            case 'project': return 'bg-blue-100 text-blue-700'
            case 'finding': return 'bg-orange-100 text-orange-700'
            case 'report': return 'bg-purple-100 text-purple-700'
            default: return 'bg-slate-100 text-slate-700'
        }
    }

    return (
        <div className="flex items-center gap-3 py-3 border-b border-slate-100 last:border-0">
            <div className={cn("p-2 rounded-lg", getTypeColor(event.type))}>
                {event.icon}
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">{event.title}</p>
                <p className="text-xs text-slate-500 truncate">{event.description}</p>
            </div>
            <span className="text-xs text-slate-400 whitespace-nowrap">
                {event.timestampText}
            </span>
        </div>
    )
}

// --- Main Dashboard Component ---

export default function Dashboard() {
    const navigate = useNavigate()
    const { toast } = useToast()
    const { getToken } = useAuth()
    const { data, allProjects, isLoading } = useDashboardStore(getToken)
    
    // Dialog states
    const [showClientDialog, setShowClientDialog] = useState(false)
    const [showFindingDialog, setShowFindingDialog] = useState(false)
    const [showProjectDialog, setShowProjectDialog] = useState(false)
    const [viewingProject, setViewingProject] = useState<any | null>(null)
    
    // Load clients for project dialog
    const [clients, setClients] = useState<any[]>([])
    
    useEffect(() => {
        const fetchClients = async () => {
            try {
                const token = await getToken()
                if (token) {
                    const response = await api.get('/clients/', {
                        headers: { Authorization: `Bearer ${token}` }
                    })
                    if (response.data && Array.isArray(response.data)) {
                        setClients(response.data)
                    }
                }
            } catch (e) {
                console.error('Failed to fetch clients:', e)
                // Fallback to localStorage
                const storedClients = JSON.parse(localStorage.getItem('clients') || '[]')
                setClients(storedClients)
            }
        }
        
        if (showProjectDialog) {
            fetchClients()
        }
    }, [showProjectDialog, getToken])
    
    // Handlers (PRESERVED - no changes)
    const handleNewClient = () => setShowClientDialog(true)
    const handleNewFinding = () => setShowFindingDialog(true)
    const handleNewReport = () => navigate('/report-builder')
    
    const handleSearch = () => {
        toast({
            title: "Global Search",
            description: "Search across reports, clients, and projects (coming soon)",
        })
        navigate('/projects')
    }
    
    const handleStartProject = () => setShowProjectDialog(true)
    
    const handleResumeReport = async (project: Project) => {
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
            
            try {
                const reportsResponse = await api.get(`/v1/reports/?project_id=${project.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                if (reportsResponse.data && reportsResponse.data.length > 0) {
                    const sortedReports = reportsResponse.data.sort((a: any, b: any) => 
                        new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
                    )
                    navigate(`/reports/${sortedReports[0].id}`)
                    return
                }
            } catch (e) {
                console.log('No existing reports found, will create new one')
            }
            
            const response = await api.post('/v1/reports/', {
                project_id: project.id,
                title: `${project.name} Report`,
                report_type: 'PENTEST'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            navigate(`/reports/${response.data.id}`)
        } catch (error: any) {
            console.error('Failed to open/create report:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to open report',
                variant: 'destructive',
            })
        }
    }
    
    const handleViewDetails = (project: Project) => {
        const storedProjects = JSON.parse(localStorage.getItem('projects') || '[]')
        const fullProject = storedProjects.find((p: any) => p.id === project.id)
        
        if (fullProject) {
            setViewingProject({
                ...fullProject,
                startDate: new Date(fullProject.startDate),
                endDate: new Date(fullProject.endDate),
                lastActivityDate: fullProject.lastActivityDate ? new Date(fullProject.lastActivityDate) : new Date(),
                createdAt: fullProject.createdAt ? new Date(fullProject.createdAt) : new Date(),
                updatedAt: fullProject.updatedAt ? new Date(fullProject.updatedAt) : new Date(),
                scope: fullProject.scope || [],
                teamMembers: fullProject.teamMembers || [],
                complianceFrameworks: fullProject.complianceFrameworks || [],
                findingsBySeverity: fullProject.findingsBySeverity || { critical: 0, high: 0, medium: 0, low: 0 }
            })
        } else {
            setViewingProject({
                ...project,
                type: 'External',
                complianceFrameworks: [],
                scope: [],
                methodology: 'OWASP',
                teamMembers: [],
                leadTester: '',
                findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                findingsCount: 0,
                description: '',
                lastActivity: '',
                lastActivityDate: new Date(),
                createdAt: new Date(),
                updatedAt: new Date(),
                startDate: new Date(),
                endDate: new Date(project.endDate),
                clientId: '1',
                clientLogoUrl: ''
            })
        }
    }
    
    const handleClientAdded = (client: any) => {
        setClients(prev => [...prev, client])
        logClientCreated(client.name, client.id)
        toast({
            title: "✓ Client Created",
            description: `${client.name} has been added.`,
        })
    }
    
    const handleFindingAdded = (finding: any) => {
        const existingFindings = JSON.parse(localStorage.getItem('customFindings') || '[]')
        const updatedFindings = [{
            ...finding,
            isCustom: true,
            createdAt: new Date().toISOString()
        }, ...existingFindings]
        localStorage.setItem('customFindings', JSON.stringify(updatedFindings))
        window.dispatchEvent(new Event('custom-findings-updated'))
        logFindingAdded(finding.title, finding.severity || 'Medium', 'Library', finding.id)
        toast({
            title: "✓ Finding Created",
            description: `${finding.title} has been added.`,
        })
    }
    
    const handleProjectAdded = (project: any) => {
        logProjectCreated(project.name, project.client_name || project.clientName || 'Unknown', project.id)
        toast({
            title: "✓ Project Created",
            description: `${project.name} is ready.`,
        })
    }

    // Group projects by status for Kanban
    const planningProjects = allProjects.filter(p => p.status === 'Planning')
    const inProgressProjects = allProjects.filter(p => p.status === 'In Progress' || p.status === 'IN_PROGRESS')
    const reviewProjects = allProjects.filter(p => p.status === 'In Review' || p.status === 'REVIEW')
    const completedProjects = allProjects.filter(p => p.status === 'Completed' || p.status === 'COMPLETED')

    if (isLoading) {
        return (
            <div className="h-[calc(100vh-100px)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-violet-600 mx-auto" />
                    <p className="text-slate-500 mt-3 text-sm">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Page Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
                    <p className="text-slate-500 text-sm mt-0.5">
                        Overview of your security assessments and projects
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleNewClient}>
                        <Users className="w-4 h-4 mr-1.5" />
                        Add Client
                    </Button>
                    <Button size="sm" onClick={handleStartProject}>
                        <Plus className="w-4 h-4 mr-1.5" />
                        New Project
                    </Button>
                </div>
            </div>

            {/* Stats Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <ProjectStatusCard projects={allProjects} />
                <FindingsWidget stats={data.stats} />
                <CriticalWidget count={data.stats.criticalFindings} />
            </div>

            {/* Kanban Board */}
            <div className="pt-4">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <h2 className="text-lg font-semibold text-slate-900">Projects</h2>
                        <Badge variant="secondary" className="text-xs">
                            {allProjects.length} total
                        </Badge>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" className="text-slate-500">
                            <BarChart3 className="w-4 h-4 mr-1.5" />
                            Board
                        </Button>
                        <Link to="/projects">
                            <Button variant="ghost" size="sm" className="text-slate-500">
                                View all
                                <ChevronRight className="w-4 h-4 ml-0.5" />
                            </Button>
                        </Link>
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
                    <KanbanColumn 
                        title="Planning" 
                        count={planningProjects.length}
                        icon={<FolderKanban className="w-4 h-4 text-slate-400" />}
                        projects={planningProjects}
                        onViewDetails={handleViewDetails}
                        onResumeReport={handleResumeReport}
                    />
                    <KanbanColumn 
                        title="In Progress" 
                        count={inProgressProjects.length}
                        icon={<Zap className="w-4 h-4 text-violet-500" />}
                        projects={inProgressProjects}
                        onViewDetails={handleViewDetails}
                        onResumeReport={handleResumeReport}
                    />
                    <KanbanColumn 
                        title="Review" 
                        count={reviewProjects.length}
                        icon={<Sparkles className="w-4 h-4 text-amber-500" />}
                        projects={reviewProjects}
                        onViewDetails={handleViewDetails}
                        onResumeReport={handleResumeReport}
                    />
                    <KanbanColumn 
                        title="Completed" 
                        count={completedProjects.length}
                        icon={<CheckCircle2 className="w-4 h-4 text-emerald-500" />}
                        projects={completedProjects}
                        onViewDetails={handleViewDetails}
                        onResumeReport={handleResumeReport}
                    />
                </div>
            </div>

            {/* Recent Activity */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold flex items-center gap-2">
                            <Activity className="w-4 h-4 text-violet-600" />
                            Recent Activity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {data.recentActivity.length > 0 ? (
                            <div className="space-y-0">
                                {data.recentActivity.map((event) => (
                                    <ActivityItem key={event.id} event={event} />
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-slate-400">
                                <Activity className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                <p className="text-sm">No recent activity</p>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Quick Stats */}
                <Card>
                    <CardHeader className="pb-3">
                        <CardTitle className="text-base font-semibold">Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                            <div className="flex items-center gap-2 text-slate-600">
                                <Users className="w-4 h-4" />
                                <span className="text-sm">Active Clients</span>
                            </div>
                            <span className="text-lg font-semibold text-slate-900">{data.stats.activeClients}</span>
                        </div>
                        <div className="flex items-center justify-between py-2 border-b border-slate-100">
                            <div className="flex items-center gap-2 text-slate-600">
                                <CheckCircle2 className="w-4 h-4" />
                                <span className="text-sm">Completed</span>
                            </div>
                            <span className="text-lg font-semibold text-slate-900">{data.stats.completedProjects}</span>
                        </div>
                        <div className="flex items-center justify-between py-2">
                            <div className="flex items-center gap-2 text-slate-600">
                                <Shield className="w-4 h-4" />
                                <span className="text-sm">Total Findings</span>
                            </div>
                            <span className="text-lg font-semibold text-slate-900">{data.stats.totalFindings}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>
            
            {/* Dialogs (PRESERVED - no changes) */}
            <AddClientDialog
                open={showClientDialog}
                onOpenChange={setShowClientDialog}
                onClientAdded={handleClientAdded}
            />
            
            <AddFindingDialog
                open={showFindingDialog}
                onOpenChange={setShowFindingDialog}
                onFindingAdded={handleFindingAdded}
            />
            
            <AddProjectDialog
                open={showProjectDialog}
                onOpenChange={setShowProjectDialog}
                onProjectAdded={handleProjectAdded}
                clients={clients}
            />
            
            <ProjectDetailModal
                project={viewingProject}
                open={!!viewingProject}
                onClose={() => setViewingProject(null)}
                onEdit={(project) => {
                    setViewingProject(null)
                    toast({
                        title: "Edit Project",
                        description: "Project editing will be available soon.",
                    })
                }}
                onGenerateReport={(project) => {
                    setViewingProject(null)
                    navigate(`/reports/${project.id}`)
                }}
                onDelete={(project) => {
                    setViewingProject(null)
                    toast({
                        title: "Delete Project",
                        description: "Project deletion will be available soon.",
                        variant: "destructive",
                    })
                }}
            />
        </div>
    )
}
