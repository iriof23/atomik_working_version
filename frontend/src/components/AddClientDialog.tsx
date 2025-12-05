import { useState, useEffect, KeyboardEvent } from 'react'
import { useAuth } from '@clerk/clerk-react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
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
} from "@/components/ui/select"
import {
    Building2,
    Mail,
    Phone,
    Tag,
    Check,
    X,
    Loader2,
    Globe,
    User,
} from 'lucide-react'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'

interface EditingClient {
    id: string
    name: string
    logoUrl?: string
    status?: 'Active' | 'Inactive' | 'Prospect' | 'Archived'
    serviceTier?: 'Standard' | 'Priority' | 'Strategic'
    riskLevel?: 'High' | 'Medium' | 'Low' | string
    industry?: string
    companySize?: 'Enterprise' | 'SMB' | 'Startup'
    primaryContact?: string
    email?: string
    phone?: string
    tags?: string[]
    notes?: string
}

interface CreatedClient {
    id: string
    name: string
    logoUrl: string
    status: 'Active' | 'Inactive' | 'Prospect' | 'Archived'
    serviceTier: 'Standard' | 'Priority' | 'Strategic'
    riskLevel: 'High' | 'Medium' | 'Low'
    industry: string
    companySize: 'Enterprise' | 'SMB' | 'Startup'
    primaryContact: string
    email: string
    phone: string
    tags: string[]
    notes: string
    lastActivity: string
    lastActivityDate: Date
    projectsCount: number
    reportsCount: number
    totalFindings: number
    findingsBySeverity: { critical: number; high: number; medium: number; low: number }
    createdAt: Date
    updatedAt: Date
}

interface AddClientDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onClientAdded?: (client: CreatedClient) => void
    editingClient?: EditingClient | null
}

interface FormData {
    name: string
    industry: string
    companySize: 'Enterprise' | 'SMB' | 'Startup'
    logoUrl: string
    primaryContact: string
    email: string
    phone: string
    status: 'Active' | 'Inactive' | 'Prospect' | 'Archived'
    serviceTier: 'Standard' | 'Priority' | 'Strategic'
    tags: string[]
    notes: string
}

const SUGGESTED_TAGS = ['PCI-DSS', 'SOC2', 'HIPAA', 'ISO27001', 'GDPR', 'Finance', 'Healthcare']

export function AddClientDialog({ open, onOpenChange, onClientAdded, editingClient }: AddClientDialogProps) {
    const { getToken } = useAuth()
    const { toast } = useToast()
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    const [formData, setFormData] = useState<FormData>({
        name: '',
        industry: '',
        companySize: 'SMB',
        logoUrl: '',
        primaryContact: '',
        email: '',
        phone: '',
        status: 'Prospect',
        serviceTier: 'Standard',
        tags: [],
        notes: ''
    })

    const [tagInput, setTagInput] = useState('')

    useEffect(() => {
        if (open) {
            if (editingClient) {
                setFormData({
                    name: editingClient.name || '',
                    industry: editingClient.industry || '',
                    companySize: editingClient.companySize || 'SMB',
                    logoUrl: editingClient.logoUrl || '',
                    primaryContact: editingClient.primaryContact || '',
                    email: editingClient.email || '',
                    phone: editingClient.phone || '',
                    status: editingClient.status || 'Prospect',
                    serviceTier: editingClient.serviceTier || (editingClient.riskLevel as FormData['serviceTier']) || 'Standard',
                    tags: editingClient.tags || [],
                    notes: editingClient.notes || ''
                })
            } else {
                setFormData({
                    name: '',
                    industry: '',
                    companySize: 'SMB',
                    logoUrl: '',
                    primaryContact: '',
                    email: '',
                    phone: '',
                    status: 'Prospect',
                    serviceTier: 'Standard',
                    tags: [],
                    notes: ''
                })
            }
            setTagInput('')
        }
    }, [editingClient, open])

    const updateField = <K extends keyof FormData>(field: K, value: FormData[K]) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            addTag()
        } else if (e.key === 'Backspace' && tagInput === '' && formData.tags.length > 0) {
            removeTag(formData.tags[formData.tags.length - 1])
        }
    }

    const addTag = (tagToAdd?: string) => {
        const tag = (tagToAdd || tagInput).trim().replace(/,/g, '')
        if (tag && !formData.tags.includes(tag)) {
            updateField('tags', [...formData.tags, tag])
            setTagInput('')
        }
    }

    const removeTag = (tag: string) => {
        updateField('tags', formData.tags.filter(t => t !== tag))
    }

    const handleSubmit = async () => {
        if (!formData.name.trim()) return
        
        setIsSubmitting(true)

        try {
            const token = await getToken()
            if (!token) {
                toast({ title: 'Error', description: 'Authentication required. Please sign in again.', variant: 'destructive' })
                return
            }

            const payload: Record<string, string> = {
                name: formData.name.trim(),
            }
            
            if (formData.primaryContact?.trim()) {
                payload.contact_name = formData.primaryContact.trim()
            }
            if (formData.email?.trim()) {
                // Normalize email: trim and lowercase
                const email = formData.email.trim().toLowerCase()
                // Only send if it looks like a valid email
                if (email.includes('@') && email.includes('.')) {
                    payload.contact_email = email
                }
            }
            if (formData.phone?.trim()) {
                // Normalize phone: keep only digits and common phone characters
                const phone = formData.phone.trim().replace(/[^\d+\-().\s]/g, '')
                if (phone) {
                    payload.contact_phone = phone
                }
            }
            if (formData.industry?.trim()) {
                payload.industry = formData.industry.trim()
            }
            if (formData.companySize) {
                payload.company_size = formData.companySize
            }
            if (formData.logoUrl?.trim()) {
                let websiteUrl = formData.logoUrl.trim()
                // Auto-prepend https:// if no protocol specified
                if (websiteUrl && !websiteUrl.match(/^https?:\/\//i)) {
                    websiteUrl = `https://${websiteUrl}`
                }
                payload.website_url = websiteUrl
            }
            if (formData.status) {
                payload.status = formData.status
            }
            // Map service tier to risk level for backend
            const riskLevelMap: Record<string, string> = {
                'Standard': 'Medium',
                'Priority': 'High', 
                'Strategic': 'Low'
            }
            payload.risk_level = riskLevelMap[formData.serviceTier] || 'Medium'
            if (formData.tags.length > 0) {
                payload.tags = JSON.stringify(formData.tags)
            }
            if (formData.notes?.trim()) {
                payload.notes = formData.notes.trim()
            }

            let clientData: { id: string; name: string; contact_name?: string; contact_email?: string; contact_phone?: string; created_at?: string; updated_at?: string }
            
            if (editingClient) {
                const response = await api.put(`/clients/${editingClient.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                clientData = response.data
                toast({ title: 'Client Updated', description: `${clientData.name} updated.` })
            } else {
                const response = await api.post('/clients/', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                clientData = response.data
                toast({ title: 'Client Created', description: `${clientData.name} created.` })
            }

            // Validate response has required fields
            if (!clientData?.id || !clientData?.name) {
                throw new Error('Invalid response from server')
            }

            const now = new Date()
            const riskLevelFromTier: Record<string, 'High' | 'Medium' | 'Low'> = {
                'Standard': 'Medium',
                'Priority': 'High',
                'Strategic': 'Low'
            }
            
            // Parse dates safely
            let createdAt = now
            let updatedAt = now
            try {
                if (clientData.created_at) {
                    createdAt = new Date(clientData.created_at)
                    if (isNaN(createdAt.getTime())) createdAt = now
                }
                if (clientData.updated_at) {
                    updatedAt = new Date(clientData.updated_at)
                    if (isNaN(updatedAt.getTime())) updatedAt = now
                }
            } catch {
                // Keep default dates
            }

            const frontendClientData: CreatedClient = {
                id: clientData.id,
                name: clientData.name,
                logoUrl: formData.logoUrl || '',
                status: formData.status,
                serviceTier: formData.serviceTier,
                riskLevel: riskLevelFromTier[formData.serviceTier] || 'Medium',
                industry: formData.industry || '',
                companySize: formData.companySize,
                primaryContact: clientData.contact_name || formData.primaryContact || '',
                email: clientData.contact_email || formData.email || '',
                phone: clientData.contact_phone || formData.phone || '',
                tags: formData.tags || [],
                notes: formData.notes || '',
                lastActivity: 'Just now',
                lastActivityDate: now,
                projectsCount: 0,
                reportsCount: 0,
                totalFindings: 0,
                findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                createdAt,
                updatedAt,
            }

            onClientAdded?.(frontendClientData)
            onOpenChange(false)

        } catch (error: unknown) {
            console.error('Client save error:', error)
            let errorMessage = 'Failed to save client.'
            
            try {
                const apiError = error as { response?: { data?: { detail?: string | Array<{ msg: string; loc?: string[] }> } }, message?: string }
                const detail = apiError.response?.data?.detail
                
                if (detail) {
                    if (typeof detail === 'string') {
                        // Simple string error
                        errorMessage = detail
                    } else if (Array.isArray(detail)) {
                        // Pydantic validation errors - extract messages
                        errorMessage = detail.map(err => err.msg).join(', ')
                    }
                } else if (apiError.message) {
                    errorMessage = apiError.message
                }
            } catch {
                // Keep default error message
            }
            
            toast({
                title: 'Error',
                description: errorMessage,
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px] p-0 gap-0 overflow-hidden bg-white border-slate-200 rounded-xl shadow-2xl">
                <DialogHeader className="px-6 py-4 border-b border-slate-100 bg-slate-50/50">
                    <DialogTitle className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                        <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                            <Building2 className="h-5 w-5" />
                        </div>
                        {editingClient ? 'Edit Client' : 'New Client'}
                    </DialogTitle>
                    <DialogDescription>
                        Enter the organization details below.
                    </DialogDescription>
                </DialogHeader>

                <div className="p-6 space-y-6">
                    {/* Section 1: Core Identity */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2 space-y-1.5">
                            <Label htmlFor="name" className="text-xs font-medium text-slate-500 uppercase">
                                Company Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="Acme Corp"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                className="h-9"
                                autoFocus
                            />
                        </div>
                        
                        <div className="space-y-1.5">
                            <Label htmlFor="website" className="text-xs font-medium text-slate-500 uppercase">Website</Label>
                            <div className="relative">
                                <Globe className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    id="website"
                                    placeholder="https://acme.com"
                                    value={formData.logoUrl}
                                    onChange={(e) => updateField('logoUrl', e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="industry" className="text-xs font-medium text-slate-500 uppercase">Industry</Label>
                            <Input
                                id="industry"
                                placeholder="e.g. FinTech"
                                value={formData.industry}
                                onChange={(e) => updateField('industry', e.target.value)}
                                className="h-9"
                            />
                        </div>
                    </div>

                    {/* Section 2: Contact & Classification */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <Label htmlFor="contact" className="text-xs font-medium text-slate-500 uppercase">Primary Contact</Label>
                            <div className="relative">
                                <User className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    id="contact"
                                    placeholder="John Doe"
                                    value={formData.primaryContact}
                                    onChange={(e) => updateField('primaryContact', e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="email" className="text-xs font-medium text-slate-500 uppercase">Email</Label>
                            <div className="relative">
                                <Mail className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    id="email"
                                    placeholder="john@acme.com"
                                    value={formData.email}
                                    onChange={(e) => updateField('email', e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="phone" className="text-xs font-medium text-slate-500 uppercase">Phone</Label>
                            <div className="relative">
                                <Phone className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                                <Input
                                    id="phone"
                                    placeholder="+1 (555) 123-4567"
                                    value={formData.phone}
                                    onChange={(e) => updateField('phone', e.target.value)}
                                    className="pl-9 h-9"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="size" className="text-xs font-medium text-slate-500 uppercase">Company Size</Label>
                            <Select 
                                value={formData.companySize} 
                                onValueChange={(val: FormData['companySize']) => updateField('companySize', val)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Startup">Startup (1-50)</SelectItem>
                                    <SelectItem value="SMB">SMB (51-500)</SelectItem>
                                    <SelectItem value="Enterprise">Enterprise (500+)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="status" className="text-xs font-medium text-slate-500 uppercase">Status</Label>
                            <Select 
                                value={formData.status} 
                                onValueChange={(val: FormData['status']) => updateField('status', val)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Prospect">Prospect</SelectItem>
                                    <SelectItem value="Active">Active</SelectItem>
                                    <SelectItem value="Inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="tier" className="text-xs font-medium text-slate-500 uppercase">Service Tier</Label>
                            <Select 
                                value={formData.serviceTier} 
                                onValueChange={(val: FormData['serviceTier']) => updateField('serviceTier', val)}
                            >
                                <SelectTrigger className="h-9">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="Standard">Standard</SelectItem>
                                    <SelectItem value="Priority">Priority</SelectItem>
                                    <SelectItem value="Strategic">Strategic</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Section 3: Tags & Notes */}
                    <div className="space-y-3">
                        <div className="space-y-1.5">
                            <Label className="text-xs font-medium text-slate-500 uppercase flex items-center gap-1.5">
                                <Tag className="h-3 w-3" />
                                Tags
                            </Label>
                            <div className="flex flex-wrap gap-1.5 p-2 rounded-md border border-slate-200 bg-white focus-within:border-emerald-500 focus-within:ring-1 focus-within:ring-emerald-500">
                                {formData.tags.map(tag => (
                                    <span key={tag} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-emerald-100 text-emerald-700">
                                        {tag}
                                        <button type="button" onClick={() => removeTag(tag)} className="hover:text-emerald-900"><X className="h-3 w-3" /></button>
                                    </span>
                                ))}
                                <input
                                    className="flex-1 bg-transparent text-sm outline-none min-w-[60px] placeholder:text-slate-400"
                                    placeholder={formData.tags.length ? "" : "Add tags..."}
                                    value={tagInput}
                                    onChange={e => setTagInput(e.target.value)}
                                    onKeyDown={handleTagKeyDown}
                                    onBlur={() => { if (tagInput.trim()) addTag() }}
                                />
                            </div>
                            <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                                {SUGGESTED_TAGS.filter(t => !formData.tags.includes(t)).slice(0, 5).map(tag => (
                                    <button
                                        key={tag}
                                        type="button"
                                        onClick={() => addTag(tag)}
                                        className="text-[10px] px-2 py-0.5 rounded-full border border-slate-200 text-slate-500 hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-600 transition-colors whitespace-nowrap"
                                    >
                                        + {tag}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="notes" className="text-xs font-medium text-slate-500 uppercase">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Any additional context..."
                                value={formData.notes}
                                onChange={(e) => updateField('notes', e.target.value)}
                                className="h-16 resize-none"
                            />
                        </div>
                    </div>
                </div>

                <DialogFooter className="px-6 py-4 bg-slate-50 border-t border-slate-100">
                    <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit} 
                        disabled={isSubmitting || !formData.name.trim()}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white min-w-[100px]"
                    >
                        {isSubmitting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <>
                                <Check className="h-4 w-4 mr-1.5" />
                                {editingClient ? 'Save Changes' : 'Create Client'}
                            </>
                        )}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
