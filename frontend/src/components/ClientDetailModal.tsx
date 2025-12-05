import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Mail, Phone, Building2, Users, FileText, Activity, Edit, Trash2, Loader2, Tag, StickyNote, Globe } from 'lucide-react'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'

interface Client {
    id: string
    name: string
    logoUrl?: string
    status: 'Active' | 'Inactive' | 'Prospect' | 'Archived'
    riskLevel: 'High' | 'Medium' | 'Low'
    industry: string
    companySize: 'Enterprise' | 'SMB' | 'Startup'
    primaryContact: string
    email: string
    phone?: string
    lastActivity: string
    lastActivityDate: Date
    tags: string[]
    notes?: string
    projectsCount: number
    reportsCount: number
    totalFindings: number
    findingsBySeverity: {
        critical: number
        high: number
        medium: number
        low: number
    }
    createdAt: Date
    updatedAt: Date
}

interface ClientDetailModalProps {
    client: Client | null
    open: boolean
    onClose: () => void
    onEdit: (client: Client) => void
    onDelete?: (client: Client) => void
}

interface AssociatedProject {
    id: string
    name: string
    status: string
    priority: string
    progress: number
}

export default function ClientDetailModal({ client, open, onClose, onEdit, onDelete }: ClientDetailModalProps) {
    const { getToken } = useAuth()
    const [associatedProjects, setAssociatedProjects] = useState<AssociatedProject[]>([])
    const [loadingProjects, setLoadingProjects] = useState(false)
    const [totalFindings, setTotalFindings] = useState(0)
    const [findingsBySeverity, setFindingsBySeverity] = useState({
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
    })

    useEffect(() => {
        const fetchProjectsAndFindings = async () => {
            if (!client?.id || !open) return
            
            setLoadingProjects(true)
            try {
                const token = await getToken()
                if (!token) {
                    console.warn('No auth token for fetching projects')
                    setAssociatedProjects([])
                    return
                }

                const response = await api.get(`/projects/?client_id=${client.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })

                console.log('Client projects response:', response.data)

                if (Array.isArray(response.data)) {
                    const projects: AssociatedProject[] = response.data.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        status: mapStatus(p.status),
                        priority: 'Medium',
                        progress: calculateProgress(p.status),
                    }))
                    setAssociatedProjects(projects)

                    let allFindings: any[] = []
                    for (const project of response.data) {
                        try {
                            const findingsResponse = await api.get(`/findings/?project_id=${project.id}`, {
                                headers: { Authorization: `Bearer ${token}` }
                            })
                            if (Array.isArray(findingsResponse.data)) {
                                allFindings = [...allFindings, ...findingsResponse.data]
                            }
                        } catch (findingError) {
                            console.error(`Failed to fetch findings for project ${project.id}:`, findingError)
                        }
                    }

                    const severityCounts = {
                        critical: 0,
                        high: 0,
                        medium: 0,
                        low: 0
                    }
                    
                    allFindings.forEach((finding: any) => {
                        const severity = (finding.severity || '').toLowerCase()
                        if (severity === 'critical') severityCounts.critical++
                        else if (severity === 'high') severityCounts.high++
                        else if (severity === 'medium') severityCounts.medium++
                        else if (severity === 'low' || severity === 'info' || severity === 'informational') severityCounts.low++
                    })

                    setTotalFindings(allFindings.length)
                    setFindingsBySeverity(severityCounts)
                } else {
                    setAssociatedProjects([])
                    setTotalFindings(0)
                    setFindingsBySeverity({ critical: 0, high: 0, medium: 0, low: 0 })
                }
            } catch (error) {
                console.error('Failed to fetch client projects:', error)
                setAssociatedProjects([])
                setTotalFindings(0)
                setFindingsBySeverity({ critical: 0, high: 0, medium: 0, low: 0 })
            } finally {
                setLoadingProjects(false)
            }
        }

        fetchProjectsAndFindings()
    }, [client?.id, open, getToken])

    const mapStatus = (status: string): string => {
        const statusMap: Record<string, string> = {
            'PLANNING': 'Planning',
            'IN_PROGRESS': 'In Progress',
            'REVIEW': 'Review',
            'COMPLETED': 'Completed',
            'ARCHIVED': 'Archived',
        }
        return statusMap[status?.toUpperCase()] || status || 'Planning'
    }

    const calculateProgress = (status: string): number => {
        const progressMap: Record<string, number> = {
            'PLANNING': 10,
            'IN_PROGRESS': 50,
            'REVIEW': 80,
            'COMPLETED': 100,
            'ARCHIVED': 100,
        }
        return progressMap[status?.toUpperCase()] || 0
    }

    if (!client) return null

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active':
                return 'bg-emerald-600 text-white shadow-sm border-0'
            case 'Inactive':
                return 'bg-slate-500 text-white shadow-sm border-0'
            case 'Prospect':
                return 'bg-blue-600 text-white shadow-sm border-0'
            default:
                return 'bg-slate-200 text-slate-700 shadow-sm border-0'
        }
    }

    return (
        <Dialog open={open} onOpenChange={onClose}>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white border-slate-200 sm:rounded-xl scrollbar-thin">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 bg-white sticky top-0 z-10">
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14 rounded-xl border border-slate-100 shadow-sm">
                                <AvatarFallback className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white font-semibold text-lg">
                                    {client.name.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <DialogTitle className="text-2xl font-bold text-slate-900">{client.name}</DialogTitle>
                                <p className="text-sm text-slate-500 mt-0.5 flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" />
                                    {client.primaryContact}
                                </p>
                            </div>
                        </div>
                        <span className={cn(
                            "px-2.5 py-1 rounded-full text-xs font-medium border",
                            getStatusColor(client.status)
                        )}>
                            {client.status}
                        </span>
                    </div>

                    {/* Stats Row */}
                    <div className="grid grid-cols-3 gap-4 mt-6">
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Projects</span>
                                <FileText className="w-4 h-4 text-emerald-600" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900">
                                {loadingProjects ? <Loader2 className="w-5 h-5 animate-spin" /> : associatedProjects.length}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Findings</span>
                                <Activity className="w-4 h-4 text-amber-500" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900">
                                {loadingProjects ? <Loader2 className="w-5 h-5 animate-spin" /> : totalFindings}
                            </p>
                        </div>
                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                            <div className="flex items-center justify-between mb-1">
                                <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Critical</span>
                                <Activity className="w-4 h-4 text-red-500" />
                            </div>
                            <p className="text-2xl font-bold text-slate-900">
                                {loadingProjects ? <Loader2 className="w-5 h-5 animate-spin" /> : findingsBySeverity.critical}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="p-6 space-y-8">
                    {/* Contact Information */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <Building2 className="w-4 h-4 text-slate-400" />
                            Organization Details
                        </h3>
                        <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Email Address</p>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                                    {client.email || '—'}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Phone Number</p>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                    <Phone className="w-3.5 h-3.5 text-slate-400" />
                                    {client.phone || '—'}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Industry</p>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    {client.industry || '—'}
                                </div>
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 mb-1">Company Size</p>
                                <div className="flex items-center gap-2 text-sm font-medium text-slate-900">
                                    <Users className="w-3.5 h-3.5 text-slate-400" />
                                    {client.companySize || '—'}
                                </div>
                            </div>
                            {client.logoUrl && (
                                <div className="col-span-2">
                                    <p className="text-xs text-slate-500 mb-1">Website</p>
                                    <div className="flex items-center gap-2 text-sm font-medium">
                                        <Globe className="w-3.5 h-3.5 text-slate-400" />
                                        <a 
                                            href={client.logoUrl.startsWith('http') ? client.logoUrl : `https://${client.logoUrl}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="text-emerald-600 hover:text-emerald-700 hover:underline transition-colors"
                                        >
                                            {client.logoUrl}
                                        </a>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Associated Projects */}
                    <div>
                        <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            <FileText className="w-4 h-4 text-slate-400" />
                            Active Projects
                        </h3>
                        <div className="space-y-3">
                            {loadingProjects ? (
                                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <Loader2 className="w-5 h-5 animate-spin text-slate-400 mx-auto" />
                                </div>
                            ) : associatedProjects.length === 0 ? (
                                <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
                                    <p className="text-sm text-slate-500">No projects found</p>
                                </div>
                            ) : (
                                associatedProjects.map((project) => (
                                    <div
                                        key={project.id}
                                        className="group flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:border-emerald-200 hover:shadow-sm transition-all bg-white"
                                    >
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-slate-900 truncate">{project.name}</p>
                                            <div className="flex items-center gap-2 mt-1.5">
                                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-600">
                                                    {project.status}
                                                </span>
                                                <span className="text-slate-300">•</span>
                                                <span className="text-xs text-slate-500">{project.priority} Priority</span>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Additional Info: Tags & Notes */}
                    {(client.tags.length > 0 || client.notes) && (
                        <div className="grid grid-cols-1 gap-6 pt-6 border-t border-slate-100">
                            {client.tags.length > 0 && (
                                <div>
                                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-3">Tags</h3>
                                    <div className="flex flex-wrap gap-2">
                                        {client.tags.map((tag) => (
                                            <span key={tag} className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                                                #{tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            {client.notes && (
                                <div>
                                    <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wide mb-2">Notes</h3>
                                    <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3 rounded-lg border border-slate-100">
                                        {client.notes}
                                    </p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-4 border-t border-slate-100 bg-slate-50/50 sticky bottom-0 flex items-center justify-between">
                    <Button 
                        variant="ghost" 
                        onClick={() => onDelete?.(client)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-2"
                    >
                        <Trash2 className="w-4 h-4 shrink-0" />
                        <span>Delete</span>
                    </Button>
                    <div className="flex gap-2">
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                        <Button onClick={() => onEdit(client)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                            <Edit className="w-4 h-4 shrink-0" />
                            <span>Edit Client</span>
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}