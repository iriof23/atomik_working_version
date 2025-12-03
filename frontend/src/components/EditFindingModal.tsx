import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Editor } from '@/components/editor/Editor';
import { Trash2, Save, Globe, Plus, X, Shield, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogClose,
} from "@/components/ui/dialog";

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

interface EditFindingModalProps {
    finding: ProjectFinding | null;
    isOpen: boolean;
    onClose: () => void;
    onUpdate: (finding: ProjectFinding) => void;
    onDelete: () => void;
    isEditable?: boolean; // Whether the title can be edited (true for custom templates)
}

export function EditFindingModal({ finding, isOpen, onClose, onUpdate, onDelete, isEditable = false }: EditFindingModalProps) {
    const [localFinding, setLocalFinding] = useState<ProjectFinding | null>(finding);
    const [isDirty, setIsDirty] = useState(false);
    const [newAssetUrl, setNewAssetUrl] = useState('');
    const [affectedAssetsCount, setAffectedAssetsCount] = useState(0);

    // Generate professional Finding ID
    const generateFindingId = (): string => {
        if (finding?.references) return finding.references;
        let clientPrefix = finding?.project?.client?.name?.slice(0, 3).toUpperCase();
        if (!clientPrefix && finding?.title) {
            clientPrefix = finding.title.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        }
        if (!clientPrefix) clientPrefix = 'GEN';
        const suffix = finding?.id?.replace(/[^A-Za-z0-9]/g, '').slice(-3).toUpperCase() || '000';
        return `${clientPrefix}-${suffix}`;
    };

    const findingId = generateFindingId();

    useEffect(() => {
        setLocalFinding(finding);
        setIsDirty(false);
        setAffectedAssetsCount(finding?.affectedAssets?.length || 0);
    }, [finding]);

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
            onUpdate({
                ...localFinding,
                evidence: localFinding.evidence
            });
            setIsDirty(false);
        }
    };

    const handleClose = () => {
        if (isDirty) {
            if (window.confirm('You have unsaved changes. Are you sure you want to close?')) {
                onClose();
            }
        } else {
            onClose();
        }
    };

    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical': return 'bg-red-50 text-red-700 border-red-200';
            case 'High': return 'bg-orange-50 text-orange-700 border-orange-200';
            case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200';
            case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
            default: return 'bg-blue-50 text-blue-700 border-blue-200';
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
        setAffectedAssetsCount(localFinding.affectedAssets.length + 1);
        setNewAssetUrl('');
    };

    const removeAsset = (index: number) => {
        if (!localFinding) return;
        handleChange({
            affectedAssets: localFinding.affectedAssets.filter((_, i) => i !== index)
        });
        setAffectedAssetsCount(localFinding.affectedAssets.length - 1);
    };

    if (!localFinding) return null;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent className="max-w-[90vw] w-full h-[90vh] p-0 gap-0 bg-white border-slate-200 shadow-2xl flex flex-col overflow-hidden [&>button]:hidden sm:rounded-xl">
                
                {/* Header */}
                <div className="h-16 border-b border-slate-200 flex items-center justify-between px-6 shrink-0 bg-white z-10">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                         <div className="p-2 bg-violet-50 rounded-lg border border-violet-100">
                            <Shield className="w-5 h-5 text-violet-600" />
                        </div>
                        <div className="flex flex-col">
                             <Input 
                                disabled={!isEditable}
                                value={localFinding.title} 
                                onChange={(e) => isEditable && handleChange({ title: e.target.value })}
                                className={cn(
                                    "font-semibold text-lg border-none px-0 h-7 focus-visible:ring-0 bg-transparent text-slate-900 placeholder:text-slate-400 shadow-none",
                                    !isEditable && "cursor-default"
                                )}
                            />
                             <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
                                <span className="font-mono">{findingId}</span>
                                <span>•</span>
                                <Badge variant="outline" className={cn('font-medium border rounded-md', getSeverityColor(localFinding.severity))}>
                                    {localFinding.severity}
                                </Badge>
                                {isDirty && (
                                    <>
                                        <span>•</span>
                                        <span className="text-amber-600 font-medium flex items-center gap-1">
                                            <AlertCircle className="w-3 h-3" />
                                            Unsaved Changes
                                        </span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onDelete && isEditable && (
                             <Button variant="ghost" size="sm" onClick={onDelete} className="text-slate-500 hover:text-red-600 hover:bg-red-50 mr-2">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        )}
                        <Button variant="outline" size="sm" onClick={handleClose} className="text-slate-700 border-slate-200 hover:bg-slate-50">
                            Cancel
                        </Button>
                         <Button size="sm" onClick={handleSave} disabled={!isDirty} className="bg-violet-600 hover:bg-violet-700 text-white shadow-sm">
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </Button>
                    </div>
                </div>

                {/* Body Layout */}
                 <div className="flex-1 min-h-0 grid grid-cols-12">
                    
                    {/* Sidebar (Metadata) - 25% width */}
                    <div className="col-span-12 md:col-span-3 border-r border-slate-200 bg-slate-50/50 h-full overflow-y-auto">
                        <div className="p-6 space-y-6">
                            
                            {/* Classification */}
                             <div className="space-y-4">
                                <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                                    Classification
                                </h4>
                                <div className="grid gap-4">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">Severity</label>
                                        <select
                                            value={localFinding.severity}
                                            onChange={(e) => handleChange({ severity: e.target.value as any })}
                                            className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-shadow"
                                        >
                                            {['Critical', 'High', 'Medium', 'Low', 'Informational'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                     <div className="space-y-1.5">
                                        <label className="text-xs font-medium text-slate-500">Status</label>
                                        <select
                                            value={localFinding.status}
                                            onChange={(e) => handleChange({ status: e.target.value as any })}
                                            className="w-full h-9 px-3 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 outline-none transition-shadow"
                                        >
                                            {['Open', 'In Progress', 'Fixed', 'Accepted Risk'].map(s => (
                                                <option key={s} value={s}>{s}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="h-px bg-slate-200" />

                             {/* Technical Specs */}
                            <div className="space-y-4">
                                 <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Technical Specs</h4>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-medium text-slate-500">CVSS Vector</label>
                                    <Input
                                        value={localFinding.cvssVector || ''}
                                        onChange={(e) => handleChange({ cvssVector: e.target.value })}
                                        className="h-9 font-mono text-xs bg-white border-slate-200 focus:ring-violet-500/20 focus:border-violet-500"
                                        placeholder="CVSS:3.1/..."
                                    />
                                </div>
                            </div>

                            <div className="h-px bg-slate-200" />

                            {/* Assets */}
                             <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h4 className="text-xs font-semibold text-slate-900 uppercase tracking-wider">Affected Assets</h4>
                                    <Badge variant="secondary" className="bg-slate-200 text-slate-600 hover:bg-slate-200">
                                        {localFinding.affectedAssets.length}
                                    </Badge>
                                </div>
                                <div className="flex gap-2">
                                    <Input
                                        value={newAssetUrl}
                                        onChange={(e) => setNewAssetUrl(e.target.value)}
                                        placeholder="Add URL or IP..."
                                        className="h-8 text-xs bg-white border-slate-200 focus:ring-violet-500/20 focus:border-violet-500"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddAsset()}
                                    />
                                    <Button size="sm" variant="outline" onClick={handleAddAsset} disabled={!newAssetUrl.trim()} className="h-8 w-8 p-0 shrink-0 bg-white">
                                        <Plus className="w-3 h-3" />
                                    </Button>
                                </div>
                                 <div className="space-y-2">
                                    {localFinding.affectedAssets.map((asset, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white border border-slate-200 rounded-lg shadow-sm group">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Globe className="w-3 h-3 text-slate-400 flex-shrink-0" />
                                                <span className="truncate text-slate-600 font-mono text-xs" title={asset.url}>{asset.url}</span>
                                            </div>
                                            <button onClick={() => removeAsset(idx)} className="text-slate-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content (Editors) - 75% width */}
                    <div className="col-span-12 md:col-span-9 h-full overflow-y-auto bg-white scroll-smooth">
                        <div className="p-8 max-w-4xl mx-auto space-y-10 pb-20">
                            
                             {/* Description */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                                        Description
                                    </h3>
                                </div>
                                <div className="rounded-lg border border-slate-100 bg-slate-50/30 min-h-[150px]">
                                    <Editor
                                        content={localFinding.description}
                                        onChange={(html) => handleChange({ description: html })}
                                        placeholder="Describe the vulnerability..."
                                        className="min-h-[150px] prose-sm max-w-none p-4"
                                    />
                                </div>
                            </section>

                             {/* Remediation */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-sm font-semibold text-slate-900">Remediation</h3>
                                </div>
                                <div className="rounded-lg border border-slate-100 bg-slate-50/30 min-h-[150px]">
                                    <Editor
                                        content={localFinding.recommendations}
                                        onChange={(html) => handleChange({ recommendations: html })}
                                        placeholder="How to fix this issue..."
                                        className="min-h-[150px] prose-sm max-w-none p-4"
                                    />
                                </div>
                            </section>

                             {/* Evidence */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-sm font-semibold text-slate-900">Proof of Concept & Evidence</h3>
                                </div>
                                <div className="rounded-lg border border-slate-100 bg-slate-50/30 min-h-[300px]">
                                    <Editor
                                        content={localFinding.evidence || ''}
                                        onChange={(html) => handleChange({ evidence: html })}
                                        placeholder="Add evidence, screenshots, or code snippets..."
                                        variant="evidence"
                                        className="min-h-[300px] prose-sm max-w-none p-4"
                                    />
                                </div>
                            </section>
                            
                            {/* References */}
                            <section className="space-y-4">
                                <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                                    <h3 className="text-sm font-semibold text-slate-900">References</h3>
                                </div>
                                <div className="rounded-lg border border-slate-100 bg-slate-50/30 min-h-[100px]">
                                    <Editor
                                        content={localFinding.references || ''}
                                        onChange={(html) => handleChange({ references: html })}
                                        placeholder="Add links to CVEs or documentation..."
                                        className="min-h-[100px] prose-sm max-w-none p-4"
                                    />
                                </div>
                            </section>
                        </div>
                    </div>
                 </div>
            </DialogContent>
        </Dialog>
    );
}