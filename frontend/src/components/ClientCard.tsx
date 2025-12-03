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

    return (
        <div
            onClick={() => onView(client)}
            className="group bg-card rounded-xl border border-slate-200 hover:border-violet-300 hover:shadow-card-hover transition-all duration-200 cursor-pointer overflow-hidden flex flex-col h-full"
        >
            {/* Header */}
            <div className="p-4 border-b border-slate-100 flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 rounded-xl">
                        {hasLogo && <AvatarImage src={client.logoUrl} alt={client.name} />}
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                            {client.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-slate-900 leading-tight group-hover:text-violet-700 transition-colors truncate">
                            {client.name}
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5 truncate">
                            {client.primaryContact || 'No contact'}
                        </p>
                    </div>
                </div>

                <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <button className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100">
                            <MoreHorizontal className="w-4 h-4" />
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(client) }}>
                            <Edit className="w-4 h-4 mr-2" />
                            Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onDuplicate(client) }}>
                            <Copy className="w-4 h-4 mr-2" />
                            Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={(e) => { e.stopPropagation(); onDelete(client) }}
                            className="text-red-600 focus:text-red-600 focus:bg-red-50"
                        >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Delete
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* Body */}
            <div className="p-4 space-y-2.5 flex-1">
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Mail className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{client.email || '—'}</span>
                </div>
                {client.phone && (
                    <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Phone className="w-4 h-4 text-slate-400 flex-shrink-0" />
                        <span>{client.phone}</span>
                    </div>
                )}
                <div className="flex items-center gap-2 text-sm text-slate-500">
                    <Building2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{client.industry}</span>
                    {client.hasPortalAccess && (
                        <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">
                            <Globe className="w-3 h-3" />
                            Portal
                        </span>
                    )}
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 border-t border-slate-100 divide-x divide-slate-100 bg-slate-50/50">
                <div className="p-3 text-center">
                    <div className="text-lg font-bold text-slate-900 leading-none mb-1">
                        {client.projectsCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Projects</div>
                </div>
                <div className="p-3 text-center">
                    <div className="text-lg font-bold text-slate-900 leading-none mb-1">
                        {client.reportsCount}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Reports</div>
                </div>
                <div className="p-3 text-center">
                    <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className="text-lg font-bold text-slate-900 leading-none">
                            {client.totalFindings}
                        </span>
                        {client.findingsBySeverity.critical > 0 && (
                            <span className="flex h-2 w-2 rounded-full bg-red-500 animate-pulse" title={`${client.findingsBySeverity.critical} Critical`} />
                        )}
                    </div>
                    <div className="text-[10px] uppercase tracking-wider text-slate-400 font-medium">Findings</div>
                </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 bg-slate-50/50">
                <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    <span>{client.lastActivity}</span>
                </div>
                <div className="flex items-center gap-1.5">
                    <span className={cn("w-2 h-2 rounded-full", getStatusColor(client.status))} />
                    <span className="font-medium text-slate-600">{client.status}</span>
                </div>
            </div>
        </div>
    )
}
