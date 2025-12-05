import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
} from "@/components/ui/dialog"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
import { Shield, X, AlertTriangle, Flame, AlertCircle, Info, FileText, Wrench, Camera } from 'lucide-react'
import CVSSCalculator from './CVSSCalculator'

interface AddFindingDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onFindingAdded: (finding: any) => void
}

const severityConfig = {
    Critical: { icon: AlertTriangle, color: 'text-white', bg: 'bg-gradient-to-r from-red-600 to-red-700', border: 'border-0' },
    High: { icon: Flame, color: 'text-white', bg: 'bg-gradient-to-r from-orange-500 to-orange-600', border: 'border-0' },
    Medium: { icon: AlertCircle, color: 'text-white', bg: 'bg-gradient-to-r from-amber-500 to-amber-600', border: 'border-0' },
    Low: { icon: Info, color: 'text-white', bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', border: 'border-0' },
    Info: { icon: Info, color: 'text-white', bg: 'bg-gradient-to-r from-slate-500 to-slate-600', border: 'border-0' },
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
    const [isDirty, setIsDirty] = useState(false)
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)

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
            setIsDirty(false)
        }
    }, [open])

    const handleFormChange = (updates: Partial<typeof formData>) => {
        setFormData(prev => ({ ...prev, ...updates }))
        setIsDirty(true)
    }

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault()
        const newFinding = {
            id: `custom-${Date.now()}`,
            ...formData
        }
        onFindingAdded(newFinding)
        setIsDirty(false)
        onOpenChange(false)
    }

    const handleClose = () => {
        if (isDirty) {
            setShowUnsavedDialog(true)
        } else {
            onOpenChange(false)
        }
    }

    const handleDiscardChanges = () => {
        setShowUnsavedDialog(false)
        setIsDirty(false)
        onOpenChange(false)
    }

    const currentSeverity = severityConfig[formData.severity as keyof typeof severityConfig] || severityConfig.Medium

    return (
        <Dialog open={open} onOpenChange={(opening) => !opening && handleClose()}>
            <DialogContent 
                className="max-w-[90vw] w-full h-[90vh] p-0 gap-0 bg-white border-slate-200 shadow-2xl flex flex-col overflow-hidden [&>button]:hidden sm:rounded-2xl"
                onInteractOutside={(e) => {
                    if (isDirty) {
                        e.preventDefault()
                        setShowUnsavedDialog(true)
                    }
                }}
                onEscapeKeyDown={(e) => {
                    if (isDirty) {
                        e.preventDefault()
                        setShowUnsavedDialog(true)
                    }
                }}
                onOpenAutoFocus={(e) => e.preventDefault()}
            >
                {/* Premium Header - Matching System Library */}
                <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white shrink-0">
                    <div className="px-6 py-4 grid grid-cols-[auto_1fr_auto] items-center gap-4">
                        {/* Gradient Shield Icon */}
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                            <Shield className="w-6 h-6 text-white" />
                        </div>
                        
                        {/* Title and Metadata */}
                        <div className="min-w-0">
                            <Input 
                                value={formData.title} 
                                onChange={(e) => handleFormChange({ title: e.target.value })}
                                placeholder="Enter finding title..."
                                className="font-bold text-xl border-none px-0 h-8 focus-visible:ring-0 bg-transparent text-slate-900 placeholder:text-slate-400 shadow-none w-full"
                                autoFocus
                            />
                            
                            {/* Metadata Pills */}
                            <div className="flex items-center gap-2 text-xs mt-1.5 flex-wrap">
                                <span className={cn(
                                    'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border',
                                    currentSeverity.bg, currentSeverity.color, currentSeverity.border
                                )}>
                                    {(() => {
                                        const Icon = currentSeverity.icon
                                        return <Icon className="w-3 h-3" />
                                    })()}
                                    {formData.severity}
                                </span>
                                <span className="text-slate-300">•</span>
                                <span className="text-[11px] text-slate-500">
                                    {formData.category}
                                </span>
                                {formData.owasp_reference && (
                                    <>
                                        <span className="text-slate-300">•</span>
                                        <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">
                                            {formData.owasp_reference}
                                        </span>
                                    </>
                                )}
                                {isDirty && (
                                    <>
                                        <span className="text-slate-300">•</span>
                                        <span className="text-amber-600 font-medium flex items-center gap-1 text-[11px]">
                                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                            Unsaved changes
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                        
                        {/* Actions */}
                        <div className="flex items-center gap-2">
                            <Button variant="ghost" size="sm" onClick={handleClose} className="text-slate-500 hover:text-slate-900 text-xs">
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleSubmit}
                                size="sm"
                                disabled={!formData.title || !formData.description}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-4 shadow-sm disabled:opacity-50 gap-1.5"
                            >
                                <Shield className="w-3.5 h-3.5 shrink-0" />
                                <span>Save</span>
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Body Layout - Matching System Library */}
                <div className="flex-1 min-h-0 flex bg-slate-50/50">
                    {/* Sidebar (Metadata) - Centered panel design */}
                    <div className="w-[340px] shrink-0 overflow-y-auto scrollbar-thin">
                        <div className="m-6 mr-3 p-6 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-6">
                            
                            {/* Classification */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Classification
                                </h4>
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 mb-1.5 block">Severity</label>
                                        <Select
                                            value={formData.severity}
                                            onValueChange={(value) => handleFormChange({ severity: value })}
                                        >
                                            <SelectTrigger className="h-9 bg-white text-sm font-medium border-slate-200 !text-slate-900 [&>span]:!text-slate-900">
                                                <SelectValue placeholder="Select severity" className="!text-slate-900" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white border-slate-200">
                                                {Object.entries(severityConfig).map(([level, config]) => {
                                                    const Icon = config.icon
                                                    return (
                                                        <SelectItem key={level} value={level} className="text-sm !text-slate-900">
                                                            <div className="flex items-center gap-2">
                                                                <Icon className="w-3.5 h-3.5 text-slate-600" />
                                                                <span className="text-slate-900">{level}</span>
                                                            </div>
                                                        </SelectItem>
                                                    )
                                                })}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 mb-1.5 block">Category</label>
                                        <Select
                                            value={formData.category}
                                            onValueChange={(value) => handleFormChange({ category: value })}
                                        >
                                            <SelectTrigger className="h-9 bg-white text-sm font-medium border-slate-200 text-slate-700">
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent className="bg-white border-slate-200">
                                                <SelectItem value="Web" className="text-sm text-slate-700">Web Application</SelectItem>
                                                <SelectItem value="Mobile" className="text-sm text-slate-700">Mobile</SelectItem>
                                                <SelectItem value="Network" className="text-sm text-slate-700">Network</SelectItem>
                                                <SelectItem value="Cloud" className="text-sm text-slate-700">Cloud Infrastructure</SelectItem>
                                                <SelectItem value="API" className="text-sm text-slate-700">API Security</SelectItem>
                                                <SelectItem value="Database" className="text-sm text-slate-700">Database</SelectItem>
                                                <SelectItem value="Other" className="text-sm text-slate-700">Other</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                            </div>

                            <div className="border-t border-slate-100" />

                            {/* Technical Specs */}
                            <div className="space-y-4">
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Technical
                                </h4>
                                <div>
                                    <label className="text-[10px] text-slate-500 mb-1.5 block">CVSS Score</label>
                                    <div className="flex gap-1.5">
                                        <Input
                                            key={`cvss-${formData.cvss_vector?.slice(-10) || 'empty'}`}
                                            value={formData.cvss_vector}
                                            onChange={(e) => handleFormChange({ cvss_vector: e.target.value })}
                                            placeholder="CVSS:3.1/AV:N/AC:L/..."
                                            className="h-8 font-mono text-[10px] bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 flex-1"
                                        />
                                        <CVSSCalculator
                                            vector={formData.cvss_vector}
                                            onUpdate={(vector, _score, severity) => {
                                                handleFormChange({ 
                                                    cvss_vector: vector, 
                                                    severity: severity 
                                                });
                                            }}
                                        />
                                    </div>
                                    <p className="text-[10px] text-slate-400 font-mono mt-1 line-clamp-1">
                                        {formData.cvss_vector || 'Vector will be generated after applying a score'}
                                    </p>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 mb-1.5 block">OWASP Reference</label>
                                    <Input
                                        value={formData.owasp_reference}
                                        onChange={(e) => handleFormChange({ owasp_reference: e.target.value })}
                                        placeholder="A01:2021"
                                        className="h-8 bg-white border-slate-200 text-xs font-mono text-slate-700 placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            <div className="border-t border-slate-100" />

                            {/* Preview Card */}
                            <div className="space-y-3">
                                <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                    Preview
                                </h4>
                                <div className={cn(
                                    "p-3 rounded-lg border",
                                    currentSeverity.bg,
                                    currentSeverity.border
                                )}>
                                    <div className="flex items-center gap-2 mb-2">
                                        {(() => {
                                            const Icon = currentSeverity.icon
                                            return <Icon className={cn("w-4 h-4", currentSeverity.color)} />
                                        })()}
                                        <span className={cn("text-xs font-semibold uppercase", currentSeverity.color)}>
                                            {formData.severity}
                                        </span>
                                    </div>
                                    <p className="text-sm font-medium text-white truncate">
                                        {formData.title || 'Untitled Finding'}
                                    </p>
                                    <p className="text-[10px] text-white/70 mt-1">
                                        {formData.category} • {formData.owasp_reference || 'No OWASP ref'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Content - Editors */}
                    <div className="flex-1 overflow-y-auto scrollbar-thin">
                        <div className="m-6 ml-3 p-8 bg-white rounded-2xl border border-slate-200/80 shadow-sm space-y-8">
                            {/* Description */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                                    <span className="text-red-500 text-xs">*</span>
                                </div>
                                <Editor
                                    content={formData.description}
                                    onChange={(html) => handleFormChange({ description: html })}
                                    placeholder="Describe the vulnerability, its impact, and how it was discovered..."
                                    frameless
                                    className="min-h-[180px]"
                                />
                            </section>

                            {/* Remediation */}
                            <section className="pt-6 border-t border-slate-100">
                                <div className="flex items-center gap-2 mb-4">
                                    <Wrench className="w-4 h-4 text-slate-400" />
                                    <h3 className="text-sm font-semibold text-slate-900">Remediation</h3>
                                    <span className="text-red-500 text-xs">*</span>
                                </div>
                                <Editor
                                    content={formData.remediation}
                                    onChange={(html) => handleFormChange({ remediation: html })}
                                    placeholder="Provide clear steps to fix or mitigate this vulnerability..."
                                    frameless
                                    className="min-h-[150px]"
                                />
                            </section>

                            {/* Evidence / Proof of Concept */}
                            <section className="pt-6 border-t border-slate-100">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Camera className="w-4 h-4 text-slate-400" />
                                        <h3 className="text-sm font-semibold text-slate-900">Proof of Concept</h3>
                                    </div>
                                    <span className="text-[10px] text-slate-400 uppercase tracking-wide">Optional</span>
                                </div>
                                <div className="border-2 border-dashed border-emerald-100 bg-emerald-50/20 rounded-xl p-1 hover:border-emerald-200 transition-colors">
                                    <Editor
                                        content={formData.evidence}
                                        onChange={(html) => handleFormChange({ evidence: html })}
                                        placeholder="Type reproduction steps, paste code snippets, or drag & drop screenshots here..."
                                        variant="evidence"
                                        className="min-h-[160px]"
                                    />
                                </div>
                            </section>
                        </div>
                    </div>
                </div>
            </DialogContent>

            {/* Unsaved Changes Warning */}
            <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
                <AlertDialogContent className="bg-white border-slate-200 shadow-2xl sm:rounded-2xl">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <AlertDialogTitle className="text-lg font-semibold text-slate-900">
                                Unsaved Changes
                            </AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-sm text-slate-500 leading-relaxed pl-13">
                            You have unsaved changes to this finding. If you close now, your changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel 
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            onClick={handleDiscardChanges}
                        >
                            Discard Changes
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => setShowUnsavedDialog(false)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            Keep Editing
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Dialog>
    )
}