import { useState, useRef, useEffect } from 'react'
import { Plus, Search, FileText, X, Trash2, Shield, Upload, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { vulnerabilityDatabase, type Vulnerability } from '@/data/vulnerabilities'
import { Editor } from '@/components/editor/Editor'
import { EditFindingModal } from './EditFindingModal'
import { StatCard } from './StatCard'
import { useParams } from 'react-router-dom'
import { logFindingAdded, logFindingUpdated, logFindingDeleted } from '@/lib/activityLog'
import { api } from '@/lib/api'
import { useAuth } from '@clerk/clerk-react'
import { useToast } from '@/components/ui/use-toast'

interface ProjectFinding {
    id: string
    owaspId: string
    title: string
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational'
    cvssScore?: number
    cvssVector?: string
    status: 'Open' | 'In Progress' | 'Fixed' | 'Accepted Risk'
    description: string
    recommendations: string
    evidence?: string
    affectedAssets: Array<{ url: string; description: string; instanceCount: number }>
    screenshots: Array<{ id: string; url: string; caption: string }>
}

interface FindingsTabContentProps {
    projectId?: string  // Optional - if not provided, will use URL params
    onUpdate: () => void
}

export default function FindingsTabContent({ projectId: propProjectId, onUpdate }: FindingsTabContentProps) {
    const { projectId: urlProjectId } = useParams()
    // Use prop projectId if provided, otherwise fall back to URL param
    const projectId = propProjectId || urlProjectId
    const { getToken } = useAuth()
    const { toast } = useToast()
    const [findings, setFindings] = useState<ProjectFinding[]>([])
    const [selectedFinding, setSelectedFinding] = useState<ProjectFinding | null>(null)
    const [showAddModal, setShowAddModal] = useState(false)
    const [showDeleteDialog, setShowDeleteDialog] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedVulns, setSelectedVulns] = useState<Vulnerability[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [isDeleting, setIsDeleting] = useState(false)

    // Helper function to map API FindingResponse to ProjectFinding
    const mapApiFindingToProjectFinding = (apiFinding: any): ProjectFinding => {
        return {
            id: apiFinding.id,
            owaspId: apiFinding.cve_id || '',
            title: apiFinding.title,
            severity: apiFinding.severity as ProjectFinding['severity'],
            cvssScore: apiFinding.cvss_score || undefined,
            cvssVector: apiFinding.cvss_vector || undefined,
            status: (apiFinding.status === 'OPEN' ? 'Open' : 
                    apiFinding.status === 'IN_PROGRESS' ? 'In Progress' : 
                    apiFinding.status === 'FIXED' ? 'Fixed' : 
                    apiFinding.status === 'ACCEPTED_RISK' ? 'Accepted Risk' : 'Open') as ProjectFinding['status'],
            description: apiFinding.description || '',
            recommendations: apiFinding.remediation || '',
            evidence: apiFinding.affected_systems || undefined,
            affectedAssets: [],
            screenshots: []
        }
    }

    // Load findings from API on mount
    useEffect(() => {
        const fetchFindings = async () => {
            if (!projectId) return
            
            setIsLoading(true)
            try {
                const token = await getToken()
                if (!token) {
                    console.error('No auth token available')
                    return
                }

                const response = await api.get(`/findings/?project_id=${projectId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                })

                if (response.data && Array.isArray(response.data)) {
                    const mappedFindings = response.data.map(mapApiFindingToProjectFinding)
                    setFindings(mappedFindings)
                }
            } catch (error) {
                console.error('Failed to fetch findings:', error)
                toast({
                    title: 'Error',
                    description: 'Failed to load findings. Please try again.',
                    variant: 'destructive',
                })
            } finally {
                setIsLoading(false)
            }
        }

        fetchFindings()
    }, [projectId, getToken, toast])

    // Add finding from library
    const handleAddFinding = async (vuln: Vulnerability) => {
        if (!projectId) return

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

            const payload = {
                title: vuln.title,
                description: vuln.description || '',
                severity: vuln.severity === 'Info' ? 'Informational' : vuln.severity,
                project_id: projectId,
                cvss_vector: vuln.cvss_vector || undefined,
                remediation: vuln.recommendation || '',
            }

            const response = await api.post('/findings/', payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            const newFinding = mapApiFindingToProjectFinding(response.data)
            setFindings([...findings, newFinding])
            setShowAddModal(false)
            
            // Log activity
            logFindingAdded(vuln.title, vuln.severity === 'Info' ? 'Informational' : vuln.severity, response.data.project_name || 'Project', newFinding.id)
            
            toast({
                title: 'Finding Added',
                description: `${vuln.title} has been added successfully.`,
            })
            
            onUpdate()
        } catch (error: any) {
            console.error('Failed to create finding:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to add finding. Please try again.',
                variant: 'destructive',
            })
        }
    }

    // Bulk add findings from library
    const handleBulkAddFindings = async () => {
        if (!projectId) return

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

            // Create all findings in parallel
            const createPromises = selectedVulns.map(vuln => 
                api.post('/findings/', {
                    title: vuln.title,
                    description: vuln.description || '',
                    severity: vuln.severity === 'Info' ? 'Informational' : vuln.severity,
                    project_id: projectId,
                    cvss_vector: vuln.cvss_vector || undefined,
                    remediation: vuln.recommendation || '',
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                })
            )

            const responses = await Promise.all(createPromises)
            const newFindings = responses.map(res => mapApiFindingToProjectFinding(res.data))
            
            setFindings([...findings, ...newFindings])

            // Reset modal state
            setShowAddModal(false)
            setSelectedVulns([])
            setSearchQuery('')

            // Log activity for each finding
            newFindings.forEach((finding, index) => {
                const vuln = selectedVulns[index]
                logFindingAdded(vuln.title, vuln.severity === 'Info' ? 'Informational' : vuln.severity, responses[index].data.project_name || 'Project', finding.id)
            })

            toast({
                title: 'Findings Added',
                description: `Successfully added ${newFindings.length} finding${newFindings.length !== 1 ? 's' : ''}.`,
            })

            onUpdate()
        } catch (error: any) {
            console.error('Failed to create findings:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to add findings. Please try again.',
                variant: 'destructive',
            })
        }
    }

    // Update finding
    const handleUpdateFinding = async (updated: ProjectFinding) => {
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

            const payload = {
                title: updated.title,
                description: updated.description,
                severity: updated.severity,
                cvss_vector: updated.cvssVector,
                remediation: updated.recommendations,
                status: updated.status === 'Open' ? 'OPEN' :
                       updated.status === 'In Progress' ? 'IN_PROGRESS' :
                       updated.status === 'Fixed' ? 'FIXED' :
                       updated.status === 'Accepted Risk' ? 'ACCEPTED_RISK' : 'OPEN',
            }

            const response = await api.put(`/findings/${updated.id}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            const updatedFinding = mapApiFindingToProjectFinding(response.data)
            const updatedFindings = findings.map(f => f.id === updated.id ? updatedFinding : f)
            setFindings(updatedFindings)
            setSelectedFinding(updatedFinding)
            
            toast({
                title: 'Finding Updated',
                description: `${updated.title} has been updated successfully.`,
            })
            
            onUpdate()
        } catch (error: any) {
            console.error('Failed to update finding:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to update finding. Please try again.',
                variant: 'destructive',
            })
        }
    }


    // Delete finding
    const handleDeleteFinding = async () => {
        if (!selectedFinding) return

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

            await api.delete(`/findings/${selectedFinding.id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            // Log activity
            logFindingDeleted(selectedFinding.title, 'Project', selectedFinding.id)

            const updatedFindings = findings.filter(f => f.id !== selectedFinding.id)
            setFindings(updatedFindings)
            setSelectedFinding(null)
            setShowDeleteDialog(false)

            toast({
                title: 'Finding Deleted',
                description: `${selectedFinding.title} has been permanently removed.`,
            })

            onUpdate()
        } catch (error: any) {
            console.error('Failed to delete finding:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to delete finding. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setIsDeleting(false)
        }
    }



    // Group findings by severity
    const groupedFindings = {
        Critical: findings.filter(f => f.severity === 'Critical'),
        High: findings.filter(f => f.severity === 'High'),
        Medium: findings.filter(f => f.severity === 'Medium'),
        Low: findings.filter(f => f.severity === 'Low'),
        Informational: findings.filter(f => f.severity === 'Informational')
    }

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical':
                return 'bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/20'
            case 'High':
                return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20'
            case 'Medium':
                return 'bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 border-yellow-500/20'
            case 'Low':
                return 'bg-green-500/10 text-green-600 dark:text-green-400 border-green-500/20'
            default:
                return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20'
        }
    }

    // Calculate severity counts
    const severityCounts = {
        Critical: findings.filter(f => f.severity === 'Critical').length,
        High: findings.filter(f => f.severity === 'High').length,
        Medium: findings.filter(f => f.severity === 'Medium').length,
        Low: findings.filter(f => f.severity === 'Low').length,
        Informational: findings.filter(f => f.severity === 'Informational').length
    }

    return (
        <>
            <div className="space-y-6">
                {/* 1. Severity Summary (Top Row) */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <StatCard
                        icon={<div className="w-2 h-2 rounded-full bg-red-500" />}
                        label="Critical Findings"
                        value={severityCounts.Critical}
                        variant="destructive"
                    />
                    <StatCard
                        icon={<div className="w-2 h-2 rounded-full bg-orange-500" />}
                        label="High Risk"
                        value={severityCounts.High}
                        variant="warning"
                    />
                    <StatCard
                        icon={<div className="w-2 h-2 rounded-full bg-yellow-500" />}
                        label="Medium Risk"
                        value={severityCounts.Medium}
                        variant="default" // Using default but we might want a yellow variant later
                    />
                    <StatCard
                        icon={<div className="w-2 h-2 rounded-full bg-blue-500" />}
                        label="Low Risk"
                        value={severityCounts.Low}
                        variant="success" // Using success for Low/Info usually
                    />
                </div>

                {/* 2. Action Toolbar (Middle Row) */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div className="relative w-full sm:w-64">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                            placeholder="Search findings..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="pl-9"
                        />
                    </div>
                    <div className="flex items-center gap-2 w-full sm:w-auto">
                        <Button variant="outline" size="sm" className="flex-1 sm:flex-none">
                            <Upload className="w-4 h-4 mr-2" />
                            Import Scan
                        </Button>
                        <Button onClick={() => setShowAddModal(true)} size="sm" className="flex-1 sm:flex-none">
                            <Plus className="w-4 h-4 mr-2" />
                            Add Finding
                        </Button>
                    </div>
                </div>

                {/* 3. Findings List or Premium Empty State */}
                <ScrollArea className="h-[calc(100vh-400px)] min-h-[400px]">
                    <div className="space-y-3 pr-2 pb-20">
                        {isLoading ? (
                            <div className="flex items-center justify-center h-96">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                <span className="ml-3 text-muted-foreground">Loading findings...</span>
                            </div>
                        ) : findings.length === 0 ? (
                            <div className="h-96 rounded-lg border border-dashed border-border bg-muted/30 flex flex-col items-center justify-center relative overflow-hidden">
                                {/* Subtle Background Pattern */}
                                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                                    style={{
                                        backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
                                    }}
                                />

                                <div className="relative z-10 flex flex-col items-center text-center p-6">
                                    <div className="w-16 h-16 rounded-2xl bg-muted border border-border flex items-center justify-center mb-6 shadow-xl">
                                        <Shield className="w-8 h-8 text-muted-foreground" />
                                    </div>
                                    <h3 className="text-lg font-medium text-foreground mb-2">
                                        No findings added yet
                                    </h3>
                                    <p className="text-sm text-muted-foreground max-w-md mb-8">
                                        Start by adding vulnerabilities from the library or import a scanner file to populate your report.
                                    </p>
                                    <div className="flex items-center gap-4 text-sm">
                                        <button
                                            onClick={() => setShowAddModal(true)}
                                            className="text-primary hover:text-primary/80 font-medium hover:underline transition-all"
                                        >
                                            Browse Library
                                        </button>
                                        <span className="text-muted-foreground">•</span>
                                        <button className="text-muted-foreground hover:text-foreground transition-colors">
                                            Create Custom
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                {Object.entries(groupedFindings).map(([severity, items]) => (
                                    items.length > 0 && (
                                        <div key={severity}>
                                            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-2 mt-6 first:mt-0">
                                                {severity} <span className="opacity-60">({items.length})</span>
                                            </h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                {items.map((finding) => (
                                                    <Card
                                                        key={finding.id}
                                                        className={cn(
                                                            'cursor-pointer transition-all duration-200 hover:shadow-lg relative group',
                                                            selectedFinding?.id === finding.id
                                                                ? 'border-primary shadow-md ring-1 ring-primary/20'
                                                                : 'hover:border-primary/50'
                                                        )}
                                                        onClick={() => setSelectedFinding(finding)}
                                                    >
                                                        <CardContent className="p-5">
                                                            <div className="flex items-start justify-between gap-3">
                                                                <div className="flex-1 min-w-0">
                                                                    <h4 className="text-sm font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors leading-snug">
                                                                        {finding.title}
                                                                    </h4>
                                                                    <div className="flex items-center gap-2 mt-4">
                                                                        <Badge className={cn('text-[10px] px-2 py-0.5 font-medium border', getSeverityColor(finding.severity))}>
                                                                            {finding.severity}
                                                                        </Badge>
                                                                        <span className="text-xs text-muted-foreground font-medium">
                                                                            {finding.status}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                ))}
                                            </div>
                                        </div>
                                    )
                                ))}
                            </>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* Edit Finding Modal */}
            <EditFindingModal
                finding={selectedFinding}
                isOpen={!!selectedFinding}
                onClose={() => setSelectedFinding(null)}
                onUpdate={handleUpdateFinding}
                onDelete={() => setShowDeleteDialog(true)}
                isEditable={true}
            />

            {/* Add Finding Modal - Bulk Selector */}
            <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
                    <DialogHeader>
                        <DialogTitle>Add Findings from Library</DialogTitle>
                    </DialogHeader>
                    <div className="grid grid-cols-2 gap-4 flex-1 min-h-0">
                        {/* Left Panel - Available Vulnerabilities */}
                        <div className="space-y-3 flex flex-col min-h-0">
                            <div className="flex-shrink-0">
                                <h3 className="text-sm font-semibold text-foreground mb-2">
                                    Available Vulnerabilities
                                </h3>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                    <Input
                                        placeholder="Search vulnerabilities..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="pl-9"
                                    />
                                </div>
                            </div>
                            <ScrollArea className="flex-1 min-h-0">
                                <div className="space-y-2 pr-2">
                                    {vulnerabilityDatabase
                                        .filter(v =>
                                            v.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            v.description.toLowerCase().includes(searchQuery.toLowerCase())
                                        )
                                        .map((vuln) => {
                                            const isSelected = selectedVulns.some(sv => sv.id === vuln.id)
                                            return (
                                                <Card
                                                    key={vuln.id}
                                                    className={cn(
                                                        "cursor-pointer transition-all",
                                                        isSelected
                                                            ? "opacity-50 border-gray-300"
                                                            : "hover:shadow-md hover:border-primary/50"
                                                    )}
                                                    onClick={() => !isSelected && setSelectedVulns([...selectedVulns, vuln])}
                                                >
                                                    <CardContent className="p-3">
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <h4 className="text-sm font-semibold text-foreground truncate">
                                                                        {vuln.title}
                                                                    </h4>
                                                                    <Badge className={cn('text-[10px] px-1.5 py-0 flex-shrink-0', getSeverityColor(vuln.severity))}>
                                                                        {vuln.severity}
                                                                    </Badge>
                                                                </div>
                                                                <p className="text-xs text-muted-foreground line-clamp-1">
                                                                    {vuln.description}
                                                                </p>
                                                                <div className="flex items-center gap-2 mt-1">
                                                                    <Badge variant="outline" className="text-[10px]">
                                                                        {vuln.category}
                                                                    </Badge>
                                                                </div>
                                                            </div>
                                                            {isSelected ? (
                                                                <span className="text-xs text-muted-foreground flex-shrink-0">Added</span>
                                                            ) : (
                                                                <Plus className="w-5 h-5 text-primary flex-shrink-0" />
                                                            )}
                                                        </div>
                                                    </CardContent>
                                                </Card>
                                            )
                                        })}
                                </div>
                            </ScrollArea>
                        </div>

                        {/* Right Panel - To Be Added */}
                        <div className="space-y-3 flex flex-col border-l border-border pl-4 min-h-0">
                            <div className="flex items-center justify-between flex-shrink-0">
                                <h3 className="text-sm font-semibold text-foreground">
                                    To Be Added ({selectedVulns.length})
                                </h3>
                                {selectedVulns.length > 0 && (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => setSelectedVulns([])}
                                        className="text-xs h-7"
                                    >
                                        Clear All
                                    </Button>
                                )}
                            </div>

                            {selectedVulns.length === 0 ? (
                                <div className="flex-1 flex items-center justify-center min-h-0">
                                    <div className="text-center text-muted-foreground">
                                        <Plus className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No findings selected</p>
                                        <p className="text-xs mt-1">Click on vulnerabilities to add them</p>
                                    </div>
                                </div>
                            ) : (
                                <ScrollArea className="flex-1 min-h-0">
                                    <div className="space-y-2 pr-2">
                                        {selectedVulns.map((vuln) => (
                                            <Card key={vuln.id} className="border-primary/30 bg-primary/5">
                                                <CardContent className="p-3">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <h4 className="text-sm font-semibold text-foreground truncate">
                                                                    {vuln.title}
                                                                </h4>
                                                                <Badge className={cn('text-[10px] px-1.5 py-0 flex-shrink-0', getSeverityColor(vuln.severity))}>
                                                                    {vuln.severity}
                                                                </Badge>
                                                            </div>
                                                            <p className="text-xs text-muted-foreground line-clamp-1">
                                                                {vuln.category}
                                                            </p>
                                                        </div>
                                                        <button
                                                            onClick={() => setSelectedVulns(selectedVulns.filter(v => v.id !== vuln.id))}
                                                            className="text-red-500 hover:text-red-700 flex-shrink-0"
                                                        >
                                                            <X className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    </div>

                    <DialogFooter className="border-t border-border pt-4 flex-shrink-0">
                        <Button
                            variant="outline"
                            onClick={() => {
                                setShowAddModal(false)
                                setSelectedVulns([])
                                setSearchQuery('')
                            }}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleBulkAddFindings}
                            disabled={selectedVulns.length === 0}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add {selectedVulns.length} Finding{selectedVulns.length !== 1 ? 's' : ''}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete Finding</DialogTitle>
                    </DialogHeader>
                    <div className="py-4">
                        <p className="text-sm text-muted-foreground mb-4">
                            Are you sure you want to delete this finding? This action cannot be undone.
                        </p>
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                            <p className="text-sm font-semibold text-red-900 dark:text-red-200">
                                {selectedFinding?.title}
                            </p>
                            <p className="text-xs text-red-700 dark:text-red-300 mt-1">
                                Severity: {selectedFinding?.severity}
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button
                            variant="outline"
                            onClick={() => setShowDeleteDialog(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            variant="destructive"
                            onClick={handleDeleteFinding}
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Deleting...
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete Finding
                                </>
                            )}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </>
    )
}

