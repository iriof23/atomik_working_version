import { useState, useEffect } from 'react'
import {
    Dialog,
    DialogContent,
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
import { Shield, X, AlertTriangle, Flame, AlertCircle, Info, FileText, Wrench, Camera } from 'lucide-react'

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

    const currentSeverity = severityConfig[formData.severity as keyof typeof severityConfig] || severityConfig.Medium

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl h-[85vh] flex flex-col gap-0 p-0 bg-white border-slate-200 overflow-hidden [&>button]:hidden sm:rounded-2xl shadow-2xl">
                {/* Premium Header */}
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white shrink-0">
                    <div className="flex items-start justify-between">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-slate-900 tracking-tight">New Vulnerability Template</h2>
                                <p className="text-xs text-slate-500 mt-0.5">Create a reusable finding for your security assessments</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => onOpenChange(false)}
                            className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Split Layout: Sidebar + Content */}
                <div className="flex-1 flex overflow-hidden">
                    {/* Left Sidebar - Metadata */}
                    <div className="w-72 shrink-0 bg-slate-50/80 border-r border-slate-100 p-5 overflow-y-auto scrollbar-thin">
                        <div className="space-y-5">
                            {/* Title */}
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Finding Title
                                </label>
                                <Input
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    placeholder="e.g. SQL Injection"
                                    className="h-9 bg-white border-slate-200 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus-visible:ring-emerald-500/20 focus-visible:border-emerald-500"
                                    autoFocus
                                />
                            </div>

                            {/* Severity */}
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Severity
                                </label>
                                <Select
                                    value={formData.severity}
                                    onValueChange={(value) => setFormData({ ...formData, severity: value })}
                                >
                                    <SelectTrigger className="h-9 bg-white border-slate-200 text-sm font-medium text-slate-900">
                                        <SelectValue placeholder="Select severity" />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200">
                                        {Object.entries(severityConfig).map(([level, config]) => {
                                            const Icon = config.icon
                                            const colorMap: Record<string, string> = {
                                                Critical: 'text-red-600',
                                                High: 'text-orange-600',
                                                Medium: 'text-amber-600',
                                                Low: 'text-emerald-600',
                                                Info: 'text-slate-600'
                                            }
                                            return (
                                                <SelectItem key={level} value={level} className="text-sm">
                                                    <div className="flex items-center gap-2">
                                                        <Icon className={cn("w-3.5 h-3.5", colorMap[level])} />
                                                        <span className={colorMap[level]}>{level}</span>
                                                    </div>
                                                </SelectItem>
                                            )
                                        })}
                                    </SelectContent>
                                </Select>
                            </div>

                            {/* Category */}
                            <div>
                                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2 block">
                                    Category
                                </label>
                                <Select
                                    value={formData.category}
                                    onValueChange={(value) => setFormData({ ...formData, category: value })}
                                >
                                    <SelectTrigger className="h-9 bg-white border-slate-200 text-sm text-slate-900">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="bg-white border-slate-200">
                                        <SelectItem value="Web">Web Application</SelectItem>
                                        <SelectItem value="Mobile">Mobile</SelectItem>
                                        <SelectItem value="Network">Network</SelectItem>
                                        <SelectItem value="Cloud">Cloud Infrastructure</SelectItem>
                                        <SelectItem value="API">API Security</SelectItem>
                                        <SelectItem value="Database">Database</SelectItem>
                                        <SelectItem value="Other">Other</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>

                            <div className="border-t border-slate-200 pt-5">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                    References
                                </p>
                                
                                {/* OWASP */}
                                <div className="mb-4">
                                    <label className="text-[10px] text-slate-500 mb-1.5 block">OWASP ID</label>
                                    <Input
                                        value={formData.owasp_reference}
                                        onChange={(e) => setFormData({ ...formData, owasp_reference: e.target.value })}
                                        placeholder="A01:2021"
                                        className="h-8 bg-white border-slate-200 text-xs font-mono text-slate-700 placeholder:text-slate-400"
                                    />
                                </div>

                                {/* CVSS */}
                                <div>
                                    <label className="text-[10px] text-slate-500 mb-1.5 block">CVSS Vector</label>
                                    <Input
                                        value={formData.cvss_vector}
                                        onChange={(e) => setFormData({ ...formData, cvss_vector: e.target.value })}
                                        placeholder="CVSS:3.1/AV:N/AC:L/..."
                                        className="h-8 bg-white border-slate-200 text-[10px] font-mono text-slate-700 placeholder:text-slate-400"
                                    />
                                </div>
                            </div>

                            {/* Quick Stats Preview */}
                            <div className="border-t border-slate-200 pt-5">
                                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                    Preview
                                </p>
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
                                    <p className="text-sm font-medium text-slate-900 truncate">
                                        {formData.title || 'Untitled Finding'}
                                    </p>
                                    <p className="text-[10px] text-slate-500 mt-1">
                                        {formData.category} • {formData.owasp_reference || 'No OWASP ref'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Content - Editors */}
                    <div className="flex-1 overflow-y-auto bg-white scrollbar-thin">
                        <div className="p-8 space-y-8">
                            {/* Description */}
                            <section>
                                <div className="flex items-center gap-2 mb-4">
                                    <FileText className="w-4 h-4 text-slate-400" />
                                    <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                                    <span className="text-red-500 text-xs">*</span>
                                </div>
                                <Editor
                                    content={formData.description}
                                    onChange={(html) => setFormData({ ...formData, description: html })}
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
                                    onChange={(html) => setFormData({ ...formData, remediation: html })}
                                    placeholder="Provide clear steps to fix or mitigate this vulnerability..."
                                    frameless
                                    className="min-h-[150px]"
                                />
                            </section>

                            {/* Evidence */}
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
                                        onChange={(html) => setFormData({ ...formData, evidence: html })}
                                        placeholder="Add screenshots, code snippets, or step-by-step reproduction..."
                                        variant="evidence"
                                        className="min-h-[160px]"
                                    />
                                </div>
                            </section>
                        </div>
                    </div>
                </div>

                {/* Premium Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/30 shrink-0 flex items-center justify-between">
                    <p className="text-[10px] text-slate-400">
                        {formData.title ? '✓ Title' : '○ Title'} • {formData.description ? '✓ Description' : '○ Description'} • {formData.remediation ? '✓ Remediation' : '○ Remediation'}
                    </p>
                    <div className="flex gap-2">
                        <Button 
                            type="button" 
                            variant="ghost"
                            size="sm"
                            onClick={() => onOpenChange(false)}
                            className="text-slate-500 hover:text-slate-900 hover:bg-slate-100 text-xs"
                        >
                            Cancel
                        </Button>
                        <Button 
                            onClick={handleSubmit}
                            size="sm"
                            disabled={!formData.title || !formData.description}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs px-5 shadow-sm disabled:opacity-50"
                        >
                            <Shield className="w-3.5 h-3.5 mr-1.5" />
                            Add Finding
                        </Button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    )
}