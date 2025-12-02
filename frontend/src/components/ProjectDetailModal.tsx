import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
    Users,
    FileText,
    Activity,
    Edit,
    Trash2,
    Target,
    Shield,
    Globe,
    Clock,
    CheckCircle2,
    AlertTriangle,
    Building2,
    Loader2
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { api } from '@/lib/api'

interface Project {
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
    methodology: string

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
    complianceFrameworks: string[]

    // Metadata
    description: string
    lastActivity: string
    lastActivityDate: Date
    createdAt: Date
    updatedAt: Date
}

interface ProjectDetailModalProps {
    project: Project | null
    open: boolean
    onClose: () => void
    onEdit: (project: Project) => void
    onGenerateReport: (project: Project) => void
    onDelete: (project: Project) => void
}

export default function ProjectDetailModal({
    project,
    open,
    onClose,
    onEdit,
    onGenerateReport,
    onDelete
}: ProjectDetailModalProps) {
    const { getToken } = useAuth()
    const [loadingFindings, setLoadingFindings] = useState(false)
    const [totalFindings, setTotalFindings] = useState(0)
    const [findingsBySeverity, setFindingsBySeverity] = useState({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
    })

    // Fetch findings when project changes
    useEffect(() => {
        const fetchFindings = async () => {
            if (!project?.id || !open) return
            
            setLoadingFindings(true)
            try {
                const token = await getToken()
                if (!token) {
                    console.warn('No auth token for fetching findings')
                    return
                }

                const response = await api.get(`/findings/?project_id=${project.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })

                if (Array.isArray(response.data)) {
                    const severityCounts = {
                        critical: 0,
                        high: 0,
                        medium: 0,
                        low: 0
                    }
                    
                    response.data.forEach((finding: any) => {
                        const severity = (finding.severity || '').toLowerCase()
                        if (severity === 'critical') severityCounts.critical++
                        else if (severity === 'high') severityCounts.high++
                        else if (severity === 'medium') severityCounts.medium++
                        else if (severity === 'low' || severity === 'info' || severity === 'informational') severityCounts.low++
                    })

                    setTotalFindings(response.data.length)
                    setFindingsBySeverity(severityCounts)
                }
            } catch (error) {
                console.error('Failed to fetch project findings:', error)
            } finally {
                setLoadingFindings(false)
            }
        }

        fetchFindings()
    }, [project?.id, open, getToken])

    if (!project) return null

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'In Progress':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
            case 'Completed':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            case 'Planning':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
            case 'On Hold':
                return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
            default:
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }
    }

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'Critical':
                return 'bg-red-500/10 text-red-500 border-red-500/20'
            case 'High':
                return 'bg-orange-500/10 text-orange-500 border-orange-500/20'
            case 'Medium':
                return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
            case 'Low':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
            default:
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                                {project.clientLogoUrl}
                            </div>
                            <div>
                                <DialogTitle className="text-xl">{project.name}</DialogTitle>
                                <div className="flex items-center gap-2 text-muted-foreground text-sm mt-0.5">
                                    <Building2 className="w-3 h-3" />
                                    <span>{project.clientName}</span>
                                    <span>•</span>
                                    <span>{project.type}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex gap-2 mr-8">
                            <Badge className={getStatusColor(project.status)}>{project.status}</Badge>
                            <Badge variant="outline" className={getPriorityColor(project.priority)}>{project.priority}</Badge>
                        </div>
                    </div>
                </DialogHeader>

                <div className="space-y-6 mt-4">
                    {/* Description */}
                    {project.description && (
                        <div className="text-sm text-muted-foreground">
                            {project.description}
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-card border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Progress</p>
                                    <p className="text-xl font-bold mt-0.5">{project.progress}%</p>
                                </div>
                                <div className="p-2 bg-blue-500/10 rounded-lg">
                                    <Activity className="w-5 h-5 text-blue-500" />
                                </div>
                            </div>
                            <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-500 rounded-full transition-all"
                                    style={{ width: `${project.progress}%` }}
                                />
                            </div>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Findings</p>
                                    <p className="text-xl font-bold mt-0.5">
                                        {loadingFindings ? <Loader2 className="w-4 h-4 animate-spin" /> : totalFindings}
                                    </p>
                                </div>
                                <div className="p-2 bg-amber-500/10 rounded-lg">
                                    <Target className="w-5 h-5 text-amber-500" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Critical Issues</p>
                                    <p className="text-xl font-bold mt-0.5 text-red-500">
                                        {loadingFindings ? <Loader2 className="w-4 h-4 animate-spin" /> : findingsBySeverity.critical}
                                    </p>
                                </div>
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <AlertTriangle className="w-5 h-5 text-red-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-6">
                            {/* Timeline */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    Timeline
                                </h3>
                                <div className="bg-card border border-border rounded-lg p-3 space-y-3">
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">Start Date</span>
                                        <span className="text-sm font-medium">{format(project.startDate, 'MMM d, yyyy')}</span>
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <span className="text-sm text-muted-foreground">End Date</span>
                                        <span className="text-sm font-medium">{format(project.endDate, 'MMM d, yyyy')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Methodology & Compliance */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Shield className="w-4 h-4" />
                                    Methodology & Compliance
                                </h3>
                                <div className="bg-card border border-border rounded-lg p-3 space-y-3">
                                    <div>
                                        <p className="text-xs text-muted-foreground mb-1">Methodology</p>
                                        <Badge variant="secondary">{project.methodology}</Badge>
                                    </div>
                                    {project.complianceFrameworks.length > 0 && (
                                        <div>
                                            <p className="text-xs text-muted-foreground mb-1">Compliance Frameworks</p>
                                            <div className="flex flex-wrap gap-1.5">
                                                {project.complianceFrameworks.map(f => (
                                                    <Badge key={f} variant="outline">{f}</Badge>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            {/* Team */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    Team
                                </h3>
                                <div className="bg-card border border-border rounded-lg p-3 space-y-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm text-muted-foreground">Lead Tester</span>
                                        <span className="text-sm font-medium">{project.leadTester}</span>
                                    </div>
                                    <div className="border-t border-border pt-3">
                                        <p className="text-xs text-muted-foreground mb-2">Team Members</p>
                                        <div className="space-y-2">
                                            {project.teamMembers.map(member => (
                                                <div key={member.id} className="flex items-center gap-2">
                                                    <Avatar className="h-6 w-6">
                                                        <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                                                            {member.name.split(' ').map(n => n[0]).join('')}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <span className="text-sm">{member.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Scope */}
                            <div>
                                <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                    <Globe className="w-4 h-4" />
                                    Scope
                                </h3>
                                <div className="bg-card border border-border rounded-lg p-3">
                                    <ul className="space-y-2">
                                        {project.scope.map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-2 text-sm">
                                                <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 shrink-0" />
                                                <span className="break-all">{item}</span>
                                            </li>
                                        ))}
                                        {project.scope.length === 0 && (
                                            <li className="text-sm text-muted-foreground italic">No scope items defined</li>
                                        )}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <Button onClick={() => onEdit(project)} className="flex-1" size="sm">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Project
                        </Button>
                        <Button onClick={() => onGenerateReport(project)} variant="outline" className="flex-1" size="sm">
                            <FileText className="w-4 h-4 mr-2" />
                            Generate Report
                        </Button>
                        <Button onClick={() => onDelete(project)} variant="outline" className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-50" size="sm">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Project
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
