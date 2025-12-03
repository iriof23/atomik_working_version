import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
                secondary:
                    "border border-border bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
                outline: 
                    "border border-border text-foreground",
                success:
                    "border border-transparent bg-green-500 text-white hover:bg-green-500/80",
                // Severity variants (matching screenshot style)
                critical:
                    "border border-red-200 bg-red-100 text-red-700 dark:border-red-800 dark:bg-red-900/30 dark:text-red-400",
                high:
                    "border border-orange-200 bg-orange-100 text-orange-700 dark:border-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
                medium:
                    "border border-yellow-200 bg-yellow-100 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
                low:
                    "border border-green-200 bg-green-100 text-green-700 dark:border-green-800 dark:bg-green-900/30 dark:text-green-400",
                info:
                    "border border-blue-200 bg-blue-100 text-blue-700 dark:border-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
                // Priority variants (from screenshot)
                urgent:
                    "border border-orange-200 bg-orange-50 text-orange-600",
                normal:
                    "border border-slate-200 bg-slate-50 text-slate-600",
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
