import {
    MoreHorizontal,
    Mail,
    Phone,
    Building2,
    Clock,
    Edit,
    Copy,
    Archive,
    ExternalLink,
    Trash2,
    Globe
} from 'lucide-react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'

// Duplicate interface for now to avoid circular dependencies or larger refactors
// In a real app, this should be in a shared types file
export interface Client {
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
    lastActivity: string
    lastActivityDate: Date
    tags: string[]
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

interface ClientCardProps {
    client: Client
    onView: (client: Client) => void
    onEdit: (client: Client) => void
    onDuplicate: (client: Client) => void
    onArchive: (client: Client) => void
    onCopyLink: (client: Client) => void
    onDelete: (client: Client) => void
}

export function ClientCard({
    client,
    onView,
    onEdit,
    onDuplicate,
    onArchive,
    onCopyLink,
    onDelete
}: ClientCardProps) {

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-emerald-500'
            case 'Inactive': return 'bg-yellow-500'
            case 'Prospect': return 'bg-blue-500'
            case 'Archived': return 'bg-zinc-500'
            default: return 'bg-zinc-500'
        }
    }

    const hasLogo = typeof client.logoUrl === 'string' && (client.logoUrl.startsWith('http://') || client.logoUrl.startsWith('https://'))
    console.log('🔥 ClientCard rendering with initials logic, hasLogo:', hasLogo, 'client:', client.name)

    return (
        <div
            onClick={() => onView(client)}
            className="group bg-card rounded-lg border border-border hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer overflow-hidden flex flex-col h-full"
        >
            {/* Header */}
            <div className="p-4 border-b border-border flex items-start justify-between bg-muted/50">
                <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 rounded-md">
                        {hasLogo && <AvatarImage src={client.logoUrl} alt={client.name} />}
                        <AvatarFallback className="rounded-md bg-muted text-muted-foreground font-semibold">
                            {client.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div>
                        <h3 className="font-semibold text-foreground leading-tight group-hover:text-primary transition-colors">
                            {client.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mt-0.5">
                            {client.primaryContact}
                        </p>
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <MoreHorizontal className="w-5 h-5" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(client) }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit Client
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(client) }}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onDelete(client) }}
                            className="text-red-500 focus:text-red-400 focus:bg-red-950/20 dark:focus:bg-red-950/20"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete Client
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3 flex-1">
                <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{client.email}</span>
                    </div>
                    {client.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Phone className="w-4 h-4" />
                            <span>{client.phone}</span>
                        </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Building2 className="w-4 h-4" />
                        <span className="truncate">{client.industry} • {client.companySize}</span>
                        {client.hasPortalAccess && (
                            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <Globe className="w-3 h-3" />
                                Portal
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 border-t border-border divide-x divide-border bg-muted/50">
                <div className="p-3 text-center">
                    <div className="text-lg font-semibold text-foreground leading-none mb-1">
                        {client.projectsCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Projects</div>
                </div>
                <div className="p-3 text-center">
                    <div className="text-lg font-semibold text-foreground leading-none mb-1">
                        {client.reportsCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Reports</div>
                </div>
                <div className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1 mb-1">
                        <span className="text-lg font-semibold text-foreground leading-none">
                            {client.totalFindings}
                        </span>
                        {client.findingsBySeverity.critical > 0 && (
                            <span className="flex h-2 w-2 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" title={`${client.findingsBySeverity.critical} Critical`} />
                        )}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Findings</div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 border-t border-border flex items-center justify-between text-xs text-muted-foreground bg-muted/50">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5" />
                    <span>Active: {client.lastActivity}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full", getStatusColor(client.status))} />
                    <span className="font-medium">{client.status}</span>
                </div>
            </div>
        </div>
    )
}
