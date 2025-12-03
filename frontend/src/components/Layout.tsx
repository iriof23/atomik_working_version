import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../lib/store'
import { useUser, useClerk } from '@clerk/clerk-react'
import logo from '../assets/logo.png'
import { Toaster } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'
import {
    LayoutDashboard,
    Users,
    FolderKanban,
    Shield,
    FileText,
    Settings,
    ChevronLeft,
    ChevronDown,
    ChevronRight,
    LogOut,
    Search,
    Bell,
    HelpCircle,
} from 'lucide-react'

interface NavItemProps {
    to: string
    icon: React.ReactNode
    label: string
    count?: number
    isActive?: boolean
    isCollapsed?: boolean
}

function NavItem({ to, icon, label, count, isActive, isCollapsed }: NavItemProps) {
    return (
        <Link
            to={to}
            className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-150",
                isActive
                    ? "bg-violet-50 text-violet-700 dark:bg-sidebar-active dark:text-sidebar-active-text"
                    : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-sidebar-hover dark:hover:text-white"
            )}
        >
            <span className={cn("flex-shrink-0", isActive ? "text-violet-600" : "text-slate-400")}>
                {icon}
            </span>
            {!isCollapsed && (
                <>
                    <span className="flex-1">{label}</span>
                    {count !== undefined && (
                        <span className={cn(
                            "text-xs font-medium px-2 py-0.5 rounded-full",
                            isActive
                                ? "bg-violet-100 text-violet-700"
                                : "bg-slate-100 text-slate-500"
                        )}>
                            {count}
                        </span>
                    )}
                </>
            )}
        </Link>
    )
}

interface NavSectionProps {
    title: string
    children: React.ReactNode
    isCollapsed?: boolean
    defaultOpen?: boolean
}

function NavSection({ title, children, isCollapsed, defaultOpen = true }: NavSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen)

    if (isCollapsed) {
        return <div className="py-2">{children}</div>
    }

    return (
        <div className="py-2">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-1 w-full px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400 hover:text-slate-600 transition-colors"
            >
                {isOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                {title}
            </button>
            {isOpen && <div className="mt-1 space-y-0.5">{children}</div>}
        </div>
    )
}

export default function Layout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user: storeUser, logout: storeLogout } = useAuthStore()
    const { user: clerkUser, isLoaded } = useUser()
    const { signOut } = useClerk()
    const [isCollapsed, setIsCollapsed] = useState(false)

    const handleLogout = async () => {
        await signOut()
        storeLogout()
        navigate('/sign-in')
    }

    const displayName = clerkUser ? clerkUser.fullName : storeUser?.name
    const displayEmail = clerkUser ? clerkUser.primaryEmailAddress?.emailAddress : storeUser?.email
    const initials = displayName?.split(' ').map(n => n[0]).join('').toUpperCase() || 'U'

    const isActive = (path: string) => location.pathname === path || location.pathname.startsWith(path + '/')

    const sidebarWidth = isCollapsed ? '64px' : '240px'

    return (
        <div className="min-h-screen bg-background">
            {/* Sidebar */}
            <aside
                className={cn(
                    "fixed inset-y-0 left-0 z-50 flex flex-col",
                    "bg-white dark:bg-sidebar border-r border-sidebar-border",
                    "transition-all duration-300 ease-in-out"
                )}
                style={{ width: sidebarWidth }}
            >
                {/* Header */}
                <div className="flex items-center justify-between h-14 px-3 border-b border-sidebar-border">
                    <Link 
                        to="/" 
                        className={cn(
                            "flex items-center gap-2 hover:opacity-80 transition-opacity",
                            isCollapsed && "justify-center"
                        )}
                    >
                        <img src={logo} alt="Atomik" className="w-8 h-8 object-contain" />
                        {!isCollapsed && (
                            <span className="text-lg font-bold text-slate-900 dark:text-white tracking-tight">
                                Atomik
                            </span>
                        )}
                    </Link>
                    {!isCollapsed && (
                        <button
                            onClick={() => setIsCollapsed(true)}
                            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {/* Collapsed expand button */}
                {isCollapsed && (
                    <button
                        onClick={() => setIsCollapsed(false)}
                        className="flex items-center justify-center h-10 mt-2 mx-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-md transition-colors"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                )}

                {/* Navigation */}
                <nav className="flex-1 px-2 py-2 overflow-y-auto custom-scrollbar">
                    <NavSection title="Overview" isCollapsed={isCollapsed}>
                        <NavItem
                            to="/dashboard"
                            icon={<LayoutDashboard className="w-5 h-5" />}
                            label="Dashboard"
                            isActive={isActive('/dashboard')}
                            isCollapsed={isCollapsed}
                        />
                    </NavSection>

                    <NavSection title="Management" isCollapsed={isCollapsed}>
                        <NavItem
                            to="/clients"
                            icon={<Users className="w-5 h-5" />}
                            label="Clients"
                            isActive={isActive('/clients')}
                            isCollapsed={isCollapsed}
                        />
                        <NavItem
                            to="/projects"
                            icon={<FolderKanban className="w-5 h-5" />}
                            label="Projects"
                            isActive={isActive('/projects')}
                            isCollapsed={isCollapsed}
                        />
                        <NavItem
                            to="/findings"
                            icon={<Shield className="w-5 h-5" />}
                            label="Findings"
                            isActive={isActive('/findings')}
                            isCollapsed={isCollapsed}
                        />
                        <NavItem
                            to="/reports"
                            icon={<FileText className="w-5 h-5" />}
                            label="Reports"
                            isActive={isActive('/reports')}
                            isCollapsed={isCollapsed}
                        />
                    </NavSection>

                    <NavSection title="System" isCollapsed={isCollapsed} defaultOpen={false}>
                        <NavItem
                            to="/settings"
                            icon={<Settings className="w-5 h-5" />}
                            label="Settings"
                            isActive={isActive('/settings')}
                            isCollapsed={isCollapsed}
                        />
                    </NavSection>
                </nav>

                {/* User Profile */}
                <div className="border-t border-sidebar-border p-3">
                    <div className={cn(
                        "flex items-center gap-3",
                        isCollapsed && "justify-center"
                    )}>
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white text-sm font-medium flex-shrink-0">
                            {initials}
                        </div>
                        {!isCollapsed && (
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                                    {displayName}
                                </p>
                                <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                                    {displayEmail}
                                </p>
                            </div>
                        )}
                        {!isCollapsed && (
                            <button
                                onClick={handleLogout}
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"
                                title="Logout"
                            >
                                <LogOut className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <main
                className="min-h-screen transition-all duration-300 ease-in-out"
                style={{ marginLeft: sidebarWidth }}
            >
                {/* Top bar */}
                <header className="sticky top-0 z-40 h-14 bg-background/80 backdrop-blur-sm border-b border-border flex items-center justify-between px-6">
                    <div className="flex items-center gap-4">
                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                            <input
                                type="text"
                                placeholder="Search..."
                                className="w-64 pl-9 pr-4 py-1.5 text-sm bg-slate-100 dark:bg-slate-800 border-0 rounded-lg placeholder-slate-400 focus:ring-2 focus:ring-violet-500 focus:bg-white dark:focus:bg-slate-700 transition-all duration-200"
                            />
                            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 bg-slate-200 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                                ⌘K
                            </kbd>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                            <HelpCircle className="w-5 h-5" />
                        </button>
                        <button className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors">
                            <Bell className="w-5 h-5" />
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-orange-500 rounded-full" />
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <div className="p-6">
                    <Outlet />
                </div>
            </main>
            <Toaster />
        </div>
    )
}
