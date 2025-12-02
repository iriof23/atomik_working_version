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
    ScrollText
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
                        const projectsRes = await api.get('/v1/projects', {
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
                        const clientsRes = await api.get('/clients', {
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

    return { data, isLoading }
}

// --- Components ---

const HeroCard = ({ 
    project,
    criticalCount,
    onStartProject,
    onResumeReport,
    onViewDetails
}: { 
    project: Project | null
    criticalCount: number
    onStartProject: () => void
    onResumeReport?: (project: Project) => void
    onViewDetails?: (project: Project) => void
}) => {
    const { user: storeUser } = useAuthStore()
    const { user: clerkUser } = useUser()
    const displayName = clerkUser?.firstName || storeUser?.name || 'Commander'

    // Calculate days until due
    const getDaysUntilDue = (endDate: string) => {
        const end = new Date(endDate)
        const now = new Date()
        const diffTime = end.getTime() - now.getTime()
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays
    }

    // Get critical findings count for this project from localStorage
    const getProjectCriticalCount = (projectId: string) => {
        const findingsKey = `findings_${projectId}`
        const stored = localStorage.getItem(findingsKey)
        if (stored) {
            try {
                const findings = JSON.parse(stored)
                return findings.filter((f: any) => f.severity === 'Critical').length
            } catch (e) { }
        }
        return 0
    }

    if (!project) return (
        <Card className="col-span-1 lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-primary/5 via-card to-card border-primary/20">
            <CardContent className="p-8 flex flex-col justify-center h-full min-h-[300px]">
                <h2 className="text-3xl font-bold tracking-tight mb-2">Welcome back, {displayName}</h2>
                <p className="text-muted-foreground mb-6">Ready to start your next mission?</p>
                <Button size="lg" className="w-fit gap-2" onClick={onStartProject}>
                    <Plus className="w-5 h-5" /> Start New Project
                </Button>
            </CardContent>
        </Card>
    )

    const projectCriticalCount = getProjectCriticalCount(project.id)
    const daysUntilDue = getDaysUntilDue(project.endDate)

    return (
        <Card className="col-span-1 lg:col-span-2 relative overflow-hidden bg-gradient-to-br from-primary/10 via-card to-card border-primary/20 shadow-lg group">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <Zap className="w-32 h-32 text-primary" />
            </div>

            <CardContent className="p-8 flex flex-col justify-between h-full relative z-10">
                <div>
                    <div className="flex items-center gap-2 text-primary mb-2">
                        <Activity className="w-4 h-4 animate-pulse" />
                        <span className="text-sm font-medium uppercase tracking-wider">Current Mission</span>
                    </div>
                    <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-1">
                        {project.name}
                    </h2>
                    <p className="text-muted-foreground text-lg flex items-center gap-2">
                        {project.clientName}
                    </p>
                </div>

                <div className="mt-8 space-y-6">
                    <div className="flex flex-wrap gap-3">
                        {projectCriticalCount > 0 && (
                            <Badge variant="destructive" className="px-3 py-1 text-sm gap-1.5">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                {projectCriticalCount} Critical Issue{projectCriticalCount !== 1 ? 's' : ''}
                            </Badge>
                        )}
                        {daysUntilDue <= 7 && daysUntilDue > 0 && (
                            <Badge variant="secondary" className="px-3 py-1 text-sm gap-1.5 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 border-orange-500/20">
                                <Clock className="w-3.5 h-3.5" />
                                Due in {daysUntilDue} Day{daysUntilDue !== 1 ? 's' : ''}
                            </Badge>
                        )}
                        {daysUntilDue <= 0 && (
                            <Badge variant="destructive" className="px-3 py-1 text-sm gap-1.5">
                                <Clock className="w-3.5 h-3.5" />
                                Overdue
                            </Badge>
                        )}
                        {projectCriticalCount === 0 && daysUntilDue > 7 && (
                            <Badge variant="secondary" className="px-3 py-1 text-sm gap-1.5 bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                On Track
                            </Badge>
                        )}
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-medium">
                            <span>Mission Progress</span>
                            <span>{project.progress}%</span>
                        </div>
                        <div className="h-3 w-full bg-secondary/50 rounded-full overflow-hidden backdrop-blur-sm">
                            <div
                                className="h-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-1000 ease-out"
                                style={{ width: `${project.progress}%` }}
                            />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-2">
                        <Button 
                            size="lg" 
                            className="gap-2 text-base px-8 shadow-primary/25 shadow-lg hover:shadow-primary/40 transition-all"
                            onClick={() => onResumeReport?.(project)}
                        >
                            <Play className="w-5 h-5 fill-current" />
                            Resume Report
                        </Button>
                        <Button 
                            size="lg" 
                            variant="outline" 
                            className="gap-2"
                            onClick={() => onViewDetails?.(project)}
                        >
                            View Details <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

const DeadlineList = ({ projects }: { projects: Project[] }) => {
    return (
        <Card className="col-span-1 h-full flex flex-col bg-card/50 backdrop-blur-sm">
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Calendar className="w-5 h-5 text-primary" />
                    Upcoming Deadlines
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                <div className="space-y-6 relative">
                    {/* Vertical connector line */}
                    <div className="absolute left-[7px] top-2 bottom-2 w-[2px] bg-border/50" />

                    {projects.map((project, i) => (
                        <div key={project.id} className="relative pl-6 group cursor-pointer">
                            <div className={cn(
                                "absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 bg-background transition-colors",
                                i === 0 ? "border-red-500 group-hover:bg-red-500/20" :
                                    i === 1 ? "border-orange-500 group-hover:bg-orange-500/20" :
                                        "border-blue-500 group-hover:bg-blue-500/20"
                            )} />
                            <div className="space-y-1">
                                <h4 className="font-medium leading-none group-hover:text-primary transition-colors">
                                    {project.name}
                                </h4>
                                <div className="flex justify-between items-center text-sm text-muted-foreground">
                                    <span>{project.clientName}</span>
                                    <span className={cn(
                                        "text-xs font-medium px-2 py-0.5 rounded-full",
                                        i === 0 ? "bg-red-500/10 text-red-500" : "bg-secondary text-secondary-foreground"
                                    )}>
                                        {new Date(project.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}

                    {projects.length === 0 && (
                        <div className="text-center text-muted-foreground py-8">
                            No upcoming deadlines
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

const QuickStats = ({ stats }: { stats: DashboardData['stats'] }) => {
    return (
        <>
            <Card className="bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors cursor-pointer group">
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-primary/10 rounded-lg text-primary group-hover:scale-110 transition-transform">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full flex items-center gap-1">
                            <TrendingUp className="w-3 h-3" /> +12%
                        </span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-2xl font-bold tracking-tight">{stats.totalFindings}</h3>
                        <p className="text-sm text-muted-foreground">Total Findings</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors cursor-pointer group border-red-500/20">
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-500 group-hover:scale-110 transition-transform">
                            <Zap className="w-5 h-5" />
                        </div>
                        <span className="text-xs font-medium text-red-500 bg-red-500/10 px-2 py-1 rounded-full">
                            Action Required
                        </span>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-2xl font-bold tracking-tight text-red-500">{stats.criticalFindings}</h3>
                        <p className="text-sm text-muted-foreground">Critical Issues</p>
                    </div>
                </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors cursor-pointer group">
                <CardContent className="p-6">
                    <div className="flex justify-between items-start mb-4">
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-500 group-hover:scale-110 transition-transform">
                            <Users className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="space-y-1">
                        <h3 className="text-2xl font-bold tracking-tight">{stats.activeClients}</h3>
                        <p className="text-sm text-muted-foreground">Active Clients</p>
                    </div>
                </CardContent>
            </Card>
        </>
    )
}

const QuickActions = ({ onNewFinding, onNewClient, onNewReport, onSearch }: { 
    onNewFinding: () => void
    onNewClient: () => void
    onNewReport: () => void
    onSearch: () => void
}) => {
    const actions = [
        { 
            icon: <Shield className="w-5 h-5" />, 
            label: 'New Finding', 
            color: 'text-red-500',
            onClick: onNewFinding,
            description: 'Add vulnerability'
        },
        { 
            icon: <Users className="w-5 h-5" />, 
            label: 'New Client', 
            color: 'text-blue-500',
            onClick: onNewClient,
            description: 'Add organization'
        },
        { 
            icon: <FileText className="w-5 h-5" />, 
            label: 'New Report', 
            color: 'text-purple-500',
            onClick: onNewReport,
            description: 'Generate document'
        },
        { 
            icon: <Search className="w-5 h-5" />, 
            label: 'Search', 
            color: 'text-cyan-500',
            onClick: onSearch,
            description: 'Find anything'
        },
    ]

    return (
        <Card className="bg-card/50 backdrop-blur-sm">
            <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
                <div className="grid grid-cols-2 gap-3">
                    {actions.map((action, i) => (
                        <Button
                            key={i}
                            variant="outline"
                            onClick={action.onClick}
                            className="h-24 flex flex-col gap-2 hover:bg-accent/50 hover:border-primary/50 transition-all group"
                        >
                            <div className={cn(action.color, "group-hover:scale-110 transition-transform")}>
                                {action.icon}
                            </div>
                            <div className="text-center">
                                <div className="text-xs font-medium">{action.label}</div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">{action.description}</div>
                            </div>
                        </Button>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

// Activity Log Feed Component (View-only log of all actions)
const PulseFeed = () => {
    const [activityLog, setActivityLog] = useState<ActivityEvent[]>([])
    
    // Load activity log on mount and refresh periodically
    useEffect(() => {
        const loadLog = () => {
            setActivityLog(getActivityLog())
        }
        
        loadLog()
        
        // Refresh every 2 seconds to show new entries
        const interval = setInterval(loadLog, 2000)
        return () => clearInterval(interval)
    }, [])
    
    // Get icon based on event type and action
    const getEventIcon = (event: ActivityEvent) => {
        switch (event.type) {
            case 'client':
                return <Users className="w-4 h-4 text-emerald-400" />
            case 'project':
                if (event.action === 'completed') return <CheckCircle2 className="w-4 h-4 text-green-400" />
                if (event.action === 'deleted') return <AlertTriangle className="w-4 h-4 text-red-400" />
                return <Activity className="w-4 h-4 text-blue-400" />
            case 'finding':
                const severity = event.metadata?.severity
                if (severity === 'Critical') return <AlertTriangle className="w-4 h-4 text-red-400" />
                if (severity === 'High') return <AlertTriangle className="w-4 h-4 text-orange-400" />
                return <Shield className="w-4 h-4 text-yellow-400" />
            case 'report':
                if (event.action === 'generated') return <FileText className="w-4 h-4 text-green-400" />
                return <FileText className="w-4 h-4 text-purple-400" />
            default:
                return <Activity className="w-4 h-4 text-gray-400" />
        }
    }
    
    // Get type badge color
    const getTypeBadgeClass = (type: string) => {
        switch (type) {
            case 'client': return "border-emerald-500/50 text-emerald-500 bg-emerald-500/5"
            case 'project': return "border-blue-500/50 text-blue-500 bg-blue-500/5"
            case 'finding': return "border-orange-500/50 text-orange-500 bg-orange-500/5"
            case 'report': return "border-purple-500/50 text-purple-500 bg-purple-500/5"
            default: return "border-gray-500/50 text-gray-500 bg-gray-500/5"
        }
    }
    
    return (
        <Card className="col-span-1 lg:col-span-3 bg-card/50 backdrop-blur-sm">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="flex items-center gap-2">
                    <ScrollText className="w-5 h-5 text-primary" />
                    Mission Pulse
                </CardTitle>
                <Badge variant="outline" className="text-xs text-muted-foreground">
                    Activity Log
                </Badge>
            </CardHeader>
            <CardContent>
                <div className="space-y-0.5 max-h-[320px] overflow-y-auto scrollbar-thin scrollbar-thumb-border scrollbar-track-transparent">
                    {activityLog.slice(0, 10).map((event) => (
                        <div
                            key={event.id}
                            className="flex items-center gap-3 p-2.5 rounded-md hover:bg-accent/30 transition-colors border-l-2 border-transparent hover:border-primary/30"
                        >
                            {/* Icon */}
                            <div className="p-1.5 rounded-full bg-background/80 border border-border/50 flex-shrink-0">
                                {getEventIcon(event)}
                            </div>
                            
                            {/* Content */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h4 className="font-medium text-sm truncate">
                                        {event.title}
                                    </h4>
                                    <Badge 
                                        variant="outline" 
                                        className={cn(
                                            "text-[9px] px-1.5 py-0 capitalize flex-shrink-0",
                                            getTypeBadgeClass(event.type)
                                        )}
                                    >
                                        {event.type}
                                    </Badge>
                                </div>
                                <p className="text-muted-foreground text-xs truncate mt-0.5">
                                    {event.description}
                                </p>
                            </div>
                            
                            {/* Timestamp */}
                            <div className="text-right flex-shrink-0">
                                <span className="text-[10px] text-muted-foreground whitespace-nowrap font-mono">
                                    {formatRelativeTime(new Date(event.timestamp))}
                                </span>
                            </div>
                        </div>
                    ))}
                    
                    {activityLog.length === 0 && (
                        <div className="text-center py-10 text-muted-foreground">
                            <ScrollText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p className="text-sm font-medium">No activity yet</p>
                            <p className="text-xs mt-1">Actions will appear here as you work</p>
                        </div>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

// --- Main Dashboard Component ---

export default function Dashboard() {
    const navigate = useNavigate()
    const { toast } = useToast()
    const { getToken } = useAuth()
    const { data, isLoading } = useDashboardStore(getToken)
    
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
                    const response = await api.get('/clients', {
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
    
    // Handlers
    const handleNewClient = () => {
        setShowClientDialog(true)
    }
    
    const handleNewFinding = () => {
        setShowFindingDialog(true)
    }
    
    const handleNewReport = () => {
        navigate('/report-builder')
    }
    
    const handleSearch = () => {
        // Navigate to a global search page or show search command palette
        toast({
            title: "Global Search",
            description: "Search across reports, clients, and projects (coming soon)",
        })
        // TODO: Implement global search modal or navigate to search page
        // For now, navigate to projects page which has search functionality
        navigate('/projects')
    }
    
    const handleStartProject = () => {
        setShowProjectDialog(true)
    }
    
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
            
            // First, check if a report already exists for this project
            try {
                const reportsResponse = await api.get(`/v1/reports/?project_id=${project.id}`, {
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
            
            // No report exists - create one
            const response = await api.post('/v1/reports/', {
                project_id: project.id,
                title: `${project.name} Report`,
                report_type: 'PENTEST'
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            // Navigate to the new report
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
        // Load full project data from localStorage
        const storedProjects = JSON.parse(localStorage.getItem('projects') || '[]')
        const fullProject = storedProjects.find((p: any) => p.id === project.id)
        
        if (fullProject) {
            // Convert date strings back to Date objects
            setViewingProject({
                ...fullProject,
                startDate: new Date(fullProject.startDate),
                endDate: new Date(fullProject.endDate),
                lastActivityDate: fullProject.lastActivityDate ? new Date(fullProject.lastActivityDate) : new Date(),
                createdAt: fullProject.createdAt ? new Date(fullProject.createdAt) : new Date(),
                updatedAt: fullProject.updatedAt ? new Date(fullProject.updatedAt) : new Date(),
                // Ensure arrays exist
                scope: fullProject.scope || [],
                teamMembers: fullProject.teamMembers || [],
                complianceFrameworks: fullProject.complianceFrameworks || [],
                // Ensure findingsBySeverity exists
                findingsBySeverity: fullProject.findingsBySeverity || { critical: 0, high: 0, medium: 0, low: 0 }
            })
        } else {
            // Fallback to basic project data if not found in localStorage
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
                clientLogoUrl: '🏢'
            })
        }
    }
    
    const handleClientAdded = (client: any) => {
        // Update clients list in state
        setClients(prev => [...prev, client])
        
        // Log activity
        logClientCreated(client.name, client.id)
        
        // Show success toast
        toast({
            title: "✓ Client Created Successfully",
            description: `${client.name} has been added to your portfolio.`,
        })
    }
    
    const handleFindingAdded = (finding: any) => {
        // Save finding to customFindings in localStorage (same key used by Findings.tsx)
        const existingFindings = JSON.parse(localStorage.getItem('customFindings') || '[]')
        const updatedFindings = [{
            ...finding,
            isCustom: true,
            createdAt: new Date().toISOString()
        }, ...existingFindings]
        localStorage.setItem('customFindings', JSON.stringify(updatedFindings))
        
        // Dispatch event to notify Findings page
        window.dispatchEvent(new Event('custom-findings-updated'))
        
        // Log activity
        logFindingAdded(finding.title, finding.severity || 'Medium', 'Library', finding.id)
        
        // Show success toast
        toast({
            title: "✓ Finding Template Created",
            description: `${finding.title} has been added to your custom templates in the Findings Database.`,
        })
    }
    
    const handleProjectAdded = (project: any) => {
        // Log activity
        logProjectCreated(project.name, project.client_name || project.clientName || 'Unknown', project.id)
        
        // Show success toast
        toast({
            title: "✓ Project Created Successfully",
            description: `${project.name} has been created and is ready for work.`,
        })
    }

    // Count total projects for the header
    const activeProjectsCount = data.upcomingProjects.length + (data.activeProject ? 1 : 0)

    if (isLoading) {
        return (
            <div className="h-[calc(100vh-100px)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
                    <p className="text-muted-foreground mt-2">Loading dashboard...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-foreground">Mission Control</h1>
                    <p className="text-muted-foreground mt-1">
                        {activeProjectsCount} active project{activeProjectsCount !== 1 ? 's' : ''} • {data.stats.criticalFindings > 0 ? `${data.stats.criticalFindings} critical finding${data.stats.criticalFindings !== 1 ? 's' : ''} require attention` : 'All systems nominal'}
                    </p>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground bg-card/50 px-3 py-1 rounded-full border border-border/50">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    System Operational
                </div>
            </div>

            {/* Bento Grid Layout */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Row 1: Focus Zone + Horizon */}
                <HeroCard 
                    project={data.activeProject}
                    criticalCount={data.stats.criticalFindings}
                    onStartProject={handleStartProject}
                    onResumeReport={handleResumeReport}
                    onViewDetails={handleViewDetails}
                />
                <DeadlineList projects={data.upcomingProjects} />

                {/* Row 2: Quick Stats & Actions */}
                <QuickStats stats={data.stats} />
                <QuickActions 
                    onNewFinding={handleNewFinding}
                    onNewClient={handleNewClient}
                    onNewReport={handleNewReport}
                    onSearch={handleSearch}
                />

                {/* Row 3: Activity Log (Mission Pulse) */}
                <PulseFeed />
            </div>
            
            {/* Dialogs */}
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
            
            {/* Project Detail Modal */}
            <ProjectDetailModal
                project={viewingProject}
                open={!!viewingProject}
                onClose={() => setViewingProject(null)}
                onEdit={(project) => {
                    setViewingProject(null)
                    // TODO: Implement edit project
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
                    // TODO: Implement delete project
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
