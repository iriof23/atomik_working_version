import { useState, useEffect } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Mail, Phone, Building2, Users, FileText, Activity, Edit, Archive, Download, Loader2, Tag, StickyNote } from 'lucide-react'
import { api } from '@/lib/api'

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
}

interface AssociatedProject {
    id: string
    name: string
    status: string
    priority: string
    progress: number
}

export default function ClientDetailModal({ client, open, onClose, onEdit }: ClientDetailModalProps) {
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

    // Fetch associated projects and their findings when client changes
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

                // Fetch projects filtered by client_id
                const response = await api.get(`/projects/?client_id=${client.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })

                console.log('Client projects response:', response.data)

                if (Array.isArray(response.data)) {
                    const projects: AssociatedProject[] = response.data.map((p: any) => ({
                        id: p.id,
                        name: p.name,
                        status: mapStatus(p.status),
                        priority: 'Medium', // Default priority
                        progress: calculateProgress(p.status),
                    }))
                    setAssociatedProjects(projects)

                    // Fetch findings for all projects
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

                    // Calculate findings by severity
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

    // Map API status to display status
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

    // Calculate progress based on status
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
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            case 'Inactive':
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
            case 'Prospect':
                return 'bg-purple-500/10 text-purple-400 border-purple-500/20'
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
                            {client.logoUrl && (
                                <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl">
                                    {client.logoUrl}
                                </div>
                            )}
                            <div>
                                <DialogTitle className="text-xl">{client.name}</DialogTitle>
                                <p className="text-muted-foreground text-sm mt-0.5">{client.primaryContact}</p>
                            </div>
                        </div>
                        <Badge className={`${getStatusColor(client.status)} mr-8`}>{client.status}</Badge>
                    </div>
                </DialogHeader>

                <div className="space-y-4 mt-4">
                    {/* Contact Information */}
                    <div className="bg-card border border-border rounded-lg p-3">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                            <Mail className="w-5 h-5 text-primary" />
                            Contact Information
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <div className="flex items-center gap-2">
                                <Mail className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Email</p>
                                    <p className="text-sm font-medium">{client.email}</p>
                                </div>
                            </div>
                            {client.phone && (
                                <div className="flex items-center gap-2">
                                    <Phone className="w-4 h-4 text-muted-foreground" />
                                    <div>
                                        <p className="text-xs text-muted-foreground">Phone</p>
                                        <p className="text-sm font-medium">{client.phone}</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Industry</p>
                                    <p className="text-sm font-medium">{client.industry}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <div>
                                    <p className="text-xs text-muted-foreground">Company Size</p>
                                    <p className="text-sm font-medium">{client.companySize}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Stats Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="bg-card border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Projects</p>
                                    <p className="text-xl font-bold mt-0.5">
                                        {loadingProjects ? <Loader2 className="w-4 h-4 animate-spin" /> : associatedProjects.length}
                                    </p>
                                </div>
                                <div className="p-2 bg-primary/10 rounded-lg">
                                    <FileText className="w-5 h-5 text-primary" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Total Findings</p>
                                    <p className="text-xl font-bold mt-0.5">
                                        {loadingProjects ? <Loader2 className="w-4 h-4 animate-spin" /> : totalFindings}
                                    </p>
                                </div>
                                <div className="p-2 bg-amber-500/10 rounded-lg">
                                    <Activity className="w-5 h-5 text-amber-500" />
                                </div>
                            </div>
                        </div>
                        <div className="bg-card border border-border rounded-lg p-3">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-xs text-muted-foreground">Critical Issues</p>
                                    <p className="text-xl font-bold mt-0.5 text-red-500">
                                        {loadingProjects ? <Loader2 className="w-4 h-4 animate-spin" /> : findingsBySeverity.critical}
                                    </p>
                                </div>
                                <div className="p-2 bg-red-500/10 rounded-lg">
                                    <Activity className="w-5 h-5 text-red-500" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Tags */}
                    {client.tags && client.tags.length > 0 && (
                        <div className="bg-card border border-border rounded-lg p-3">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <Tag className="w-4 h-4 text-purple-500" />
                                Tags
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {client.tags.map((tag) => (
                                    <Badge key={tag} variant="secondary" className="text-xs">
                                        #{tag}
                                    </Badge>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Notes */}
                    {client.notes && (
                        <div className="bg-card border border-border rounded-lg p-3">
                            <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                                <StickyNote className="w-4 h-4 text-amber-500" />
                                Notes
                            </h3>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{client.notes}</p>
                        </div>
                    )}

                    {/* Associated Projects */}
                    <div className="bg-card border border-border rounded-lg p-3">
                        <h3 className="text-sm font-semibold mb-3">Associated Projects</h3>
                        <div className="space-y-2">
                            {loadingProjects ? (
                                <div className="flex items-center justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                                    <span className="ml-2 text-sm text-muted-foreground">Loading projects...</span>
                                </div>
                            ) : associatedProjects.length === 0 ? (
                                <div className="text-center py-4 text-muted-foreground">
                                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No projects associated with this client yet</p>
                                </div>
                            ) : (
                                associatedProjects.map((project) => (
                                <div
                                    key={project.id}
                                    className="flex items-center justify-between p-2 rounded-lg border border-border hover:bg-accent/50 transition-colors"
                                >
                                    <div className="flex-1">
                                        <p className="text-sm font-medium">{project.name}</p>
                                        <div className="flex items-center gap-1.5 mt-0.5">
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {project.status}
                                            </Badge>
                                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                                {project.priority}
                                            </Badge>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <div className="w-24">
                                            <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-0.5">
                                                <span>Progress</span>
                                                <span>{project.progress}%</span>
                                            </div>
                                            <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className="h-full bg-primary rounded-full transition-all"
                                                    style={{ width: `${project.progress}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center gap-2 pt-3 border-t border-border">
                        <Button onClick={() => onEdit(client)} className="flex-1" size="sm">
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Client
                        </Button>
                        <Button variant="outline" className="flex-1" size="sm">
                            <Download className="w-4 h-4 mr-2" />
                            Generate Report
                        </Button>
                        <Button variant="outline" className="flex-1" size="sm">
                            <Archive className="w-4 h-4 mr-2" />
                            Archive
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}
