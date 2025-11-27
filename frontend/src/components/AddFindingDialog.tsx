import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Editor } from '@/components/editor/Editor'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

interface AddFindingDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onFindingAdded: (finding: any) => void
}

export function AddFindingDialog({ open, onOpenChange, onFindingAdded }: AddFindingDialogProps) {
    const [formData, setFormData] = useState({
        title: '',
        severity: 'Medium',
        category: 'Web',
        description: '',
        remediation: '',
        evidence: '',
        owasp_reference: '',
        cvss_vector: ''
    })

    // Reset form when dialog opens
    useEffect(() => {
        if (open) {
            setFormData({
                title: '',
                severity: 'Medium',
                category: 'Web',
                description: '',
                remediation: '',
                evidence: '',
                owasp_reference: '',
                cvss_vector: ''
            })
        }
    }, [open])

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()

        const newFinding = {
            id: `custom-${Date.now()}`,
            ...formData
        }

        onFindingAdded(newFinding)
        onOpenChange(false)
    }

    // Refined Input styles - Technical Look
    const inputStyle = "h-9 bg-zinc-900/50 border-zinc-800 text-zinc-300 text-sm focus-visible:ring-1 focus-visible:ring-zinc-600 focus-visible:border-zinc-500 placeholder:text-zinc-600 focus-visible:ring-offset-0"
    const labelStyle = "text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1.5 block"

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[90vh] flex flex-col gap-0 p-0 bg-zinc-950 border-zinc-800 overflow-hidden [&>button]:hidden">
                {/* Header - Fixed */}
                <div className="px-8 py-6 border-b border-zinc-800 bg-zinc-900/30 shrink-0">
                    <DialogHeader className="mb-6">
                        <DialogTitle className="text-xl text-zinc-100 font-semibold">Add Custom Finding</DialogTitle>
                        <DialogDescription className="text-zinc-400">
                            Create a new vulnerability template for your findings database.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-6">
                        {/* Title Row */}
                        <div>
                            <label className={labelStyle}>Title</label>
                            <Input
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                placeholder="e.g. Broken Access Control"
                                className={cn(inputStyle, "text-base font-medium")}
                                autoFocus
                            />
                        </div>

                        {/* Metadata Grid */}
                        <div className="grid grid-cols-2 gap-8">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyle}>Severity</label>
                                    <Select
                                        value={formData.severity}
                                        onValueChange={(value) => setFormData({ ...formData, severity: value })}
                                    >
                                        <SelectTrigger className={inputStyle}>
                                            <SelectValue placeholder="Select severity" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                                            <SelectItem value="Critical">Critical</SelectItem>
                                            <SelectItem value="High">High</SelectItem>
                                            <SelectItem value="Medium">Medium</SelectItem>
                                            <SelectItem value="Low">Low</SelectItem>
                                            <SelectItem value="Info">Info</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div>
                                    <label className={labelStyle}>Category</label>
                                    <Select
                                        value={formData.category}
                                        onValueChange={(value) => setFormData({ ...formData, category: value })}
                                    >
                                        <SelectTrigger className={inputStyle}>
                                            <SelectValue placeholder="Select category" />
                                        </SelectTrigger>
                                        <SelectContent className="bg-zinc-900 border-zinc-800 text-zinc-300">
                                            <SelectItem value="Web">Web</SelectItem>
                                            <SelectItem value="Mobile">Mobile</SelectItem>
                                            <SelectItem value="Network">Network</SelectItem>
                                            <SelectItem value="Cloud">Cloud</SelectItem>
                                            <SelectItem value="Database">Database</SelectItem>
                                            <SelectItem value="Other">Other</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className={labelStyle}>OWASP Reference</label>
                                    <Input
                                        value={formData.owasp_reference}
                                        onChange={(e) => setFormData({ ...formData, owasp_reference: e.target.value })}
                                        placeholder="e.g. A01:2021"
                                        className={cn(inputStyle, "font-mono text-xs")}
                                    />
                                </div>
                                <div>
                                    <label className={labelStyle}>CVSS Vector</label>
                                    <Input
                                        value={formData.cvss_vector}
                                        onChange={(e) => setFormData({ ...formData, cvss_vector: e.target.value })}
                                        placeholder="CVSS:3.1/..."
                                        className={cn(inputStyle, "font-mono text-xs tracking-tight")}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                
                {/* Content Area - Scrollable with Custom Scrollbar */}
                <div className="flex-1 overflow-y-auto px-8 py-8 bg-zinc-950/50 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                    <div className="max-w-3xl mx-auto space-y-10">
                        {/* Description */}
                        <section className="space-y-3">
                            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                Description <span className="text-red-500">*</span>
                            </h3>
                            <Editor
                                content={formData.description}
                                onChange={(html) => setFormData({ ...formData, description: html })}
                                placeholder="Detailed description of the vulnerability..."
                                className="min-h-[200px] bg-transparent border-zinc-800/50"
                            />
                        </section>

                        {/* Remediation */}
                        <section className="space-y-3">
                            <h3 className="text-sm font-medium text-zinc-400 flex items-center gap-2">
                                Remediation <span className="text-red-500">*</span>
                            </h3>
                            <Editor
                                content={formData.remediation}
                                onChange={(html) => setFormData({ ...formData, remediation: html })}
                                placeholder="Steps to fix or mitigate the issue..."
                                className="min-h-[150px] bg-transparent border-zinc-800/50"
                            />
                        </section>

                        {/* Proof of Concept & Evidence */}
                        <section className="space-y-3">
                            <h3 className="text-sm font-medium text-zinc-400">Proof of Concept & Evidence</h3>
                            <div className="text-xs text-zinc-500 mb-2">
                                Optional: Add generic screenshots or code snippets for this template.
                            </div>
                            <Editor
                                content={formData.evidence}
                                onChange={(html) => setFormData({ ...formData, evidence: html })}
                                placeholder="Proof of concept..."
                                variant="evidence"
                                className="min-h-[200px] bg-transparent border-zinc-800/50"
                            />
                        </section>
                    </div>
                </div>

                {/* Footer - Fixed */}
                <div className="px-8 py-5 border-t border-zinc-800 bg-zinc-900/30 shrink-0 flex justify-end gap-3">
                    <Button 
                        type="button" 
                        variant="ghost" 
                        onClick={() => onOpenChange(false)}
                        className="text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                    >
                        Cancel
                    </Button>
                    <Button 
                        onClick={handleSubmit}
                        disabled={!formData.title || !formData.description}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white font-medium px-6"
                    >
                        Add Finding
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
