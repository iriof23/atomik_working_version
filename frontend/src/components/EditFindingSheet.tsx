import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Editor } from '@/components/editor/Editor';
import { Trash2, Save, Globe, Plus, X, Shield, AlertTriangle, Flame, AlertCircle, Info, FileText, Wrench, Camera, Link2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Sheet,
    SheetContent,
} from "@/components/ui/sheet";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import CVSSCalculator from './CVSSCalculator';

// Define types locally for now, ideally should be shared
export interface ProjectFinding {
    id: string;
    owaspId: string;
    title: string;
    severity: 'Critical' | 'High' | 'Medium' | 'Low' | 'Informational';
    cvssScore?: number;
    cvssVector?: string;
    status: 'Open' | 'In Progress' | 'Fixed' | 'Accepted Risk';
    description: string;
    recommendations: string;
    evidence?: string;
    affectedAssets: Array<{ url: string; description: string; instanceCount: number }>;
    screenshots: Array<{ id: string; url: string; caption: string }>;
    references?: string;
    project?: {
        client?: {
            name?: string;
        };
    };
}

interface EditFindingSheetProps {
    finding: ProjectFinding | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (finding: ProjectFinding) => void;
    onDelete: () => void;
}

const severityConfig = {
    Critical: { icon: AlertTriangle, color: 'text-white', bg: 'bg-gradient-to-r from-red-600 to-red-700', border: 'border-0', ring: 'ring-red-200' },
    High: { icon: Flame, color: 'text-white', bg: 'bg-gradient-to-r from-orange-500 to-orange-600', border: 'border-0', ring: 'ring-orange-200' },
    Medium: { icon: AlertCircle, color: 'text-white', bg: 'bg-gradient-to-r from-amber-500 to-amber-600', border: 'border-0', ring: 'ring-amber-200' },
    Low: { icon: Info, color: 'text-white', bg: 'bg-gradient-to-r from-emerald-500 to-emerald-600', border: 'border-0', ring: 'ring-emerald-200' },
    Informational: { icon: Info, color: 'text-white', bg: 'bg-gradient-to-r from-blue-500 to-blue-600', border: 'border-0', ring: 'ring-blue-200' },
}

const statusOptions = ['Open', 'In Progress', 'Fixed', 'Accepted Risk']

const formatCvssScore = (score?: number | null) => {
    if (score === undefined || score === null || Number.isNaN(score)) return '';
    return Number(score).toFixed(1);
};

export function EditFindingSheet({ finding, isOpen, onClose, onUpdate, onDelete }: EditFindingSheetProps) {
    const [localFinding, setLocalFinding] = useState<ProjectFinding | null>(finding);
    const [isDirty, setIsDirty] = useState(false);
    const [newAssetUrl, setNewAssetUrl] = useState('');
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false);
    const [cvssMeta, setCvssMeta] = useState<{ vector: string; score: string }>({
        vector: finding?.cvssVector || '',
        score: formatCvssScore(finding?.cvssScore),
    });

    useEffect(() => {
        setLocalFinding(finding);
        setCvssMeta({
            vector: finding?.cvssVector || '',
            score: formatCvssScore(finding?.cvssScore),
        });
        setIsDirty(false);
    }, [finding]);

    useEffect(() => {
        if (!localFinding) return;
        setCvssMeta({
            vector: localFinding.cvssVector || '',
            score: formatCvssScore(localFinding.cvssScore),
        });
    }, [localFinding?.cvssVector, localFinding?.cvssScore]);

    // Dirty state warning on unload
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = '';
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty]);

    const handleChange = (updates: Partial<ProjectFinding>) => {
        if (!localFinding) return;
        setLocalFinding(prev => prev ? ({ ...prev, ...updates }) : null);
        setIsDirty(true);
    };

    const handleSave = () => {
        if (localFinding) {
            onUpdate(localFinding);
            setIsDirty(false);
        }
    };

    const handleClose = () => {
        if (isDirty) {
            setShowUnsavedDialog(true);
        } else {
            onClose();
        }
    };

    const handleDiscardChanges = () => {
        setShowUnsavedDialog(false);
        setIsDirty(false);
        onClose();
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical': return 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-sm border-0';
            case 'High': return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm border-0';
            case 'Medium': return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm border-0';
            case 'Low': return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm border-0';
            default: return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm border-0';
        }
    };

    const handleAddAsset = () => {
        if (!newAssetUrl.trim() || !localFinding) return;
        handleChange({
            affectedAssets: [...localFinding.affectedAssets, {
                url: newAssetUrl.trim(),
                description: '',
                instanceCount: 1
            }]
        });
        setNewAssetUrl('');
    };

    const removeAsset = (index: number) => {
        if (!localFinding) return;
        handleChange({
            affectedAssets: localFinding.affectedAssets.filter((_, i) => i !== index)
        });
    };

    if (!localFinding) return null;

    const currentSeverity = severityConfig[localFinding.severity as keyof typeof severityConfig] || severityConfig.Medium;

    const findingId = localFinding.id;

    return (
        <Sheet open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <SheetContent 
                side="right" 
                hideCloseButton 
                className="w-[90vw] max-w-[90vw] p-0 overflow-hidden border-l border-slate-200 bg-white"
                onInteractOutside={(e) => {
                    if (isDirty) {
                        e.preventDefault();
                        setShowUnsavedDialog(true);
                    }
                }}
                onEscapeKeyDown={(e) => {
                    if (isDirty) {
                        e.preventDefault();
                        setShowUnsavedDialog(true);
                    }
                }}
            >
                <div className="flex flex-col h-full w-full">
                    {/* Premium Header - Consistent with EditFindingModal */}
                    <div className="border-b border-slate-100 bg-gradient-to-b from-slate-50/80 to-white shrink-0">
                        <div className="px-6 py-4 grid grid-cols-[auto_1fr_auto] items-center gap-4">
                            {/* Gradient Shield Icon */}
                            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg">
                                <Shield className="w-6 h-6 text-white" />
                            </div>
                            
                            {/* Title and Metadata - Takes all available space */}
                            <div className="min-w-0">
                                {/* Title - Full width display */}
                                <h2 className="font-bold text-xl text-slate-900 tracking-tight break-words" title={localFinding.title}>
                                    {localFinding.title}
                                </h2>
                                
                                {/* Metadata Pills */}
                                <div className="flex items-center gap-2 text-xs mt-1.5 flex-wrap">
                                    <span className={cn(
                                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold uppercase tracking-wide border',
                                        currentSeverity.bg, currentSeverity.color, currentSeverity.border
                                    )}>
                                        {(() => {
                                            const Icon = currentSeverity.icon;
                                            return <Icon className="w-3 h-3" />;
                                        })()}
                                        {localFinding.severity}
                                    </span>
                                    <span className="text-slate-300">•</span>
                                    <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{findingId}</span>
                                    <span className="text-slate-300">•</span>
                                    <span className="text-[11px] text-slate-500">
                                        {localFinding.status}
                                    </span>
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
                            
                            {/* Actions - Fixed width */}
                            <div className="flex items-center gap-2">
                                {onDelete && (
                                    <Button variant="ghost" size="sm" onClick={onDelete} className="text-slate-400 hover:text-red-600 hover:bg-red-50">
                                        <Trash2 className="w-4 h-4" />
                                    </Button>
                                )}
                                <Button variant="ghost" size="sm" onClick={handleClose} className="text-slate-500 hover:text-slate-900 text-xs">
                                    Cancel
                                </Button>
                                <Button size="sm" onClick={handleSave} disabled={!isDirty} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm text-xs px-4">
                                    <Save className="w-3.5 h-3.5 mr-1.5" />
                                    Save
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Body Layout */}
                    <div className="flex-1 min-h-0 flex">
                        
                        {/* Sidebar (Metadata) */}
                        <div className="w-80 shrink-0 border-r border-slate-100 bg-slate-50/80 overflow-y-auto scrollbar-thin">
                            <div className="p-5 space-y-6">
                                
                                {/* Classification */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Classification
                                    </h4>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="text-[10px] text-slate-500 mb-1.5 block">Severity</label>
                                            <Select
                                                value={localFinding.severity}
                                                onValueChange={(value) => handleChange({ severity: value as any })}
                                            >
                                                <SelectTrigger className="h-9 bg-white text-sm font-medium border-slate-200 !text-slate-900 [&>span]:!text-slate-900">
                                                    <SelectValue placeholder="Select severity" className="!text-slate-900" />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white border-slate-200">
                                                    {Object.entries(severityConfig).map(([level, config]) => {
                                                        const Icon = config.icon;
                                                        return (
                                                            <SelectItem key={level} value={level} className="text-sm !text-slate-900">
                                                                <div className="flex items-center gap-2">
                                                                    <Icon className={cn("w-3.5 h-3.5 text-slate-600")} />
                                                                    <span className="text-slate-900">{level}</span>
                                                                </div>
                                                            </SelectItem>
                                                        );
                                                    })}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-500 mb-1.5 block">Status</label>
                                            <Select
                                                value={localFinding.status}
                                                onValueChange={(value) => handleChange({ status: value as any })}
                                            >
                                                <SelectTrigger className="h-9 bg-white text-sm font-medium border-slate-200 text-slate-700">
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent className="bg-white border-slate-200">
                                                    {statusOptions.map((status) => (
                                                        <SelectItem key={status} value={status} className="text-sm text-slate-700">
                                                            {status}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-slate-200" />

                                {/* Technical Specs */}
                                <div className="space-y-4">
                                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                        Technical
                                    </h4>
                                    <div>
                                        <label className="text-[10px] text-slate-500 mb-1.5 block">CVSS Score</label>
                                        <div className="flex gap-1.5">
                                            <Input
                                                value={cvssMeta.score}
                                                readOnly
                                                className="h-8 font-mono text-[12px] bg-white border-slate-200 text-slate-900 placeholder:text-slate-400 flex-1"
                                                placeholder="0.0"
                                            />
                                            <CVSSCalculator
                                                vector={cvssMeta.vector}
                                                onUpdate={(vector, score, severity) => {
                                                    handleChange({ 
                                                        cvssVector: vector, 
                                                        cvssScore: score,
                                                        severity: severity as any 
                                                    });
                                                    setCvssMeta({
                                                        vector,
                                                        score: formatCvssScore(score),
                                                    });
                                                }}
                                            />
                                        </div>
                                        <p className="text-[10px] text-slate-400 font-mono mt-1 line-clamp-1">
                                            {cvssMeta.vector || 'Vector will be generated after applying a score'}
                                        </p>
                                    </div>
                                </div>

                                <div className="border-t border-slate-200" />

                                {/* Affected Assets */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
                                            Affected Assets
                                        </h4>
                                        <span className="text-[10px] font-semibold text-slate-500 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                                            {localFinding.affectedAssets.length}
                                        </span>
                                    </div>
                                    <div className="flex gap-1.5">
                                        <Input
                                            value={newAssetUrl}
                                            onChange={(e) => setNewAssetUrl(e.target.value)}
                                            placeholder="Add URL or IP..."
                                            className="h-8 text-xs bg-white border-slate-200 placeholder:text-slate-400"
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddAsset()}
                                        />
                                        <Button size="sm" variant="outline" onClick={handleAddAsset} disabled={!newAssetUrl.trim()} className="h-8 w-8 p-0 shrink-0 bg-white border-slate-200">
                                            <Plus className="w-3 h-3" />
                                        </Button>
                                    </div>
                                    <div className="space-y-1.5">
                                        {localFinding.affectedAssets.map((asset, idx) => (
                                            <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg group hover:border-emerald-200 transition-colors">
                                                <div className="flex items-center gap-2 overflow-hidden">
                                                    <Globe className="w-3 h-3 text-slate-400 shrink-0 group-hover:text-emerald-500" />
                                                    <span className="truncate text-[11px] text-slate-600 font-mono group-hover:text-slate-900" title={asset.url}>
                                                        {asset.url}
                                                    </span>
                                                </div>
                                                <button onClick={() => removeAsset(idx)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <X className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                        {localFinding.affectedAssets.length === 0 && (
                                            <div className="flex flex-col items-center justify-center py-6 border border-dashed border-slate-200 rounded-lg bg-white/50">
                                                <Globe className="w-5 h-5 text-slate-300 mb-2" />
                                                <p className="text-[10px] text-slate-400">No assets linked</p>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Live Preview */}
                                <div className="border-t border-slate-200 pt-5">
                                    <h4 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3">
                                        Preview
                                    </h4>
                                    <div className={cn(
                                        "p-4 rounded-xl shadow-sm",
                                        localFinding.severity === 'Critical' && 'bg-gradient-to-br from-red-600 to-red-700',
                                        localFinding.severity === 'High' && 'bg-gradient-to-br from-orange-500 to-orange-600',
                                        localFinding.severity === 'Medium' && 'bg-gradient-to-br from-amber-500 to-amber-600',
                                        localFinding.severity === 'Low' && 'bg-gradient-to-br from-emerald-500 to-emerald-600',
                                        localFinding.severity === 'Informational' && 'bg-gradient-to-br from-blue-500 to-blue-600'
                                    )}>
                                        <div className="flex items-center gap-2 mb-2">
                                            {(() => {
                                                const Icon = currentSeverity.icon;
                                                return <Icon className="w-4 h-4 text-white/90" />;
                                            })()}
                                            <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">
                                                {localFinding.severity}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-white truncate">
                                            {localFinding.title || 'Untitled'}
                                        </p>
                                        <p className="text-[10px] text-white/70 mt-1.5 font-medium">
                                            {findingId} • {localFinding.status}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Main Content (Editors) */}
                        <div className="flex-1 overflow-y-auto bg-white scrollbar-thin">
                            <div className="p-10 max-w-3xl mx-auto space-y-10 pb-24">
                                
                                {/* Description */}
                                <section>
                                    <div className="flex items-center gap-2 mb-4">
                                        <FileText className="w-4 h-4 text-slate-400" />
                                        <h3 className="text-sm font-semibold text-slate-900">Description</h3>
                                    </div>
                                    <Editor
                                        content={localFinding.description}
                                        onChange={(html) => handleChange({ description: html })}
                                        placeholder="Describe the vulnerability, its impact, and how it was discovered..."
                                        frameless
                                        className="min-h-[120px]"
                                    />
                                </section>

                                {/* Remediation */}
                                <section className="pt-8 border-t border-slate-100">
                                    <div className="flex items-center gap-2 mb-4">
                                        <Wrench className="w-4 h-4 text-slate-400" />
                                        <h3 className="text-sm font-semibold text-slate-900">Remediation</h3>
                                    </div>
                                    <Editor
                                        content={localFinding.recommendations}
                                        onChange={(html) => handleChange({ recommendations: html })}
                                        placeholder="Provide clear steps to fix or mitigate this vulnerability..."
                                        frameless
                                        className="min-h-[120px]"
                                    />
                                </section>

                                {/* Evidence */}
                                <section className="pt-8 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Camera className="w-4 h-4 text-slate-400" />
                                            <h3 className="text-sm font-semibold text-slate-900">Proof of Concept & Evidence</h3>
                                        </div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">Optional</span>
                                    </div>
                                    <div className="border-2 border-dashed border-emerald-100 bg-emerald-50/20 rounded-xl p-1 hover:border-emerald-200 transition-colors">
                                        <Editor
                                            content={localFinding.evidence || ''}
                                            onChange={(html) => handleChange({ evidence: html })}
                                            placeholder="Add screenshots, code snippets, or step-by-step reproduction..."
                                            variant="evidence"
                                            className="min-h-[150px]"
                                        />
                                    </div>
                                </section>
                                
                                {/* References */}
                                <section className="pt-8 border-t border-slate-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <Link2 className="w-4 h-4 text-slate-400" />
                                            <h3 className="text-sm font-semibold text-slate-900">References</h3>
                                        </div>
                                        <span className="text-[10px] text-slate-400 uppercase tracking-wide">Optional</span>
                                    </div>
                                    <Editor
                                        content={localFinding.references || ''}
                                        onChange={(html) => handleChange({ references: html })}
                                        placeholder="Add links to OWASP, CVE, or other relevant resources..."
                                        frameless
                                        className="min-h-[80px]"
                                    />
                                </section>
                            </div>
                        </div>
                    </div>
                </div>
            </SheetContent>

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
        </Sheet>
    );
}
