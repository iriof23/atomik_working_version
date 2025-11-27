import { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
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
    Users,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    X,
    Shield,
    Globe,
    Smartphone,
    Server,
    Cloud,
    Wifi,
    FileCode
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'

interface AddProjectDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onProjectAdded?: (project: any) => void
    clients: any[] // Pass existing clients for dropdown
    editingProject?: any // Project to edit (if provided, dialog is in edit mode)
}

export function AddProjectDialog({ open, onOpenChange, onProjectAdded, clients, editingProject }: AddProjectDialogProps) {
    const [step, setStep] = useState(1)
    const [formData, setFormData] = useState({
        // Step 1: Basics
        name: '',
        clientId: '',
        clientName: '',
        type: 'External',
        description: '',

        // Step 2: Scope & Methodology
        scope: [] as string[],
        methodology: 'OWASP Testing Guide v4',
        complianceFrameworks: [] as string[],

        // Step 3: Timeline & Priority
        startDate: undefined as Date | undefined,
        endDate: undefined as Date | undefined,
        priority: 'Medium',
        status: 'Planning',

        // Step 4: Team
        leadTester: '',
        teamMembers: [] as string[]
    })

    // Update form data when editingProject changes
    useEffect(() => {
        if (editingProject) {
            setFormData({
                name: editingProject.name || '',
                clientId: editingProject.clientId || '',
                clientName: editingProject.clientName || '',
                type: editingProject.type || 'External',
                description: editingProject.description || '',
                scope: editingProject.scope || [],
                methodology: editingProject.methodology || 'OWASP Testing Guide v4',
                complianceFrameworks: editingProject.complianceFrameworks || [],
                startDate: editingProject.startDate ? new Date(editingProject.startDate) : undefined,
                endDate: editingProject.endDate ? new Date(editingProject.endDate) : undefined,
                priority: editingProject.priority || 'Medium',
                status: editingProject.status || 'Planning',
                leadTester: editingProject.leadTester || '',
                teamMembers: editingProject.teamMembers?.map((m: any) => m.id || m) || []
            })
        } else {
            // Reset form when not editing
            setFormData({
                name: '',
                clientId: '',
                clientName: '',
                type: 'External',
                description: '',
                scope: [],
                methodology: 'OWASP Testing Guide v4',
                complianceFrameworks: [],
                startDate: undefined,
                endDate: undefined,
                priority: 'Medium',
                status: 'Planning',
                leadTester: '',
                teamMembers: []
            })
        }
    }, [editingProject, open])

    const [scopeInput, setScopeInput] = useState('')

    const totalSteps = 4

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const addScopeItem = () => {
        if (scopeInput.trim() && !formData.scope.includes(scopeInput.trim())) {
            updateField('scope', [...formData.scope, scopeInput.trim()])
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

    const handleNext = () => {
        if (step < totalSteps) setStep(step + 1)
    }

    const handleBack = () => {
        if (step > 1) setStep(step - 1)
    }

    const handleSubmit = () => {
        // Find selected client details
        const selectedClient = clients.find(c => c.id === formData.clientId)

        // Create new project object
        const newProject = {
            id: Date.now().toString(),
            ...formData,
            clientName: selectedClient?.name || 'Unknown Client',
            clientLogoUrl: selectedClient?.logoUrl || '🏢',
            progress: 0,
            findingsCount: 0,
            findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
            teamMembers: formData.teamMembers.map(id => ({
                id,
                name: id === '1' ? 'Alice Johnson' : id === '2' ? 'Bob Smith' : 'Unknown User', // Mock logic
                role: 'Pentester',
                avatarUrl: ''
            })),
            lastActivity: 'Just now',
            lastActivityDate: new Date(),
            createdAt: new Date(),
            updatedAt: new Date()
        }

        onProjectAdded?.(newProject)
        onOpenChange(false)

        // Reset form
        setStep(1)
        setFormData({
            name: '',
            clientId: '',
            clientName: '',
            type: 'External',
            description: '',
            scope: [],
            methodology: 'PTES',
            complianceFrameworks: [],
            startDate: undefined,
            endDate: undefined,
            priority: 'Medium',
            status: 'Planning',
            leadTester: '',
            teamMembers: []
        })
    }

    // Mock team members
    const availableTeamMembers = [
        { id: '1', name: 'Alice Johnson', role: 'Lead Pentester' },
        { id: '2', name: 'Bob Smith', role: 'Security Analyst' },
        { id: '3', name: 'Carol White', role: 'Junior Tester' },
        { id: '4', name: 'David Lee', role: 'Mobile Expert' },
        { id: '5', name: 'Emma Davis', role: 'API Specialist' }
    ]

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold flex items-center gap-2">
                        <FolderKanban className="h-6 w-6 text-blue-600" />
                        {editingProject ? 'Edit Project' : 'Create New Project'}
                    </DialogTitle>
                    <DialogDescription>
                        {editingProject 
                            ? 'Update project details, scope, timeline, and team'
                            : 'Define scope, timeline, and team for a new penetration test'
                        }
                    </DialogDescription>
                </DialogHeader>

                {/* Progress Indicator */}
                <div className="flex items-center justify-between mb-6 px-2">
                    {[1, 2, 3, 4].map((s) => (
                        <div key={s} className="flex items-center flex-1">
                            <div className="flex flex-col items-center flex-1 relative">
                                <div
                                    className={cn(
                                        "w-8 h-8 rounded-full flex items-center justify-center font-semibold transition-all z-10",
                                        step >= s
                                            ? "bg-blue-600 text-white"
                                            : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                                    )}
                                >
                                    {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                                </div>
                                <span className={cn(
                                    "text-[10px] uppercase tracking-wider mt-2 font-semibold absolute -bottom-6 w-24 text-center",
                                    step >= s ? "text-blue-600" : "text-gray-400"
                                )}>
                                    {s === 1 && "Basics"}
                                    {s === 2 && "Scope"}
                                    {s === 3 && "Timeline"}
                                    {s === 4 && "Team"}
                                </span>
                            </div>
                            {s < totalSteps && (
                                <div className={cn(
                                    "h-1 flex-1 mx-2 rounded transition-all",
                                    step > s ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-700"
                                )} />
                            )}
                        </div>
                    ))}
                </div>

                <div className="mt-8 min-h-[300px]">
                    {/* Step 1: Project Basics */}
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label htmlFor="name">Project Name <span className="text-red-500">*</span></Label>
                                <Input
                                    id="name"
                                    placeholder="e.g., Q1 2024 External Pentest"
                                    value={formData.name}
                                    onChange={(e) => updateField('name', e.target.value)}
                                    className="text-lg"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Client <span className="text-red-500">*</span></Label>
                                    <Select
                                        value={formData.clientId}
                                        onValueChange={(value) => updateField('clientId', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select client..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {clients.map((client) => (
                                                <SelectItem key={client.id} value={client.id}>
                                                    <span className="flex items-center gap-2">
                                                        <span>{client.logoUrl || '🏢'}</span>
                                                        {client.name}
                                                    </span>
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label>Testing Type</Label>
                                    <Select
                                        value={formData.type}
                                        onValueChange={(value) => updateField('type', value)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="External"><span className="flex items-center gap-2"><Globe className="w-4 h-4" /> External Network</span></SelectItem>
                                            <SelectItem value="Internal"><span className="flex items-center gap-2"><Server className="w-4 h-4" /> Internal Network</span></SelectItem>
                                            <SelectItem value="Web App"><span className="flex items-center gap-2"><Globe className="w-4 h-4" /> Web Application</span></SelectItem>
                                            <SelectItem value="Mobile"><span className="flex items-center gap-2"><Smartphone className="w-4 h-4" /> Mobile App</span></SelectItem>
                                            <SelectItem value="API"><span className="flex items-center gap-2"><FileCode className="w-4 h-4" /> API</span></SelectItem>
                                            <SelectItem value="Cloud"><span className="flex items-center gap-2"><Cloud className="w-4 h-4" /> Cloud Infrastructure</span></SelectItem>
                                            <SelectItem value="Network"><span className="flex items-center gap-2"><Wifi className="w-4 h-4" /> Wireless/Network</span></SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="description">Description</Label>
                                <Textarea
                                    id="description"
                                    placeholder="Brief description of the engagement..."
                                    value={formData.description}
                                    onChange={(e) => updateField('description', e.target.value)}
                                    rows={4}
                                />
                            </div>
                        </div>
                    )}

                    {/* Step 2: Scope & Methodology */}
                    {step === 2 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Target className="w-4 h-4 text-blue-600" />
                                    Scope Definition
                                </Label>
                                <div className="flex gap-2">
                                    <Input
                                        placeholder="Add domain, IP range, or URL (e.g., 192.168.1.0/24)"
                                        value={scopeInput}
                                        onChange={(e) => setScopeInput(e.target.value)}
                                        onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addScopeItem())}
                                    />
                                    <Button type="button" onClick={addScopeItem} variant="outline">Add</Button>
                                </div>
                                <div className="flex flex-wrap gap-2 min-h-[60px] p-3 border rounded-md bg-muted/30">
                                    {formData.scope.length === 0 && (
                                        <span className="text-sm text-muted-foreground italic">No scope items added yet</span>
                                    )}
                                    {formData.scope.map((item) => (
                                        <Badge key={item} variant="secondary" className="gap-1 pl-2 pr-1 py-1">
                                            {item}
                                            <button onClick={() => removeScopeItem(item)} className="hover:bg-secondary/80 rounded-full p-0.5">
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Methodology</Label>
                                <Select
                                    value={formData.methodology}
                                    onValueChange={(value) => updateField('methodology', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="PTES (Penetration Testing Execution Standard)">PTES (Penetration Testing Execution Standard)</SelectItem>
                                        <SelectItem value="OWASP Testing Guide v4">OWASP Testing Guide v4</SelectItem>
                                        <SelectItem value="NIST SP 800-115">NIST SP 800-115</SelectItem>
                                        <SelectItem value="OSSTMM">OSSTMM</SelectItem>
                                        <SelectItem value="Custom Methodology">Custom Methodology</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Shield className="w-4 h-4 text-green-600" />
                                    Compliance Requirements
                                </Label>
                                <div className="grid grid-cols-2 gap-2">
                                    {['PCI-DSS', 'SOC2', 'HIPAA', 'GDPR', 'ISO 27001', 'FedRAMP'].map((framework) => (
                                        <div
                                            key={framework}
                                            onClick={() => toggleCompliance(framework)}
                                            className={cn(
                                                "flex items-center gap-2 p-2 rounded-md border cursor-pointer transition-colors",
                                                formData.complianceFrameworks.includes(framework)
                                                    ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-4 h-4 rounded border flex items-center justify-center",
                                                formData.complianceFrameworks.includes(framework)
                                                    ? "bg-blue-500 border-blue-500"
                                                    : "border-gray-400"
                                            )}>
                                                {formData.complianceFrameworks.includes(framework) && <CheckCircle2 className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-sm font-medium">{framework}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Timeline & Priority */}
                    {step === 3 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2 flex flex-col">
                                    <Label>Start Date <span className="text-red-500">*</span></Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !formData.startDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formData.startDate ? format(formData.startDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formData.startDate}
                                                onSelect={(date) => updateField('startDate', date)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>

                                <div className="space-y-2 flex flex-col">
                                    <Label>End Date <span className="text-red-500">*</span></Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !formData.endDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formData.endDate ? format(formData.endDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formData.endDate}
                                                onSelect={(date) => updateField('endDate', date)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Priority Level</Label>
                                <div className="grid grid-cols-4 gap-2">
                                    {['Low', 'Medium', 'High', 'Critical'].map((p) => (
                                        <button
                                            key={p}
                                            type="button"
                                            onClick={() => updateField('priority', p)}
                                            className={cn(
                                                "py-2 px-3 rounded-md border text-sm font-medium transition-all",
                                                formData.priority === p
                                                    ? p === 'Critical' ? "bg-red-100 border-red-500 text-red-700"
                                                        : p === 'High' ? "bg-orange-100 border-orange-500 text-orange-700"
                                                            : p === 'Medium' ? "bg-yellow-100 border-yellow-500 text-yellow-700"
                                                                : "bg-green-100 border-green-500 text-green-700"
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            {p}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Initial Status</Label>
                                <div className="grid grid-cols-3 gap-2">
                                    {['Planning', 'In Progress', 'On Hold'].map((s) => (
                                        <button
                                            key={s}
                                            type="button"
                                            onClick={() => updateField('status', s)}
                                            className={cn(
                                                "py-2 px-3 rounded-md border text-sm font-medium transition-all",
                                                formData.status === s
                                                    ? "bg-blue-50 border-blue-500 text-blue-700 dark:bg-blue-900/20"
                                                    : "hover:bg-muted"
                                            )}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Step 4: Team Assignment */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <div className="space-y-2">
                                <Label>Lead Tester</Label>
                                <Select
                                    value={formData.leadTester}
                                    onValueChange={(value) => updateField('leadTester', value)}
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="Select lead tester..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {availableTeamMembers.map((member) => (
                                            <SelectItem key={member.id} value={member.name}>
                                                {member.name} ({member.role})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="space-y-2">
                                <Label className="flex items-center gap-2">
                                    <Users className="w-4 h-4 text-purple-600" />
                                    Assign Team Members
                                </Label>
                                <div className="border rounded-md divide-y">
                                    {availableTeamMembers.map((member) => (
                                        <div
                                            key={member.id}
                                            className={cn(
                                                "flex items-center justify-between p-3 cursor-pointer transition-colors",
                                                formData.teamMembers.includes(member.id) ? "bg-blue-50 dark:bg-blue-900/10" : "hover:bg-muted/50"
                                            )}
                                            onClick={() => {
                                                if (formData.teamMembers.includes(member.id)) {
                                                    updateField('teamMembers', formData.teamMembers.filter(id => id !== member.id))
                                                } else {
                                                    updateField('teamMembers', [...formData.teamMembers, member.id])
                                                }
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-xs font-bold">
                                                    {member.name.split(' ').map(n => n[0]).join('')}
                                                </div>
                                                <div>
                                                    <p className="text-sm font-medium">{member.name}</p>
                                                    <p className="text-xs text-muted-foreground">{member.role}</p>
                                                </div>
                                            </div>
                                            <div className={cn(
                                                "w-5 h-5 rounded border flex items-center justify-center",
                                                formData.teamMembers.includes(member.id)
                                                    ? "bg-blue-600 border-blue-600"
                                                    : "border-gray-300"
                                            )}>
                                                {formData.teamMembers.includes(member.id) && <CheckCircle2 className="w-3.5 h-3.5 text-white" />}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between items-center sm:justify-between mt-6">
                    <div className="flex gap-2">
                        {step > 1 && (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={handleBack}
                            >
                                <ChevronLeft className="h-4 w-4 mr-1" />
                                Back
                            </Button>
                        )}
                    </div>

                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => onOpenChange(false)}
                        >
                            Cancel
                        </Button>

                        {step < totalSteps ? (
                            <Button
                                type="button"
                                onClick={handleNext}
                                disabled={
                                    (step === 1 && (!formData.name || !formData.clientId)) ||
                                    (step === 3 && (!formData.startDate || !formData.endDate))
                                }
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                className="bg-blue-600 hover:bg-blue-700"
                            >
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                {editingProject ? 'Update Project' : 'Create Project'}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
