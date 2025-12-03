import {
    MoreVertical,
    Trash2,
    Pencil,
    ChevronRight,
    FolderOpen,
    Shield
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
import { Card, CardContent } from '@/components/ui/card'
import { Client } from './ClientCard'
import { cn } from '@/lib/utils'

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

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Active': return <Badge variant="success" className="text-[10px]">{status}</Badge>
            case 'Inactive': return <Badge variant="secondary" className="text-[10px]">{status}</Badge>
            case 'Prospect': return <Badge variant="info" className="text-[10px]">{status}</Badge>
            case 'Archived': return <Badge variant="outline" className="text-[10px]">{status}</Badge>
            default: return <Badge variant="secondary" className="text-[10px]">{status}</Badge>
        }
    }

    const hasLogo = typeof client.logoUrl === 'string' && (client.logoUrl.startsWith('http://') || client.logoUrl.startsWith('https://'))

    return (
        <Card 
            className="hover:shadow-card-hover hover:border-slate-300 transition-all cursor-pointer group"
            onClick={() => onView(client)}
        >
            <CardContent className="p-4">
                <div className="flex items-center gap-4">
                    {/* Avatar */}
                    <Avatar className="h-10 w-10 rounded-xl flex-shrink-0">
                        {hasLogo && <AvatarImage src={client.logoUrl} alt={client.name} />}
                        <AvatarFallback className="rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white text-xs font-semibold">
                            {client.name.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    {/* Main Info */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="text-sm font-semibold text-slate-900 truncate group-hover:text-violet-700 transition-colors">
                                {client.name}
                            </h3>
                            {getStatusBadge(client.status)}
                        </div>
                        <p className="text-xs text-slate-500 truncate">
                            {client.industry} • {client.primaryContact || 'No contact'} • {client.email || 'No email'}
                        </p>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6">
                        <div className="text-center px-4">
                            <div className="text-sm font-semibold text-slate-900">{client.projectsCount}</div>
                            <div className="text-xs text-slate-500">Projects</div>
                        </div>
                        <div className="text-center px-4">
                            <div className="flex items-center justify-center gap-1">
                                <span className="text-sm font-semibold text-slate-900">{client.totalFindings}</span>
                                {client.findingsBySeverity.critical > 0 && (
                                    <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                )}
                            </div>
                            <div className="text-xs text-slate-500">Findings</div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="h-8 px-3 text-slate-600"
                            onClick={(e) => { e.stopPropagation(); onEdit(client) }}
                        >
                            <Pencil className="w-4 h-4 mr-1" />
                            Edit
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                    <MoreVertical className="h-4 w-4" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-44">
                                <DropdownMenuItem onClick={(e) => { e.stopPropagation(); onArchive(client) }}>
                                    Archive
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                    className="text-red-600 focus:text-red-600 focus:bg-red-50"
                                    onClick={(e) => { e.stopPropagation(); onDelete(client) }}
                                >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>

                    {/* Chevron */}
                    <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 transition-colors flex-shrink-0" />
                </div>
            </CardContent>
        </Card>
    )
}
