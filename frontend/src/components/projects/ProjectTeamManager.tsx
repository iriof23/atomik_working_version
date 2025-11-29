/**
 * ProjectTeamManager Component
 * 
 * Manages project team members with role assignments.
 * Linear-style UI with avatars, role badges, and member management.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@clerk/clerk-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select'
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useToast } from '@/components/ui/use-toast'
import { api } from '@/lib/api'
import { cn } from '@/lib/utils'
import { UserPlus, X, Shield, User, Eye, Loader2 } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface AvailableMember {
    id: string
    email: string
    firstName?: string | null
    lastName?: string | null
    imageUrl?: string | null
    name?: string | null
}

interface ProjectMember {
    id: string
    userId: string
    userName?: string
    userEmail: string
    role: 'LEAD' | 'TESTER' | 'VIEWER'
    assignedAt: string
}

interface ProjectTeamManagerProps {
    projectId: string
    members?: ProjectMember[]
    onMembersChange?: (members: ProjectMember[]) => void
}

export default function ProjectTeamManager({ 
    projectId, 
    members = [], 
    onMembersChange 
}: ProjectTeamManagerProps) {
    const { getToken } = useAuth()
    const { toast } = useToast()
    const navigate = useNavigate()
    
    const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([])
    const [currentMembers, setCurrentMembers] = useState<ProjectMember[]>(members)
    const [loading, setLoading] = useState(false)
    const [fetchingAvailable, setFetchingAvailable] = useState(false)
    const [memberSelectOpen, setMemberSelectOpen] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')

    // Sync members when prop changes
    useEffect(() => {
        setCurrentMembers(members)
    }, [members])

    // Fetch available members (users in organization not yet on team)
    useEffect(() => {
        const fetchAvailableMembers = async () => {
            try {
                setFetchingAvailable(true)
                const token = await getToken()
                
                if (!token) {
                    console.error('No auth token available')
                    return
                }

                const response = await api.get('/v1/projects/available-members', {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                })

                // Handle empty response (user has no organization)
                if (!response.data || response.data.length === 0) {
                    setAvailableMembers([])
                    return
                }

                // Filter out members already on the team
                const assignedUserIds = new Set(currentMembers.map(m => m.userId))
                const available = response.data.filter((m: AvailableMember) => !assignedUserIds.has(m.id))
                
                setAvailableMembers(available)
            } catch (error: any) {
                console.error('Failed to fetch available members:', error)
                
                // Don't show error toast for 404/empty responses - just log it
                if (error.response?.status === 404 || error.response?.status === 403) {
                    console.warn('No organization found or no available members')
                    setAvailableMembers([])
                } else {
                    toast({
                        title: 'Error',
                        description: 'Failed to load available team members. Please try again.',
                        variant: 'destructive'
                    })
                }
            } finally {
                setFetchingAvailable(false)
            }
        }

        if (projectId) {
            fetchAvailableMembers()
        }
    }, [projectId, currentMembers, getToken, toast])

    const handleAddMember = async (userId: string) => {
        try {
            setLoading(true)
            const token = await getToken()
            
            if (!token) {
                throw new Error('Not authenticated')
            }

            // Find the member details
            const member = availableMembers.find(m => m.id === userId)
            if (!member) return

            // Optimistically add with default role
            const optimisticMember: ProjectMember = {
                id: `temp-${Date.now()}`,
                userId: member.id,
                userName: member.name || `${member.firstName || ''} ${member.lastName || ''}`.trim() || undefined,
                userEmail: member.email,
                role: 'TESTER',
                assignedAt: new Date().toISOString()
            }

            setCurrentMembers(prev => [...prev, optimisticMember])
            onMembersChange?.([...currentMembers, optimisticMember])

            // Call API to add member
            const response = await api.post(
                `/projects/${projectId}/members`,
                {
                    userId: member.id,
                    role: 'TESTER'
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            // Replace optimistic member with real one
            setCurrentMembers(prev => {
                const updated = prev.map(m => m.id === optimisticMember.id ? response.data : m)
                onMembersChange?.(updated)
                return updated
            })

            setMemberSelectOpen(false)
            setSearchQuery('')

            toast({
                title: 'Member Added',
                description: `${member.email} has been added to the team`,
            })
        } catch (error: any) {
            console.error('Failed to add member:', error)
            
            // Revert optimistic update
            setCurrentMembers(members)
            onMembersChange?.(members)

            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to add team member',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const handleRemoveMember = async (userId: string) => {
        try {
            setLoading(true)
            const token = await getToken()
            
            if (!token) {
                throw new Error('Not authenticated')
            }

            const memberToRemove = currentMembers.find(m => m.userId === userId)
            if (!memberToRemove) return

            // Optimistically remove
            const updatedMembers = currentMembers.filter(m => m.userId !== userId)
            setCurrentMembers(updatedMembers)
            onMembersChange?.(updatedMembers)

            // Call API to remove
            await api.delete(
                `/projects/${projectId}/members/${userId}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            toast({
                title: 'Member Removed',
                description: `${memberToRemove.userEmail} has been removed from the team`,
            })
        } catch (error: any) {
            console.error('Failed to remove member:', error)
            
            // Revert optimistic update
            setCurrentMembers(members)
            onMembersChange?.(members)

            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to remove team member',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const handleRoleChange = async (userId: string, newRole: 'LEAD' | 'TESTER' | 'VIEWER') => {
        try {
            setLoading(true)
            const token = await getToken()
            
            if (!token) {
                throw new Error('Not authenticated')
            }

            // Optimistically update
            const updatedMembers = currentMembers.map(m => 
                m.userId === userId ? { ...m, role: newRole } : m
            )
            setCurrentMembers(updatedMembers)
            onMembersChange?.(updatedMembers)

            // Use PUT endpoint to update role (more efficient)
            const response = await api.put(
                `/projects/${projectId}/members/${userId}`,
                {
                    role: newRole
                },
                {
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            )

            // Update with real response
            setCurrentMembers(prev => {
                const updated = prev.map(m => m.userId === userId ? response.data : m)
                onMembersChange?.(updated)
                return updated
            })

            toast({
                title: 'Role Updated',
                description: `Member role changed to ${newRole}`,
            })
        } catch (error: any) {
            console.error('Failed to update role:', error)
            
            // Revert optimistic update
            setCurrentMembers(members)
            onMembersChange?.(members)

            toast({
                title: 'Error',
                description: error.response?.data?.detail || 'Failed to update member role',
                variant: 'destructive'
            })
        } finally {
            setLoading(false)
        }
    }

    const getRoleIcon = (role: string) => {
        switch (role) {
            case 'LEAD':
                return <Shield className="w-3 h-3" />
            case 'TESTER':
                return <User className="w-3 h-3" />
            case 'VIEWER':
                return <Eye className="w-3 h-3" />
            default:
                return <User className="w-3 h-3" />
        }
    }

    const getRoleBadgeColor = (role: string) => {
        switch (role) {
            case 'LEAD':
                return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
            case 'TESTER':
                return 'bg-blue-500/10 text-blue-500 border-blue-500/20'
            case 'VIEWER':
                return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
            default:
                return 'bg-zinc-500/10 text-zinc-500 border-zinc-500/20'
        }
    }

    const getInitials = (member: ProjectMember | AvailableMember) => {
        if ('userName' in member && member.userName) {
            return member.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        }
        if ('firstName' in member && member.firstName && 'lastName' in member && member.lastName) {
            return `${member.firstName[0]}${member.lastName[0]}`.toUpperCase()
        }
        if ('email' in member) {
            return member.email.substring(0, 2).toUpperCase()
        }
        return '??'
    }

    const getDisplayName = (member: ProjectMember | AvailableMember) => {
        if ('userName' in member && member.userName) {
            return member.userName
        }
        if ('firstName' in member && member.firstName && 'lastName' in member && member.lastName) {
            return `${member.firstName} ${member.lastName}`
        }
        return 'email' in member ? member.email : 'Unknown'
    }

    const filteredAvailable = availableMembers.filter(member => {
        const query = searchQuery.toLowerCase()
        const name = getDisplayName(member).toLowerCase()
        const email = member.email.toLowerCase()
        return name.includes(query) || email.includes(query)
    })

    return (
        <div className="space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-foreground">Assigned Team</h3>
                <Badge variant="outline" className="text-xs">
                    {currentMembers.length} member{currentMembers.length !== 1 ? 's' : ''}
                </Badge>
            </div>

            {/* Member List */}
            <div className="space-y-2">
                {currentMembers.map((member) => (
                    <div
                        key={member.id}
                        className="flex items-center gap-3 p-3 rounded-lg border border-border bg-card/50 hover:bg-card transition-colors group"
                    >
                        {/* Avatar */}
                        <Avatar className="w-8 h-8">
                            <AvatarImage 
                                src={('imageUrl' in member && member.imageUrl) || undefined}
                                alt={getDisplayName(member)}
                            />
                            <AvatarFallback className="text-xs bg-primary/10 text-primary">
                                {getInitials(member)}
                            </AvatarFallback>
                        </Avatar>

                        {/* Name & Email */}
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                                {getDisplayName(member)}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                                {member.userEmail}
                            </p>
                        </div>

                        {/* Role Selector */}
                        <Select
                            value={member.role}
                            onValueChange={(value) => handleRoleChange(member.userId, value as 'LEAD' | 'TESTER' | 'VIEWER')}
                            disabled={loading}
                        >
                            <SelectTrigger className="w-[120px] h-8">
                                <SelectValue>
                                    <div className="flex items-center gap-1.5">
                                        {getRoleIcon(member.role)}
                                        <span className="text-xs">{member.role}</span>
                                    </div>
                                </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="LEAD">
                                    <div className="flex items-center gap-2">
                                        <Shield className="w-4 h-4" />
                                        <span>Lead</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="TESTER">
                                    <div className="flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        <span>Tester</span>
                                    </div>
                                </SelectItem>
                                <SelectItem value="VIEWER">
                                    <div className="flex items-center gap-2">
                                        <Eye className="w-4 h-4" />
                                        <span>Viewer</span>
                                    </div>
                                </SelectItem>
                            </SelectContent>
                        </Select>

                        {/* Remove Button */}
                        <Button
                            variant="ghost"
                            size="icon"
                            className="w-7 h-7 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleRemoveMember(member.userId)}
                            disabled={loading}
                        >
                            <X className="w-4 h-4" />
                        </Button>
                    </div>
                ))}

                {currentMembers.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground border border-dashed rounded-lg">
                        <User className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">No team members assigned</p>
                        <p className="text-xs">Add members to collaborate on this project</p>
                    </div>
                )}
            </div>

            {/* Add Member Button - Always show, even if no available members */}
            <Popover open={memberSelectOpen} onOpenChange={setMemberSelectOpen}>
                <PopoverTrigger asChild>
                    <Button
                        variant="outline"
                        className="w-full gap-2"
                        disabled={loading || fetchingAvailable}
                    >
                        {loading || fetchingAvailable ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Loading...
                            </>
                        ) : (
                            <>
                                <UserPlus className="w-4 h-4" />
                                Add Member
                            </>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                    <div className="p-4 space-y-3">
                        <div className="flex items-center gap-2">
                            <Input
                                placeholder="Search members..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="h-9"
                            />
                        </div>
                        <div className="max-h-[300px] overflow-y-auto space-y-1">
                            {fetchingAvailable ? (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    Loading...
                                </div>
                            ) : filteredAvailable.length === 0 ? (
                                <div className="text-center py-8 text-sm text-muted-foreground">
                                    {availableMembers.length === 0 ? (
                                        <div className="space-y-2">
                                            <p>No other members found in this organization.</p>
                                            <p className="text-xs">Invite team members to assign them to projects.</p>
                                        </div>
                                    ) : (
                                        <p>No members match your search.</p>
                                    )}
                                </div>
                            ) : (
                                filteredAvailable.map((member) => (
                                    <button
                                        key={member.id}
                                        onClick={() => {
                                            handleAddMember(member.id)
                                            setMemberSelectOpen(false)
                                        }}
                                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent transition-colors text-left"
                                        disabled={loading}
                                    >
                                        <Avatar className="w-8 h-8">
                                            <AvatarImage 
                                                src={member.imageUrl || undefined}
                                                alt={getDisplayName(member)}
                                            />
                                            <AvatarFallback className="text-xs">
                                                {getInitials(member)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">
                                                {getDisplayName(member)}
                                            </p>
                                            <p className="text-xs text-muted-foreground truncate">
                                                {member.email}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                    
                    {/* Footer with Invite Button - Always visible */}
                    <div className="p-2 border-t border-zinc-800 mt-2">
                        <Button 
                            variant="ghost" 
                            size="sm" 
                            className="w-full justify-start text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10"
                            onClick={() => {
                                setMemberSelectOpen(false)
                                navigate('/settings?tab=team')
                            }}
                        >
                            <UserPlus className="w-4 h-4 mr-2" />
                            Invite New Member
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>

            {availableMembers.length === 0 && currentMembers.length > 0 && (
                <p className="text-xs text-muted-foreground text-center">
                    All organization members are already assigned to this project
                </p>
            )}

            {availableMembers.length === 0 && currentMembers.length === 0 && !fetchingAvailable && (
                <div className="text-center py-6 border border-dashed rounded-lg bg-muted/30">
                    <User className="w-8 h-8 mx-auto mb-2 text-muted-foreground opacity-50" />
                    <p className="text-sm font-medium text-foreground mb-1">
                        No team members available
                    </p>
                    <p className="text-xs text-muted-foreground">
                        Invite team members in Settings to add them to projects
                    </p>
                </div>
            )}
        </div>
    )
}

