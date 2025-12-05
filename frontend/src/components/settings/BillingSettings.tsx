import { useState, useEffect } from 'react'
import { initializePaddle, Paddle } from '@paddle/paddle-js'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Check, Zap, CreditCard, Shield, Crown, Sparkles, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { billingApi } from '@/lib/api'
import { useUser, useAuth, useOrganization } from '@clerk/clerk-react'
import { useToast } from '@/components/ui/use-toast'

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
    const { organization } = useOrganization()
    const { toast } = useToast()

    // Fetch billing info from backend
    useEffect(() => {
        const fetchBillingInfo = async () => {
            try {
                setFetchingBilling(true)
                
                // Get Clerk session token and set it for this request
                const token = await getToken()
                
                if (!token) {
                    throw new Error('Not authenticated')
                }
                
                // Make request with token
                const data = await billingApi.getBillingInfo(token)
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
                    // Handle checkout errors
                    if (data.name === 'checkout.error') {
                        console.error('Paddle Checkout Error:', data)
                    }
                    
                    // Handle successful checkout
                    if (data.name === 'checkout.completed') {
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
                }
            }).catch((error) => {
                console.error('Failed to initialize Paddle:', error)
            })
        }
    }, [])

    // Determine tier from price ID
    const getTierFromPriceId = (priceId: string): 'PRO' | 'AGENCY' | 'credits' => {
        if (priceId === 'pri_01kb5djzbeyaev2k64nzkayfbx') return 'PRO'
        if (priceId === 'pri_01kb5dphg35030j7e9crrcqxd8') return 'AGENCY'
        return 'credits' // Credit packs
    }

    // Open Paddle Checkout
    const openCheckout = (priceId: string) => {
        if (!paddle) {
            console.error('Paddle not initialized')
            toast({
                title: 'Error',
                description: 'Payment system not ready. Please try again.',
                variant: 'destructive'
            })
            return
        }
        
        setLoading(priceId)
        
        // Determine the tier/type for this purchase
        const tier = getTierFromPriceId(priceId)
        const isCredits = tier === 'credits'
        
        // Build checkout options with user info and custom data
        const checkoutOptions: any = {
            items: [{ priceId, quantity: 1 }],
            settings: {
                successUrl: `${window.location.origin}/settings?checkout=success`,
                displayMode: 'overlay',
                theme: 'light',
                locale: 'en'
            },
            // Pass custom data for webhook processing
            customData: {
                type: isCredits ? 'credits' : 'subscription',
                tier: tier,
                userId: user?.id || null,
                orgId: organization?.id || null,
                userEmail: user?.primaryEmailAddress?.emailAddress || null,
            }
        }
        
        // Add customer email if available
        if (user?.primaryEmailAddress?.emailAddress) {
            checkoutOptions.customer = {
                email: user.primaryEmailAddress.emailAddress
            }
        }
        
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
                    <Loader2 className="w-8 h-8 text-emerald-600 animate-spin mx-auto mb-4" />
                    <p className="text-slate-500">Loading billing information...</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-8">
            {/* Header */}
            <div>
                <h2 className="text-lg font-semibold text-slate-900">Billing & Credits</h2>
                <p className="text-sm text-slate-500 mt-1">Manage your subscription, payments, and AI credits</p>
            </div>
            
            {/* ========== SECTION A: CURRENT STATUS (THE HUD) ========== */}
            <Card className="bg-white border-slate-200">
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {/* Current Plan */}
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 rounded-xl">
                                <Shield className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Current Plan</p>
                                <div className="flex items-center gap-2 mt-1">
                                    <p className="text-xl font-bold text-slate-900">{currentPlan}</p>
                                    <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 text-emerald-700">
                                        Active
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* AI Credits */}
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-amber-100 rounded-xl">
                                <Zap className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">AI Credits</p>
                                <p className="text-xl font-bold text-slate-900 flex items-center gap-1.5 mt-1">
                                    {currentCredits} <Zap className="w-4 h-4 text-amber-500" />
                                </p>
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-emerald-100 rounded-xl">
                                <CreditCard className="w-5 h-5 text-emerald-600" />
                            </div>
                            <div>
                                <p className="text-xs text-slate-500 uppercase tracking-wide font-medium">Status</p>
                                <div className="mt-1">
                                    {subscriptionStatus === 'active' || subscriptionStatus === 'Active' ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                                            Active
                                        </span>
                                    ) : subscriptionStatus === 'past_due' ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200">
                                            <span className="w-1.5 h-1.5 bg-red-500 rounded-full mr-1.5" />
                                            Past Due
                                        </span>
                                    ) : subscriptionStatus === 'canceled' ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
                                            <span className="w-1.5 h-1.5 bg-slate-400 rounded-full mr-1.5" />
                                            Canceled
                                        </span>
                                    ) : subscriptionStatus === 'paused' ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                                            <span className="w-1.5 h-1.5 bg-amber-500 rounded-full mr-1.5" />
                                            Paused
                                        </span>
                                    ) : subscriptionStatus === 'trialing' ? (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                                            Trial
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full mr-1.5 animate-pulse" />
                                            Active
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ========== SECTION B: SUBSCRIPTION PLANS (THE GRID) ========== */}
            <div>
                <div className="mb-4">
                    <h3 className="text-sm font-semibold text-slate-900">Upgrade Workspace</h3>
                    <p className="text-xs text-slate-500 mt-1">Choose the plan that fits your needs</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {subscriptionPlans.map((plan) => (
                        <Card
                            key={plan.id}
                            className={cn(
                                'bg-white border rounded-xl flex flex-col hover:shadow-card-hover transition-all relative',
                                plan.popular && 'border-emerald-300 shadow-lg shadow-emerald-100',
                                plan.current && 'opacity-75',
                                !plan.popular && 'border-slate-200'
                            )}
                        >
                            {plan.popular && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                    <span className="inline-flex items-center bg-emerald-600 text-white text-[11px] font-semibold px-2.5 py-1 rounded-full shadow-sm">
                                        <Crown className="w-3 h-3 mr-1" />
                                        Recommended
                                    </span>
                                </div>
                            )}

                            <CardHeader className="pb-3">
                                <div className="space-y-1.5">
                                    <CardTitle className="text-slate-900 text-lg">{plan.name}</CardTitle>
                                    <p className="text-xs text-slate-500">{plan.subtitle}</p>
                                    <div className="flex items-baseline gap-1 mt-3">
                                        <span className="text-3xl font-bold text-slate-900">${plan.price}</span>
                                        <span className="text-xs text-slate-500">/month</span>
                                    </div>
                                    {plan.credits > 0 && (
                                        <p className="text-xs text-emerald-600 flex items-center gap-1 font-medium">
                                            <Zap className="w-3.5 h-3.5" />
                                            {plan.credits} AI Credits/mo
                                        </p>
                                    )}
                                </div>
                            </CardHeader>

                            <CardContent className="flex-1 flex flex-col gap-4 pt-0">
                                {/* Features List */}
                                <ul className="space-y-2 flex-1">
                                    {plan.features.map((feature, index) => (
                                        <li key={index} className="flex items-start gap-2 text-xs">
                                            <Check className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                                            <span className="text-slate-600">{feature}</span>
                                        </li>
                                    ))}
                                </ul>

                                {/* Action Button */}
                                {plan.current ? (
                                    <Button
                                        disabled
                                        size="sm"
                                        className="w-full bg-slate-100 text-slate-500 cursor-not-allowed"
                                    >
                                        Current Plan
                                    </Button>
                                ) : plan.priceId ? (
                                    <Button
                                        onClick={() => openCheckout(plan.priceId!)}
                                        disabled={loading === plan.priceId || !paddle}
                                        size="sm"
                                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                                    >
                                        {loading === plan.priceId ? 'Loading...' : 'Upgrade Now'}
                                    </Button>
                                ) : (
                                    <Button
                                        disabled
                                        size="sm"
                                        className="w-full bg-slate-100 text-slate-500 cursor-not-allowed"
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
                    <h3 className="text-sm font-semibold text-slate-900">Refill AI Credits</h3>
                    <p className="text-xs text-slate-500 mt-1">One-time credit packs for extra capacity</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {creditPacks.map((pack) => (
                        <Card
                            key={pack.id}
                            className={cn(
                                'bg-white border rounded-xl hover:shadow-card-hover transition-all',
                                pack.popular && 'border-amber-200 shadow-lg shadow-amber-50',
                                !pack.popular && 'border-slate-200'
                            )}
                        >
                            <CardContent className="p-5">
                                <div className="flex items-start justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="p-2.5 bg-amber-100 rounded-xl">
                                            <Sparkles className="w-5 h-5 text-amber-600" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-semibold text-slate-900">{pack.name}</h4>
                                            <p className="text-xs text-slate-500">{pack.description}</p>
                                        </div>
                                    </div>
                                    {pack.popular && (
                                        <span className="inline-flex items-center bg-amber-100 text-amber-700 text-[11px] font-semibold px-2 py-0.5 rounded-md">
                                            Best Value
                                        </span>
                                    )}
                                </div>

                                <div className="flex items-center justify-between mb-4">
                                    <div>
                                        <p className="text-2xl font-bold text-slate-900">${pack.price}</p>
                                        <p className="text-xs text-emerald-600 flex items-center gap-1 mt-0.5 font-medium">
                                            <Zap className="w-3.5 h-3.5" />
                                            {pack.credits} Credits
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] text-slate-400 uppercase tracking-wide">Cost per credit</p>
                                        <p className="text-xs text-slate-600 font-medium">${(pack.price / pack.credits).toFixed(3)}</p>
                                    </div>
                                </div>

                                <Button
                                    onClick={() => openCheckout(pack.priceId)}
                                    disabled={loading === pack.priceId || !paddle}
                                    size="sm"
                                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium transition-colors"
                                >
                                    {loading === pack.priceId ? 'Loading...' : 'Buy Now'}
                                </Button>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            </div>

            {/* Additional Info */}
            <div className="flex items-start gap-3 p-4 bg-slate-50 border border-slate-100 rounded-xl">
                <div className="p-2 bg-emerald-100 rounded-lg">
                    <Zap className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                    <h3 className="text-sm font-medium text-slate-900">How AI Credits Work</h3>
                    <p className="text-xs text-slate-500 mt-1">
                        AI credits are used for report generation, vulnerability enrichment, and automated analysis. 
                        Subscription credits reset monthly, while purchased credit packs never expire.
                    </p>
                </div>
            </div>
        </div>
    )
}