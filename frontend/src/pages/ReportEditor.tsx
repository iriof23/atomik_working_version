import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ChevronLeft, FileText, BookOpen, Settings, Eye, Download, Save, ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import FindingsTabContent from '@/components/FindingsTabContent'
import { Editor } from '@/components/editor/Editor'
import { api } from '@/lib/api'
import { useToast } from '@/components/ui/use-toast'

// Default/fallback project data
const defaultProject = {
    id: '',
    name: 'Loading...',
    clientName: 'Loading...',
    clientLogoUrl: '🏢',
    status: 'In Progress' as const,
    progress: 0,
    findingsCount: 0,
    findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 }
}

type TabType = 'findings' | 'narrative' | 'settings' | 'preview' | 'export'

interface ReportData {
    id: string
    title: string
    report_type: string
    status: string
    html_content: string | null
    project_id: string
    project_name: string
    client_name: string
    generated_by_id: string
    generated_by_name: string
    created_at: string
    updated_at: string
}

export default function ReportEditor() {
    const { projectId: reportId } = useParams() // This is actually the report ID
    const navigate = useNavigate()
    const { getToken } = useAuth()
    const { toast } = useToast()
    
    const [activeTab, setActiveTab] = useState<TabType>('narrative')
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
    const [actualFindingsCount, setActualFindingsCount] = useState(0)
    const [isLoading, setIsLoading] = useState(true)
    const [isSaving, setIsSaving] = useState(false)
    const [reportData, setReportData] = useState<ReportData | null>(null)
    const [narrativeContent, setNarrativeContent] = useState<string>('')
    
    // Project data derived from report
    const project = reportData ? {
        id: reportData.project_id,
        name: reportData.project_name,
        clientName: reportData.client_name,
        clientLogoUrl: '🏢',
        status: reportData.status as 'In Progress' | 'Planning' | 'Completed',
        progress: 0,
        findingsCount: 0,
        findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 }
    } : defaultProject
    
    // Fetch report data on mount
    useEffect(() => {
        const fetchReport = async () => {
            if (!reportId) return
            
            setIsLoading(true)
            try {
                const token = await getToken()
                if (!token) {
                    toast({
                        title: 'Error',
                        description: 'Authentication required',
                        variant: 'destructive',
                    })
                    navigate('/reports')
                    return
                }

                const response = await api.get(`/v1/reports/${reportId}/detail`, {
                    headers: { Authorization: `Bearer ${token}` }
                })
                
                console.log('Report data:', response.data)
                setReportData(response.data)
                setNarrativeContent(response.data.html_content || '')
            } catch (error: any) {
                console.error('Failed to fetch report:', error)
                toast({
                    title: 'Error',
                    description: error.response?.data?.detail || 'Failed to load report',
                    variant: 'destructive',
                })
                // Navigate back if report not found
                if (error.response?.status === 404) {
                    navigate('/reports')
                }
            } finally {
                setIsLoading(false)
            }
        }
        
        fetchReport()
    }, [reportId, getToken, navigate, toast])

    // Function to fetch findings count from API
    const fetchFindingsCount = async () => {
        const projectIdForFindings = reportData?.project_id
        if (!projectIdForFindings) {
            setActualFindingsCount(0)
            return
        }

        try {
            const token = await getToken()
            if (!token) {
                setActualFindingsCount(0)
                return
            }

            const response = await api.get(`/findings?project_id=${projectIdForFindings}`, {
                headers: { Authorization: `Bearer ${token}` }
            })

            if (response.data && Array.isArray(response.data)) {
                setActualFindingsCount(response.data.length)
            } else {
                setActualFindingsCount(0)
            }
        } catch (error) {
            console.error('Failed to fetch findings count:', error)
            setActualFindingsCount(0)
        }
    }

    // Load actual findings count from API
    useEffect(() => {
        if (reportData?.project_id) {
            fetchFindingsCount()
        
            // Refresh count periodically (every 5 seconds) to catch updates
        const interval = setInterval(() => {
                fetchFindingsCount()
            }, 5000)
        
            return () => clearInterval(interval)
        } else {
            setActualFindingsCount(0)
        }
    }, [reportData?.project_id, getToken])
    
    // Handler to update findings count when FindingsTabContent updates
    const handleFindingsUpdate = () => {
        fetchFindingsCount()
    }
    
    // Recalculate count when switching to findings tab
    useEffect(() => {
        if (activeTab === 'findings') {
            fetchFindingsCount()
        }
    }, [activeTab])

    // Report settings state - initialize from report data when available
    const [reportSettings, setReportSettings] = useState({
        clientLogo: '',
        clientName: '',
        reportTitle: '',
        primaryColor: '#10b981', // emerald-500
        headerText: 'Confidential',
        footerText: 'Prepared by Atomik Security',
        preparedBy: 'Security Team',
        confidentialityLevel: 'Confidential' as const
    })
    
    // Update report settings when report data loads
    useEffect(() => {
        if (reportData) {
            setReportSettings(prev => ({
                ...prev,
                clientName: reportData.client_name,
                reportTitle: `${reportData.project_name} - Security Assessment Report`,
            }))
        }
    }, [reportData])

    const handleBack = () => {
        if (hasUnsavedChanges) {
            if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
                navigate('/reports')
            }
        } else {
            navigate('/reports')
        }
    }

    const handleSave = async () => {
        if (!reportId || !reportData) return
        
        setIsSaving(true)
        try {
            const token = await getToken()
            if (!token) {
                toast({
                    title: 'Error',
                    description: 'Authentication required',
                    variant: 'destructive',
                })
                return
            }

            await api.put(`/v1/reports/${reportId}`, {
                title: reportSettings.reportTitle || reportData.title,
                html_content: narrativeContent,
            }, {
                headers: { Authorization: `Bearer ${token}` }
            })
            
        setHasUnsavedChanges(false)
            toast({
                title: 'Saved',
                description: 'Report saved successfully.',
            })
        } catch (error: any) {
            console.error('Failed to save report:', error)
            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to save report',
                variant: 'destructive',
            })
        } finally {
            setIsSaving(false)
        }
    }

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'In Progress':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
            case 'Planning':
                return 'bg-purple-500/10 text-purple-500 border-purple-500/20'
            case 'Completed':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            default:
                return 'bg-gray-500/10 text-gray-400 border-gray-500/20'
        }
    }

    const tabs = [
        { id: 'narrative' as TabType, label: 'Narrative', icon: BookOpen },
        { id: 'findings' as TabType, label: 'Findings', icon: FileText },
        { id: 'settings' as TabType, label: 'Settings', icon: Settings },
        { id: 'preview' as TabType, label: 'Preview', icon: Eye },
        { id: 'export' as TabType, label: 'Export', icon: Download }
    ]

    // Show loading state
    if (isLoading) {
        return (
            <div className="h-[calc(100vh-100px)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-500 mx-auto" />
                    <p className="text-zinc-400 mt-2">Loading report...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Breadcrumb Navigation */}
            <div className="flex items-center gap-2 text-sm">
                <Link
                    to="/reports"
                    className="flex items-center gap-1 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Reports
                </Link>
                <span className="text-gray-400">/</span>
                <Link
                    to="/clients"
                    className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
                >
                    {project.clientName}
                </Link>
                <span className="text-gray-400">/</span>
                <span className="text-gray-900 dark:text-white font-medium">{project.name}</span>
            </div>

            {/* Project Header */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="text-3xl">{project.clientLogoUrl}</div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {project.name}
                                </h1>
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {project.clientName}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge className={getStatusColor(project.status)}>
                                {project.status}
                            </Badge>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                    {actualFindingsCount} Finding{actualFindingsCount !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                    {actualFindingsCount > 0 ? Math.round((actualFindingsCount / 10) * 100) : 0}% Complete
                                </p>
                            </div>
                            <Button onClick={handleSave} size="sm" disabled={!hasUnsavedChanges || isSaving}>
                                {isSaving ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                <Save className="w-4 h-4 mr-2" />
                                {hasUnsavedChanges ? 'Save Changes' : 'Saved'}
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Tab Navigation */}
            <div className="border-b border-gray-200 dark:border-gray-700">
                <div className="flex gap-1">
                    {tabs.map((tab) => {
                        const Icon = tab.icon
                        return (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative',
                                    activeTab === tab.id
                                        ? 'text-primary'
                                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary" />
                                )}
                            </button>
                        )
                    })}
                </div>
            </div>

            {/* Tab Content */}
            <div className="min-h-[600px]">
                {activeTab === 'findings' && (
                    <FindingsTab
                        projectId={reportData?.project_id}
                        onUpdate={() => {
                            setHasUnsavedChanges(true)
                            // Update findings count
                            handleFindingsUpdate()
                        }}
                    />
                )}
                {activeTab === 'narrative' && (
                    <NarrativeTab 
                        initialContent={narrativeContent}
                        onUpdate={(content) => {
                            setNarrativeContent(content)
                            setHasUnsavedChanges(true)
                        }} 
                    />
                )}
                {activeTab === 'settings' && (
                    <SettingsTab
                        settings={reportSettings}
                        onUpdate={(newSettings) => {
                            setReportSettings(newSettings)
                            setHasUnsavedChanges(true)
                        }}
                    />
                )}
                {activeTab === 'preview' && (
                    <PreviewTab settings={reportSettings} project={project} />
                )}
                {activeTab === 'export' && (
                    <ExportTab />
                )}
            </div>
        </div >
    )
}

// Findings Tab Component
function FindingsTab({ projectId, onUpdate }: { projectId?: string; onUpdate: () => void }) {
    return <FindingsTabContent projectId={projectId} onUpdate={onUpdate} />
}

// Narrative Tab Component
interface NarrativeContent {
    executiveSummary: string
    methodology: string
    scope: string
}

function NarrativeTab({ 
    initialContent, 
    onUpdate 
}: { 
    initialContent: string
    onUpdate: (content: string) => void 
}) {
    // Parse initial content from JSON string (from database)
    const parseInitialContent = (): NarrativeContent => {
        if (!initialContent) {
            return { executiveSummary: '', methodology: '', scope: '' }
        }
        try {
            const parsed = JSON.parse(initialContent)
            return {
                executiveSummary: parsed.executiveSummary || parsed.executive_summary || '',
                methodology: parsed.methodology || '',
                scope: parsed.narrative_scope || parsed.scope || ''
            }
        } catch {
            // If not valid JSON, treat as raw HTML for executive summary
            return { executiveSummary: initialContent, methodology: '', scope: '' }
        }
    }
    
    const [narrative, setNarrative] = useState<NarrativeContent>(parseInitialContent)
    
    // Serialize narrative to JSON string whenever it changes
    const serializeNarrative = (updated: NarrativeContent): string => {
        return JSON.stringify({
            executiveSummary: updated.executiveSummary,
            methodology: updated.methodology,
            narrative_scope: updated.scope
    })
    }

    return (
        <div className="space-y-4">
            <CollapsibleSection title="Executive Summary" defaultOpen={true}>
                <Editor
                    content={narrative.executiveSummary}
                    onChange={(html) => {
                        const updated = { ...narrative, executiveSummary: html }
                        setNarrative(updated)
                        onUpdate(serializeNarrative(updated))
                    }}
                    placeholder="Provide a high-level overview of the assessment..."
                />
            </CollapsibleSection>

            <CollapsibleSection title="Methodology" defaultOpen={true}>
                <Editor
                    content={narrative.methodology}
                    onChange={(html) => {
                        const updated = { ...narrative, methodology: html }
                        setNarrative(updated)
                        onUpdate(serializeNarrative(updated))
                    }}
                    placeholder="Describe the testing methodology used..."
                />
            </CollapsibleSection>

            <CollapsibleSection title="Scope" defaultOpen={true}>
                <Editor
                    content={narrative.scope}
                    onChange={(html) => {
                        const updated = { ...narrative, scope: html }
                        setNarrative(updated)
                        onUpdate(serializeNarrative(updated))
                    }}
                    placeholder="Define the scope of the assessment..."
                />
            </CollapsibleSection>
        </div>
    )
}

function CollapsibleSection({
    title,
    children,
    defaultOpen = false
}: {
    title: string
    children: React.ReactNode
    defaultOpen?: boolean
}) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    return (
        <Card>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors rounded-t-lg"
            >
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {title}
                </h2>
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                )}
            </button>
            {isOpen && (
                <CardContent className="p-4 pt-0">
                    {children}
                </CardContent>
            )}
        </Card>
    )
}

// Settings Tab Component (Client Branding)
function SettingsTab({
    settings,
    onUpdate
}: {
    settings: any;
    onUpdate: (settings: any) => void
}) {
    const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (file) {
            // Validate file type
            if (!file.type.startsWith('image/')) {
                alert('Please upload an image file')
                return
            }

            // Validate file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                alert('File size must be less than 2MB')
                return
            }

            // Convert to base64
            const reader = new FileReader()
            reader.onloadend = () => {
                onUpdate({ ...settings, clientLogo: reader.result as string })
            }
            reader.readAsDataURL(file)
        }
    }

    return (
        <div className="max-w-3xl space-y-4">
            <Card>
                <CardContent className="p-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Client Branding
                    </h3>

                    {/* Logo Upload */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Client Logo
                        </label>
                        <div className="flex items-center gap-4">
                            {settings.clientLogo ? (
                                <div className="relative">
                                    <img
                                        src={settings.clientLogo}
                                        alt="Client logo"
                                        className="h-16 w-auto max-w-[200px] object-contain border border-gray-300 dark:border-gray-600 rounded-lg p-2"
                                    />
                                    <button
                                        onClick={() => onUpdate({ ...settings, clientLogo: '' })}
                                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs hover:bg-red-600"
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className="h-16 w-32 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg flex items-center justify-center text-gray-400">
                                    No logo
                                </div>
                            )}
                            <label className="cursor-pointer">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleLogoUpload}
                                    className="hidden"
                                />
                                <div className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                                    {settings.clientLogo ? 'Change Logo' : 'Upload Logo'}
                                </div>
                            </label>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                            PNG, JPG, or SVG. Max 2MB.
                        </p>
                    </div>

                    {/* Report Title */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Report Title
                        </label>
                        <input
                            type="text"
                            value={settings.reportTitle}
                            onChange={(e) => onUpdate({ ...settings, reportTitle: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        />
                    </div>

                    {/* Primary Color */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Primary Color
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                type="color"
                                value={settings.primaryColor}
                                onChange={(e) => onUpdate({ ...settings, primaryColor: e.target.value })}
                                className="h-10 w-20 rounded-lg cursor-pointer"
                            />
                            <input
                                type="text"
                                value={settings.primaryColor}
                                onChange={(e) => onUpdate({ ...settings, primaryColor: e.target.value })}
                                className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                                placeholder="#10b981"
                            />
                        </div>
                    </div>

                    {/* Header Text */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Header Text
                        </label>
                        <input
                            type="text"
                            value={settings.headerText}
                            onChange={(e) => onUpdate({ ...settings, headerText: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="e.g., Confidential"
                        />
                    </div>

                    {/* Footer Text */}
                    <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Footer Text
                        </label>
                        <input
                            type="text"
                            value={settings.footerText}
                            onChange={(e) => onUpdate({ ...settings, footerText: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                            placeholder="e.g., Prepared by Atomik Security"
                        />
                    </div>

                    {/* Confidentiality Level */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Confidentiality Level
                        </label>
                        <select
                            value={settings.confidentialityLevel}
                            onChange={(e) => onUpdate({ ...settings, confidentialityLevel: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            <option value="Public">Public</option>
                            <option value="Confidential">Confidential</option>
                            <option value="Strictly Confidential">Strictly Confidential</option>
                        </select>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// Preview Tab Component
function PreviewTab({ settings, project }: { settings: any; project: any }) {
    return (
        <Card>
            <CardContent className="p-8">
                <div className="max-w-4xl mx-auto bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg p-8 shadow-lg">
                    {/* Report Header */}
                    <div className="border-b pb-6 mb-6" style={{ borderColor: settings.primaryColor }}>
                        <div className="flex items-center justify-between mb-4">
                            {settings.clientLogo && (
                                <img
                                    src={settings.clientLogo}
                                    alt="Client logo"
                                    className="h-12 w-auto max-w-[200px] object-contain"
                                />
                            )}
                            <div className="text-right">
                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                    {settings.headerText}
                                </p>
                            </div>
                        </div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                            {settings.reportTitle}
                        </h1>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                            {project.clientName}
                        </p>
                    </div>

                    {/* Report Content Preview */}
                    <div className="space-y-6">
                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" style={{ color: settings.primaryColor }}>
                                Executive Summary
                            </h2>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                This is a preview of your report. The actual content will appear here based on your findings and narrative.
                            </p>
                        </div>

                        <div>
                            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2" style={{ color: settings.primaryColor }}>
                                Findings Summary
                            </h2>
                            <div className="grid grid-cols-4 gap-3">
                                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-red-600">{project.findingsBySeverity.critical}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Critical</p>
                                </div>
                                <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-orange-600">{project.findingsBySeverity.high}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">High</p>
                                </div>
                                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-yellow-600">{project.findingsBySeverity.medium}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Medium</p>
                                </div>
                                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-green-600">{project.findingsBySeverity.low}</p>
                                    <p className="text-xs text-gray-600 dark:text-gray-400">Low</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Report Footer */}
                    <div className="border-t mt-8 pt-4 text-center" style={{ borderColor: settings.primaryColor }}>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                            {settings.footerText}
                        </p>
                    </div>
                </div>
            </CardContent>
        </Card>
    )
}

// Export Tab Component
function ExportTab() {
    const [exportFormat, setExportFormat] = useState<'pdf' | 'docx' | 'html'>('pdf')
    const [isExporting, setIsExporting] = useState(false)

    const handleExport = () => {
        setIsExporting(true)
        // TODO: Implement actual export
        setTimeout(() => {
            setIsExporting(false)
            alert(`Exported as ${exportFormat.toUpperCase()}`)
        }, 2000)
    }

    return (
        <div className="max-w-2xl mx-auto">
            <Card>
                <CardContent className="p-6">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                        Export Report
                    </h3>

                    {/* Format Selection */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Export Format
                        </label>
                        <div className="grid grid-cols-3 gap-3">
                            {(['pdf', 'docx', 'html'] as const).map((format) => (
                                <button
                                    key={format}
                                    onClick={() => setExportFormat(format)}
                                    className={cn(
                                        'p-4 border-2 rounded-lg text-center transition-all',
                                        exportFormat === format
                                            ? 'border-primary bg-primary/5'
                                            : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                                    )}
                                >
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white uppercase">
                                        {format}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Export Button */}
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="w-full"
                        size="lg"
                    >
                        <Download className="w-4 h-4 mr-2" />
                        {isExporting ? 'Exporting...' : `Export as ${exportFormat.toUpperCase()}`}
                    </Button>

                    {/* Export Info */}
                    <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                        <p className="text-sm text-blue-900 dark:text-blue-100">
                            <strong>Note:</strong> Your report will include all findings, narrative sections, and client branding.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
