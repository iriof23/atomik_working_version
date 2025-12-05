import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Editor } from '@/components/editor/Editor';
import { Trash2, Save, Globe, Plus, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { ProjectFinding } from '@/types';

// Re-export for backwards compatibility
export type { ProjectFinding } from '@/types';

interface FindingDetailsProps {
    finding: ProjectFinding;
    onUpdate: (finding: ProjectFinding) => void;
    onDelete: () => void;
}

export function FindingDetails({ finding, onUpdate, onDelete }: FindingDetailsProps) {
    const [localFinding, setLocalFinding] = useState<ProjectFinding>(finding);
    const [isDirty, setIsDirty] = useState(false);
    const [newAssetUrl, setNewAssetUrl] = useState('');

    // Update local state when prop changes, but only if not dirty or confirmed?
    // Actually, usually we want to reset if the selected finding changes from the parent.
    useEffect(() => {
        setLocalFinding(finding);
        setIsDirty(false);
    }, [finding.id]); // Only reset when ID changes

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
        setLocalFinding(prev => ({ ...prev, ...updates }));
        setIsDirty(true);
    };

    const handleSave = () => {
        onUpdate(localFinding);
        setIsDirty(false);
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
        if (!newAssetUrl.trim()) return;
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
        handleChange({
            affectedAssets: localFinding.affectedAssets.filter((_, i) => i !== index)
        });
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            {/* Sticky Header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <Badge className={cn('text-xs px-2 py-0.5', getSeverityColor(localFinding.severity))}>
                        {localFinding.severity}
                    </Badge>
                    <span className="text-sm text-zinc-500 font-mono">{localFinding.id}</span>
                    {isDirty && <span className="text-xs text-orange-500 font-medium">• Unsaved Changes</span>}
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onDelete}
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleSave}
                        disabled={!isDirty}
                        className="bg-primary hover:bg-primary/90"
                    >
                        <Save className="w-4 h-4 mr-2" />
                        Save Changes
                    </Button>
                </div>
            </div>

            {/* Main Grid Container */}
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 min-h-0">
                {/* Left Column: Metadata Panel */}
                <div className="lg:col-span-1 border-r border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/20 h-full overflow-hidden flex flex-col">
                    <ScrollArea className="flex-1">
                        <div className="p-6 space-y-6">
                            {/* Title */}
                            <div className="space-y-2">
                                <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Title</label>
                                <Input
                                    value={localFinding.title}
                                    onChange={(e) => handleChange({ title: e.target.value })}
                                    className="font-medium"
                                />
                            </div>

                            {/* Severity & Status */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Severity</label>
                                    <select
                                        value={localFinding.severity}
                                        onChange={(e) => handleChange({ severity: e.target.value as any })}
                                        className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-primary/20 outline-none"
                                    >
                                        {['Critical', 'High', 'Medium', 'Low', 'Informational'].map(s => (
                                            <option key={s} value={s}>{s}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Status</label>
                                    <select
                                        value={localFinding.status}
                                        onChange={(e) => handleChange({ status: e.target.value as any })}
                                        className="w-full px-3 py-2 text-sm border border-zinc-200 dark:border-zinc-800 rounded-md bg-white dark:bg-zinc-900 focus:ring-2 focus:ring-primary/20 outline-none"
                                    >
                                        {['Open', 'In Progress', 'Fixed', 'Accepted Risk'].map(s => (
                                            <option key={s} value={s}>{s}</option>
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
                                    className="font-mono text-xs"
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
                                        className="text-xs"
                                        onKeyDown={(e) => e.key === 'Enter' && handleAddAsset()}
                                    />
                                    <Button size="sm" variant="outline" onClick={handleAddAsset} disabled={!newAssetUrl.trim()}>
                                        <Plus className="w-4 h-4" />
                                    </Button>
                                </div>
                                <div className="space-y-2">
                                    {localFinding.affectedAssets.map((asset, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded text-sm group">
                                            <div className="flex items-center gap-2 overflow-hidden">
                                                <Globe className="w-3 h-3 text-zinc-400 flex-shrink-0" />
                                                <span className="truncate text-zinc-700 dark:text-zinc-300" title={asset.url}>{asset.url}</span>
                                            </div>
                                            <button
                                                onClick={() => removeAsset(idx)}
                                                className="text-zinc-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </ScrollArea>
                </div>

                {/* Right Column: Editor Canvas */}
                <div className="lg:col-span-2 h-full overflow-hidden flex flex-col bg-white dark:bg-zinc-950">
                    <ScrollArea className="flex-1">
                        <div className="p-8 space-y-8 max-w-4xl mx-auto">
                            {/* Description */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Description</h3>
                                <Editor
                                    content={localFinding.description}
                                    onChange={(html) => handleChange({ description: html })}
                                    placeholder="Describe the vulnerability..."
                                    className="min-h-[150px]"
                                />
                            </div>

                            {/* Evidence - Dominant Element */}
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Proof of Concept & Evidence</h3>
                                    <Badge variant="outline" className="text-zinc-500">Evidence</Badge>
                                </div>
                                <div className="p-1 bg-zinc-50 dark:bg-zinc-900/50 rounded-xl border border-zinc-200 dark:border-zinc-800">
                                    <Editor
                                        content={localFinding.evidence || ''}
                                        onChange={(html) => handleChange({ evidence: html })}
                                        placeholder="Drag & drop screenshots, paste code snippets, or write your PoC here..."
                                        variant="evidence"
                                        className="min-h-[400px] border-none shadow-none focus-within:ring-0"
                                    />
                                </div>
                            </div>

                            {/* Remediation */}
                            <div className="space-y-3">
                                <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Remediation</h3>
                                <Editor
                                    content={localFinding.recommendations}
                                    onChange={(html) => handleChange({ recommendations: html })}
                                    placeholder="How to fix this issue..."
                                    className="min-h-[150px]"
                                />
                            </div>
                        </div>
                    </ScrollArea>
                </div>
            </div>
        </div>
    );
}
