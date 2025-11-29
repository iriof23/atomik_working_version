import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useThemeStore } from '@/lib/store'
import { 
    UserProfile, 
    OrganizationProfile, 
    useOrganization, 
    useOrganizationList 
} from '@clerk/clerk-react'
import { dark } from '@clerk/themes'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, User, CreditCard, Settings as SettingsIcon, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import BillingSettings from '@/components/settings/BillingSettings'

export default function Settings() {
    const { theme } = useThemeStore()
    const { organization } = useOrganization()
    const { createOrganization } = useOrganizationList()
    const [searchParams, setSearchParams] = useSearchParams()
    
    // Initialize activeTab from URL query parameter, default to 'account'
    const [activeTab, setActiveTab] = useState<'account' | 'team' | 'billing' | 'preferences'>(
        (searchParams.get('tab') as 'account' | 'team' | 'billing' | 'preferences') || 'account'
    )

    // Sync activeTab changes to URL query parameter
    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (tabParam !== activeTab) {
            const newSearchParams = new URLSearchParams(searchParams)
            if (activeTab === 'account') {
                // Remove tab param for default tab (cleaner URL)
                newSearchParams.delete('tab')
            } else {
                newSearchParams.set('tab', activeTab)
            }
            setSearchParams(newSearchParams, { replace: true })
        }
    }, [activeTab, searchParams, setSearchParams])

    // Listen for URL changes (browser back/forward)
    useEffect(() => {
        const tabParam = searchParams.get('tab')
        if (tabParam && ['account', 'team', 'billing', 'preferences'].includes(tabParam)) {
            setActiveTab(tabParam as 'account' | 'team' | 'billing' | 'preferences')
        } else if (!tabParam) {
            setActiveTab('account')
        }
    }, [searchParams])

    const isDark = theme === 'dark'

    // Navigation Items
    const navItems = [
        { id: 'account', label: 'Account', icon: User },
        { id: 'team', label: 'Team', icon: Users },
        { id: 'billing', label: 'Billing', icon: CreditCard },
        { id: 'preferences', label: 'Preferences', icon: SettingsIcon },
    ] as const

    // Create Organization Handler
    const handleCreateOrg = () => {
        createOrganization?.({ name: "My Organization" })
    }

    // Content Renderer
    const renderContent = () => {
        switch (activeTab) {
            case 'account':
                return (
                    <UserProfile 
                        appearance={{
                            baseTheme: isDark ? dark : undefined,
                            elements: {
                                rootBox: "w-full",
                                card: "w-full shadow-none border border-border bg-card",
                                navbar: "hidden",
                                navbarMobileMenuButton: "hidden",
                                headerTitle: "hidden",
                                headerSubtitle: "hidden"
                            }
                        }}
                    />
                )
            case 'team':
                if (!organization) {
                    return (
                        <Card className="w-full bg-zinc-900 border-zinc-800">
                            <CardHeader className="text-center pb-2">
                                <div className="mx-auto w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center mb-4">
                                    <Users className="w-6 h-6 text-zinc-400" />
                                </div>
                                <CardTitle className="text-2xl text-white">Build your Security Team</CardTitle>
                                <CardDescription className="text-zinc-400 max-w-md mx-auto mt-2">
                                    Create an organization to collaborate on findings, share reports, and manage client access together.
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex justify-center pt-6 pb-8">
                                <Button 
                                    size="lg" 
                                    onClick={handleCreateOrg}
                                    className="bg-white text-black hover:bg-zinc-200 font-medium"
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Create Organization
                                </Button>
                            </CardContent>
                        </Card>
                    )
                }
                return (
                    <OrganizationProfile 
                        routing="hash"
                        appearance={{
                            baseTheme: isDark ? dark : undefined,
                            elements: {
                                rootBox: "w-full",
                                card: "w-full bg-zinc-900 border border-zinc-800 shadow-sm rounded-xl overflow-hidden",
                                navbar: "bg-zinc-900/50 border-r border-zinc-800",
                                navbarButton: "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800",
                                navbarButtonActive: "text-zinc-100 bg-zinc-800",
                                headerTitle: "text-zinc-100",
                                headerSubtitle: "text-zinc-400",
                                scrollBox: "bg-zinc-900",
                            }
                        }}
                    />
                )
            case 'billing':
                return <BillingSettings />
            case 'preferences':
                 return (
                    <Card className="w-full bg-zinc-900 border-zinc-800">
                         <CardHeader>
                            <CardTitle className="text-white">App Preferences</CardTitle>
                            <CardDescription className="text-zinc-400">Customize your workspace</CardDescription>
                        </CardHeader>
                        <CardContent>
                             <div className="p-6">
                                <p className="text-zinc-400">Theme settings are managed automatically by your system preference or user profile.</p>
                             </div>
                        </CardContent>
                    </Card>
                )
            default:
                return null
        }
    }

    return (
        <div className="space-y-6">
            {/* Page Header */}
            <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                    Manage your account, team, and preferences
                </p>
            </div>

            <div className="flex flex-col lg:flex-row gap-8 items-start">
                {/* Sidebar Navigation */}
                <nav className="w-full lg:w-64 shrink-0 space-y-1">
                    {navItems.map((item) => {
                        const Icon = item.icon
                        const isActive = activeTab === item.id
                        return (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-md transition-colors",
                                    isActive 
                                        ? "bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white" 
                                        : "text-zinc-500 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800/50 hover:text-zinc-900 dark:hover:text-white"
                                )}
                            >
                                <Icon className="w-4 h-4" />
                                {item.label}
                            </button>
                        )
                    })}
                </nav>

                {/* Main Content Area */}
                <div className="flex-1 w-full max-w-5xl">
                    {renderContent()}
                </div>
            </div>
        </div>
    )
}
