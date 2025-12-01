import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Badge } from '@/components/ui/badge'
import {
    Loader2,
    Plus,
    Calendar,
    Building2
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'
import { logReportCreated } from '@/lib/activityLog'

interface DialogProject {
    id: string
    name: string
    clientName: string
    startDate: string
    endDate: string
    findingsCount?: number
    status?: string
}

interface NewReportDialogProps {
    children?: React.ReactNode
    onReportCreated?: () => void
}

export function NewReportDialog({ children, onReportCreated }: NewReportDialogProps) {
    const [open, setOpen] = useState(false)
    const [projects, setProjects] = useState<DialogProject[]>([])
    const [loading, setLoading] = useState(false)
    const [selectedProjectId, setSelectedProjectId] = useState<string>("")
    const [isSubmitting, setIsSubmitting] = useState(false)

    const { getToken } = useAuth()
    const navigate = useNavigate()
    const { toast } = useToast()

    // Fetch active projects on open
    useEffect(() => {
        if (open) {
            fetchProjects()
            setSelectedProjectId("")
        }
    }, [open])

    const fetchProjects = async () => {
        setLoading(true)
        const apiProjects: DialogProject[] = []

        // Fetch ALL projects from API (no status filter)
        try {
            const token = await getToken()
            if (!token) {
                console.warn('No authentication token available for fetching projects')
                setProjects([])
                setLoading(false)
                return
            }

            // Fetch all projects - no query params
            console.log('Fetching projects from /v1/projects...')
            const response = await api.get('/v1/projects', {
                headers: { Authorization: `Bearer ${token}` }
            })
            
            console.log('API Response:', response.data)
            console.log('Response type:', typeof response.data, 'Is array:', Array.isArray(response.data))
            
            // Validate and map API projects
            if (Array.isArray(response.data)) {
                console.log(`Received ${response.data.length} projects from API`)
                
                response.data.forEach((p: any, index: number) => {
                    console.log(`Processing project ${index + 1}:`, {
                        id: p.id,
                        name: p.name,
                        status: p.status,
                        client_name: p.client_name
                    })
                    
                    // Accept any non-empty ID from API (trust the API response)
                    const projectId = String(p.id || '').trim()
                    
                    if (projectId) {
                        apiProjects.push({
                            id: projectId,
                            name: p.name || 'Unnamed Project',
                            clientName: p.client_name || 'Unknown Client',
                            startDate: p.start_date || new Date().toISOString(),
                            endDate: p.end_date || new Date().toISOString(),
                            findingsCount: p.finding_count || 0,
                            status: p.status // Store status for filtering
                        })
                        console.log(`✓ Added project: ${p.name} (ID: ${projectId}, Status: ${p.status})`)
                    } else {
                        console.warn(`✗ Skipping project with empty ID:`, p)
                    }
                })
            } else {
                console.error('API response is not an array:', response.data)
            }
            
            // Filter client-side: exclude only ARCHIVED projects (case-insensitive)
            // Status enum values: PLANNING, IN_PROGRESS, REVIEW, COMPLETED, ARCHIVED
            const activeProjects = apiProjects.filter(p => {
                const status = String(p.status || '').toUpperCase().trim()
                const isArchived = status === 'ARCHIVED'
                if (isArchived) {
                    console.log(`✗ Filtered out archived project: ${p.name} (status: ${p.status})`)
                }
                return !isArchived
            })
            
            console.log(`Total projects fetched: ${apiProjects.length}, Active (non-archived): ${activeProjects.length}`)
            console.log('Active projects:', activeProjects.map(p => ({ id: p.id, name: p.name, status: p.status })))
            
            setProjects(activeProjects)
        } catch (error: any) {
            console.error('Failed to fetch projects from API:', error)
            if (error.response) {
                console.error('Error response status:', error.response.status)
                console.error('Error response data:', error.response.data)
            }
            setProjects([])
        } finally {
            setLoading(false)
        }
    }

    const handleCreateDraft = async () => {
        if (!selectedProjectId) {
            console.warn('No project selected')
            return
        }

        const selectedProject = projects.find(p => p.id === selectedProjectId)
        if (!selectedProject) {
            console.error('Selected project not found in projects list', { selectedProjectId, availableProjects: projects.map(p => p.id) })
            toast({
                title: "Error",
                description: "Selected project not found. Please try again.",
                variant: "destructive"
            })
            return
        }


        // Validate project ID exists
        const projectId = String(selectedProjectId).trim()
        if (!projectId) {
            console.error('No project ID selected')
            toast({
                title: "Error",
                description: "Please select a project.",
                variant: "destructive"
            })
            return
        }

        // Log the project ID before sending
        console.log('Creating report with project ID:', projectId)
        console.log('Selected project:', selectedProject)

        setIsSubmitting(true)
        try {
            const token = await getToken()
            if (!token) {
                toast({
                    title: "Error",
                    description: "Authentication token not available.",
                    variant: "destructive"
                })
                return
            }

            const payload = {
                project_id: projectId, // Use the validated UUID
                title: `${selectedProject.name} Report`,
                report_type: 'PENTEST'  // Default report type
            }

            console.log('Sending report creation request with payload:', payload)

            const response = await api.post('/v1/reports/', payload, {
                headers: { Authorization: `Bearer ${token}` }
            })

            // Log activity
            logReportCreated(`${selectedProject.name} Report`, selectedProject.name, response.data.id)

            toast({
                title: "Report initialized",
                description: "New draft report has been created.",
            })

            setOpen(false)
            if (onReportCreated) {
                onReportCreated()
            } else {
                navigate(`/reports/${response.data.id}`)
            }
        } catch (error: any) {
            // Enhanced error handling - log the actual error response
            console.error('Failed to create report:', error)
            
            let errorMessage = "Failed to create report. Please try again."
            
            if (error.response) {
                // Axios error with response
                const status = error.response.status
                const data = error.response.data
                
                console.error("Report Create Error - Status:", status)
                console.error("Report Create Error - Response:", data)
                
                // Extract detailed error message
                if (typeof data === 'string') {
                    errorMessage = data
                } else if (data?.detail) {
                    errorMessage = data.detail
                } else if (data?.message) {
                    errorMessage = data.message
                } else if (data?.error) {
                    errorMessage = data.error
                } else {
                    errorMessage = `Server error (${status}): ${JSON.stringify(data)}`
                }
            } else if (error.request) {
                // Request was made but no response received
                console.error("Report Create Error - No response received:", error.request)
                errorMessage = "No response from server. Please check your connection."
            } else {
                // Error setting up the request
                console.error("Report Create Error - Request setup failed:", error.message)
                errorMessage = error.message || "Failed to create report. Please try again."
            }
            
            toast({
                title: "Error",
                description: errorMessage,
                variant: "destructive"
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    const selectedProject = projects.find(p => p.id === selectedProjectId)

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {children || (
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        New Report
                    </Button>
                )}
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px] bg-zinc-950 border-zinc-800 text-zinc-100 p-0 gap-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="text-xl font-bold">New Report</DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Select an active engagement to generate a report for.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-zinc-300">Project</label>
                        <Select 
                            value={selectedProjectId} 
                            onValueChange={setSelectedProjectId}
                            disabled={loading}
                        >
                            <SelectTrigger className="bg-zinc-900 border-zinc-800 text-zinc-100 focus:ring-emerald-500/50">
                                <SelectValue placeholder={loading ? "Loading projects..." : "Select a project..."} />
                            </SelectTrigger>
                            <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-100">
                                {projects.length > 0 ? (
                                    projects.map((project) => (
                                        <SelectItem 
                                            key={project.id} 
                                            value={project.id}
                                            className="focus:bg-zinc-800 focus:text-zinc-100 cursor-pointer"
                                        >
                                            {project.name}
                                        </SelectItem>
                                    ))
                                ) : !loading ? (
                                    <div className="p-4 text-center">
                                        <p className="text-sm text-zinc-500 mb-3">No active projects found</p>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => {
                                                setOpen(false)
                                                navigate('/projects')
                                            }}
                                            className="text-emerald-500 border-emerald-500/50 hover:bg-emerald-500/10"
                                        >
                                            Create your first Project
                                        </Button>
                                    </div>
                                ) : null}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedProject && (
                        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 space-y-3 animate-in fade-in slide-in-from-top-2">
                            <div className="flex items-start justify-between">
                                <div>
                                    <h3 className="font-semibold text-zinc-100">{selectedProject.name}</h3>
                                    <div className="flex items-center text-sm text-zinc-400 mt-1">
                                        <Building2 className="w-3 h-3 mr-1.5" />
                                        {selectedProject.clientName}
                                    </div>
                                </div>
                            </div>
                            
                            <div className="pt-2 border-t border-zinc-800/50">
                                <div className="space-y-1">
                                    <span className="text-xs text-zinc-500 uppercase tracking-wider font-medium">Timeline</span>
                                    <div className="flex items-center text-sm text-zinc-300">
                                        <Calendar className="w-3.5 h-3.5 mr-1.5 text-emerald-500" />
                                        {new Date(selectedProject.startDate).toLocaleDateString()}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 pt-2 border-t border-zinc-800 bg-zinc-900/30">
                    <Button
                        variant="ghost"
                        onClick={() => setOpen(false)}
                        className="text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleCreateDraft}
                        disabled={!selectedProjectId || isSubmitting}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px]"
                    >
                        {isSubmitting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Creating...
                            </>
                        ) : (
                            'Create Draft'
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
