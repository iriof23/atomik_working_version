import { useState, useEffect, useRef } from 'react'
import {
    Search,
    Plus,
    Shield,
    Globe,
    Server,
    Database,
    Cpu,
    Smartphone,
    FileText,
    Upload,
    Pencil,
    Copy,
    Trash2,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    Eye,
    Filter,
    LayoutGrid,
    List as ListIcon,
    AlertTriangle,
    CheckCircle2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { vulnerabilityDatabase } from '../data/vulnerabilities'
import { AddFindingDialog } from '@/components/AddFindingDialog'
import { EditFindingModal, ProjectFinding } from '@/components/EditFindingModal'
import { useToast } from "@/components/ui/use-toast"
import { StatCard } from '@/components/StatCard'
import { Card } from '@/components/ui/card'

export default function Findings() {
    const [activeTab, setActiveTab] = useState<'system' | 'custom'>('system')
    const [searchQuery, setSearchQuery] = useState('')
    const [selectedCategory, setSelectedCategory] = useState<string>('All')
    const [selectedSeverity, setSelectedSeverity] = useState<string>('All')
    const [customFindings, setCustomFindings] = useState<any[]>([])
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [editingFinding, setEditingFinding] = useState<any>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const { toast } = useToast()

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Load custom findings from localStorage
    useEffect(() => {
        const loadFindings = () => {
            const saved = localStorage.getItem('customFindings')
            if (saved) {
                try {
                    setCustomFindings(JSON.parse(saved))
                } catch (e) {
                    console.error('Failed to parse custom findings', e)
                }
            }
        }

        loadFindings()

        // Listen for updates from Dashboard or other components
        window.addEventListener('custom-findings-updated', loadFindings)
        return () => window.removeEventListener('custom-findings-updated', loadFindings)
    }, [])

    // Save custom findings to localStorage
    const saveCustomFindings = (findings: any[]) => {
        setCustomFindings(findings)
        localStorage.setItem('customFindings', JSON.stringify(findings))
        window.dispatchEvent(new Event('custom-findings-updated'))
    }

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [searchQuery, selectedCategory, selectedSeverity, activeTab])

    // Filter Logic
    const currentList = activeTab === 'system' ? vulnerabilityDatabase : customFindings

    const filteredFindings = currentList.filter(finding => {
        const matchesSearch = finding.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            finding.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (finding.id && finding.id.toLowerCase().includes(searchQuery.toLowerCase()))
        const matchesCategory = selectedCategory === 'All' || finding.category === selectedCategory
        const matchesSeverity = selectedSeverity === 'All' || finding.severity === selectedSeverity

        return matchesSearch && matchesCategory && matchesSeverity
    })

    // Pagination Logic
    const totalItems = filteredFindings.length
    const totalPages = Math.ceil(totalItems / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems)
    const currentFindings = filteredFindings.slice(startIndex, endIndex)

    // Helper for Severity Colors
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical': return 'bg-red-50 text-red-700 border-red-200'
            case 'High': return 'bg-orange-50 text-orange-700 border-orange-200'
            case 'Medium': return 'bg-amber-50 text-amber-700 border-amber-200'
            case 'Low': return 'bg-emerald-50 text-emerald-700 border-emerald-200'
            default: return 'bg-blue-50 text-blue-700 border-blue-200'
        }
    }

    // Helper for Category Icons
    const getCategoryIcon = (category: string) => {
        switch (category) {
            case 'Web': return <Globe className="w-3.5 h-3.5" />
            case 'Mobile': return <Smartphone className="w-3.5 h-3.5" />
            case 'Network': return <Server className="w-3.5 h-3.5" />
            case 'Database': return <Database className="w-3.5 h-3.5" />
            case 'Cloud': return <Cpu className="w-3.5 h-3.5" />
            default: return <Shield className="w-3.5 h-3.5" />
        }
    }

    const handleAddFinding = (newFinding: any) => {
        const updatedFindings = [newFinding, ...customFindings]
        saveCustomFindings(updatedFindings)
        toast({
            title: "Finding Added",
            description: "New custom finding has been added to your templates.",
        })
        setActiveTab('custom')
    }

    const handleDuplicate = (finding: any) => {
        const duplicatedFinding = {
            ...finding,
            id: `custom-${Date.now()}`,
            title: `${finding.title} (Copy)`,
            isCustom: true
        }
        const updatedFindings = [duplicatedFinding, ...customFindings]
        saveCustomFindings(updatedFindings)
        toast({
            title: "Finding Duplicated",
            description: "Finding has been copied to My Templates.",
        })
        setActiveTab('custom')
    }

    const handleDelete = (id: string) => {
        const updatedFindings = customFindings.filter(f => f.id !== id)
        saveCustomFindings(updatedFindings)
        toast({
            title: "Finding Deleted",
            description: "Template has been removed.",
        })
    }

    const handleEdit = (finding: any) => {
        // Map finding to ProjectFinding format expected by EditFindingModal
        const mappedFinding: ProjectFinding = {
            id: finding.id,
            owaspId: finding.owasp_reference || '',
            title: finding.title,
            severity: finding.severity,
            status: 'Open',
            description: finding.description,
            recommendations: finding.remediation || finding.recommendation || '',
            affectedAssets: [],
            screenshots: [],
            evidence: finding.evidence,
            references: finding.references
        }
        setEditingFinding(mappedFinding)
    }

    const handleUpdateFinding = (updatedFinding: ProjectFinding) => {
        const updatedCustomFindings = customFindings.map(f => 
            f.id === updatedFinding.id ? {
                ...f,
                title: updatedFinding.title,
                severity: updatedFinding.severity,
                description: updatedFinding.description,
                remediation: updatedFinding.recommendations,
                evidence: updatedFinding.evidence,
                references: updatedFinding.references
            } : f
        )
        saveCustomFindings(updatedCustomFindings)
        setEditingFinding(null)
        toast({
            title: "Finding Updated",
            description: "Changes have been saved to your template.",
        })
    }

    const handleImportClick = () => {
        fileInputRef.current?.click()
    }

    const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0]
        if (!file) return

        setTimeout(() => {
            const importedFinding = {
                id: `imported-${Date.now()}`,
                title: `Imported: ${file.name.split('.')[0]} Vulnerability`,
                severity: 'High',
                category: 'Network',
                description: 'This finding was imported from an external scanner report.',
                remediation: 'Review the imported data and verify the finding.',
                owasp_reference: 'N/A'
            }

            const updatedFindings = [importedFinding, ...customFindings]
            saveCustomFindings(updatedFindings)

            toast({
                title: "Import Successful",
                description: `Successfully imported findings from ${file.name}`,
            })

            if (fileInputRef.current) fileInputRef.current.value = ''
            setActiveTab('custom')
        }, 1000)
    }

    return (
        <div className="space-y-6 pb-20">
            {/* Header Section */}
            <div className="flex flex-col gap-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-semibold text-slate-900">Findings Database</h1>
                        <p className="text-sm text-slate-500 mt-1">Browse standard vulnerabilities and manage your custom templates</p>
                    </div>
                    <div className="flex gap-3">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xml,.csv,.json"
                            onChange={handleFileChange}
                        />
                        <Button variant="outline" onClick={handleImportClick} className="bg-white border-slate-200 hover:bg-slate-50 text-slate-700">
                            <Upload className="w-4 h-4 mr-2" />
                            Import
                        </Button>
                        <Button className="bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setAddDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Finding
                        </Button>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <StatCard
                        label="Total Templates"
                        value={vulnerabilityDatabase.length + customFindings.length}
                        icon={<Shield className="w-5 h-5" />}
                        subtitle="System + Custom"
                        variant="default"
                    />
                    <StatCard
                        label="My Templates"
                        value={customFindings.length}
                        icon={<FileText className="w-5 h-5" />}
                        subtitle="Custom Findings"
                        variant="success"
                    />
                     <StatCard
                        label="Critical Issues"
                        value={currentList.filter(f => f.severity === 'Critical').length}
                        icon={<AlertTriangle className="w-5 h-5" />}
                        subtitle="In Current View"
                        variant="destructive"
                    />
                    <StatCard
                        label="Categories"
                        value={new Set(currentList.map(f => f.category)).size}
                        icon={<LayoutGrid className="w-5 h-5" />}
                        subtitle="Unique Types"
                        variant="warning"
                    />
                </div>

                {/* Main Content Card */}
                <Card className="border-slate-200 shadow-sm bg-white overflow-hidden">
                    {/* Toolbar */}
                    <div className="p-4 border-b border-slate-200 bg-white flex flex-col md:flex-row gap-4 items-center justify-between sticky top-0 z-10">
                        {/* Tabs */}
                        <div className="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
                            <button
                                onClick={() => setActiveTab('system')}
                                className={cn(
                                    "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                    activeTab === 'system'
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                System Library
                            </button>
                            <button
                                onClick={() => setActiveTab('custom')}
                                className={cn(
                                    "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                    activeTab === 'custom'
                                        ? "bg-white text-slate-900 shadow-sm"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                My Templates
                            </button>
                        </div>

                        <div className="flex gap-3 flex-1 justify-end w-full md:w-auto">
                            <div className="relative flex-1 md:w-64 max-w-md">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-slate-400 w-4 h-4" />
                                <Input
                                    placeholder="Search findings..."
                                    className="pl-9 w-full bg-white border-slate-200 focus:ring-violet-500/20 focus:border-violet-500"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50">
                                        <Filter className="w-4 h-4 mr-2" />
                                        Filter
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-56">
                                    <DropdownMenuItem onClick={() => { setSelectedCategory('All'); setSelectedSeverity('All') }}>
                                        Clear Filters
                                    </DropdownMenuItem>
                                    {/* Add more sophisticated filtering if needed */}
                                </DropdownMenuContent>
                            </DropdownMenu>
                             <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                                <SelectTrigger className="w-[140px] border-slate-200 text-slate-600">
                                    <SelectValue placeholder="Severity" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="All">All Severities</SelectItem>
                                    <SelectItem value="Critical">Critical</SelectItem>
                                    <SelectItem value="High">High</SelectItem>
                                    <SelectItem value="Medium">Medium</SelectItem>
                                    <SelectItem value="Low">Low</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="min-h-[400px]">
                        {filteredFindings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-20 text-slate-500">
                                {activeTab === 'custom' && !searchQuery ? (
                                    <>
                                        <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                            <FileText className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No custom templates yet</h3>
                                        <p className="max-w-sm mb-6 text-slate-500">Create your first custom finding template or duplicate one from the System Library to get started.</p>
                                        <Button onClick={() => setAddDialogOpen(true)} className="bg-violet-600 hover:bg-violet-700 text-white">
                                            <Plus className="w-4 h-4 mr-2" />
                                            Create Template
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Search className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                                        <p>No findings found matching your criteria.</p>
                                        <Button variant="link" onClick={() => {
                                            setSearchQuery('')
                                            setSelectedCategory('All')
                                            setSelectedSeverity('All')
                                        }} className="text-violet-600">
                                            Clear Filters
                                        </Button>
                                    </>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Table Header */}
                                <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-slate-100 bg-slate-50/50 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                                    <div className="col-span-2 md:col-span-1">ID</div>
                                    <div className="col-span-6 md:col-span-5">Title</div>
                                    <div className="col-span-2 hidden md:block">Category</div>
                                    <div className="col-span-2 md:col-span-2">Severity</div>
                                    <div className="col-span-2 text-right">Actions</div>
                                </div>

                                {/* Table Body */}
                                <div className="divide-y divide-slate-100">
                                    {currentFindings.map((finding) => (
                                        <div 
                                            key={finding.id} 
                                            className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-slate-50/80 transition-colors group cursor-pointer"
                                            onClick={() => handleEdit(finding)}
                                        >
                                            <div className="col-span-2 md:col-span-1 font-mono text-xs text-slate-500">
                                                {finding.id || finding.owasp_id || 'N/A'}
                                            </div>
                                            <div className="col-span-6 md:col-span-5 font-medium text-sm text-slate-900 truncate pr-4">
                                                {finding.title}
                                            </div>
                                            <div className="col-span-2 hidden md:block">
                                                <div className="flex items-center gap-2 text-sm text-slate-500">
                                                    <div className="p-1 rounded-md bg-slate-100 text-slate-500">
                                                        {getCategoryIcon(finding.category)}
                                                    </div>
                                                    <span>{finding.category}</span>
                                                </div>
                                            </div>
                                            <div className="col-span-2 md:col-span-2">
                                                <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-medium border rounded-md", getSeverityColor(finding.severity))}>
                                                    {finding.severity}
                                                </Badge>
                                            </div>
                                            <div className="col-span-2 flex justify-end items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                                {activeTab === 'custom' ? (
                                                    <>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                                                            onClick={() => handleEdit(finding)}
                                                            title="Edit"
                                                        >
                                                            <Pencil className="w-4 h-4" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                                                            onClick={() => handleDuplicate(finding)}
                                                            title="Duplicate"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild>
                                                                <Button 
                                                                    size="sm" 
                                                                    variant="ghost" 
                                                                    className="h-8 w-8 p-0 text-slate-400 hover:text-red-600 hover:bg-red-50"
                                                                >
                                                                    <Trash2 className="w-4 h-4" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent align="end">
                                                                <DropdownMenuItem onClick={() => handleDelete(finding.id)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    Delete Template
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </>
                                                ) : (
                                                    <>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-slate-900 hover:bg-slate-100"
                                                            onClick={() => handleEdit(finding)}
                                                            title="View Details"
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </Button>
                                                        <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-violet-600 hover:bg-violet-50"
                                                            onClick={() => handleDuplicate(finding)}
                                                            title="Create Template from this finding"
                                                        >
                                                            <Copy className="w-4 h-4" />
                                                        </Button>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                {/* Pagination Footer */}
                                <div className="border-t border-slate-200 bg-white py-4 px-6 flex justify-between items-center text-sm text-slate-500">
                                    <div>
                                        Showing <span className="font-medium text-slate-900">{startIndex + 1}-{Math.min(endIndex, totalItems)}</span> of <span className="font-medium text-slate-900">{totalItems}</span> findings
                                    </div>
                                    <div className="flex gap-2">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            disabled={currentPage === 1}
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            className="text-xs h-8 border-slate-200 text-slate-600 hover:text-slate-900"
                                        >
                                            <ChevronLeft className="w-3 h-3 mr-1" />
                                            Previous
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            disabled={currentPage === totalPages || totalItems === 0}
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            className="text-xs h-8 border-slate-200 text-slate-600 hover:text-slate-900"
                                        >
                                            Next
                                            <ChevronRight className="w-3 h-3 ml-1" />
                                        </Button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </Card>
            </div>

            {/* Add Finding Dialog */}
            <AddFindingDialog
                open={addDialogOpen}
                onOpenChange={setAddDialogOpen}
                onFindingAdded={handleAddFinding}
            />

            {/* Edit Finding Modal */}
            {editingFinding && (
                <EditFindingModal
                    finding={editingFinding}
                    isOpen={!!editingFinding}
                    onClose={() => setEditingFinding(null)}
                    onUpdate={handleUpdateFinding}
                    onDelete={() => {
                        if (editingFinding) {
                            handleDelete(editingFinding.id)
                            setEditingFinding(null)
                        }
                    }}
                    isEditable={activeTab === 'custom'}
                />
            )}
        </div>
    )
}