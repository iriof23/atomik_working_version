import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
    Users,
    FileText,
    Edit,
    Trash2,
    Target,
    Shield,
    Globe,
    CheckCircle2,
    AlertTriangle,
    Building2,
    Loader2,
    Calendar,
    TrendingUp,
    Flame,
    RotateCcw,
    GitBranch
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Project {
    id: string
    name: string
    clientId: string
    clientName: string
    clientLogoUrl?: string

    type: 'External' | 'Internal' | 'Web App' | 'Mobile' | 'API' | 'Cloud' | 'Network'
    status: 'Planning' | 'In Progress' | 'On Hold' | 'Completed' | 'Cancelled'
    priority: 'Critical' | 'High' | 'Medium' | 'Low'

    startDate: Date
    endDate: Date
    progress: number

    scope: string[]
    methodology: string

    teamMembers: {
        id: string
        name: string
        role: string
        avatarUrl?: string
    }[]
    leadTester: string

    findingsCount: number
    findingsBySeverity: {
        critical: number
        high: number
        medium: number
        low: number
    }

    complianceFrameworks: string[]

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

interface ProjectDetailModalProps {
    project: Project | null
    open: boolean
    onClose: () => void
    onEdit: (project: Project) => void
    onGenerateReport: (project: Project) => void
    onDelete: (project: Project) => void
    onStartRetest?: (project: Project) => void
}

export default function ProjectDetailModal({
    project,
    open,
    onClose,
    onEdit,
    onGenerateReport,
    onDelete,
    onStartRetest
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

    const getStatusStyle = (status: string) => {
        switch (status) {
            case 'In Progress':
                return 'bg-blue-50 text-blue-700 border-blue-200'
            case 'Completed':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200'
            case 'Planning':
                return 'bg-slate-100 text-slate-600 border-slate-200'
            case 'On Hold':
                return 'bg-amber-50 text-amber-700 border-amber-200'
            case 'Cancelled':
                return 'bg-red-50 text-red-700 border-red-200'
            default:
                return 'bg-slate-50 text-slate-600 border-slate-200'
        }
    }

    const getPriorityStyle = (priority: string) => {
        switch (priority) {
            case 'Critical':
                return 'bg-red-50 text-red-700 border-red-200'
            case 'High':
                return 'bg-orange-50 text-orange-700 border-orange-200'
            case 'Medium':
                return 'bg-amber-50 text-amber-700 border-amber-200'
            case 'Low':
                return 'bg-emerald-50 text-emerald-700 border-emerald-200'
            default:
                return 'bg-slate-50 text-slate-600 border-slate-200'
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white border-slate-200 sm:rounded-2xl shadow-2xl scrollbar-thin">
                {/* Premium Header */}
                <div className="p-6 bg-gradient-to-b from-slate-50/80 to-white border-b border-slate-100">
                    <div className="flex items-start gap-4">
                        {/* Avatar with gradient */}
                        <div className="relative">
                            <Avatar className="h-16 w-16 rounded-2xl shadow-lg ring-4 ring-white">
                                <AvatarFallback className="rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white font-bold text-xl">
                                    {project.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            {/* Status dot */}
                            <div className={cn(
                                "absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white shadow-sm flex items-center justify-center",
                                project.status === 'In Progress' ? 'bg-blue-500' :
                                project.status === 'Completed' ? 'bg-emerald-500' :
                                project.status === 'On Hold' ? 'bg-amber-500' : 'bg-slate-400'
                            )}>
                                {project.status === 'In Progress' && (
                                    <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                )}
                            </div>
                        </div>

                        {/* Title & Meta */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                                <div>
                                    <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight">
                                        {project.name}
                                    </DialogTitle>
                                    <p className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
                                        <Building2 className="w-3 h-3" />
                                        <span className="font-medium">{project.clientName}</span>
                                        <span className="text-slate-300 mx-1">·</span>
                                        <span>{project.type}</span>
                                    </p>
                                </div>
                                <div className="flex gap-1.5 shrink-0">
                                    {/* Retest Badge */}
                                    {project.isRetest && (
                                        <span className="px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border border-amber-200 bg-amber-50 text-amber-700 flex items-center gap-1">
                                            <GitBranch className="w-3 h-3" />
                                            Retest
                                        </span>
                                    )}
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border",
                                        getStatusStyle(project.status)
                                    )}>
                                        {project.status}
                                    </span>
                                    <span className={cn(
                                        "px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border",
                                        getPriorityStyle(project.priority)
                                    )}>
                                        {project.priority}
                                    </span>
                                </div>
                            </div>

                            {/* Parent Project Link (if this is a retest) */}
                            {project.isRetest && project.parentProjectName && (
                                <p className="text-xs text-amber-600 mt-1 flex items-center gap-1.5 bg-amber-50/50 px-2 py-1 rounded-md w-fit">
                                    <RotateCcw className="w-3 h-3" />
                                    <span>Retest of: <span className="font-medium">{project.parentProjectName}</span></span>
                                </p>
                            )}

                            {/* Description as subtitle */}
                            {project.description && (
                                <p className="text-xs text-slate-500 mt-2 line-clamp-2 leading-relaxed">
                                    {project.description}
                                </p>
                            )}
                        </div>
                    </div>

                    {/* Stats Row - More compact */}
                    <div className="grid grid-cols-4 gap-2 mt-5">
                        <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Progress</span>
                                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                            </div>
                            <p className="text-xl font-bold text-slate-900">{project.progress}%</p>
                            <div className="mt-1.5 h-1 w-full bg-slate-100 rounded-full overflow-hidden">
                                <div 
                                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-700"
                                    style={{ width: `${Math.max(project.progress, 2)}%` }}
                                />
                            </div>
                        </div>
                        <div className="p-2.5 rounded-xl bg-white border border-slate-100 shadow-sm">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">Findings</span>
                                <Target className="w-3.5 h-3.5 text-slate-400" />
                            </div>
                            <p className="text-xl font-bold text-slate-900">
                                {loadingFindings ? <Loader2 className="w-4 h-4 animate-spin" /> : totalFindings}
                            </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-red-50/50 border border-red-100">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-medium text-red-400 uppercase tracking-wider">Critical</span>
                                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                            </div>
                            <p className="text-xl font-bold text-red-600">
                                {loadingFindings ? <Loader2 className="w-4 h-4 animate-spin" /> : findingsBySeverity.critical}
                            </p>
                        </div>
                        <div className="p-2.5 rounded-xl bg-orange-50/50 border border-orange-100">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-[10px] font-medium text-orange-400 uppercase tracking-wider">High</span>
                                <Flame className="w-3.5 h-3.5 text-orange-400" />
                            </div>
                            <p className="text-xl font-bold text-orange-600">
                                {loadingFindings ? <Loader2 className="w-4 h-4 animate-spin" /> : findingsBySeverity.high}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Content Body */}
                <div className="p-6 space-y-6">
                    {/* Two Column Layout - Tighter */}
                    <div className="grid grid-cols-2 gap-6">
                        {/* Left Column */}
                        <div className="space-y-5">
                            {/* Timeline */}
                            <div>
                                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5" />
                                    Timeline
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-xs text-slate-500">Start</span>
                                        <span className="text-xs font-semibold text-slate-900">{format(project.startDate, 'MMM d, yyyy')}</span>
                                    </div>
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-xs text-slate-500">End</span>
                                        <span className="text-xs font-semibold text-slate-900">{format(project.endDate, 'MMM d, yyyy')}</span>
                                    </div>
                                </div>
                            </div>

                            {/* Methodology & Tags */}
                            <div>
                                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <Shield className="w-3.5 h-3.5" />
                                    Standards
                                </h3>
                                <div className="flex flex-wrap gap-1.5">
                                    <span className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        {project.methodology}
                                    </span>
                                    {project.complianceFrameworks.map(f => (
                                        <span key={f} className="inline-flex items-center px-2 py-1 rounded-md text-[10px] font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                            {f}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-5">
                            {/* Team */}
                            <div>
                                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" />
                                    Team
                                </h3>
                                <div className="space-y-2">
                                    <div className="flex justify-between items-center py-1">
                                        <span className="text-xs text-slate-500">Lead</span>
                                        <div className="flex items-center gap-1.5">
                                            <Avatar className="h-5 w-5 rounded-md">
                                                <AvatarFallback className="text-[8px] rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-medium">
                                                    {project.leadTester?.split(' ').map(n => n[0]).join('') || 'LT'}
                                                </AvatarFallback>
                                            </Avatar>
                                            <span className="text-xs font-semibold text-slate-900">{project.leadTester}</span>
                                        </div>
                                    </div>
                                    {project.teamMembers.length > 0 && (
                                        <div className="flex items-center gap-1 pt-1">
                                            <div className="flex -space-x-1.5">
                                                {project.teamMembers.slice(0, 4).map(member => (
                                                    <Avatar key={member.id} className="h-5 w-5 rounded-md ring-2 ring-white">
                                                        <AvatarFallback className="text-[8px] rounded-md bg-gradient-to-br from-slate-400 to-slate-500 text-white font-medium">
                                                            {member.name.split(' ').map(n => n[0]).join('')}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                ))}
                                            </div>
                                            {project.teamMembers.length > 4 && (
                                                <span className="text-[10px] text-slate-500 ml-1">
                                                    +{project.teamMembers.length - 4} more
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Scope */}
                            <div>
                                <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                                    <Globe className="w-3.5 h-3.5" />
                                    Scope
                                </h3>
                                {project.scope.length === 0 ? (
                                    <p className="text-[10px] text-slate-400 italic">No scope defined</p>
                                ) : (
                                    <ul className="space-y-1.5">
                                        {project.scope.slice(0, 4).map((item, idx) => (
                                            <li key={idx} className="flex items-start gap-1.5">
                                                <CheckCircle2 className="w-3 h-3 text-emerald-500 mt-0.5 shrink-0" />
                                                <span className="text-[11px] text-slate-700 break-all leading-tight">{item}</span>
                                            </li>
                                        ))}
                                        {project.scope.length > 4 && (
                                            <li className="text-[10px] text-slate-500 pl-4">
                                                +{project.scope.length - 4} more items
                                            </li>
                                        )}
                                    </ul>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Findings Breakdown - Premium solid colors */}
                    <div className="pt-5 border-t border-slate-100">
                        <h3 className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                            Severity Breakdown
                        </h3>
                        <div className="grid grid-cols-4 gap-2">
                            {[
                                { label: 'Critical', count: findingsBySeverity.critical, gradient: 'from-red-600 to-red-700' },
                                { label: 'High', count: findingsBySeverity.high, gradient: 'from-orange-500 to-orange-600' },
                                { label: 'Medium', count: findingsBySeverity.medium, gradient: 'from-amber-500 to-amber-600' },
                                { label: 'Low', count: findingsBySeverity.low, gradient: 'from-emerald-500 to-emerald-600' },
                            ].map(({ label, count, gradient }) => (
                                <div key={label} className={cn("p-3 rounded-xl text-center bg-gradient-to-br shadow-sm", gradient)}>
                                    <p className="text-xl font-bold text-white">{count}</p>
                                    <p className="text-[9px] font-semibold uppercase tracking-wider text-white/80">{label}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer Actions - Refined */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 flex items-center justify-between">
                    <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => onDelete(project)}
                        className="text-slate-500 hover:text-red-600 hover:bg-red-50 text-xs gap-1.5"
                    >
                        <Trash2 className="w-3.5 h-3.5 shrink-0" />
                        <span>Delete</span>
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="ghost" size="sm" onClick={onClose} className="text-xs text-slate-600">
                            Close
                        </Button>
                        {/* Start Retest button - only show if not already a retest */}
                        {!project.isRetest && onStartRetest && (
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => onStartRetest(project)}
                                className="text-xs border-amber-200 text-amber-700 hover:bg-amber-50 gap-1.5"
                            >
                                <RotateCcw className="w-3.5 h-3.5 shrink-0" />
                                <span>Retest</span>
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onGenerateReport(project)}
                            className="text-xs border-slate-200 text-slate-700 hover:bg-slate-50 gap-1.5"
                        >
                            <FileText className="w-3.5 h-3.5 shrink-0" />
                            <span>Report</span>
                        </Button>
                        <Button 
                            size="sm"
                            onClick={() => onEdit(project)} 
                            className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        >
                            <Edit className="w-3.5 h-3.5 mr-1.5" />
                            Edit
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}