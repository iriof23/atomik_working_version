import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '@clerk/clerk-react'
import { useLocation } from 'react-router-dom'
import {
  Users,
  FileText,
  AlertTriangle,
  LayoutGrid,
  List,
  Table2,
  Plus,
  Filter,
  Download,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  FolderOpen,
  ExternalLink,
  Archive,
  Copy,
  X,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Building2,
  Mail,
  Phone,
  Globe,
  TrendingUp,
  Shield,
  ChevronRight
} from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ClientListItem } from '@/components/ClientListItem'
import { FilterDialog, FilterConfig, ActiveFilters } from '@/components/FilterDialog'
import { api } from '@/lib/api'
import { logClientCreated, logClientUpdated, logClientDeleted } from '@/lib/activityLog'
import { cn } from '@/lib/utils'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Skeleton } from '@/components/ui/skeleton'
import { AddClientDialog } from '@/components/AddClientDialog'
import ClientDetailModal from '@/components/ClientDetailModal'
import { ClientCard } from '@/components/ClientCard'
import { useToast } from '@/components/ui/use-toast'
import { StatCard } from '@/components/StatCard'
import { Client } from '@/types'

// API response types
interface APIProjectResponse {
  client_id: string
  finding_count?: number
  findings_by_severity?: { critical: number; high: number; medium: number; low: number }
}

interface APIClientResponse {
  id: string
  name: string
  website_url?: string
  industry?: string
  company_size?: string
  primary_contact?: string
  email?: string
  phone?: string
  tags?: string | string[]
  notes?: string
  status?: string
  risk_level?: string
  created_at?: string
  updated_at?: string
  logo_url?: string
}

type ViewMode = 'card' | 'table' | 'list'

export default function Clients() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('atomik_client_view_mode')
    return (saved === 'card' || saved === 'table' || saved === 'list') ? saved : 'table'
  })
  const [activeFilters, setActiveFilters] = useState<Array<{ id: string, label: string, value: string }>>([])
  const { toast } = useToast()
  const [filterDialogOpen, setFilterDialogOpen] = useState(false)
  const [appliedFilters, setAppliedFilters] = useState<ActiveFilters>({})
  const [clients, setClients] = useState<Client[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [addClientDialogOpen, setAddClientDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [viewingClient, setViewingClient] = useState<Client | null>(null)
  const [deletingClient, setDeletingClient] = useState<Client | null>(null)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null)
  const { getToken } = useAuth()
  const location = useLocation()

  // Fetch clients from API function (PRESERVED)
  const fetchClients = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = await getToken()
      if (token) {
        const [clientsResponse, projectsResponse] = await Promise.all([
          api.get('/clients/', { headers: { Authorization: `Bearer ${token}` } }),
          api.get('/v1/projects/', { headers: { Authorization: `Bearer ${token}` } })
        ])
        
        if (clientsResponse.data && Array.isArray(clientsResponse.data)) {
          // Aggregate findings data from projects (using findings_by_severity from API)
          const projectsByClient: Record<string, { count: number, findings: { total: number, critical: number, high: number, medium: number, low: number } }> = {}
          
          if (Array.isArray(projectsResponse.data)) {
            projectsResponse.data.forEach((p: APIProjectResponse) => {
              if (p.client_id) {
                if (!projectsByClient[p.client_id]) {
                  projectsByClient[p.client_id] = { count: 0, findings: { total: 0, critical: 0, high: 0, medium: 0, low: 0 } }
                }
                projectsByClient[p.client_id].count++
                
                // Use severity breakdown from projects API (no extra findings API calls needed)
                const severity = p.findings_by_severity || { critical: 0, high: 0, medium: 0, low: 0 }
                const findingCount = p.finding_count || 0
                
                projectsByClient[p.client_id].findings.total += findingCount
                projectsByClient[p.client_id].findings.critical += severity.critical || 0
                projectsByClient[p.client_id].findings.high += severity.high || 0
                projectsByClient[p.client_id].findings.medium += severity.medium || 0
                projectsByClient[p.client_id].findings.low += severity.low || 0
              }
            })
          }
          
          if (clientsResponse.data.length > 0) {
            const apiClients: Client[] = clientsResponse.data.map((c: APIClientResponse) => {
              const websiteUrl = typeof c.website_url === 'string' ? c.website_url.trim() : ''
              
              let parsedTags: string[] = []
              if (c.tags) {
                try {
                  parsedTags = typeof c.tags === 'string' ? JSON.parse(c.tags) : c.tags
                } catch {
                  parsedTags = []
                }
              }
              
              const clientData = projectsByClient[c.id] || { count: 0, findings: { total: 0, critical: 0, high: 0, medium: 0, low: 0 } }

              return {
                id: c.id,
                name: c.name,
                logoUrl: '', // Don't use website URL as logo - use fallback initials instead
                status: c.status || 'Prospect',
                riskLevel: c.risk_level || 'Medium',
                industry: c.industry || 'Technology',
                companySize: c.company_size || 'SMB',
                primaryContact: c.contact_name || '',
                email: c.contact_email || '',
                phone: c.contact_phone || '',
                lastActivity: 'Recently',
                lastActivityDate: c.updated_at ? new Date(c.updated_at) : new Date(),
                tags: parsedTags,
                notes: c.notes || '',
                projectsCount: clientData.count,
                reportsCount: 0,
                totalFindings: clientData.findings.total,
                findingsBySeverity: { 
                  critical: clientData.findings.critical, 
                  high: clientData.findings.high, 
                  medium: clientData.findings.medium, 
                  low: clientData.findings.low 
                },
                createdAt: c.created_at ? new Date(c.created_at) : new Date(),
                updatedAt: c.updated_at ? new Date(c.updated_at) : new Date(),
              }
            })
            
            setClients(apiClients)
          } else {
            setClients([])
          }
        } else {
          setClients([])
        }
      } else {
        setClients([])
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error)
      setClients([])
    } finally {
      setIsLoading(false)
    }
  }, [getToken])

  useEffect(() => {
    fetchClients()
  }, [location.key, fetchClients])

  useEffect(() => {
    localStorage.setItem('atomik_client_view_mode', viewMode)
  }, [viewMode])

  // Filter management (PRESERVED)
  const removeFilter = (id: string) => {
    setActiveFilters(activeFilters.filter(f => f.id !== id))
  }

  const clearAllFilters = () => {
    setActiveFilters([])
  }

  const openAddClientDialog = () => {
    setEditingClient(null)
    setAddClientDialogOpen(true)
  }

  // Client handlers (PRESERVED)
  const handleClientAdded = (newClient: APIClientResponse) => {
    const mappedClient: Client = {
      id: newClient.id,
      name: newClient.name,
      logoUrl: newClient.logoUrl || '',
      status: newClient.status || 'Prospect',
      riskLevel: newClient.riskLevel || 'Medium',
      industry: newClient.industry || 'Technology',
      companySize: newClient.companySize || 'SMB',
      primaryContact: newClient.primaryContact || newClient.contact_name || '',
      email: newClient.email || newClient.contact_email || '',
      phone: newClient.phone || newClient.contact_phone || '',
      lastActivity: 'Just now',
      lastActivityDate: new Date(),
      tags: newClient.tags || [],
      notes: newClient.notes || '',
      projectsCount: editingClient?.projectsCount || 0,
      reportsCount: editingClient?.reportsCount || 0,
      totalFindings: editingClient?.totalFindings || 0,
      findingsBySeverity: editingClient?.findingsBySeverity || { critical: 0, high: 0, medium: 0, low: 0 },
      createdAt: newClient.createdAt || new Date(),
      updatedAt: new Date(),
    }
    
    if (editingClient) {
      const updatedClients = clients.map(c => 
        c.id === editingClient.id 
          ? { ...mappedClient, projectsCount: c.projectsCount, reportsCount: c.reportsCount, totalFindings: c.totalFindings, findingsBySeverity: c.findingsBySeverity } 
          : c
      )
      setClients(updatedClients)
      setEditingClient(null)
      logClientUpdated(newClient.name, newClient.id)
    } else {
      setClients([mappedClient, ...clients])
      logClientCreated(newClient.name, newClient.id)
    }
    
    toast({
      title: "✓ Client Saved",
      description: `${newClient.name} has been ${editingClient ? 'updated' : 'added'}.`,
    })
  }

  const handleViewClient = (client: Client) => setViewingClient(client)
  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setAddClientDialogOpen(true)
  }
  const handleDeleteClient = (client: Client) => setDeletingClient(client)

  const [isDeleting, setIsDeleting] = useState(false)

  const confirmDeleteClient = async () => {
    if (!deletingClient) return
    
    setIsDeleting(true)
    try {
      const token = await getToken()
      if (!token) {
        toast({ title: "Error", description: "Authentication required", variant: "destructive" })
        return
      }

      await api.delete(`/clients/${deletingClient.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      logClientDeleted(deletingClient.name, deletingClient.id)
      setClients(clients.filter(c => c.id !== deletingClient.id))
      
      toast({
        title: "Client Deleted",
        description: `${deletingClient.name} has been removed.`,
      })
    } catch (error) {
      console.error('Failed to delete client:', error)
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete client.",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setDeletingClient(null)
    }
  }

  const handleDuplicateClient = (client: Client) => {
    const duplicatedClient = {
      ...client,
      id: `${client.id}-copy-${Date.now()}`,
      name: `${client.name} (Copy)`,
      createdAt: new Date(),
      updatedAt: new Date()
    }
    setClients([...clients, duplicatedClient])
  }

  const handleArchiveClient = (client: Client) => {
    setClients(clients.map(c =>
      c.id === client.id ? { ...c, status: 'Archived' as const } : c
    ))
  }

  const handleCopyClientLink = (client: Client) => {
    navigator.clipboard.writeText(`${window.location.origin}/clients/${client.id}`)
    toast({ title: "Link Copied", description: "Client link copied to clipboard" })
  }

  const openFilterDialog = () => setFilterDialogOpen(true)

  const handleExportClients = () => {
    const clientsToExport = filteredClients.length > 0 ? filteredClients : clients
    
    if (clientsToExport.length === 0) {
      toast({ title: "No Clients", description: "No clients to export.", variant: "destructive" })
      return
    }

    const headers = ['Client Name', 'Status', 'Industry', 'Contact', 'Email', 'Projects', 'Findings', 'Critical']
    const csvRows = [
      headers.join(','),
      ...clientsToExport.map(client => {
        const escapeCSV = (value: string | number | boolean | null | undefined) => {
          if (value === null || value === undefined) return ''
          const str = String(value)
          if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`
          }
          return str
        }

        return [
          escapeCSV(client.name),
          escapeCSV(client.status),
          escapeCSV(client.industry),
          escapeCSV(client.primaryContact),
          escapeCSV(client.email),
          escapeCSV(client.projectsCount),
          escapeCSV(client.totalFindings),
          escapeCSV(client.findingsBySeverity.critical),
        ].join(',')
      })
    ]

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    link.setAttribute('href', URL.createObjectURL(blob))
    link.setAttribute('download', `clients_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    toast({ title: "Export Complete", description: `Exported ${clientsToExport.length} clients.` })
  }

  const clientFilterConfig: FilterConfig = {
    status: { label: 'Status', type: 'multiselect', options: ['Active', 'Inactive', 'Prospect', 'Archived'] },
    riskLevel: { label: 'Risk Level', type: 'select', options: ['High', 'Medium', 'Low'] },
    industry: { label: 'Industry', type: 'multiselect', options: ['Financial Services', 'Technology', 'Healthcare', 'Retail', 'Banking'] }
  }

  // Calculate stats
  const stats = {
    totalClients: clients.length,
    activeProjects: clients.reduce((sum, c) => sum + c.projectsCount, 0),
    pendingReports: clients.reduce((sum, c) => sum + c.reportsCount, 0),
    openFindings: clients.reduce((sum, c) => sum + c.totalFindings, 0),
    criticalFindings: clients.reduce((sum, c) => sum + c.findingsBySeverity.critical, 0)
  }

  // Filter clients (PRESERVED)
  const filteredClients = useMemo(() => {
    let result = clients.filter(client => {
      const matchesFilters = Object.entries(appliedFilters).every(([key, value]) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true
        if (key === 'status') return (value as string[]).includes(client.status)
        if (key === 'riskLevel') return client.riskLevel === (value as string)
        if (key === 'industry') return (value as string[]).includes(client.industry)
        return true
      })

      return matchesFilters
    })

    if (sortConfig) {
      result.sort((a, b) => {
        const { key, direction } = sortConfig
        let comparison = 0

        switch (key) {
          case 'name':
          case 'primaryContact':
          case 'industry':
            comparison = a[key].localeCompare(b[key])
            break
          case 'projectsCount':
          case 'reportsCount':
          case 'totalFindings':
            comparison = a[key] - b[key]
            break
          case 'lastActivityDate':
            comparison = a.lastActivityDate.getTime() - b.lastActivityDate.getTime()
            break
          default:
            comparison = 0
        }

        return direction === 'asc' ? comparison : -comparison
      })
    }

    return result
  }, [clients, appliedFilters, sortConfig])

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc' ? { key, direction: 'desc' } : null
      }
      return { key, direction: 'asc' }
    })
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-500 text-sm mt-0.5">
            Manage your client organizations and contacts
          </p>
        </div>
        <Button onClick={openAddClientDialog} className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          <Plus className="w-4 h-4 shrink-0" />
          <span>Add Client</span>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Building2 className="w-5 h-5" />}
          label="Total Clients"
          value={stats.totalClients}
          variant="default"
        />
        <StatCard
          icon={<FolderOpen className="w-5 h-5" />}
          label="Active Projects"
          value={stats.activeProjects}
          variant="success"
        />
        <StatCard
          icon={<Shield className="w-5 h-5" />}
          label="Total Findings"
          value={stats.openFindings}
          subtitle={stats.criticalFindings > 0 ? `${stats.criticalFindings} critical` : undefined}
          variant={stats.criticalFindings > 0 ? 'destructive' : 'default'}
        />
        <StatCard
          icon={<FileText className="w-5 h-5" />}
          label="Reports"
          value={stats.pendingReports}
          variant="warning"
        />
      </div>

      {/* Toolbar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            {/* Actions */}
            <div className="flex items-center gap-2">
              <Button
                variant={activeFilters.length > 0 ? "default" : "outline"}
                size="sm"
                onClick={openFilterDialog}
                className="gap-1.5"
              >
                <Filter className="w-4 h-4 shrink-0" />
                <span>Filter</span>
                {activeFilters.length > 0 && (
                  <Badge variant="secondary" className="h-5 w-5 rounded-full p-0 flex items-center justify-center text-[10px] shrink-0">
                    {activeFilters.length}
                  </Badge>
                )}
              </Button>

              <Button variant="outline" size="sm" onClick={handleExportClients} className="gap-1.5">
                <Download className="w-4 h-4 shrink-0" />
                <span>Export</span>
              </Button>

              {/* View Mode Switcher */}
              <TooltipProvider>
                <div className="flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('table')}
                        className={cn(
                          "p-1.5 rounded-md transition-all",
                          viewMode === 'table' 
                            ? "bg-white shadow-sm text-slate-900" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <Table2 className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Table</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('card')}
                        className={cn(
                          "p-1.5 rounded-md transition-all",
                          viewMode === 'card' 
                            ? "bg-white shadow-sm text-slate-900" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <LayoutGrid className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>Cards</TooltipContent>
                  </Tooltip>

                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setViewMode('list')}
                        className={cn(
                          "p-1.5 rounded-md transition-all",
                          viewMode === 'list' 
                            ? "bg-white shadow-sm text-slate-900" 
                            : "text-slate-500 hover:text-slate-700"
                        )}
                      >
                        <List className="w-4 h-4" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>List</TooltipContent>
                  </Tooltip>
                </div>
              </TooltipProvider>
            </div>
          </div>

          {/* Active Filters */}
          {activeFilters.length > 0 && (
            <div className="flex flex-wrap gap-2 items-center mt-4 pt-4 border-t border-slate-100">
              <span className="text-xs font-medium text-slate-500">Filters:</span>
              {activeFilters.map((filter) => (
                <Badge key={filter.id} variant="secondary" className="gap-1 pl-2 pr-1 py-0.5">
                  {filter.label}: {filter.value}
                  <button
                    onClick={() => removeFilter(filter.id)}
                    className="ml-1 hover:bg-slate-300 rounded p-0.5"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
              <button
                onClick={clearAllFilters}
                className="text-xs text-slate-500 hover:text-slate-700 ml-2"
              >
                Clear all
              </button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-5 w-48" />
                    <Skeleton className="h-4 w-32" />
                  </div>
                  <Skeleton className="h-8 w-20" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Content */}
      {!isLoading && filteredClients.length > 0 && (
        <>
          {viewMode === 'card' && (
            <CardView
              clients={filteredClients}
              onView={handleViewClient}
              onEdit={handleEditClient}
              onDelete={handleDeleteClient}
              onDuplicate={handleDuplicateClient}
              onArchive={handleArchiveClient}
              onCopyLink={handleCopyClientLink}
            />
          )}
          {viewMode === 'table' && (
            <TableView
              clients={filteredClients}
              onView={handleViewClient}
              onEdit={handleEditClient}
              onDelete={handleDeleteClient}
              onDuplicate={handleDuplicateClient}
              onArchive={handleArchiveClient}
              onCopyLink={handleCopyClientLink}
              onSort={handleSort}
              sortConfig={sortConfig}
            />
          )}
          {viewMode === 'list' && (
            <ListView
              clients={filteredClients}
              onView={handleViewClient}
              onEdit={handleEditClient}
              onDelete={handleDeleteClient}
              onDuplicate={handleDuplicateClient}
              onArchive={handleArchiveClient}
              onCopyLink={handleCopyClientLink}
            />
          )}
        </>
      )}

      {/* Empty State: No clients */}
      {!isLoading && clients.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mb-4">
              <Building2 className="w-8 h-8 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 mb-2">No clients yet</h3>
            <p className="text-slate-500 mb-6 max-w-sm">
              Add your first client to start managing projects and tracking security assessments.
            </p>
            <Button onClick={openAddClientDialog} size="lg" className="gap-2">
              <Plus className="w-5 h-5 shrink-0" />
              <span>Add Your First Client</span>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Dialogs (PRESERVED) */}
      <AddClientDialog
        open={addClientDialogOpen}
        onOpenChange={setAddClientDialogOpen}
        onClientAdded={handleClientAdded}
        editingClient={editingClient}
      />

      <FilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        filterConfig={clientFilterConfig}
        activeFilters={appliedFilters}
        onApplyFilters={setAppliedFilters}
        title="Filter Clients"
        description="Refine your client list"
      />

      <ClientDetailModal
        client={viewingClient}
        open={!!viewingClient}
        onClose={() => setViewingClient(null)}
        onEdit={handleEditClient}
        onDelete={(client) => {
          setViewingClient(null)
          setDeletingClient(client)
        }}
      />

      <AlertDialog open={!!deletingClient} onOpenChange={(open) => !open && !isDeleting && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingClient?.name}</strong>? This will also delete all associated projects and reports.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteClient}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                'Delete'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// Card View Component
interface CardViewProps {
  clients: Client[]
  onView: (client: Client) => void
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  onDuplicate: (client: Client) => void
  onArchive: (client: Client) => void
  onCopyLink: (client: Client) => void
}

function CardView({ clients, onView, onEdit, onDelete, onDuplicate, onArchive, onCopyLink }: CardViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {clients.map((client) => (
        <ClientCard
          key={client.id}
          client={client}
          onView={onView}
          onEdit={onEdit}
          onDuplicate={onDuplicate}
          onArchive={onArchive}
          onCopyLink={onCopyLink}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

// Table View Component
interface TableViewProps {
  clients: Client[]
  onView: (client: Client) => void
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  onDuplicate: (client: Client) => void
  onArchive: (client: Client) => void
  onCopyLink: (client: Client) => void
  onSort: (key: string) => void
  sortConfig: { key: string; direction: 'asc' | 'desc' } | null
}

function TableView({ clients, onView, onEdit, onDelete, onDuplicate, onArchive, onCopyLink, onSort, sortConfig }: TableViewProps) {
  const SortIcon = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-50" />
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-emerald-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-emerald-600" />
  }

  return (
    <Card>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-slate-100">
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                onClick={() => onSort('name')}
              >
                <div className="flex items-center">Client <SortIcon columnKey="name" /></div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                onClick={() => onSort('primaryContact')}
              >
                <div className="flex items-center">Contact <SortIcon columnKey="primaryContact" /></div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                onClick={() => onSort('projectsCount')}
              >
                <div className="flex items-center">Projects <SortIcon columnKey="projectsCount" /></div>
              </th>
              <th 
                className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer group hover:bg-slate-50"
                onClick={() => onSort('totalFindings')}
              >
                <div className="flex items-center">Findings <SortIcon columnKey="totalFindings" /></div>
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Tags
              </th>
              <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {clients.map((client) => (
              <tr 
                key={client.id} 
                className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                onClick={() => onView(client)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-xl">
                      {client.logoUrl && <AvatarImage src={client.logoUrl} alt={client.name} />}
                      <AvatarFallback className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                        {client.name.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{client.name}</div>
                      <div className="text-xs text-slate-500">{client.industry}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-slate-700">{client.primaryContact || '—'}</div>
                  <div className="text-xs text-slate-500">{client.email || '—'}</div>
                </td>
                <td className="px-4 py-3">
                  <Badge variant="secondary" className="text-xs">
                    {client.projectsCount} {client.projectsCount === 1 ? 'project' : 'projects'}
                  </Badge>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-slate-900">{client.totalFindings}</span>
                    {client.findingsBySeverity.critical > 0 && (
                      <Badge variant="critical" className="text-[10px] px-1.5 py-0">
                        {client.findingsBySeverity.critical} critical
                      </Badge>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {client.tags?.slice(0, 2).map((tag) => (
                      <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0">
                        {tag}
                      </Badge>
                    ))}
                    {client.tags?.length > 2 && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        +{client.tags.length - 2}
                      </Badge>
                    )}
                    {(!client.tags || client.tags.length === 0) && (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); onView(client); }}>
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600" onClick={(e) => { e.stopPropagation(); onEdit(client); }}>
                      <Edit className="w-4 h-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:text-slate-600">
                          <MoreVertical className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onDuplicate(client)}>
                          <Copy className="w-4 h-4 mr-2" /> Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCopyLink(client)}>
                          <ExternalLink className="w-4 h-4 mr-2" /> Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDelete(client)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

// List View Component
interface ListViewProps {
  clients: Client[]
  onView: (client: Client) => void
  onEdit: (client: Client) => void
  onDelete: (client: Client) => void
  onDuplicate: (client: Client) => void
  onArchive: (client: Client) => void
  onCopyLink: (client: Client) => void
}

function ListView({ clients, onView, onEdit, onDelete, onDuplicate, onArchive, onCopyLink }: ListViewProps) {
  return (
    <div className="space-y-2">
      {clients.map((client) => (
        <Card 
          key={client.id} 
          className="hover:shadow-card-hover transition-shadow group cursor-pointer"
          onClick={() => onView(client)}
        >
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <Avatar className="h-10 w-10 rounded-xl">
                {client.logoUrl && <AvatarImage src={client.logoUrl} alt={client.name} />}
                <AvatarFallback className="rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white text-xs font-semibold">
                  {client.name.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-slate-900 truncate">{client.name}</h3>
                  <Badge variant={client.status === 'Active' ? 'success' : 'secondary'} className="text-[10px]">
                    {client.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {client.industry} • {client.primaryContact || 'No contact'} • {client.email || 'No email'}
                </p>
              </div>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-900">{client.projectsCount}</div>
                  <div className="text-xs text-slate-500">Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-sm font-semibold text-slate-900">{client.totalFindings}</div>
                  <div className="text-xs text-slate-500">Findings</div>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600 gap-1" onClick={(e) => { e.stopPropagation(); onView(client); }}>
                  <Eye className="w-4 h-4 shrink-0" /> <span>View</span>
                </Button>
                <Button variant="ghost" size="sm" className="text-slate-400 hover:text-slate-600 gap-1" onClick={(e) => { e.stopPropagation(); onEdit(client); }}>
                  <Edit className="w-4 h-4 shrink-0" /> <span>Edit</span>
                </Button>
              </div>

              <ChevronRight className="w-5 h-5 text-slate-400" />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
