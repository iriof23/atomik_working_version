import { useState } from 'react'
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Download, Check, Lock, FileJson, FileType, FileText, Settings, Eye } from 'lucide-react'
import { cn } from "@/lib/utils"

interface ExportReportModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    report: {
        title: string
        clientName: string
        date: Date
        author?: string
        version?: string
    }
}

type ExportFormat = 'pdf' | 'docx' | 'json'
type TemplateStyle = 'modern' | 'corporate' | 'terminal'

export function ExportReportModal({ open, onOpenChange, report }: ExportReportModalProps) {
    const [format, setFormat] = useState<ExportFormat>('pdf')
    const [template, setTemplate] = useState<TemplateStyle>('modern')
    const [options, setOptions] = useState({
        executiveSummary: true,
        technicalEvidence: true,
        draftWatermark: false,
        anonymizeIp: false
    })

    const toggleOption = (key: keyof typeof options) => {
        setOptions(prev => ({ ...prev, [key]: !prev[key] }))
    }

    const getTemplatePreviewClass = () => {
        switch (template) {
            case 'modern': return "bg-zinc-950 text-white border-zinc-800"
            case 'corporate': return "bg-white text-zinc-900 border-zinc-200"
            case 'terminal': return "bg-black text-green-500 font-mono border-green-900/30"
            default: return "bg-zinc-950 text-white"
        }
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-5xl h-[85vh] flex flex-col gap-0 p-0 bg-zinc-950 border-zinc-800 overflow-hidden [&>button]:hidden">
                <div className="flex flex-1 min-h-0">
                    {/* Column 1: Configuration (The Controls) */}
                    <div className="w-[400px] border-r border-zinc-800 flex flex-col bg-zinc-900/20">
                        <DialogHeader className="px-6 py-6 border-b border-zinc-800">
                            <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
                                <Settings className="w-5 h-5 text-zinc-400" />
                                Export Settings
                            </DialogTitle>
                        </DialogHeader>

                        <div className="flex-1 overflow-y-auto p-6 space-y-8">
                            {/* Section 1: Format Selection */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Format</label>
                                <div className="bg-zinc-900/50 p-1 rounded-lg inline-flex w-full border border-zinc-800">
                                    {(['pdf', 'docx', 'json'] as const).map((fmt) => (
                                        <button
                                            key={fmt}
                                            onClick={() => setFormat(fmt)}
                                            className={cn(
                                                "flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2 relative group",
                                                format === fmt
                                                    ? "bg-zinc-800 text-white shadow-sm"
                                                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                                            )}
                                        >
                                            {fmt === 'pdf' && <FileType className="w-4 h-4" />}
                                            {fmt === 'docx' && <FileText className="w-4 h-4" />}
                                            {fmt === 'json' && <FileJson className="w-4 h-4" />}
                                            {fmt.toUpperCase()}
                                            {fmt === 'docx' && (
                                                <span className="absolute top-1 right-1">
                                                    <Lock className="w-2.5 h-2.5 text-amber-500" />
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Section 2: Template Style */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Template Style</label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { id: 'modern', label: 'Modern', bg: 'bg-zinc-900' },
                                        { id: 'corporate', label: 'Corporate', bg: 'bg-zinc-200' },
                                        { id: 'terminal', label: 'Terminal', bg: 'bg-black' },
                                    ].map((t) => (
                                        <button
                                            key={t.id}
                                            onClick={() => setTemplate(t.id as TemplateStyle)}
                                            className={cn(
                                                "relative aspect-[3/4] rounded-lg border-2 transition-all overflow-hidden group text-left p-3 flex flex-col justify-end",
                                                template === t.id
                                                    ? "border-emerald-500 ring-1 ring-emerald-500/20"
                                                    : "border-zinc-800 hover:border-zinc-600"
                                            )}
                                        >
                                            <div className={cn("absolute inset-0 opacity-50", t.bg)} />
                                            {template === t.id && (
                                                <div className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center">
                                                    <Check className="w-2.5 h-2.5 text-black" />
                                                </div>
                                            )}
                                            <span className={cn(
                                                "relative z-10 text-xs font-medium",
                                                t.id === 'corporate' ? 'text-zinc-900' : 'text-zinc-200'
                                            )}>
                                                {t.label}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Section 3: Content Toggles */}
                            <div className="space-y-4">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Content Options</label>
                                <div className="space-y-3">
                                    {[
                                        { key: 'executiveSummary', label: 'Include Executive Summary' },
                                        { key: 'technicalEvidence', label: 'Include Technical Evidence' },
                                        { key: 'draftWatermark', label: 'Add "Draft" Watermark' },
                                        { key: 'anonymizeIp', label: 'Anonymize IP Addresses' },
                                    ].map((opt) => (
                                        <div key={opt.key} className="flex items-center justify-between group">
                                            <span className="text-sm text-zinc-300 group-hover:text-zinc-200 transition-colors">{opt.label}</span>
                                            <button
                                                onClick={() => toggleOption(opt.key as keyof typeof options)}
                                                className={cn(
                                                    "w-10 h-5 rounded-full transition-colors relative",
                                                    options[opt.key as keyof typeof options] ? "bg-emerald-600" : "bg-zinc-800"
                                                )}
                                            >
                                                <div className={cn(
                                                    "absolute top-1 left-1 w-3 h-3 bg-white rounded-full transition-transform shadow-sm",
                                                    options[opt.key as keyof typeof options] ? "translate-x-5" : "translate-x-0"
                                                )} />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Column 2: The Preview (The Visual) */}
                    <div className="flex-1 bg-zinc-950/50 flex flex-col relative overflow-hidden">
                        {/* Preview Header */}
                        <div className="absolute top-6 right-6 z-10">
                            <Badge variant="outline" className="bg-zinc-900/80 border-zinc-700 text-zinc-400 backdrop-blur-md">
                                <Eye className="w-3 h-3 mr-1.5" />
                                Live Preview
                            </Badge>
                        </div>

                        {/* Paper Mockup Container */}
                        <div className="flex-1 flex items-center justify-center p-12 overflow-y-auto">
                            <div 
                                className={cn(
                                    "w-full max-w-[500px] aspect-[1/1.414] shadow-2xl rounded-sm relative transition-all duration-500 transform hover:scale-[1.02]",
                                    getTemplatePreviewClass()
                                )}
                            >
                                {/* Watermark */}
                                {options.draftWatermark && (
                                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 overflow-hidden">
                                        <span className="text-9xl font-bold opacity-[0.03] -rotate-45 whitespace-nowrap select-none uppercase">
                                            DRAFT
                                        </span>
                                    </div>
                                )}

                                {/* Cover Page Content */}
                                <div className="relative z-10 h-full flex flex-col p-12">
                                    {/* Top Logo Area */}
                                    <div className="flex justify-between items-start mb-20">
                                        <div className={cn(
                                            "w-12 h-12 rounded flex items-center justify-center text-2xl",
                                            template === 'corporate' ? "bg-zinc-900 text-white" : "bg-white/10 text-white"
                                        )}>
                                            ⚡️
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xs font-mono opacity-50">CONFIDENTIAL</p>
                                            <p className="text-xs font-mono opacity-50">REF-{new Date().getFullYear()}-001</p>
                                        </div>
                                    </div>

                                    {/* Title Area */}
                                    <div className="flex-1 flex flex-col justify-center">
                                        <h1 className={cn(
                                            "text-4xl font-bold leading-tight mb-4",
                                            template === 'terminal' && "font-mono"
                                        )}>
                                            {report.title || "Security Assessment Report"}
                                        </h1>
                                        <p className={cn(
                                            "text-xl opacity-80",
                                            template === 'terminal' && "font-mono"
                                        )}>
                                            {report.clientName || "Client Name"}
                                        </p>
                                    </div>

                                    {/* Bottom Metadata */}
                                    <div className="mt-auto space-y-4 border-t border-current/20 pt-8">
                                        <div className="grid grid-cols-2 gap-8">
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider opacity-50 mb-1">Date</p>
                                                <p className="text-sm font-medium">
                                                    {report.date?.toLocaleDateString() || new Date().toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div>
                                                <p className="text-[10px] uppercase tracking-wider opacity-50 mb-1">Version</p>
                                                <p className="text-sm font-medium">{report.version || "1.0.0"}</p>
                                            </div>
                                        </div>
                                        <div className="flex justify-between items-end pt-4">
                                            <p className="text-[10px] opacity-40">Generated by Atomik</p>
                                            {options.anonymizeIp && (
                                                <Badge variant="outline" className="text-[9px] h-4 px-1 border-current/30 opacity-60">
                                                    Sanitized
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer Actions */}
                <DialogFooter className="px-8 py-4 border-t border-zinc-800 bg-zinc-900/50 flex items-center justify-between sm:justify-between">
                    <div className="flex items-center text-sm text-zinc-500">
                        <span>Estimated Pages: <span className="text-zinc-300 font-medium">~15</span></span>
                        {options.executiveSummary && <span className="ml-2 text-xs bg-zinc-800 px-1.5 py-0.5 rounded">+ Exec Summary</span>}
                    </div>
                    <div className="flex gap-3">
                        <Button 
                            variant="ghost" 
                            onClick={() => onOpenChange(false)}
                            className="text-zinc-400 hover:text-zinc-200"
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20 pl-3 pr-4"
                            disabled={format === 'docx'} // Mock "Pro" restriction
                        >
                            <Download className="w-4 h-4 mr-2" />
                            Generate & Download
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}

