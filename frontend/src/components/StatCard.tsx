import { Card, CardContent } from '@/components/ui/card'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface StatCardProps {
    icon: React.ReactNode
    label: string
    value: number | string
    trend?: string
    trendUp?: boolean
    badge?: number
    badgeLabel?: string
    subtitle?: string
    variant?: 'default' | 'warning' | 'destructive' | 'success'
}

export function StatCard({
    icon,
    label,
    value,
    trend,
    trendUp,
    badge,
    badgeLabel,
    subtitle,
    variant = 'default'
}: StatCardProps) {

    // Subtle colored backgrounds matching the new Apple/Linear design
    const variantStyles = {
        default: {
            iconBg: 'bg-slate-100',
            iconColor: 'text-slate-600',
        },
        success: {
            iconBg: 'bg-emerald-100',
            iconColor: 'text-emerald-600',
        },
        warning: {
            iconBg: 'bg-amber-100',
            iconColor: 'text-amber-600',
        },
        destructive: {
            iconBg: 'bg-red-100',
            iconColor: 'text-red-600',
        },
    }

    const styles = variantStyles[variant]

    return (
        <Card className="hover:shadow-card-hover transition-shadow">
            <CardContent className="p-5">
                {/* Top Section: Icon and Trend/Badge */}
                <div className="flex items-start justify-between">
                    {/* Icon with colored background */}
                    <div className={cn("p-2.5 rounded-xl", styles.iconBg, styles.iconColor)}>
                        {icon}
                    </div>

                    {/* Trend indicator */}
                    {trend && (
                        <div
                            className={cn(
                                "flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full",
                                trendUp
                                    ? "bg-emerald-50 text-emerald-600"
                                    : "bg-red-50 text-red-600"
                            )}
                        >
                            {trendUp ? (
                                <TrendingUp className="w-3 h-3" />
                            ) : (
                                <TrendingDown className="w-3 h-3" />
                            )}
                            {trend}
                        </div>
                    )}

                    {/* Critical badge */}
                    {badge !== undefined && badge > 0 && (
                        <div className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-full bg-red-50 text-red-600">
                            {badge} {badgeLabel}
                        </div>
                    )}
                </div>

                {/* Bottom Section: Value and Label */}
                <div className="mt-4">
                    <p className="text-2xl font-bold text-slate-900 tracking-tight">
                        {value}
                    </p>
                    <p className="text-sm font-medium text-slate-500 mt-1">
                        {label}
                    </p>
                    {subtitle && (
                        <p className="text-xs text-slate-400 mt-1.5">
                            {subtitle}
                        </p>
                    )}
                </div>
            </CardContent>
        </Card>
    )
}
