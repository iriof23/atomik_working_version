import { useState, useEffect } from 'react'
import {
    Plus,
    Shield,
    Filter,
    Globe,
    Server,
    Database,
    Cpu,
    Smartphone,
    FileText,
    Pencil,
    Copy,
    Trash2,
    MoreHorizontal,
    ChevronLeft,
    ChevronRight,
    Eye,
    LayoutGrid,
    List as ListIcon,
    AlertTriangle,
    CheckCircle2,
    Loader2
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
import { useAuth } from '@clerk/clerk-react'
import { api } from '@/lib/api'

export default function Findings() {
    const [activeTab, setActiveTab] = useState<'system' | 'custom'>('system')
    const [selectedCategory, setSelectedCategory] = useState<string>('All')
    const [selectedSeverity, setSelectedSeverity] = useState<string>('All')
    const [customFindings, setCustomFindings] = useState<any[]>([])
    const [addDialogOpen, setAddDialogOpen] = useState(false)
    const [editingFinding, setEditingFinding] = useState<any>(null)
    const [isLoading, setIsLoading] = useState(false)
    const { toast } = useToast()
    const { getToken } = useAuth()

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1)
    const itemsPerPage = 10

    // Load custom findings from API
    useEffect(() => {
        const loadFindings = async () => {
            setIsLoading(true)
            try {
                const token = await getToken()
                if (!token) {
                    setIsLoading(false)
                    return
                }

                const response = await api.get('/templates/?type=finding', {
                    headers: { Authorization: `Bearer ${token}` }
                })

                if (response.data && Array.isArray(response.data)) {
                    // Parse template content back to finding objects
                    const findings = response.data.map((template: any) => {
                        try {
                            const content = JSON.parse(template.content)
                            return {
                                ...content,
                                id: template.id, // Use template ID
                                _templateId: template.id,
                            }
                        } catch {
                            return null
                        }
                    }).filter(Boolean)
                    setCustomFindings(findings)
                }
            } catch (error) {
                console.error('Failed to load finding templates:', error)
                toast({
                    title: "Error",
                    description: "Failed to load custom templates.",
                    variant: "destructive"
                })
            } finally {
                setIsLoading(false)
            }
        }

        loadFindings()
    }, [getToken])

    // Create new finding template via API
    const createFindingTemplate = async (finding: any) => {
        try {
            const token = await getToken()
            if (!token) return null

            const response = await api.post('/templates/', {
                name: finding.title,
                description: finding.description?.substring(0, 200) || '',
                type: 'finding',
                content: JSON.stringify(finding),
                is_public: false
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })

            return response.data
        } catch (error) {
            console.error('Failed to create template:', error)
            throw error
        }
    }

    // Update finding template via API
    const updateFindingTemplate = async (id: string, finding: any) => {
        try {
            const token = await getToken()
            if (!token) return null

            const response = await api.put(`/templates/${id}`, {
                name: finding.title,
                description: finding.description?.substring(0, 200) || '',
                content: JSON.stringify(finding)
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })

            return response.data
        } catch (error) {
            console.error('Failed to update template:', error)
            throw error
        }
    }

    // Delete finding template via API
    const deleteFindingTemplate = async (id: string) => {
        try {
            const token = await getToken()
            if (!token) return

            await api.delete(`/templates/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            })
        } catch (error) {
            console.error('Failed to delete template:', error)
            throw error
        }
    }

    // Reset pagination when filters change
    useEffect(() => {
        setCurrentPage(1)
    }, [selectedCategory, selectedSeverity, activeTab])

    // Filter Logic
    const currentList = activeTab === 'system' ? vulnerabilityDatabase : customFindings

    const filteredFindings = currentList.filter(finding => {
        const matchesCategory = selectedCategory === 'All' || finding.category === selectedCategory
        const matchesSeverity = selectedSeverity === 'All' || finding.severity === selectedSeverity

        return matchesCategory && matchesSeverity
    })

    // Pagination Logic
    const totalItems = filteredFindings.length
    const totalPages = Math.ceil(totalItems / itemsPerPage)
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = Math.min(startIndex + itemsPerPage, totalItems)
    const currentFindings = filteredFindings.slice(startIndex, endIndex)

    // Helper for Severity Colors - Premium solid gradients
    const getSeverityColor = (severity: string) => {
        switch (severity) {
            case 'Critical': return 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-sm border-0'
            case 'High': return 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-sm border-0'
            case 'Medium': return 'bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-sm border-0'
            case 'Low': return 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white shadow-sm border-0'
            default: return 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-sm border-0'
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

    const handleAddFinding = async (newFinding: any) => {
        try {
            const template = await createFindingTemplate(newFinding)
            if (template) {
                const findingWithId = {
                    ...newFinding,
                    id: template.id,
                    _templateId: template.id
                }
                setCustomFindings(prev => [findingWithId, ...prev])
                toast({
                    title: "Finding Added",
                    description: "New custom finding has been saved to the database.",
                })
                setActiveTab('custom')
            }
        } catch {
            toast({
                title: "Error",
                description: "Failed to save finding template.",
                variant: "destructive"
            })
        }
    }

    const handleDuplicate = async (finding: any) => {
        const duplicatedFinding = {
            ...finding,
            title: `${finding.title} (Copy)`,
            isCustom: true
        }
        // Remove template ID so it creates a new one
        delete duplicatedFinding.id
        delete duplicatedFinding._templateId

        try {
            const template = await createFindingTemplate(duplicatedFinding)
            if (template) {
                const findingWithId = {
                    ...duplicatedFinding,
                    id: template.id,
                    _templateId: template.id
                }
                setCustomFindings(prev => [findingWithId, ...prev])
                toast({
                    title: "Finding Duplicated",
                    description: "Finding has been copied to My Templates.",
                })
                setActiveTab('custom')
            }
        } catch {
            toast({
                title: "Error",
                description: "Failed to duplicate finding.",
                variant: "destructive"
            })
        }
    }

    const handleDelete = async (id: string) => {
        try {
            await deleteFindingTemplate(id)
            setCustomFindings(prev => prev.filter(f => f.id !== id))
            toast({
                title: "Finding Deleted",
                description: "Template has been removed.",
            })
        } catch {
            toast({
                title: "Error",
                description: "Failed to delete template.",
                variant: "destructive"
            })
        }
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
            references: finding.references,
            cvssScore: finding.cvss_score || finding.cvssScore,
            cvssVector: finding.cvss_vector || finding.cvssVector
        }
        setEditingFinding(mappedFinding)
    }

    const handleUpdateFinding = async (updatedFinding: ProjectFinding) => {
        const updatedData = {
            title: updatedFinding.title,
            severity: updatedFinding.severity,
            description: updatedFinding.description,
            remediation: updatedFinding.recommendations,
            evidence: updatedFinding.evidence,
            references: updatedFinding.references,
            cvss_score: updatedFinding.cvssScore,
            cvss_vector: updatedFinding.cvssVector,
            cvssScore: updatedFinding.cvssScore,
            cvssVector: updatedFinding.cvssVector
        }

        try {
            await updateFindingTemplate(updatedFinding.id, updatedData)
            setCustomFindings(prev => prev.map(f => 
                f.id === updatedFinding.id ? { ...f, ...updatedData } : f
            ))
            setEditingFinding(null)
            toast({
                title: "Finding Updated",
                description: "Changes have been saved to the database.",
            })
        } catch {
            toast({
                title: "Error",
                description: "Failed to update template.",
                variant: "destructive"
            })
        }
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
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" onClick={() => setAddDialogOpen(true)}>
                        <Plus className="w-4 h-4 shrink-0" />
                        <span>New Finding</span>
                    </Button>
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
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="outline" className="border-slate-200 text-slate-600 hover:bg-slate-50 gap-2">
                                        <Filter className="w-4 h-4 shrink-0" />
                                        <span>Filter</span>
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
                        {isLoading && activeTab === 'custom' ? (
                            <div className="flex flex-col items-center justify-center text-center py-20 text-slate-500">
                                <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-4" />
                                <p className="text-slate-500">Loading templates...</p>
                            </div>
                        ) : filteredFindings.length === 0 ? (
                            <div className="flex flex-col items-center justify-center text-center py-20 text-slate-500">
                                {activeTab === 'custom' ? (
                                    <>
                                        <div className="w-16 h-16 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
                                            <FileText className="w-8 h-8 text-slate-300" />
                                        </div>
                                        <h3 className="text-lg font-semibold text-slate-900 mb-2">No custom templates yet</h3>
                                        <p className="max-w-sm mb-6 text-slate-500">Create your first custom finding template or duplicate one from the System Library to get started.</p>
                                        <Button onClick={() => setAddDialogOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2">
                                            <Plus className="w-4 h-4 shrink-0" />
                                            <span>Create Template</span>
                                        </Button>
                                    </>
                                ) : (
                                    <>
                                        <Filter className="w-12 h-12 mx-auto mb-4 text-slate-200" />
                                        <p>No findings found matching your criteria.</p>
                                        <Button variant="link" onClick={() => {
                                            setSelectedCategory('All')
                                            setSelectedSeverity('All')
                                        }} className="text-emerald-600">
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
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
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
                                                            className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
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
                                            className="text-xs h-8 border-slate-200 text-slate-600 hover:text-slate-900 gap-1"
                                        >
                                            <ChevronLeft className="w-3 h-3 shrink-0" />
                                            <span>Previous</span>
                                        </Button>
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            disabled={currentPage === totalPages || totalItems === 0}
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            className="text-xs h-8 border-slate-200 text-slate-600 hover:text-slate-900 gap-1"
                                        >
                                            <span>Next</span>
                                            <ChevronRight className="w-3 h-3 shrink-0" />
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
                    isSystemLibrary={activeTab === 'system'}
                />
            )}
        </div>
    )
}