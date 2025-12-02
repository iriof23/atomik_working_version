import React, { useState, useEffect } from 'react'
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
import { Badge } from '@/components/ui/badge'
import {
    Building2,
    User,
    Mail,
    Phone,
    Tag,
    Shield,
    Briefcase,
    CheckCircle2,
    ChevronRight,
    ChevronLeft,
    X,
    Loader2
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'

interface AddClientDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onClientAdded?: (client: any) => void
    editingClient?: any
}

export function AddClientDialog({ open, onOpenChange, onClientAdded, editingClient }: AddClientDialogProps) {
    const { getToken } = useAuth()
    const { toast } = useToast()
    const [step, setStep] = useState(1)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [formData, setFormData] = useState({
        // Basic Info
        name: '',
        industry: '',
        companySize: 'SMB' as 'Enterprise' | 'SMB' | 'Startup',
        logoUrl: '',

        // Contact Info
        primaryContact: '',
        email: '',
        phone: '',

        // Classification
        status: 'Prospect' as 'Active' | 'Inactive' | 'Prospect' | 'Archived',
        riskLevel: 'Medium' as 'High' | 'Medium' | 'Low',
        tags: [] as string[],

        // Additional
        notes: ''
    })

    const [tagInput, setTagInput] = useState('')

    // Populate form when editing
    useEffect(() => {
        if (editingClient && open) {
            setFormData({
                name: editingClient.name || '',
                industry: editingClient.industry || '',
                companySize: editingClient.companySize || 'SMB',
                logoUrl: editingClient.logoUrl || '',
                primaryContact: editingClient.primaryContact || '',
                email: editingClient.email || '',
                phone: editingClient.phone || '',
                status: editingClient.status || 'Prospect',
                riskLevel: editingClient.riskLevel || 'Medium',
                tags: editingClient.tags || [],
                notes: editingClient.notes || ''
            })
        } else if (!editingClient && open) {
            // Reset form when adding new client
            setFormData({
                name: '',
                industry: '',
                companySize: 'SMB',
                logoUrl: '',
                primaryContact: '',
                email: '',
                phone: '',
                status: 'Prospect',
                riskLevel: 'Medium',
                tags: [],
                notes: ''
            })
        }
    }, [editingClient, open])

    const totalSteps = 3

    const updateField = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }))
    }

    const addTag = () => {
        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
            updateField('tags', [...formData.tags, tagInput.trim()])
            setTagInput('')
        }
    }

    const removeTag = (tag: string) => {
        updateField('tags', formData.tags.filter(t => t !== tag))
    }

    const handleNext = () => {
        if (step < totalSteps) setStep(step + 1)
    }

    const handleBack = () => {
        if (step > 1) setStep(step - 1)
    }

    const handleSubmit = async () => {
        if (isSubmitting) return
        setIsSubmitting(true)

        try {
            const token = await getToken()
            if (!token) {
                toast({
                    title: 'Error',
                    description: 'Authentication token not available.',
                    variant: 'destructive',
                })
                return
            }

            // Map form data to API expected format (snake_case)
            // Only include fields with actual values to avoid validation issues
            const payload: Record<string, string> = {
                name: formData.name.trim(),
            }
            
            if (formData.primaryContact?.trim()) {
                payload.contact_name = formData.primaryContact.trim()
            }
            if (formData.email?.trim()) {
                payload.contact_email = formData.email.trim()
            }
            if (formData.phone?.trim()) {
                payload.contact_phone = formData.phone.trim()
            }

            console.log('Creating client with payload:', payload)

            let clientData
            if (editingClient) {
                // Update existing client
                const response = await api.put(`/clients/${editingClient.id}`, payload, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                clientData = response.data
                toast({
                    title: 'Client Updated',
                    description: `${clientData.name} has been updated successfully.`,
                })
            } else {
                // Create new client
                const response = await api.post('/clients/', payload, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                clientData = response.data
                toast({
                    title: 'Client Created',
                    description: `${clientData.name} has been created successfully.`,
                })
            }

            console.log('API response:', clientData)

            // Map API response back to frontend format for the callback
            const frontendClientData = {
                id: clientData.id,
                name: clientData.name,
                logoUrl: formData.logoUrl || '',
                status: formData.status,
                riskLevel: formData.riskLevel,
                industry: formData.industry,
                companySize: formData.companySize,
                primaryContact: clientData.contact_name || formData.primaryContact,
                email: clientData.contact_email || formData.email,
                phone: clientData.contact_phone || formData.phone,
                tags: formData.tags,
            lastActivity: 'Just now',
            lastActivityDate: new Date(),
            projectsCount: 0,
            reportsCount: 0,
            totalFindings: 0,
                findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
                createdAt: new Date(clientData.created_at),
                updatedAt: new Date(clientData.updated_at),
        }

            onClientAdded?.(frontendClientData)
        onOpenChange(false)

        // Reset form
        setStep(1)
        setFormData({
            name: '',
            industry: '',
            companySize: 'SMB',
            logoUrl: '',
            primaryContact: '',
            email: '',
            phone: '',
            status: 'Prospect',
            riskLevel: 'Medium',
            tags: [],
            notes: ''
        })
        } catch (error: any) {
            console.error('Failed to create/update client:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to save client. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px] max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold flex items-center gap-2">
                        <Building2 className="h-5 w-5 text-primary" />
                        {editingClient ? 'Edit Client' : 'Add Client'}
                    </DialogTitle>
                    <DialogDescription>
                        Create a new client organization to start tracking pentesting projects
                    </DialogDescription>
                </DialogHeader>

                {/* Progress Indicator */}
                <div className="flex items-center justify-between mb-6">
                    {[1, 2, 3].map((s) => (
                        <React.Fragment key={s}>
                            <div className="flex flex-col items-center">
                                <div
                                    className={cn(
                                        "w-12 h-12 rounded-full flex items-center justify-center font-semibold transition-all",
                                        step >= s
                                            ? "bg-primary text-white"
                                            : "bg-gray-200 dark:bg-gray-700 text-gray-500"
                                    )}
                                >
                                    {step > s ? <CheckCircle2 className="h-5 w-5" /> : s}
                                </div>
                                <span className={cn(
                                    "text-xs mt-2 font-medium whitespace-nowrap",
                                    step >= s ? "text-primary" : "text-gray-500"
                                )}>
                                    {s === 1 && "Basic Info"}
                                    {s === 2 && "Contact"}
                                    {s === 3 && "Classification"}
                                </span>
                            </div>
                            {s < totalSteps && (
                                <div className={cn(
                                    "h-1 flex-1 mx-4 rounded transition-all",
                                    step > s ? "bg-primary" : "bg-gray-200 dark:bg-gray-700"
                                )} />
                            )}
                        </React.Fragment>
                    ))}
                </div>

                {/* Step 1: Basic Information */}
                {step === 1 && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="name" className="flex items-center gap-2">
                                <Building2 className="h-4 w-4 text-blue-600" />
                                Company Name <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="name"
                                placeholder="e.g., Acme Corporation"
                                value={formData.name}
                                onChange={(e) => updateField('name', e.target.value)}
                                className="text-lg"
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="industry">Industry</Label>
                                <Input
                                    id="industry"
                                    placeholder="e.g., Financial Services"
                                    value={formData.industry}
                                    onChange={(e) => updateField('industry', e.target.value)}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="companySize">Company Size</Label>
                                <select
                                    id="companySize"
                                    value={formData.companySize}
                                    onChange={(e) => updateField('companySize', e.target.value)}
                                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                                >
                                    <option value="Startup">Startup (1-50)</option>
                                    <option value="SMB">SMB (51-500)</option>
                                    <option value="Enterprise">Enterprise (500+)</option>
                                </select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="logoUrl" className="flex items-center gap-2">
                                Client URL (optional)
                            </Label>
                            <Input
                                id="logoUrl"
                                placeholder="https://client-company.com"
                                value={formData.logoUrl}
                                onChange={(e) => updateField('logoUrl', e.target.value)}
                            />
                            <p className="text-xs text-muted-foreground">
                                Enter the client’s website URL
                            </p>
                        </div>
                    </div>
                )}

                {/* Step 2: Contact Information */}
                {step === 2 && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="primaryContact" className="flex items-center gap-2">
                                <User className="h-4 w-4 text-green-600" />
                                Primary Contact <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="primaryContact"
                                placeholder="e.g., John Smith"
                                value={formData.primaryContact}
                                onChange={(e) => updateField('primaryContact', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="email" className="flex items-center gap-2">
                                <Mail className="h-4 w-4 text-blue-600" />
                                Email Address <span className="text-red-500">*</span>
                            </Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john@company.com"
                                value={formData.email}
                                onChange={(e) => updateField('email', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="phone" className="flex items-center gap-2">
                                <Phone className="h-4 w-4 text-purple-600" />
                                Phone Number
                            </Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+1 (555) 123-4567"
                                value={formData.phone}
                                onChange={(e) => updateField('phone', e.target.value)}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes</Label>
                            <Textarea
                                id="notes"
                                placeholder="Additional information about the client..."
                                value={formData.notes}
                                onChange={(e) => updateField('notes', e.target.value)}
                                rows={4}
                            />
                        </div>
                    </div>
                )}

                {/* Step 3: Classification */}
                {step === 3 && (
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="status" className="flex items-center gap-2">
                                <Briefcase className="h-4 w-4 text-blue-600" />
                                Client Status
                            </Label>
                            <div className="grid grid-cols-2 gap-2">
                                {(['Prospect', 'Active', 'Inactive', 'Archived'] as const).map((status) => (
                                    <button
                                        key={status}
                                        type="button"
                                        onClick={() => updateField('status', status)}
                                        className={cn(
                                            "px-4 py-3 rounded-lg border-2 transition-all font-medium",
                                            formData.status === status
                                                ? "border-blue-600 bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300"
                                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                        )}
                                    >
                                        {status === 'Prospect' && '🔵 '}
                                        {status === 'Active' && '🟢 '}
                                        {status === 'Inactive' && '🟡 '}
                                        {status === 'Archived' && '⚫ '}
                                        {status}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="riskLevel" className="flex items-center gap-2">
                                <Shield className="h-4 w-4 text-orange-600" />
                                Risk Level
                            </Label>
                            <div className="grid grid-cols-3 gap-2">
                                {(['Low', 'Medium', 'High'] as const).map((risk) => (
                                    <button
                                        key={risk}
                                        type="button"
                                        onClick={() => updateField('riskLevel', risk)}
                                        className={cn(
                                            "px-4 py-3 rounded-lg border-2 transition-all font-medium",
                                            formData.riskLevel === risk
                                                ? risk === 'High'
                                                    ? "border-red-600 bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300"
                                                    : risk === 'Medium'
                                                        ? "border-yellow-600 bg-yellow-50 dark:bg-yellow-950 text-yellow-700 dark:text-yellow-300"
                                                        : "border-green-600 bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-300"
                                                : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                                        )}
                                    >
                                        {risk === 'High' && '🔴 '}
                                        {risk === 'Medium' && '🟡 '}
                                        {risk === 'Low' && '🟢 '}
                                        {risk}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="tags" className="flex items-center gap-2">
                                <Tag className="h-4 w-4 text-purple-600" />
                                Tags
                            </Label>
                            <div className="flex gap-2">
                                <Input
                                    id="tags"
                                    placeholder="Add a tag (e.g., PCI, SOC2)"
                                    value={tagInput}
                                    onChange={(e) => setTagInput(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                />
                                <Button type="button" onClick={addTag} variant="outline">
                                    Add
                                </Button>
                            </div>
                            {formData.tags.length > 0 && (
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {formData.tags.map((tag) => (
                                        <Badge
                                            key={tag}
                                            variant="secondary"
                                            className="gap-1 pl-2 pr-1 py-1"
                                        >
                                            #{tag}
                                            <button
                                                type="button"
                                                onClick={() => removeTag(tag)}
                                                className="hover:bg-secondary/80 rounded-full p-0.5"
                                            >
                                                <X className="h-3 w-3" />
                                            </button>
                                        </Badge>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

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
                                disabled={!formData.name}
                            >
                                Next
                                <ChevronRight className="h-4 w-4 ml-1" />
                            </Button>
                        ) : (
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={!formData.name || !formData.primaryContact || !formData.email || isSubmitting}
                                className="bg-primary hover:bg-primary/90"
                            >
                                {isSubmitting ? (
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                ) : (
                                <CheckCircle2 className="h-4 w-4 mr-2" />
                                )}
                                {isSubmitting ? 'Saving...' : (editingClient ? 'Update Client' : 'Create Client')}
                            </Button>
                        )}
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
