import {
    MoreVertical,
    Archive,
    Trash2,
    Pencil,
    Plus,
    Mail,
    StickyNote,
    ChevronRight
} from 'lucide-react'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Client } from './ClientCard'

interface ClientListItemProps {
    client: Client
    onView: (client: Client) => void
    onEdit: (client: Client) => void
    onArchive: (client: Client) => void
    onDelete: (client: Client) => void
}

export function ClientListItem({
    client,
    onView,
    onEdit,
    onArchive,
    onDelete
}: ClientListItemProps) {

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'Active': return 'bg-emerald-500'
            case 'Inactive': return 'bg-yellow-500'
            case 'Prospect': return 'bg-blue-500'
            case 'Archived': return 'bg-zinc-500'
            default: return 'bg-zinc-500'
        }
    }

    const getRiskColor = (risk: string) => {
        switch (risk) {
            case 'High': return 'border-red-500 text-red-500'
            case 'Medium': return 'border-orange-500 text-orange-500'
            case 'Low': return 'border-emerald-500 text-emerald-500'
            default: return 'border-zinc-500 text-zinc-500'
        }
    }

    const hasLogo = typeof client.logoUrl === 'string' && (client.logoUrl.startsWith('http://') || client.logoUrl.startsWith('https://'))

    return (
        <div
            className="group flex flex-row items-center justify-between h-20 px-4 bg-transparent hover:bg-muted/50 border-b border-border transition-colors cursor-pointer"
            onClick={() => onView(client)}
        >
            {/* Left Section: Avatar + Identity */}
            <div className="flex items-center gap-4 flex-1 min-w-0">
                {/* Avatar - Square */}
                <Avatar className="h-10 w-10 rounded-md flex-shrink-0">
                    {hasLogo && <AvatarImage src={client.logoUrl} alt={client.name} />}
                    <AvatarFallback className="rounded-md bg-muted text-muted-foreground font-semibold text-xs">
                        {client.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                {/* Text Info */}
                <div className="flex flex-col min-w-0">
                    {/* Top Line: Name + Status + Risk + Tags */}
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-foreground truncate">
                            {client.name}
                        </h3>

                        {/* Status Badge */}
                        <Badge className={`${getStatusColor(client.status)} text-white text-[10px] px-2 py-0 h-5`}>
                            {client.status}
                        </Badge>

                        {/* Risk Badge */}
                        <Badge variant="outline" className={`${getRiskColor(client.riskLevel)} text-[10px] px-2 py-0 h-5 border`}>
                            {client.riskLevel}
                        </Badge>

                        {/* Tags */}
                        {client.tags && client.tags.slice(0, 2).map(tag => (
                            <span key={tag} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground border border-border">
                                #{tag}
                            </span>
                        ))}
                    </div>

                    {/* Bottom Line: Industry • Contact */}
                    <div className="text-xs text-muted-foreground truncate">
                        {client.industry} • {client.primaryContact}
                    </div>
                </div>
            </div>

            {/* Right Section: Stats + Risk + Actions */}
            <div className="flex items-center gap-8">
                {/* Stats Text */}
                <div className="hidden lg:block text-sm text-muted-foreground">
                    {client.projectsCount} Projects • {client.reportsCount} Reports
                </div>

                {/* Findings Group - Text Only */}
                <div className="text-right">
                    <div className="text-xs text-muted-foreground mb-1">
                        {client.totalFindings} Findings
                    </div>
                    <div className="text-xs">
                        {client.findingsBySeverity.critical > 0 && (
                            <span className="text-red-500 font-medium">{client.findingsBySeverity.critical} Crit</span>
                        )}
                        {client.findingsBySeverity.critical > 0 && client.findingsBySeverity.high > 0 && (
                            <span className="text-muted-foreground mx-1">•</span>
                        )}
                        {client.findingsBySeverity.high > 0 && (
                            <span className="text-orange-500">{client.findingsBySeverity.high} High</span>
                        )}
                        {client.findingsBySeverity.critical === 0 && client.findingsBySeverity.high === 0 && (
                            <span className="text-emerald-500">Secure</span>
                        )}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100 transition-opacity">
                                <MoreVertical className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onEdit(client) }}>
                                <Pencil className="h-4 w-4 mr-2" />
                                Edit Client
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                                className="text-red-500 focus:text-red-400 focus:bg-red-950/20 dark:focus:bg-red-950/20"
                                onClick={(e) => { e.stopPropagation(); onDelete(client) }}
                            >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete Client
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>

                    <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                </div>
            </div>
        </div>
    )
}
