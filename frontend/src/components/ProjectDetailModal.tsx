import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
    Users,
    FileText,
    Edit,
    Trash2,
    Globe,
    CheckCircle2,
    Building2,
    Loader2,
    Calendar,
    RotateCcw,
    MoreHorizontal,
    Shield,
    ExternalLink
} from 'lucide-react'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

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

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'In Progress': return 'bg-blue-500'
            case 'Completed': return 'bg-emerald-500'
            case 'Planning': return 'bg-slate-400'
            case 'On Hold': return 'bg-amber-500'
            case 'Cancelled': return 'bg-red-500'
            default: return 'bg-slate-400'
        }
    }

    const getDuration = () => {
        const start = new Date(project.startDate)
        const end = new Date(project.endDate)
        const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
        if (days < 7) return `${days} Days`
        const weeks = Math.ceil(days / 7)
        return `${weeks} Week${weeks > 1 ? 's' : ''}`
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-xl max-h-[85vh] overflow-y-auto p-0 gap-0 bg-white border-slate-200 sm:rounded-2xl shadow-2xl">
                {/* Clean Header */}
                <div className="p-6 pb-4">
                    <div className="flex items-start gap-4">
                        {/* Avatar */}
                        <Avatar className="h-14 w-14 rounded-2xl shadow-md ring-2 ring-slate-100">
                            <AvatarFallback className="rounded-2xl bg-gradient-to-br from-emerald-500 via-emerald-600 to-teal-600 text-white font-bold text-lg">
                                {project.name.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>

                        {/* Title & Meta */}
                        <div className="flex-1 min-w-0">
                            <DialogTitle className="text-lg font-bold text-slate-900 tracking-tight leading-tight">
                                {project.name}
                            </DialogTitle>
                            <div className="flex items-center gap-1.5 mt-1.5 text-sm text-slate-500">
                                <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                <span className="font-medium text-slate-700">{project.clientName}</span>
                                <span className="text-slate-300">·</span>
                                <span>{project.type}</span>
                                <span className="text-slate-300">·</span>
                                <span className={cn("w-2 h-2 rounded-full", getStatusColor(project.status))} />
                                <span className="font-medium">{project.status}</span>
                            </div>
                            
                            {/* Retest indicator */}
                            {project.isRetest && project.parentProjectName && (
                                <p className="text-xs text-slate-500 mt-2 flex items-center gap-1.5">
                                    <RotateCcw className="w-3 h-3 text-slate-400" />
                                    <span>Retest of</span>
                                    <span className="font-medium text-slate-700">{project.parentProjectName}</span>
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                {/* Stats Row */}
                <div className="px-6 pb-4">
                    <div className="grid grid-cols-4 gap-2">
                        <div className="text-center p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <p className="text-2xl font-bold text-slate-900">
                                {loadingFindings ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : totalFindings}
                            </p>
                            <p className="text-[10px] font-medium text-slate-500 uppercase tracking-wider mt-0.5">Findings</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-red-50 border border-red-100">
                            <p className="text-2xl font-bold text-red-600">
                                {loadingFindings ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : findingsBySeverity.critical}
                            </p>
                            <p className="text-[10px] font-medium text-red-500 uppercase tracking-wider mt-0.5">Critical</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-orange-50 border border-orange-100">
                            <p className="text-2xl font-bold text-orange-600">
                                {loadingFindings ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : findingsBySeverity.high}
                            </p>
                            <p className="text-[10px] font-medium text-orange-500 uppercase tracking-wider mt-0.5">High</p>
                        </div>
                        <div className="text-center p-3 rounded-xl bg-amber-50 border border-amber-100">
                            <p className="text-2xl font-bold text-amber-600">
                                {loadingFindings ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : findingsBySeverity.medium}
                            </p>
                            <p className="text-[10px] font-medium text-amber-500 uppercase tracking-wider mt-0.5">Medium</p>
                        </div>
                    </div>
                </div>

                {/* Details Section */}
                <div className="px-6 py-4 border-t border-slate-100 space-y-3">
                    {/* Timeline Row */}
                    <div className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-2 text-slate-500">
                            <Calendar className="w-4 h-4" />
                            <span className="text-sm">Timeline</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">
                            {format(project.startDate, 'MMM d')} – {format(project.endDate, 'MMM d, yyyy')}
                        </span>
                    </div>

                    {/* Duration Row */}
                    <div className="flex items-center justify-between py-2 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-slate-500">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-sm">Duration</span>
                        </div>
                        <span className="text-sm font-medium text-slate-900">{getDuration()}</span>
                    </div>

                    {/* Lead Row */}
                    <div className="flex items-center justify-between py-2 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-slate-500">
                            <Users className="w-4 h-4" />
                            <span className="text-sm">Lead</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Avatar className="h-5 w-5 rounded-md">
                                <AvatarFallback className="text-[8px] rounded-md bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-medium">
                                    {project.leadTester?.split(' ').map(n => n[0]).join('') || 'LT'}
                                </AvatarFallback>
                            </Avatar>
                            <span className="text-sm font-medium text-slate-900">{project.leadTester}</span>
                        </div>
                    </div>

                    {/* Scope Row */}
                    {project.scope.length > 0 && (
                        <div className="flex items-start justify-between py-2 border-t border-slate-50">
                            <div className="flex items-center gap-2 text-slate-500">
                                <Globe className="w-4 h-4" />
                                <span className="text-sm">Scope</span>
                            </div>
                            <div className="text-right">
                                {project.scope.slice(0, 2).map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 justify-end">
                                        <ExternalLink className="w-3 h-3 text-emerald-500" />
                                        <span className="text-sm font-medium text-slate-900">{item}</span>
                                    </div>
                                ))}
                                {project.scope.length > 2 && (
                                    <span className="text-xs text-slate-400">+{project.scope.length - 2} more</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Standards Row */}
                    <div className="flex items-start justify-between py-2 border-t border-slate-50">
                        <div className="flex items-center gap-2 text-slate-500">
                            <Shield className="w-4 h-4" />
                            <span className="text-sm">Standards</span>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-end max-w-[60%]">
                            <span className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                {project.methodology}
                            </span>
                            {project.complianceFrameworks.slice(0, 2).map(f => (
                                <span key={f} className="px-2 py-0.5 rounded-md text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200">
                                    {f}
                                </span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Severity Breakdown */}
                <div className="px-6 py-4 border-t border-slate-100">
                    <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
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

                {/* Footer Actions */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between">
                    {/* More menu with Delete */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600 h-8 w-8 p-0">
                                <MoreHorizontal className="w-4 h-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem 
                                onClick={() => onDelete(project)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50"
                            >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete Project
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2">
                        <Button variant="ghost" size="sm" onClick={onClose} className="text-sm text-slate-500 hover:text-slate-700">
                            Close
                        </Button>
                        
                        {/* Retest button - only for non-retests */}
                        {!project.isRetest && onStartRetest && (
                            <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => onStartRetest(project)}
                                className="text-sm border-slate-200 text-slate-600 hover:bg-slate-50 gap-1.5"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Retest
                            </Button>
                        )}
                        
                        <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => onGenerateReport(project)}
                            className="text-sm border-slate-200 text-slate-600 hover:bg-slate-50 gap-1.5"
                        >
                            <FileText className="w-3.5 h-3.5" />
                            Report
                        </Button>
                        
                        <Button 
                            size="sm"
                            onClick={() => onEdit(project)} 
                            className="text-sm bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm gap-1.5"
                        >
                            <Edit className="w-3.5 h-3.5" />
                            Edit Project
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
