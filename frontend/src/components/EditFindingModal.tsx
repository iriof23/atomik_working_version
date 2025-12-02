import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Editor } from '@/components/editor/Editor';
import { Trash2, Save, Globe, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    Dialog,
    DialogContent,
    DialogClose,
} from "@/components/ui/dialog";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";

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

    // Generate professional Finding ID from client name + UUID (e.g., "ACM-AF3")
    const generateFindingId = (): string => {
        if (finding?.references) {
            return finding.references;
        }

        // Try to get client prefix from nested structure
        let clientPrefix = finding?.project?.client?.name?.slice(0, 3).toUpperCase();

        // Fallback: Use first 3 letters of finding title if no client name
        if (!clientPrefix && finding?.title) {
            clientPrefix = finding.title.replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase();
        }

        // Final fallback
        if (!clientPrefix) {
            clientPrefix = 'GEN';
        }

        // Get Unique Suffix from finding ID (e.g. "AF3")
        const suffix = finding?.id?.replace(/[^A-Za-z0-9]/g, '').slice(-3).toUpperCase() || '000';

        return `${clientPrefix}-${suffix}`;
    };

    const findingId = generateFindingId();

    useEffect(() => {
        setLocalFinding(finding);
        setIsDirty(false);
        // Initialize from finding.affectedAssets array length
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
            // Include evidence in the save payload
            onUpdate({
                ...localFinding,
                evidence: localFinding.evidence // Explicitly include evidence
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
            case 'Critical': return 'bg-red-500/10 text-red-600 border-red-500/20';
            case 'High': return 'bg-orange-500/10 text-orange-600 border-orange-500/20';
            case 'Medium': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
            case 'Low': return 'bg-green-500/10 text-green-600 border-green-500/20';
            default: return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
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
        <Dialog open={isOpen} onOpenChange={(open) => {
            if (!open) {
                handleClose();
            }
        }}>
            <DialogContent
                className="max-w-[96vw] w-full h-[92vh] p-0 gap-0 bg-zinc-950 border-zinc-800 flex flex-col [&>button]:hidden"
            >
                {/* Header - Fixed */}
                <div className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 shrink-0">
                    <div className="flex items-center gap-4 flex-1 min-w-0">
                        <Input 
                            disabled={!isEditable}
                            value={localFinding.title} 
                            onChange={(e) => isEditable && handleChange({ title: e.target.value })}
                            className="font-medium bg-zinc-900/50 border-zinc-800 text-white max-w-md truncate" 
                        />
                        <Badge className={cn('text-xs px-2 py-0.5 flex-shrink-0', getSeverityColor(localFinding.severity))}>{localFinding.severity}</Badge>
                        {isDirty && <span className="text-xs text-orange-500 font-medium flex-shrink-0">• Unsaved Changes</span>}
                    </div>
                    <div className="flex items-center gap-3">
                        <Button type="button" size="sm" onClick={handleSave} disabled={!isDirty} className="bg-emerald-600 hover:bg-emerald-500 text-white">
                            <Save className="w-4 h-4 mr-2" />
                            Save Changes
                        </Button>
                        <Button type="button" size="sm" onClick={onDelete} className="bg-transparent hover:bg-red-500/10 text-zinc-400 hover:text-red-500 border-none shadow-none outline-none ring-0 focus:ring-0 focus:outline-none transition-colors">
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                        </Button>
                        <DialogClose asChild>
                            <Button variant="ghost" size="sm">
                                <X className="w-4 h-4" />
                            </Button>
                        </DialogClose>
                    </div>
                </div>

                {/* Body Grid - Scrollable */}
                <div className="flex-1 min-h-0 grid grid-cols-12">
                    {/* Left Column: Metadata (25%) - Scrollable */}
                    <div className="col-span-3 border-r border-zinc-800 bg-zinc-900/30 h-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                        <div className="p-6 space-y-6">
                            {/* Finding ID & Assets Count - Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Finding ID</label>
                                    <Input
                                        value={findingId}
                                        readOnly
                                        className="h-9 font-mono text-xs text-zinc-300 bg-zinc-900/30 border-zinc-800 cursor-default focus:ring-0"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Assets</label>
                                    <Input
                                        type="number"
                                        value={affectedAssetsCount === 0 ? '' : affectedAssetsCount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setAffectedAssetsCount(val === '' ? 0 : parseInt(val) || 0);
                                            setIsDirty(true);
                                        }}
                                        className="h-9 bg-zinc-900/30 border-zinc-800 text-zinc-300 text-sm focus:ring-1 focus:ring-zinc-600 focus:border-zinc-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    />
                                </div>
                            </div>

                            {/* Severity & Status */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Severity</label>
                                    <select
                                        value={localFinding.severity}
                                        onChange={(e) => handleChange({ severity: e.target.value as any })}
                                        className="w-full h-9 px-3 py-2 text-sm border border-zinc-800 rounded-md bg-zinc-900/30 text-zinc-300 focus:ring-1 focus:ring-zinc-600 focus:border-zinc-500 outline-none appearance-none"
                                    >
                                        {['Critical', 'High', 'Medium', 'Low', 'Informational'].map(s => (
                                            <option key={s} value={s} className="bg-zinc-900">{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</label>
                                    <select
                                        value={localFinding.status}
                                        onChange={(e) => handleChange({ status: e.target.value as any })}
                                        className="w-full h-9 px-3 py-2 text-sm border border-zinc-800 rounded-md bg-zinc-900/30 text-zinc-300 focus:ring-1 focus:ring-zinc-600 focus:border-zinc-500 outline-none appearance-none"
                                    >
                                        {['Open', 'In Progress', 'Fixed', 'Accepted Risk'].map(s => (
                                            <option key={s} value={s} className="bg-zinc-900">{s}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* CVSS */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">CVSS Vector</label>
                                <Input
                                    value={localFinding.cvssVector || ''}
                                    onChange={(e) => handleChange({ cvssVector: e.target.value })}
                                    className="h-9 font-mono text-xs tracking-tight bg-zinc-900/30 border-zinc-800 text-zinc-300 focus:ring-1 focus:ring-zinc-600 focus:border-zinc-500"
                                    placeholder="CVSS:3.1/..."
                                />
                            </div>

                            {/* Affected Assets */}
                            <div className="space-y-3">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider flex justify-between items-center">
                                    Affected Assets
                                    <span className="text-zinc-400 font-normal normal-case">{localFinding.affectedAssets.length} items</span>
                                </label>
                                <div className="flex gap-2">
                                    <Input
                                        value={newAssetUrl}
                                        onChange={(e) => setNewAssetUrl(e.target.value)}
                                        placeholder="Add URL/IP..."
                                        className="h-9 text-sm bg-zinc-900/30 border-zinc-800 text-zinc-300 focus:ring-1 focus:ring-zinc-600 focus:border-zinc-500"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddAsset()}
                                    />
                                    <Button size="sm" variant="outline" onClick={handleAddAsset} disabled={!newAssetUrl.trim()} className="h-9 border-zinc-800 hover:bg-zinc-800 text-zinc-300">
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {localFinding.affectedAssets.map((asset, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-zinc-900/30 border border-zinc-800 rounded text-sm group">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Globe className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                                                <span className="truncate text-zinc-300 font-mono text-xs" title={asset.url}>{asset.url}</span>
                                            </div>
                                            <button
                                                onClick={() => removeAsset(idx)}
                                                className="text-zinc-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Editors (75%) - Scrollable */}
                    <div className="col-span-9 bg-zinc-950 h-full overflow-y-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:bg-zinc-800 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-track]:bg-transparent">
                        <div className="p-8">
                            <Accordion type="multiple" defaultValue={['description', 'remediation', 'poc', 'references']} className="space-y-4">
                                {/* Description */}
                                <AccordionItem value="description" className="border border-zinc-800 bg-zinc-900/50 rounded-lg overflow-hidden">
                                    <AccordionTrigger className="px-4 py-3 hover:bg-zinc-900 transition-colors font-medium text-zinc-100">
                                        Description
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-2">
                                        <Editor
                                            content={localFinding.description}
                                            onChange={(html) => handleChange({ description: html })}
                                            placeholder="Describe the vulnerability..."
                                            className="min-h-[150px] prose-invert"
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                {/* Remediation */}
                                <AccordionItem value="remediation" className="border border-zinc-800 bg-zinc-900/50 rounded-lg overflow-hidden">
                                    <AccordionTrigger className="px-4 py-3 hover:bg-zinc-900 transition-colors font-medium text-zinc-100">
                                        Remediation
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-2">
                                        <Editor
                                            content={localFinding.recommendations}
                                            onChange={(html) => handleChange({ recommendations: html })}
                                            placeholder="How to fix this issue..."
                                            className="min-h-[150px] prose-invert"
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                {/* Proof of Concept & Evidence */}
                                <AccordionItem value="poc" className="border border-zinc-800 bg-zinc-900/50 rounded-lg overflow-hidden">
                                    <AccordionTrigger className="px-4 py-3 hover:bg-zinc-900 transition-colors font-medium text-zinc-100">
                                        Proof of Concept & Evidence
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-2">
                                        <Editor
                                            content={localFinding.evidence || ''}
                                            onChange={(html) => handleChange({ evidence: html })}
                                            placeholder="Drag & drop screenshots, paste code snippets, or write your PoC here..."
                                            variant="evidence"
                                            className="min-h-[400px] prose-invert"
                                        />
                                    </AccordionContent>
                                </AccordionItem>

                                {/* References */}
                                <AccordionItem value="references" className="border border-zinc-800 bg-zinc-900/50 rounded-lg overflow-hidden">
                                    <AccordionTrigger className="px-4 py-3 hover:bg-zinc-900 transition-colors font-medium text-zinc-100">
                                        References
                                    </AccordionTrigger>
                                    <AccordionContent className="px-4 pb-4 pt-2">
                                        <Editor
                                            content={localFinding.references || ''}
                                            onChange={(html) => handleChange({ references: html })}
                                            placeholder="Add references (URLs, CVEs, documentation links, etc.)..."
                                            className="min-h-[150px] prose-invert"
                                        />
                                    </AccordionContent>
                                </AccordionItem>
                            </Accordion>
                        </div>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
