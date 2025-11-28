import { useState, useEffect } from 'react'
import { initializePaddle, Paddle } from '@paddle/paddle-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Zap, CreditCard, Shield, Crown, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { billingApi, api } from '@/lib/api'
import { useUser, useAuth } from '@clerk/clerk-react'

interface BillingInfo {
    plan: 'FREE' | 'PRO' | 'AGENCY'
    creditBalance: number
    subscriptionStatus: string | null
    subscriptionId: string | null
    paddleCustomerId: string | null
}

export default function BillingSettings() {
    const [paddle, setPaddle] = useState<Paddle | null>(null)
    const [loading, setLoading] = useState<string | null>(null)
    const [billingInfo, setBillingInfo] = useState<BillingInfo | null>(null)
    const [fetchingBilling, setFetchingBilling] = useState(true)
    const { user } = useUser()
    const { getToken } = useAuth()

    // Fetch billing info from backend
    useEffect(() => {
        const fetchBillingInfo = async () => {
            try {
                setFetchingBilling(true)
                
                // Get Clerk session token and set it for this request
                const token = await getToken()
                console.log('Clerk token obtained:', token ? 'Yes' : 'No')
                
                if (!token) {
                    console.error('No Clerk token available')
                    throw new Error('Not authenticated')
                }
                
                // Make request with token
                const data = await billingApi.getBillingInfo(token)
                console.log('Billing info fetched:', data)
                setBillingInfo(data)
            } catch (error: any) {
                console.error('Failed to fetch billing info:', error)
                console.error('Error details:', error.response?.data)
                // Fallback to default values
                setBillingInfo({
                    plan: 'FREE',
                    creditBalance: 5,
                    subscriptionStatus: null,
                    subscriptionId: null,
                    paddleCustomerId: null
                })
            } finally {
                setFetchingBilling(false)
            }
        }

        if (user) {
            fetchBillingInfo()
        }
    }, [user, getToken])

    // Current plan data from API
    const currentPlan = billingInfo?.plan || 'FREE'
    const currentCredits = billingInfo?.creditBalance || 0
    const subscriptionStatus = billingInfo?.subscriptionStatus || 'Active'

    // Initialize Paddle
    useEffect(() => {
        const token = import.meta.env.VITE_PADDLE_CLIENT_TOKEN
        if (token) {
            initializePaddle({
                environment: 'sandbox',
                token,
                eventCallback: async (data) => {
                    console.log('Paddle Event:', data)
                    
                    // Handle checkout errors
                    if (data.name === 'checkout.error') {
                        console.error('Paddle Checkout Error:', data)
                    }
                    
                    // Handle checkout closed
                    if (data.name === 'checkout.closed') {
                        console.log('Paddle Checkout Closed:', data)
                    }
                    
                    // Handle successful checkout
                    if (data.name === 'checkout.completed') {
                        console.log('Checkout completed!', data)
                        // Refresh billing data from API
                        try {
                            const token = await getToken()
                            if (token) {
                                const updatedBilling = await billingApi.getBillingInfo(token)
                                setBillingInfo(updatedBilling)
                            }
                        } catch (error) {
                            console.error('Failed to refresh billing info:', error)
                        }
                    }
                }
            }).then((paddleInstance) => {
                if (paddleInstance) {
                    setPaddle(paddleInstance)
                    console.log('Paddle initialized successfully')
                }
            }).catch((error) => {
                console.error('Failed to initialize Paddle:', error)
            })
        } else {
            console.warn('VITE_PADDLE_CLIENT_TOKEN not found in environment variables')
        }
    }, [])

    // Open Paddle Checkout
    const openCheckout = (priceId: string) => {
        if (!paddle) {
            console.error('Paddle not initialized')
            return
        }
        
        setLoading(priceId)
        
        // Build checkout options with user info
        const checkoutOptions: any = {
            items: [{ priceId, quantity: 1 }],
            settings: {
                successUrl: `${window.location.origin}/settings?checkout=success`,
                displayMode: 'overlay', // or 'inline'
                theme: 'dark',
                locale: 'en'
            }
        }
        
        // Add customer email if available
        if (user?.primaryEmailAddress?.emailAddress) {
            checkoutOptions.customer = {
                email: user.primaryEmailAddress.emailAddress
            }
        }
        
        console.log('Opening Paddle checkout with:', checkoutOptions)
        
        paddle.Checkout.open(checkoutOptions)
        // Reset loading state after a delay
        setTimeout(() => setLoading(null), 1000)
    }

    // Subscription Plans
    const subscriptionPlans = [
        {
            id: 'free',
            name: 'Free Tier',
            subtitle: 'For Testing',
            price: 0,
            priceId: null,
            credits: 10,
            features: [
                '1 Active Project',
                'PDF Export Only',
                '10 AI Credits/month',
                'Community Support'
            ],
            current: currentPlan === 'FREE',
            popular: false
        },
        {
            id: 'pro',
            name: 'Pro',
            subtitle: 'For Freelancers',
            price: 49,
            priceId: 'pri_01kb5djzbeyaev2k64nzkayfbx',
            credits: 500,
            features: [
                'Unlimited Projects',
                'PDF & DOCX Export',
                '500 AI Credits/month',
                'Priority Support',
                'Custom Branding'
            ],
            current: currentPlan === 'PRO',
            popular: false
        },
        {
            id: 'agency',
            name: 'Agency',
            subtitle: 'For Teams',
            price: 149,
            priceId: 'pri_01kb5dphg35030j7e9crrcqxd8',
            credits: 2000,
            features: [
                'Everything in Pro',
                'White-label Reports',
                'Client Portal Access',
                '2000 AI Credits/month',
                'Dedicated Support',
                'SSO & SAML'
            ],
            current: currentPlan === 'AGENCY',
            popular: true
        }
    ]

    // Credit Top-Up Packs
    const creditPacks = [
        {
            id: 'starter',
            name: 'Starter Pack',
            price: 15,
            credits: 500,
            priceId: 'pri_01kb5dww39pc83mag1x8dtrzyw',
            description: 'Perfect for occasional use'
        },
        {
            id: 'pro',
            name: 'Pro Pack',
            price: 50,
            credits: 2000,
            priceId: 'pri_01kb5e09hfcpdpzxvxmzg3c179',
            description: 'Best value for power users',
            popular: true
        }
    ]

    // Show loading state while fetching billing info
    if (fetchingBilling) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <div className="text-center">
                    <Loader2 className="w-8 h-8 text-emerald-500 animate-spin mx-auto mb-4" />
                    <p className="text-zinc-400">Loading billing information...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* ========== SECTION A: CURRENT STATUS (THE HUD) ========== */}
            <div>
                <h2 className="text-2xl font-bold text-white mb-4">Billing & Credits</h2>
                
                <Card className="bg-zinc-900 border-zinc-800">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            {/* Current Plan */}
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-emerald-500/10 rounded-lg">
                                    <Shield className="w-6 h-6 text-emerald-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Current Plan</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <p className="text-xl font-bold text-white">{currentPlan}</p>
                                        <Badge className="bg-emerald-600 text-white border-0 text-xs">
                                            Active
                                        </Badge>
                                    </div>
                                </div>
                            </div>

                            {/* AI Credits */}
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-yellow-500/10 rounded-lg">
                                    <Zap className="w-6 h-6 text-yellow-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">AI Credits</p>
                                    <p className="text-xl font-bold text-white flex items-center gap-2 mt-1">
                                        {currentCredits} <Zap className="w-5 h-5 text-yellow-500" />
                                    </p>
                                </div>
                            </div>

                            {/* Status */}
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-blue-500/10 rounded-lg">
                                    <CreditCard className="w-6 h-6 text-blue-500" />
                                </div>
                                <div>
                                    <p className="text-sm text-zinc-400">Status</p>
                                    <p className="text-xl font-bold text-white mt-1">{subscriptionStatus}</p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ========== SECTION B: SUBSCRIPTION PLANS (THE GRID) ========== */}
            <div>
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-white">Upgrade Workspace</h3>
                    <p className="text-sm text-zinc-400 mt-1">Choose the plan that fits your needs</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {subscriptionPlans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={cn(
                                'bg-zinc-900 border border-zinc-800 rounded-xl flex flex-col hover:border-zinc-700 transition-all relative',
                                plan.popular && 'border-emerald-500 shadow-lg shadow-emerald-500/20',
                                plan.current && 'opacity-75'
                            )}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <Badge className="bg-emerald-600 text-white border-0 px-3 py-1">
                                        <Crown className="w-3 h-3 mr-1" />
                                        Recommended
                                    </Badge>
                                </div>
                            )}

                            <CardHeader className="pb-4">
                                <div className="space-y-2">
                                    <CardTitle className="text-white text-xl">{plan.name}</CardTitle>
                                    <p className="text-sm text-zinc-400">{plan.subtitle}</p>
                                    <div className="flex items-baseline gap-1 mt-4">
                                        <span className="text-4xl font-bold text-white">${plan.price}</span>
                                        <span className="text-zinc-400">/month</span>
                                    </div>
                                    {plan.credits > 0 && (
                                        <p className="text-sm text-emerald-400 flex items-center gap-1">
                                            <Zap className="w-4 h-4" />
                                            {plan.credits} AI Credits/mo
                                        </p>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 flex flex-col gap-4">
                                {/* Features List */}
                                <ul className="space-y-3 flex-1">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2 text-sm">
                                            <Check className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-zinc-300">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* Action Button */}
                                {plan.current ? (
                                    <Button
                                        disabled
                                        className="w-full bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                    >
                                        Current Plan
                                    </Button>
                                ) : plan.priceId ? (
                                    <Button
                                        onClick={() => openCheckout(plan.priceId!)}
                                        disabled={loading === plan.priceId || !paddle}
                                        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                                    >
                                        {loading === plan.priceId ? 'Loading...' : 'Upgrade Now'}
                                    </Button>
                                ) : (
                                    <Button
                                        disabled
                                        className="w-full bg-zinc-800 text-zinc-400 cursor-not-allowed"
                                    >
                                        Contact Sales
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* ========== SECTION C: CREDIT TOP-UPS (THE EXPANSION) ========== */}
            <div>
                <div className="mb-4">
                    <h3 className="text-xl font-bold text-white">Refill AI Credits</h3>
                    <p className="text-sm text-zinc-400 mt-1">One-time credit packs for extra capacity</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {creditPacks.map((pack) => (
                        <Card
                            key={pack.id}
                            className={cn(
                                'bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-700 transition-all',
                                pack.popular && 'border-purple-500/50 shadow-lg shadow-purple-500/10'
                            )}
                        >
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-3 bg-yellow-500/10 rounded-lg">
                                            <Sparkles className="w-6 h-6 text-yellow-500" />
                                        </div>
                                        <div>
                                            <h4 className="text-lg font-bold text-white">{pack.name}</h4>
                                            <p className="text-sm text-zinc-400">{pack.description}</p>
                                        </div>
                                    </div>
                                    {pack.popular && (
                                        <Badge className="bg-purple-600 text-white border-0 text-xs">
                                            Best Value
                                        </Badge>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-3xl font-bold text-white">${pack.price}</p>
                                        <p className="text-sm text-emerald-400 flex items-center gap-1 mt-1">
                                            <Zap className="w-4 h-4" />
                                            {pack.credits} Credits
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-xs text-zinc-500">Cost per credit</p>
                                        <p className="text-sm text-zinc-300">${(pack.price / pack.credits).toFixed(3)}</p>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => openCheckout(pack.priceId)}
                                    disabled={loading === pack.priceId || !paddle}
                                    className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-colors"
                                >
                                    {loading === pack.priceId ? 'Loading...' : 'Buy Now'}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Additional Info */}
            <Card className="bg-zinc-900 border-zinc-800">
                <CardContent className="p-6">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-blue-500/10 rounded-lg">
                            <Zap className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <h3 className="font-medium text-white">How AI Credits Work</h3>
                            <p className="text-sm text-zinc-400 mt-1">
                                AI credits are used for report generation, vulnerability enrichment, and automated analysis. 
                                Subscription credits reset monthly, while purchased credit packs never expire.
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
