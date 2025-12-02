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
  Search,
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
  Building2
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/StatCard'
import { ClientListItem } from '@/components/ClientListItem'
import { FilterDialog, FilterConfig, ActiveFilters } from '@/components/FilterDialog'
import { api } from '@/lib/api'
import { logClientCreated, logClientUpdated, logClientDeleted } from '@/lib/activityLog'
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

// Client interface
interface Client {
  id: string
  name: string
  logoUrl?: string
  status: 'Active' | 'Inactive' | 'Prospect' | 'Archived'
  riskLevel: 'High' | 'Medium' | 'Low'
  industry: string
  companySize: 'Enterprise' | 'SMB' | 'Startup'
  primaryContact: string
  email: string
  phone?: string
  lastActivity: string // relative time like "2 days ago"
  lastActivityDate: Date
  tags: string[] // e.g., ["PCI", "Annual", "VIP"]
  projectsCount: number
  reportsCount: number
  totalFindings: number
  findingsBySeverity: {
    critical: number
    high: number
    medium: number
    low: number
  }
  createdAt: Date
  updatedAt: Date
  hasPortalAccess?: boolean
}

type ViewMode = 'card' | 'table' | 'list'

export default function Clients() {
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    const saved = localStorage.getItem('atomik_client_view_mode')
    return (saved === 'card' || saved === 'table' || saved === 'list') ? saved : 'table'
  })
  const [searchQuery, setSearchQuery] = useState('')
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

  // Fetch clients from API function
  const fetchClients = useCallback(async () => {
    setIsLoading(true)
    try {
      const token = await getToken()
      if (token) {
        const response = await api.get('/clients/', {
          headers: { Authorization: `Bearer ${token}` }
        })
        
        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          // Map API data to Client interface
          const apiClients: Client[] = response.data.map((c: any) => ({
            id: c.id,
            name: c.name,
            logoUrl: '',
            status: c.status || 'Active',
            riskLevel: c.risk_level || 'Medium',
            industry: c.industry || 'Technology',
            companySize: c.company_size || 'SMB',
            primaryContact: c.contact_name || '',
            email: c.contact_email || '',
            phone: c.contact_phone || '',
            lastActivity: 'Recently',
            lastActivityDate: c.updated_at ? new Date(c.updated_at) : new Date(),
            tags: [],
            projectsCount: 0,
            reportsCount: 0,
            totalFindings: 0,
            findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
            createdAt: c.created_at ? new Date(c.created_at) : new Date(),
            updatedAt: c.updated_at ? new Date(c.updated_at) : new Date(),
          }))
          
          // Use only API clients
          setClients(apiClients)
        } else {
          // No API clients, use empty array
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

  // Fetch clients when page is navigated to (location.key changes on each navigation)
  useEffect(() => {
    fetchClients()
  }, [location.key, fetchClients])

  // Save view mode to localStorage
  useEffect(() => {
    localStorage.setItem('atomik_client_view_mode', viewMode)
  }, [viewMode])

  // Filter management functions
  const removeFilter = (id: string) => {
    setActiveFilters(activeFilters.filter(f => f.id !== id))
  }

  const clearAllFilters = () => {
    setActiveFilters([])
    setSearchQuery('')
  }

  const clearSearch = () => {
    setSearchQuery('')
  }

  const openAddClientDialog = () => {
    setEditingClient(null)
    setAddClientDialogOpen(true)
  }

  const handleClientAdded = (newClient: any) => {
    // Map the API response to our Client interface
    const mappedClient: Client = {
      id: newClient.id,
      name: newClient.name,
      logoUrl: newClient.logo_url || '',
      status: newClient.status || 'Active',
      riskLevel: newClient.risk_level || 'Medium',
      industry: newClient.industry || 'Technology',
      companySize: newClient.company_size || 'SMB',
      primaryContact: newClient.contact_name || '',
      email: newClient.contact_email || '',
      phone: newClient.contact_phone || '',
      lastActivity: 'Just now',
      lastActivityDate: new Date(),
      tags: [],
      projectsCount: 0,
      reportsCount: 0,
      totalFindings: 0,
      findingsBySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
      createdAt: new Date(),
      updatedAt: new Date(),
    }
    
    if (editingClient) {
      // Update existing client
      const updatedClients = clients.map(c => c.id === editingClient.id ? { ...c, ...mappedClient } : c)
      setClients(updatedClients)
      setEditingClient(null)
      // Log update activity
      logClientUpdated(newClient.name, newClient.id)
    } else {
      // Add new client at the beginning of the list
      setClients([mappedClient, ...clients])
      // Log create activity
      logClientCreated(newClient.name, newClient.id)
    }
    
    toast({
      title: "✓ Client Saved",
      description: `${newClient.name} has been ${editingClient ? 'updated' : 'added'} successfully.`,
    })
  }

  // Client action handlers
  const handleViewClient = (client: Client) => {
    setViewingClient(client)
  }

  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setAddClientDialogOpen(true)
  }

  const handleDeleteClient = (client: Client) => {
    setDeletingClient(client)
  }

  const [isDeleting, setIsDeleting] = useState(false)

  const confirmDeleteClient = async () => {
    if (!deletingClient) return
    
    setIsDeleting(true)
    try {
      const token = await getToken()
      if (!token) {
        toast({
          title: "Error",
          description: "Authentication required",
          variant: "destructive",
        })
        return
      }

      // Call the backend API to delete the client
      await api.delete(`/clients/${deletingClient.id}`, {
        headers: { Authorization: `Bearer ${token}` }
      })

      // Log delete activity
      logClientDeleted(deletingClient.name, deletingClient.id)
      
      // Remove from local state
      setClients(clients.filter(c => c.id !== deletingClient.id))
      
      toast({
        title: "Client Deleted",
        description: `${deletingClient.name} has been permanently removed.`,
      })
    } catch (error: any) {
      console.error('Failed to delete client:', error)
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to delete client. Please try again.",
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
    // You could add a toast notification here
    console.log('Client link copied to clipboard')
  }

  // Calculate stats
  const openFilterDialog = () => {
    setFilterDialogOpen(true)
  }

  const handleExportClients = () => {
    // Get the clients to export (use filtered clients if filters are active, otherwise all)
    const clientsToExport = filteredClients.length > 0 ? filteredClients : clients
    
    if (clientsToExport.length === 0) {
      toast({
        title: "No Clients to Export",
        description: "There are no clients to export.",
        variant: "destructive",
      })
      return
    }

    // Define CSV headers
    const headers = [
      'Client Name',
      'Status',
      'Risk Level',
      'Industry',
      'Company Size',
      'Primary Contact',
      'Email',
      'Phone',
      'Tags',
      'Projects Count',
      'Reports Count',
      'Total Findings',
      'Critical Findings',
      'High Findings',
      'Medium Findings',
      'Low Findings',
      'Has Portal Access',
      'Last Activity',
      'Created At',
      'Updated At'
    ]

    // Convert clients to CSV rows
    const csvRows = [
      headers.join(','),
      ...clientsToExport.map(client => {
        const tags = client.tags?.join('; ') || ''
        
        // Escape commas and quotes in CSV values
        const escapeCSV = (value: any) => {
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
          escapeCSV(client.riskLevel),
          escapeCSV(client.industry),
          escapeCSV(client.companySize),
          escapeCSV(client.primaryContact),
          escapeCSV(client.email),
          escapeCSV(client.phone || ''),
          escapeCSV(tags),
          escapeCSV(client.projectsCount),
          escapeCSV(client.reportsCount),
          escapeCSV(client.totalFindings),
          escapeCSV(client.findingsBySeverity.critical),
          escapeCSV(client.findingsBySeverity.high),
          escapeCSV(client.findingsBySeverity.medium),
          escapeCSV(client.findingsBySeverity.low),
          escapeCSV(client.hasPortalAccess ? 'Yes' : 'No'),
          escapeCSV(client.lastActivity),
          escapeCSV(client.createdAt.toLocaleDateString()),
          escapeCSV(client.updatedAt.toLocaleDateString())
        ].join(',')
      })
    ]

    // Create CSV content
    const csvContent = csvRows.join('\n')

    // Create blob and download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const link = document.createElement('a')
    const url = URL.createObjectURL(blob)
    link.setAttribute('href', url)
    link.setAttribute('download', `clients_export_${new Date().toISOString().split('T')[0]}.csv`)
    link.style.visibility = 'hidden'
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const clientFilterConfig: FilterConfig = {
    status: {
      label: 'Status',
      type: 'multiselect',
      options: ['Active', 'Inactive', 'Prospect', 'Archived']
    },
    riskLevel: {
      label: 'Risk Level',
      type: 'select',
      options: ['High', 'Medium', 'Low']
    },
    industry: {
      label: 'Industry',
      type: 'multiselect',
      options: ['Financial Services', 'Technology', 'Healthcare', 'Retail', 'Banking']
    }
  }

  const stats = {
    totalClients: clients.length,
    activeProjects: clients.reduce((sum, c) => sum + c.projectsCount, 0),
    pendingReports: clients.reduce((sum, c) => sum + c.reportsCount, 0),
    openFindings: clients.reduce((sum, c) => sum + c.totalFindings, 0),
    criticalFindings: clients.reduce((sum, c) => sum + c.findingsBySeverity.critical, 0)
  }

  // Filter clients based on search
  // Filter clients based on search
  const filteredClients = useMemo(() => {
    let result = clients.filter(client => {
      const lowerCaseSearchQuery = searchQuery.toLowerCase()
      const matchesSearch = client.name.toLowerCase().includes(lowerCaseSearchQuery) ||
        client.industry.toLowerCase().includes(lowerCaseSearchQuery) ||
        client.tags.some(tag => tag.toLowerCase().includes(lowerCaseSearchQuery))

      const matchesFilters = Object.entries(appliedFilters).every(([key, value]) => {
        if (!value || (Array.isArray(value) && value.length === 0)) return true

        if (key === 'status') {
          return (value as string[]).includes(client.status)
        }
        if (key === 'riskLevel') {
          return client.riskLevel === (value as string)
        }
        if (key === 'industry') {
          return (value as string[]).includes(client.industry)
        }

        return true
      })

      return matchesSearch && matchesFilters
    })

    // Apply sorting
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
  }, [clients, searchQuery, appliedFilters, sortConfig])

  const handleSort = (key: string) => {
    setSortConfig(current => {
      if (current?.key === key) {
        return current.direction === 'asc'
          ? { key, direction: 'desc' }
          : null
      }
      return { key, direction: 'asc' }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Clients</h1>
          <p className="mt-2 text-gray-600 dark:text-gray-400">
            Manage your client organizations and contacts
          </p>
        </div>
        <Button onClick={openAddClientDialog} className="bg-primary hover:bg-primary/90">
          <Plus className="w-4 h-4 mr-2" />
          Add Client
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Users className="w-6 h-6" />}
          label="Total Clients"
          value={stats.totalClients}
          trend="+12%"
          trendUp={true}
          variant="default"
        />
        <StatCard
          icon={<FolderOpen className="w-6 h-6" />}
          label="Active Engagements"
          value={stats.activeProjects}
          trend="+8%"
          trendUp={true}
          variant="success"
        />
        <StatCard
          icon={<FileText className="w-6 h-6" />}
          label="Pending Reports"
          value={stats.pendingReports}
          trend="-5%"
          trendUp={false}
          variant="warning"
        />
        <StatCard
          icon={<AlertTriangle className="w-6 h-6" />}
          label="Open Findings"
          value={stats.openFindings}
          badge={stats.criticalFindings}
          badgeLabel="Critical"
          variant="destructive"
        />
      </div>

      {/* Toolbar */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex-1 w-full sm:w-auto">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <input
                type="text"
                placeholder="Search clients by name, contact, email, industry, or tags..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-input rounded-lg focus:ring-2 focus:ring-ring focus:border-transparent bg-background text-foreground placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">


            {/* Enhanced Filter Button with Count Badge */}
            <Button
              variant={activeFilters.length > 0 ? "default" : "outline"}
              size="sm"
              onClick={openFilterDialog}
              className="relative"
            >
              <Filter className="h-4 w-4 mr-2" />
              Filter
              {activeFilters.length > 0 && (
                <Badge
                  variant="secondary"
                  className="ml-2 h-5 w-5 rounded-full p-0 flex items-center justify-center bg-primary-foreground text-primary font-bold"
                >
                  {activeFilters.length}
                </Badge>
              )}
            </Button>

            <Button variant="outline" size="sm" onClick={handleExportClients}>
              <Download className="w-4 h-4 mr-2" />
              Export
            </Button>

            {/* View Mode Switcher with Tooltips */}
            <TooltipProvider>
              <div className="flex items-center gap-1 border rounded-md p-1 border-border bg-card">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'table' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('table')}
                      className="h-8 w-8 p-0"
                    >
                      <Table2 className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Table View</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'card' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('card')}
                      className="h-8 w-8 p-0"
                    >
                      <LayoutGrid className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Card View</TooltipContent>
                </Tooltip>

                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant={viewMode === 'list' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setViewMode('list')}
                      className="h-8 w-8 p-0"
                    >
                      <List className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>List View</TooltipContent>
                </Tooltip>
              </div>
            </TooltipProvider>
          </div>
        </div>

        {/* Active Filters Display */}
        {activeFilters.length > 0 && (
          <div className="flex flex-wrap gap-2 items-center p-3 bg-muted/50 rounded-lg border border-border">
            <span className="text-sm font-medium text-muted-foreground">Active filters:</span>
            {activeFilters.map((filter) => (
              <Badge
                key={filter.id}
                variant="secondary"
                className="gap-1.5 pl-2 pr-1 py-1 hover:bg-secondary/80"
              >
                {filter.label}: {filter.value}
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent"
                  onClick={() => removeFilter(filter.id)}
                >
                  <X className="h-3 w-3" />
                </Button>
              </Badge>
            ))}
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-xs h-7"
            >
              Clear all
            </Button>
          </div>
        )}
      </div>

      {/* Loading Skeletons */}
      {isLoading && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-4 p-4 border rounded-lg border-border bg-card">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2">
                  <Skeleton className="h-6 w-48" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-96" />
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-12" />
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-14" />
                </div>
                <div className="flex gap-6">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
              <Skeleton className="h-8 w-20" />
            </div>
          ))}
        </div>
      )}

      {/* Content Views */}
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

      {/* Empty State: No clients exist */}
      {!isLoading && clients.length === 0 && !searchQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Users className="h-16 w-16 text-muted-foreground mb-4 animate-pulse" />
          <h3 className="text-lg font-semibold mb-2">No clients yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            Get started by adding your first client organization to begin tracking
            pentesting projects and managing vulnerabilities.
          </p>
          <Button onClick={openAddClientDialog} size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Add Your First Client
          </Button>
        </div>
      )}

      {/* Empty State: No search results */}
      {!isLoading && filteredClients.length === 0 && searchQuery && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No clients found</h3>
          <p className="text-muted-foreground mb-6 max-w-sm">
            No clients match your search "{searchQuery}". Try adjusting your
            filters or search terms.
          </p>
          <Button variant="outline" onClick={clearSearch}>
            <X className="h-4 w-4 mr-2" />
            Clear Search
          </Button>
        </div>
      )}

      {/* Add Client Dialog */}
      <AddClientDialog
        open={addClientDialogOpen}
        onOpenChange={setAddClientDialogOpen}
        onClientAdded={handleClientAdded}
        editingClient={editingClient}
      />

      {/* Filter Dialog */}
      <FilterDialog
        open={filterDialogOpen}
        onOpenChange={setFilterDialogOpen}
        filterConfig={clientFilterConfig}
        activeFilters={appliedFilters}
        onApplyFilters={setAppliedFilters}
        title="Filter Clients"
        description="Apply filters to refine your client list"
      />

      {/* Client Detail Modal */}
      <ClientDetailModal
        client={viewingClient}
        open={!!viewingClient}
        onClose={() => setViewingClient(null)}
        onEdit={handleEditClient}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingClient} onOpenChange={(open) => !open && !isDeleting && setDeletingClient(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Client</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>{deletingClient?.name}</strong>? This action cannot be undone.
              All associated projects and reports will also be permanently deleted.
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
                'Delete Client'
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
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3">
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
    if (sortConfig?.key !== columnKey) return <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="w-4 h-4 ml-1 text-blue-600" />
      : <ArrowDown className="w-4 h-4 ml-1 text-blue-600" />
  }

  const renderHeader = (label: string, key: string, align: 'left' | 'right' = 'left') => (
    <th
      className={`px-6 py-3 text-${align} text-xs font-medium text-muted-foreground uppercase tracking-wider cursor-pointer group hover:bg-muted transition-colors select-none`}
      onClick={() => onSort(key)}
    >
      <div className={`flex items-center ${align === 'right' ? 'justify-end' : ''}`}>
        {label}
        <SortIcon columnKey={key} />
      </div>
    </th>
  )

  return (
    <div className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              {renderHeader('Client', 'name')}
              {renderHeader('Contact', 'primaryContact')}
              {renderHeader('Projects', 'projectsCount')}
              {renderHeader('Reports', 'reportsCount')}
              {renderHeader('Findings', 'totalFindings')}
              {renderHeader('Last Activity', 'lastActivityDate')}
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {clients.map((client) => (
              <tr key={client.id} className="hover:bg-muted/50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    {client.logoUrl ? (
                      <img src={client.logoUrl} alt={client.name} className="w-10 h-10 rounded object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Building2 className="w-5 h-5 text-muted-foreground" />
                      </div>
                    )}
                    <div>
                      <div className="font-medium text-foreground">{client.name}</div>
                      <div className="text-sm text-muted-foreground">{client.industry}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-foreground">{client.primaryContact}</div>
                  <div className="text-sm text-muted-foreground">{client.email}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="px-2 py-1 text-xs font-semibold bg-primary/10 text-primary rounded-full">
                    {client.projectsCount} active
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-sm text-foreground">{client.reportsCount} pending</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-foreground">{client.totalFindings}</span>
                    {client.findingsBySeverity.critical > 0 && (
                      <span className="px-2 py-1 text-xs font-semibold bg-red-100 dark:bg-red-900 text-red-600 dark:text-red-400 rounded-full">
                        {client.findingsBySeverity.critical} critical
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                  {client.lastActivity}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end gap-2">
                    <button
                      onClick={() => onView(client)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEdit(client)}
                      className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-lg transition-colors">
                          <MoreVertical className="w-4 h-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onDuplicate(client)}>
                          <Copy className="w-4 h-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onArchive(client)}>
                          <Archive className="w-4 h-4 mr-2" />
                          Archive
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => onCopyLink(client)}>
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => onDelete(client)} className="text-red-600 dark:text-red-400">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
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
    </div>
  )
}

// Enhanced List View Component with 4-line structure
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
    <div className="space-y-3">
      {clients.map((client) => (
        <ClientListItem
          key={client.id}
          client={client}
          onView={onView}
          onEdit={onEdit}
          onArchive={onArchive}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}

