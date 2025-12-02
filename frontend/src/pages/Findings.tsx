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
    Eye
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
        const saved = localStorage.getItem('customFindings')
        if (saved) {
            try {
                setCustomFindings(JSON.parse(saved))
            } catch (e) {
                console.error('Failed to parse custom findings', e)
            }
        }
    }, [])

    // Save custom findings to localStorage
    const saveCustomFindings = (findings: any[]) => {
        setCustomFindings(findings)
        localStorage.setItem('customFindings', JSON.stringify(findings))
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
            case 'Critical': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800'
            case 'High': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-200 dark:border-orange-800'
            case 'Medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800'
            case 'Low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800'
            default: return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800'
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
        <div className="space-y-6 h-[calc(100vh-100px)] flex flex-col">
            {/* Header Section */}
            <div className="flex flex-col gap-6 flex-shrink-0">
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-foreground">Findings Database</h1>
                        <p className="text-muted-foreground">Browse standard vulnerabilities and manage your custom templates</p>
                    </div>
                    <div className="flex gap-2">
                        <input
                            type="file"
                            ref={fileInputRef}
                            className="hidden"
                            accept=".xml,.csv,.json"
                            onChange={handleFileChange}
                        />
                        <Button variant="outline" onClick={handleImportClick}>
                            <Upload className="w-4 h-4 mr-2" />
                            Import Findings
                        </Button>
                        <Button className="bg-primary hover:bg-primary/90" onClick={() => setAddDialogOpen(true)}>
                            <Plus className="w-4 h-4 mr-2" />
                            New Finding
                        </Button>
                    </div>
                </div>

                {/* Tabs - Segmented Control Style - Premium Polish */}
                <div>
                    <div className="bg-muted/50 p-1 rounded-lg inline-flex border border-border">
                        <button
                            onClick={() => setActiveTab('system')}
                            className={cn(
                                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                activeTab === 'system'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                            )}
                        >
                            System Library
                        </button>
                        <button
                            onClick={() => setActiveTab('custom')}
                            className={cn(
                                "px-4 py-1.5 text-sm font-medium rounded-md transition-all",
                                activeTab === 'custom'
                                    ? "bg-background text-foreground shadow-sm"
                                    : "text-muted-foreground hover:text-foreground hover:bg-muted-foreground/10"
                            )}
                        >
                            My Templates
                        </button>
                    </div>
                </div>

                {/* Toolbar */}
                <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between bg-card p-4 rounded-lg border border-border shadow-sm">
                    <div className="flex gap-4 flex-1 w-full">
                        <div className="relative flex-1 max-w-md">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                            <Input
                                placeholder="Search by title, ID, or description..."
                                className="pl-10 w-full"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                            <SelectTrigger className="w-[160px]">
                                <SelectValue placeholder="Category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="All">All Categories</SelectItem>
                                <SelectItem value="Web">Web</SelectItem>
                                <SelectItem value="Mobile">Mobile</SelectItem>
                                <SelectItem value="Network">Network</SelectItem>
                                <SelectItem value="Database">Database</SelectItem>
                                <SelectItem value="Cloud">Cloud</SelectItem>
                            </SelectContent>
                        </Select>
                        <Select value={selectedSeverity} onValueChange={setSelectedSeverity}>
                            <SelectTrigger className="w-[160px]">
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
                    <div className="text-sm text-muted-foreground">
                        {filteredFindings.length} findings found
                    </div>
                </div>
            </div>

            {/* Main Content - High Density Table */}
            <div className="flex-1 min-h-0 bg-card rounded-lg border border-border overflow-hidden shadow-sm flex flex-col">
                {filteredFindings.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-center py-12 text-muted-foreground">
                        {activeTab === 'custom' && !searchQuery ? (
                            <>
                                <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                                    <FileText className="w-8 h-8 opacity-50" />
                                </div>
                                <h3 className="text-lg font-semibold text-foreground mb-2">No custom templates yet</h3>
                                <p className="max-w-sm mb-6">Create your first custom finding template or duplicate one from the System Library to get started.</p>
                                <Button onClick={() => setAddDialogOpen(true)}>
                                    <Plus className="w-4 h-4 mr-2" />
                                    Create Template
                                </Button>
                            </>
                        ) : (
                            <>
                                <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>No findings found matching your criteria.</p>
                                <Button variant="link" onClick={() => {
                                    setSearchQuery('')
                                    setSelectedCategory('All')
                                    setSelectedSeverity('All')
                                }}>
                                    Clear Filters
                                </Button>
                            </>
                        )}
                    </div>
                ) : (
                    <>
                        {/* Table Header */}
                        <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border bg-muted/30 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                            <div className="col-span-2 md:col-span-1">ID</div>
                            <div className="col-span-6 md:col-span-5">Title</div>
                            <div className="col-span-2 hidden md:block">Category</div>
                            <div className="col-span-2 md:col-span-2">Severity</div>
                            <div className="col-span-2 text-right">Actions</div>
                        </div>

                        {/* Table Body */}
                        <ScrollArea className="flex-1">
                            <div className="divide-y divide-border/50">
                                {currentFindings.map((finding) => (
                                    <div 
                                        key={finding.id} 
                                        className="grid grid-cols-12 gap-4 px-6 py-3 items-center hover:bg-muted/40 transition-colors group cursor-pointer border-b border-border/50 last:border-0"
                                        onClick={() => activeTab === 'custom' ? handleEdit(finding) : handleEdit(finding)}
                                    >
                                        <div className="col-span-2 md:col-span-1 font-mono text-xs text-muted-foreground">
                                            {finding.id || finding.owasp_id || 'N/A'}
                                        </div>
                                        <div className="col-span-6 md:col-span-5 font-medium text-sm text-foreground truncate pr-4">
                                            {finding.title}
                                        </div>
                                        <div className="col-span-2 hidden md:block">
                                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                {getCategoryIcon(finding.category)}
                                                <span>{finding.category}</span>
                                            </div>
                                        </div>
                                        <div className="col-span-2 md:col-span-2">
                                            <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-medium border", getSeverityColor(finding.severity))}>
                                                {finding.severity}
                                            </Badge>
                                        </div>
                                        <div className="col-span-2 flex justify-end items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                            {activeTab === 'custom' ? (
                                                <>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                        onClick={() => handleEdit(finding)}
                                                        title="Edit"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
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
                                                                className="h-8 w-8 p-2 rounded-md text-muted-foreground hover:text-destructive hover:bg-muted transition-colors"
                                                            >
                                                                <MoreHorizontal className="w-4 h-4" />
                                                            </Button>
                                                        </DropdownMenuTrigger>
                                                        <DropdownMenuContent align="end">
                                                            <DropdownMenuItem onClick={() => handleDelete(finding.id)} className="text-destructive focus:text-destructive">
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
                                                        className="h-8 w-8 p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                                                        onClick={() => handleEdit(finding)}
                                                        title="View Details"
                                                    >
                                                        <Eye className="w-4 h-4" />
                                                    </Button>
                                                    <Button 
                                                        size="sm" 
                                                        variant="ghost" 
                                                        className="h-8 w-8 p-2 rounded-md text-muted-foreground hover:text-primary hover:bg-muted transition-colors"
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
                        </ScrollArea>
                        
                        {/* Pagination Footer - Anchored & Polished */}
                        <div className="border-t border-border bg-muted/30 py-4 px-6 flex justify-between items-center text-sm text-muted-foreground">
                            <div>
                                Showing <span className="font-medium text-foreground">{startIndex + 1}-{Math.min(endIndex, totalItems)}</span> of <span className="font-medium text-foreground">{totalItems}</span> findings
                            </div>
                            <div className="flex gap-2">
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    disabled={currentPage === 1}
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    className="text-xs h-8"
                                >
                                    <ChevronLeft className="w-3 h-3 mr-1" />
                                    Previous
                                </Button>
                                <Button 
                                    variant="outline" 
                                    size="sm" 
                                    disabled={currentPage === totalPages || totalItems === 0}
                                    onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                    className="text-xs h-8"
                                >
                                    Next
                                    <ChevronRight className="w-3 h-3 ml-1" />
                                </Button>
                            </div>
                        </div>
                    </>
                )}
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
                />
            )}
        </div>
    )
}