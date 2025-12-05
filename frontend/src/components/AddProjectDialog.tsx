import { useState, useEffect, KeyboardEvent } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import { Calendar } from '@/components/ui/calendar'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import {
    FolderKanban,
    Target,
    Calendar as CalendarIcon,
    Check,
    X,
    Shield,
    Globe,
    Smartphone,
    Server,
    Cloud,
    Wifi,
    FileCode,
    Loader2,
    Building2
} from 'lucide-react'
import { useToast } from '@/components/ui/use-toast'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { api } from '@/lib/api'
import { ClientBasic } from '@/types'

// Use ClientBasic for dropdown list
type Client = ClientBasic

interface EditingProject {
    id: string
    name: string
    clientId?: string
    client_id?: string
    clientName?: string
    client_name?: string
    type?: string
    project_type?: string
    description?: string
    scope?: string | string[]
    methodology?: string
    complianceFrameworks?: string | string[]
    compliance_frameworks?: string | string[]
    startDate?: Date | string
    start_date?: string
    endDate?: Date | string
    end_date?: string
    priority?: string
    status?: string
    leadTester?: string
    lead_id?: string
    teamMembers?: Array<{ id: string } | string>
}

interface ProjectData {
    id: string
    name: string
    description?: string
    clientId: string
    clientName: string
    clientLogoUrl?: string
    type: string
    status: string
    priority: string
    startDate?: Date
    endDate?: Date
    progress: number
    findingsCount: number
    findingsBySeverity: { critical: number; high: number; medium: number; low: number }
    teamMembers: string[]
    methodology: string
    complianceFrameworks: string[]
    scope: string[]
    lastActivity: string
    lastActivityDate: Date
    createdAt: Date
    updatedAt: Date
}

interface AddProjectDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onProjectAdded?: (project: ProjectData) => void
    clients: Client[]
    editingProject?: EditingProject | null
}

interface FormData {
    name: string
    clientId: string
    type: string
    description: string
    scope: string[]
    methodology: string
    complianceFrameworks: string[]
    startDate: Date | undefined
    endDate: Date | undefined
    priority: string
    status: string
}

const parseScopeField = (rawScope: string | string[] | undefined | null): string[] => {
    if (!rawScope) return []
    if (Array.isArray(rawScope)) return rawScope.filter(Boolean)
    
    if (typeof rawScope === 'string') {
        try {
            const parsed = JSON.parse(rawScope)
            if (Array.isArray(parsed)) {
                return parsed.filter(Boolean)
            }
        } catch {
            return rawScope
                .split(/[\n,]+/)
                .map(item => item.trim())
                .filter(Boolean)
        }
        
        return rawScope ? [rawScope].filter(Boolean) : []
    }
    
    return []
}

const PROJECT_TAGS = ['Web App', 'API', 'Mobile', 'Network', 'Cloud', 'Internal', 'External', 'Retest']

export function AddProjectDialog({ open, onOpenChange, onProjectAdded, clients, editingProject }: AddProjectDialogProps) {
    const { getToken } = useAuth()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [startDateOpen, setStartDateOpen] = useState(false)
    const [endDateOpen, setEndDateOpen] = useState(false)
    const [scopeInput, setScopeInput] = useState('')
    
    const [formData, setFormData] = useState<FormData>({
        name: '',
        clientId: '',
        type: 'External',
        description: '',
        scope: [],
        methodology: 'OWASP Testing Guide v4',
        complianceFrameworks: [],
        startDate: undefined,
        endDate: undefined,
        priority: 'Medium',
        status: 'Planning',
    })

    useEffect(() => {
        if (open) {
            if (editingProject) {
                const parsedScope = parseScopeField(editingProject.scope)
                
                let parsedComplianceFrameworks: string[] = []
                const frameworks = editingProject.complianceFrameworks || editingProject.compliance_frameworks
                if (frameworks) {
                    try {
                        parsedComplianceFrameworks = typeof frameworks === 'string'
                            ? JSON.parse(frameworks)
                            : frameworks
                    } catch {
                        parsedComplianceFrameworks = []
                    }
                }
                
                setFormData({
                    name: editingProject.name || '',
                    clientId: editingProject.clientId || editingProject.client_id || '',
                    type: editingProject.type || editingProject.project_type || 'External',
                    description: editingProject.description || '',
                    scope: parsedScope,
                    methodology: editingProject.methodology || 'OWASP Testing Guide v4',
                    complianceFrameworks: parsedComplianceFrameworks,
                    startDate: editingProject.startDate || editingProject.start_date 
                        ? new Date(editingProject.startDate || editingProject.start_date!) 
                        : undefined,
                    endDate: editingProject.endDate || editingProject.end_date 
                        ? new Date(editingProject.endDate || editingProject.end_date!) 
                        : undefined,
                    priority: editingProject.priority || 'Medium',
                    status: editingProject.status || 'Planning',
                })
            } else {
                setFormData({
                    name: '',
                    clientId: '',
                    type: 'External',
                    description: '',
                    scope: [],
                    methodology: 'OWASP Testing Guide v4',
                    complianceFrameworks: [],
                    startDate: undefined,
                    endDate: undefined,
                    priority: 'Medium',
                    status: 'Planning',
                })
            }
            setScopeInput('')
        }
    }, [editingProject, open])

    const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleScopeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addScopeItem()
        } else if (e.key === 'Backspace' && scopeInput === '' && formData.scope.length > 0) {
            removeScopeItem(formData.scope[formData.scope.length - 1])
        }
    }

    const addScopeItem = (itemToAdd?: string) => {
        const item = (itemToAdd || scopeInput).trim().replace(/,/g, '')
        if (item && !formData.scope.includes(item)) {
            updateField('scope', [...formData.scope, item])
            setScopeInput('')
        }
    }

    const removeScopeItem = (item: string) => {
        updateField('scope', formData.scope.filter(i => i !== item))
    }

    const toggleCompliance = (framework: string) => {
        if (formData.complianceFrameworks.includes(framework)) {
            updateField('complianceFrameworks', formData.complianceFrameworks.filter(f => f !== framework))
        } else {
            updateField('complianceFrameworks', [...formData.complianceFrameworks, framework])
        }
    }

    const handleSubmit = async () => {
        if (!formData.name.trim() || !formData.clientId) return
        
        setIsSubmitting(true)

        try {
            const token = await getToken()
            if (!token) throw new Error('Authentication required')

            const selectedClient = clients.find(c => c.id === formData.clientId)

            const payload: Record<string, string> = {
                name: formData.name.trim(),
                client_id: formData.clientId,
            }
            
            if (formData.description?.trim()) {
                payload.description = formData.description.trim()
            }
            if (formData.startDate) {
                payload.start_date = formData.startDate.toISOString()
            }
            if (formData.endDate) {
                payload.end_date = formData.endDate.toISOString()
            }
            if (formData.type) {
                payload.project_type = formData.type
            }
            payload.scope = JSON.stringify(formData.scope || [])
            if (formData.methodology) {
                payload.methodology = formData.methodology
            }
            if (formData.complianceFrameworks.length > 0) {
                payload.compliance_frameworks = JSON.stringify(formData.complianceFrameworks)
            }
            if (formData.priority) {
                payload.priority = formData.priority
            }
            if (formData.status) {
                const statusMap: Record<string, string> = {
                    'Planning': 'PLANNING',
                    'In Progress': 'IN_PROGRESS',
                    'On Hold': 'ON_HOLD',
                    'Completed': 'COMPLETED',
                    'Cancelled': 'CANCELLED',
                }
                payload.status = statusMap[formData.status] || 'PLANNING'
            }

            let projectData: { id: string; name: string; description?: string; client_id: string; client_name?: string; status?: string; start_date?: string; end_date?: string; finding_count?: number; created_at: string; updated_at: string }
            
            if (editingProject) {
                const response = await api.put(`/projects/${editingProject.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                projectData = response.data
                toast({ title: 'Project Updated', description: `${projectData.name} updated.` })
            } else {
                const response = await api.post('/projects/', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                projectData = response.data
                toast({ title: 'Project Created', description: `${projectData.name} created.` })
            }

            const frontendProjectData: ProjectData = {
                id: projectData.id,
                name: projectData.name,
                description: projectData.description,
                clientId: projectData.client_id,
                clientName: projectData.client_name || selectedClient?.name || 'Unknown Client',
                clientLogoUrl: selectedClient?.logoUrl || '',
                type: formData.type,
                status: projectData.status || 'Planning',
                priority: formData.priority,
                startDate: projectData.start_date ? new Date(projectData.start_date) : formData.startDate,
                endDate: projectData.end_date ? new Date(projectData.end_date) : formData.endDate,
                progress: 0,
                findingsCount: projectData.finding_count || 0,
                findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                teamMembers: [],
                methodology: formData.methodology,
                complianceFrameworks: formData.complianceFrameworks,
                scope: formData.scope,
                lastActivity: 'Just now',
                lastActivityDate: new Date(),
                createdAt: new Date(projectData.created_at),
                updatedAt: new Date(projectData.updated_at),
            }

            onProjectAdded?.(frontendProjectData)
            onOpenChange(false)

        } catch (error: unknown) {
            console.error('Project save error:', error)
            const apiError = error as { response?: { data?: { detail?: string } } }
            toast({
                title: 'Error',
                description: apiError.response?.data?.detail || 'Failed to save project.',
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto p-0 gap-0 bg-white border-slate-200 rounded-xl shadow-2xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                            <FolderKanban className="h-5 w-5" />
                        </div>
                        {editingProject ? 'Edit Project' : 'New Project'}
                    </DialogTitle>
                    <DialogDescription>
                        {editingProject 
                            ? 'Update project details and configuration.'
                            : 'Define scope, timeline, and details for a new penetration test.'
                        }
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Section 1: Core Info */}
                    <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="col-span-2 space-y-1.5">
                                <Label htmlFor="name" className="text-xs font-medium text-slate-500 uppercase">
                                    Project Name <span className="text-red-500">*</span>
                                </Label>
                                <Input
                                    id="name"
                                    placeholder="Q1 2024 External Pentest"
                                    value={formData.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                    className="h-9"
                                    autoFocus
                                />
                            </div>
                            
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500 uppercase">
                                    Client <span className="text-red-500">*</span>
                                </Label>
                                <Select
                                    value={formData.clientId}
                                    onValueChange={(value) => updateField('clientId', value)}
                                >
                                    <SelectTrigger className="h-9">
                                        <div className="flex items-center gap-2">
                                            <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                            <SelectValue placeholder={clients.length === 0 ? "No clients" : "Select client..."} />
                                        </div>
                                    </SelectTrigger>
                                    <SelectContent>
                                        {clients.map((client) => (
                                            <SelectItem key={client.id} value={client.id}>
                                                {client.name}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500 uppercase">Testing Type</Label>
                                <Select
                                    value={formData.type}
                                    onValueChange={(value) => updateField('type', value)}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="External"><span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-slate-400" /> External Network</span></SelectItem>
                                        <SelectItem value="Internal"><span className="flex items-center gap-2"><Server className="w-3.5 h-3.5 text-slate-400" /> Internal Network</span></SelectItem>
                                        <SelectItem value="Web App"><span className="flex items-center gap-2"><Globe className="w-3.5 h-3.5 text-slate-400" /> Web Application</span></SelectItem>
                                        <SelectItem value="Mobile"><span className="flex items-center gap-2"><Smartphone className="w-3.5 h-3.5 text-slate-400" /> Mobile App</span></SelectItem>
                                        <SelectItem value="API"><span className="flex items-center gap-2"><FileCode className="w-3.5 h-3.5 text-slate-400" /> API</span></SelectItem>
                                        <SelectItem value="Cloud"><span className="flex items-center gap-2"><Cloud className="w-3.5 h-3.5 text-slate-400" /> Cloud Infrastructure</span></SelectItem>
                                        <SelectItem value="Network"><span className="flex items-center gap-2"><Wifi className="w-3.5 h-3.5 text-slate-400" /> Wireless/Network</span></SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500 uppercase">Methodology</Label>
                                <Select
                                    value={formData.methodology}
                                    onValueChange={(value) => updateField('methodology', value)}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PTES">PTES</SelectItem>
                                        <SelectItem value="OWASP Testing Guide v4">OWASP Testing Guide v4</SelectItem>
                                        <SelectItem value="NIST SP 800-115">NIST SP 800-115</SelectItem>
                                        <SelectItem value="OSSTMM">OSSTMM</SelectItem>
                                        <SelectItem value="Custom">Custom Methodology</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium text-slate-500 uppercase">Priority</Label>
                                <Select
                                    value={formData.priority}
                                    onValueChange={(value) => updateField('priority', value)}
                                >
                                    <SelectTrigger className="h-9">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="Low">Low</SelectItem>
                                        <SelectItem value="Medium">Medium</SelectItem>
                                        <SelectItem value="High">High</SelectItem>
                                        <SelectItem value="Critical">Critical</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </div>

                    {/* Section 2: Timeline */}
                    <div className="grid grid-cols-3 gap-4">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500 uppercase">Start Date</Label>
                            <Popover open={startDateOpen} onOpenChange={setStartDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full h-9 justify-start text-left text-sm font-normal",
                                            !formData.startDate && "text-slate-400"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                                        {formData.startDate ? format(formData.startDate, "MMM d, yyyy") : "Pick date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formData.startDate}
                                        onSelect={(date) => {
                                            updateField('startDate', date)
                                            setStartDateOpen(false)
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500 uppercase">End Date</Label>
                            <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className={cn(
                                            "w-full h-9 justify-start text-left text-sm font-normal",
                                            !formData.endDate && "text-slate-400"
                                        )}
                                    >
                                        <CalendarIcon className="mr-2 h-3.5 w-3.5 text-slate-400" />
                                        {formData.endDate ? format(formData.endDate, "MMM d, yyyy") : "Pick date"}
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0">
                                    <Calendar
                                        mode="single"
                                        selected={formData.endDate}
                                        onSelect={(date) => {
                                            updateField('endDate', date)
                                            setEndDateOpen(false)
                                        }}
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500 uppercase">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value) => updateField('status', value)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Planning">Planning</SelectItem>
                                    <SelectItem value="In Progress">In Progress</SelectItem>
                                    <SelectItem value="On Hold">On Hold</SelectItem>
                                    <SelectItem value="Completed">Completed</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Section 3: Scope */}
                    <div className="space-y-1.5">
                        <Label className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1.5">
                            <Target className="h-3 w-3" />
                            Scope (domains, IPs, URLs)
                        </Label>
                        <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500 min-h-[38px]">
                            {formData.scope.map(item => (
                                <span key={item} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
                                    {item}
                                    <button type="button" onClick={() => removeScopeItem(item)} className="hover:text-slate-900"><X className="h-3 w-3" /></button>
                                </span>
                            ))}
                            <input
                                className="flex-1 bg-transparent text-sm outline-none min-w-[120px] placeholder:text-slate-400"
                                placeholder={formData.scope.length ? "" : "Add scope items..."}
                                value={scopeInput}
                                onChange={e => setScopeInput(e.target.value)}
                                onKeyDown={handleScopeKeyDown}
                                onBlur={() => { if (scopeInput.trim()) addScopeItem() }}
                            />
                        </div>
                    </div>

                    {/* Section 4: Compliance */}
                    <div className="space-y-2">
                        <Label className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1.5">
                            <Shield className="h-3 w-3" />
                            Project Tags
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                            {PROJECT_TAGS.map((framework) => (
                                <button
                                    key={framework}
                                    type="button"
                                    onClick={() => toggleCompliance(framework)}
                                    className={cn(
                                        "px-2.5 py-1 rounded-md text-xs font-medium transition-all border",
                                        formData.complianceFrameworks.includes(framework)
                                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                            : "bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100"
                                    )}
                                >
                                    {formData.complianceFrameworks.includes(framework) && (
                                        <Check className="w-3 h-3 inline mr-1" />
                                    )}
                                    {framework}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Section 5: Description */}
                    <div className="space-y-1.5">
                        <Label htmlFor="description" className="text-xs font-medium text-slate-500 uppercase">Description</Label>
                        <Textarea
                            id="description"
                            placeholder="Brief description of the engagement..."
                            value={formData.description}
                            onChange={(e) => updateField('description', e.target.value)}
                            className="h-16 resize-none"
                        />
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !formData.name.trim() || !formData.clientId}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-1.5" />
                                {editingProject ? 'Save Changes' : 'Create Project'}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
