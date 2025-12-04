import { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { ChevronLeft, FileText, BookOpen, Settings, Download, Save, ChevronDown, ChevronRight, Loader2, AlertTriangle } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
    clientLogoUrl: '',
    status: 'In Progress' as const,
    progress: 0,
    findingsCount: 0,
    findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 }
}

type TabType = 'findings' | 'narrative' | 'settings' | 'export'

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
    const [showUnsavedDialog, setShowUnsavedDialog] = useState(false)
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
        clientLogoUrl: '',
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

            const response = await api.get(`/findings/?project_id=${projectIdForFindings}`, {
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
        confidentialityLevel: 'Confidential' as const,
        pdfTemplate: 'classic' as 'classic' | 'apple'
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
            setShowUnsavedDialog(true);
        } else {
            navigate('/reports');
        }
    };

    const handleDiscardAndLeave = () => {
        setShowUnsavedDialog(false);
        setHasUnsavedChanges(false);
        navigate('/reports');
    };

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
                return 'bg-slate-800 text-white shadow-sm border-0'
            case 'Planning':
                return 'bg-slate-200 text-slate-700 shadow-sm border-0'
            case 'Completed':
                return 'bg-emerald-600 text-white shadow-sm border-0'
            case 'On Hold':
                return 'bg-amber-600 text-white shadow-sm border-0'
            default:
                return 'bg-slate-200 text-slate-700 shadow-sm border-0'
        }
    }

    const tabs = [
        { id: 'narrative' as TabType, label: 'Narrative', icon: BookOpen },
        { id: 'findings' as TabType, label: 'Findings', icon: FileText },
        { id: 'settings' as TabType, label: 'Settings', icon: Settings },
        { id: 'export' as TabType, label: 'Export', icon: Download }
    ]

    // Show loading state
    if (isLoading) {
        return (
            <div className="h-[calc(100vh-100px)] flex items-center justify-center">
                <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-emerald-600 mx-auto" />
                    <p className="text-slate-500 mt-2">Loading report...</p>
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
                    className="flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    Reports
                </Link>
                <span className="text-slate-300">/</span>
                <Link
                    to="/clients"
                    className="text-slate-500 hover:text-slate-900 transition-colors"
                >
                    {project.clientName}
                </Link>
                <span className="text-slate-300">/</span>
                <span className="text-slate-900 font-medium">{project.name}</span>
            </div>

            {/* Project Header */}
            <Card>
                <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white text-sm font-semibold">
                                {project.name.slice(0, 2).toUpperCase()}
                            </div>
                            <div>
                                <h1 className="text-lg font-semibold text-slate-900">
                                    {project.name}
                                </h1>
                                <p className="text-sm text-slate-500">
                                    {project.clientName}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <Badge className={getStatusColor(project.status)}>
                                {project.status}
                            </Badge>
                            <div className="text-right">
                                <p className="text-sm font-semibold text-slate-900">
                                    {actualFindingsCount} Finding{actualFindingsCount !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-slate-500">
                                    {actualFindingsCount > 0 ? Math.round((actualFindingsCount / 10) * 100) : 0}% Complete
                                </p>
                            </div>
                            <Button onClick={handleSave} size="sm" disabled={!hasUnsavedChanges || isSaving} className="bg-emerald-600 hover:bg-emerald-700">
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
            <div className="border-b border-slate-200">
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
                                        ? 'text-emerald-600'
                                        : 'text-slate-500 hover:text-slate-900'
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {tab.label}
                                {activeTab === tab.id && (
                                    <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-emerald-600" />
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
                {activeTab === 'export' && reportId && (
                    <ExportTab reportId={reportId} settings={reportSettings} />
                )}
            </div>

            {/* Unsaved Changes Warning */}
            <AlertDialog open={showUnsavedDialog} onOpenChange={setShowUnsavedDialog}>
                <AlertDialogContent className="bg-white border-slate-200 shadow-2xl sm:rounded-2xl">
                    <AlertDialogHeader>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                            </div>
                            <AlertDialogTitle className="text-lg font-semibold text-slate-900">
                                Unsaved Report Changes
                            </AlertDialogTitle>
                        </div>
                        <AlertDialogDescription className="text-sm text-slate-500 leading-relaxed pl-13">
                            You have unsaved changes to this report. If you leave now, your changes will be lost.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter className="gap-2">
                        <AlertDialogCancel 
                            className="border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                            onClick={handleDiscardAndLeave}
                        >
                            Leave Anyway
                        </AlertDialogCancel>
                        <AlertDialogAction
                            onClick={() => setShowUnsavedDialog(false)}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white"
                        >
                            Stay & Save
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
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
                className="w-full flex items-center justify-between p-4 hover:bg-slate-50 transition-colors rounded-t-lg"
            >
                <h2 className="text-sm font-semibold text-slate-900">
                    {title}
                </h2>
                {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                ) : (
                    <ChevronRight className="w-4 h-4 text-slate-400" />
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
        <div className="space-y-4">
            <Card>
                <CardContent className="p-5">
                    <h3 className="text-sm font-semibold text-slate-900 mb-4">
                        Client Branding
                    </h3>

                    {/* Logo Upload - Full Width */}
                    <div className="mb-4 pb-4 border-b border-slate-100">
                        <label className="block text-xs font-medium text-slate-700 mb-2">
                            Client Logo
                        </label>
                        <div className="flex items-center gap-3">
                            {settings.clientLogo ? (
                                <div className="relative">
                                    <img
                                        src={settings.clientLogo}
                                        alt="Client logo"
                                        className="h-12 w-auto max-w-[160px] object-contain border border-slate-200 rounded-lg p-1.5"
                                    />
                                    <button
                                        onClick={() => onUpdate({ ...settings, clientLogo: '' })}
                                        className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full w-4 h-4 flex items-center justify-center text-xs hover:bg-red-600"
                                    >
                                        ×
                                    </button>
                                </div>
                            ) : (
                                <div className="h-12 w-24 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center text-slate-400 text-xs">
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
                                <div className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 transition-colors">
                                    {settings.clientLogo ? 'Change' : 'Upload'}
                                </div>
                            </label>
                            <span className="text-xs text-slate-400">PNG, JPG, SVG · Max 2MB</span>
                        </div>
                    </div>

                    {/* Report Title - Full Width */}
                    <div className="mb-4">
                        <label className="block text-xs font-medium text-slate-700 mb-1.5">
                            Report Title
                        </label>
                        <input
                            type="text"
                            value={settings.reportTitle}
                            onChange={(e) => onUpdate({ ...settings, reportTitle: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                    </div>

                    {/* 2-Column Grid */}
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        {/* Primary Color */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Primary Color
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="color"
                                    value={settings.primaryColor}
                                    onChange={(e) => onUpdate({ ...settings, primaryColor: e.target.value })}
                                    className="h-9 w-14 rounded-lg cursor-pointer border border-slate-200"
                                />
                                <input
                                    type="text"
                                    value={settings.primaryColor}
                                    onChange={(e) => onUpdate({ ...settings, primaryColor: e.target.value })}
                                    className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                    placeholder="#10b981"
                                />
                            </div>
                        </div>

                        {/* Header Text */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Header Text
                            </label>
                            <input
                                type="text"
                                value={settings.headerText}
                                onChange={(e) => onUpdate({ ...settings, headerText: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                placeholder="e.g., Confidential"
                            />
                        </div>

                        {/* Footer Text */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Footer Text
                            </label>
                            <input
                                type="text"
                                value={settings.footerText}
                                onChange={(e) => onUpdate({ ...settings, footerText: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                                placeholder="e.g., Prepared by Atomik Security"
                            />
                        </div>

                        {/* Confidentiality Level */}
                        <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1.5">
                                Confidentiality Level
                            </label>
                            <select
                                value={settings.confidentialityLevel}
                                onChange={(e) => onUpdate({ ...settings, confidentialityLevel: e.target.value })}
                                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            >
                                <option value="Public">Public</option>
                                <option value="Confidential">Confidential</option>
                                <option value="Strictly Confidential">Strictly Confidential</option>
                            </select>
                        </div>
                    </div>

                    {/* PDF Template Style - Full Width with visual selector */}
                    <div className="pt-4 border-t border-slate-100">
                        <label className="block text-xs font-medium text-slate-700 mb-2">
                            PDF Template Style
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => onUpdate({ ...settings, pdfTemplate: 'classic' })}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                    (settings.pdfTemplate || 'classic') === 'classic'
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-3 h-3 rounded-full border-2 ${
                                        (settings.pdfTemplate || 'classic') === 'classic'
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : 'border-slate-300'
                                    }`}>
                                        {(settings.pdfTemplate || 'classic') === 'classic' && (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="w-1 h-1 bg-white rounded-full" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-slate-900">Classic Premium</span>
                                </div>
                                <p className="text-xs text-slate-500 ml-5">Dark headers, structured cards</p>
                            </button>
                            <button
                                type="button"
                                onClick={() => onUpdate({ ...settings, pdfTemplate: 'apple' })}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                    settings.pdfTemplate === 'apple'
                                        ? 'border-emerald-500 bg-emerald-50'
                                        : 'border-slate-200 hover:border-slate-300 bg-white'
                                }`}
                            >
                                <div className="flex items-center gap-2 mb-1">
                                    <div className={`w-3 h-3 rounded-full border-2 ${
                                        settings.pdfTemplate === 'apple'
                                            ? 'border-emerald-500 bg-emerald-500'
                                            : 'border-slate-300'
                                    }`}>
                                        {settings.pdfTemplate === 'apple' && (
                                            <div className="w-full h-full flex items-center justify-center">
                                                <div className="w-1 h-1 bg-white rounded-full" />
                                            </div>
                                        )}
                                    </div>
                                    <span className="text-sm font-medium text-slate-900">Apple Minimal</span>
                                </div>
                                <p className="text-xs text-slate-500 ml-5">Clean, spacious layout</p>
                            </button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

// Export Tab Component
function ExportTab({ reportId, settings }: { reportId: string, settings: any }) {
    const [exportFormat, setExportFormat] = useState<'pdf' | 'docx'>('pdf')
    const [isExporting, setIsExporting] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const { getToken } = useAuth()
    const { toast } = useToast()

    const handleExport = async () => {
        setIsExporting(true)
        setError(null)
        
        try {
            const token = await getToken()
            if (!token) {
                throw new Error('Authentication required')
            }

            // Build the export URL with template parameter for PDF
            const pdfTemplate = settings.pdfTemplate || 'classic'
            const templateParam = exportFormat === 'pdf' ? `&template=${pdfTemplate}` : ''
            
            // Call the export API
            const response = await fetch(
                `${import.meta.env.VITE_API_URL || 'http://localhost:8000'}/api/v1/reports/${reportId}/export?format=${exportFormat}${templateParam}`,
                {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                    },
                }
            )

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.detail || `Export failed: ${response.statusText}`)
            }

            // Get the filename from the Content-Disposition header
            const contentDisposition = response.headers.get('Content-Disposition')
            let filename = `report.${exportFormat}`
            if (contentDisposition) {
                const match = contentDisposition.match(/filename="(.+)"/)
                if (match) {
                    filename = match[1]
                }
            }

            // Download the file
            const blob = await response.blob()
            const url = window.URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = filename
            document.body.appendChild(a)
            a.click()
            window.URL.revokeObjectURL(url)
            document.body.removeChild(a)

            toast({
                title: 'Export Successful',
                description: `Your report has been exported as ${exportFormat.toUpperCase()}.`,
            })
        } catch (err: any) {
            console.error('Export failed:', err)
            setError(err.message || 'Failed to export report')
            toast({
                title: 'Export Failed',
                description: err.message || 'Failed to export report. Please try again.',
                variant: 'destructive',
            })
        } finally {
            setIsExporting(false)
        }
    }

    return (
        <div className="max-w-2xl mx-auto">
            <Card>
                <CardContent className="p-6">
                    <h3 className="text-sm font-semibold text-slate-900 mb-6">
                        Export Report
                    </h3>

                    {/* Format Selection */}
                    <div className="mb-6">
                        <label className="block text-xs font-medium text-slate-700 mb-3">
                            Export Format
                        </label>
                        <div className="grid grid-cols-2 gap-3">
                            {(['pdf', 'docx'] as const).map((format) => (
                                <button
                                    key={format}
                                    onClick={() => setExportFormat(format)}
                                    className={cn(
                                        'p-4 border-2 rounded-xl text-center transition-all',
                                        exportFormat === format
                                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                                    )}
                                >
                                    <p className="text-sm font-semibold uppercase">
                                        {format}
                                    </p>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {format === 'pdf' ? 'Print-ready document' : 'Editable document'}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
                            <p className="text-sm text-red-600">{error}</p>
                        </div>
                    )}

                    {/* Export Button */}
                    <Button
                        onClick={handleExport}
                        disabled={isExporting}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                        size="lg"
                    >
                        {isExporting ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Generating {exportFormat.toUpperCase()}...
                            </>
                        ) : (
                            <>
                        <Download className="w-4 h-4 mr-2" />
                                Export as {exportFormat.toUpperCase()}
                            </>
                        )}
                    </Button>

                    {/* Export Info */}
                    <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                        <p className="text-sm text-slate-600">
                            <strong className="text-slate-700">Note:</strong> Your report will include all findings, narrative sections, and client branding.
                        </p>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
