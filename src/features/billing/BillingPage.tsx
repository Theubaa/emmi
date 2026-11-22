import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Check, CreditCard, Zap, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store/auth.store'
import { toast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import type { Subscription } from '@/types/database'

const PLANS = [
  {
    id: 'starter',
    name: 'Starter Growth',
    price: '$37',
    period: '/month',
    description: 'Perfect for solo founders and early outbound experiments.',
    features: [
      'Up to 3 Connected Email Accounts',
      '1,000 Active Verified Leads',
      '5,000 Emails / month',
      'Standard IMAP/SMTP Inboxes',
      'Basic Unibox Threading',
    ],
    highlight: false,
  },
  {
    id: 'hypergrowth',
    name: 'Hypergrowth Pro',
    price: '$97',
    period: '/month',
    description: 'For growing sales teams needing high deliverability and scale.',
    features: [
      'Up to 15 Connected Email Accounts',
      '25,000 Active Leads',
      '50,000 Emails / month',
      'Automated Multi-step Follow-up Sequences',
      'Realtime Collaborative Unibox',
      'Automated Bounce & Reply Detection',
    ],
    highlight: true,
  },
  {
    id: 'scale',
    name: 'Enterprise Scale',
    price: '$247',
    period: '/month',
    description: 'For agencies and large scale cold outreach operations.',
    features: [
      'Unlimited Email Accounts',
      '100,000+ Active Leads',
      '250,000 Emails / month',
      'Custom Dedicated Tracking Domains',
      'Multi-workspace Tenant Isolation',
      'Priority Delivery Queue & Support',
    ],
    highlight: false,
  },
]

export function BillingPage() {
  const { currentWorkspace, user } = useAuthStore()

  const { data: subscription } = useQuery({
    queryKey: ['workspace-subscription', currentWorkspace?.customer_id],
    queryFn: async () => {
      if (!currentWorkspace?.customer_id) return null
      const { data } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('customer_id', currentWorkspace.customer_id)
        .single()
      return (data || null) as Subscription | null
    },
    enabled: !!currentWorkspace?.customer_id,
  })

  const currentPlan = subscription?.plan || 'starter'

  const handleSelectPlan = (planId: string) => {
    toast({
      title: 'Checkout Interface',
      description: `Plan switch to ${planId.toUpperCase()} requested. Stripe/billing portal ready.`,
    })
  }

  return (
    <div className="p-6 space-y-8 max-w-6xl">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <CreditCard className="h-6 w-6 text-primary" />
          Subscription & Usage Plans
        </h1>
        <p className="text-muted-foreground text-sm">
          Scale your email outreach capacity as your sales operations grow.
        </p>
      </div>

      {/* Usage Quota Card */}
      <Card className="bg-gradient-to-r from-primary/5 via-primary/10 to-transparent border-primary/20">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-semibold capitalize">{currentPlan} Tier</h3>
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/30">
                  Active
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Your next billing cycle renews on the 1st of next month.
              </p>
            </div>
            <Button variant="outline" size="sm">Manage Payment Methods</Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Monthly Email Credits</span>
                <span className="font-medium">1,240 / {subscription?.max_emails_per_month || 5000}</span>
              </div>
              <Progress value={24.8} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Connected Email Inboxes</span>
                <span className="font-medium">2 / {subscription?.max_email_accounts || 3}</span>
              </div>
              <Progress value={66} className="h-2" />
            </div>

            <div>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">Contact Leads Stored</span>
                <span className="font-medium">350 / {subscription?.max_leads || 1000}</span>
              </div>
              <Progress value={35} className="h-2" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Pricing Comparison Matrix */}
      <div>
        <h2 className="text-xl font-bold mb-4">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((plan) => {
            const isCurrent = currentPlan.toLowerCase() === plan.id.toLowerCase()
            return (
              <Card
                key={plan.id}
                className={`relative flex flex-col ${
                  plan.highlight ? 'border-primary shadow-lg ring-1 ring-primary' : ''
                }`}
              >
                {plan.highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground text-xs uppercase px-3 py-0.5">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader>
                  <CardTitle className="text-xl">{plan.name}</CardTitle>
                  <CardDescription className="text-xs min-h-[32px]">{plan.description}</CardDescription>
                  <div className="pt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-extrabold">{plan.price}</span>
                    <span className="text-xs text-muted-foreground">{plan.period}</span>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Included:</div>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs">
                        <Check className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter>
                  <Button
                    className="w-full"
                    variant={isCurrent ? 'secondary' : plan.highlight ? 'default' : 'outline'}
                    onClick={() => handleSelectPlan(plan.id)}
                    disabled={isCurrent}
                  >
                    {isCurrent ? 'Current Plan' : 'Select Plan'}
                  </Button>
                </CardFooter>
              </Card>
            )
          })}
        </div>
      </div>
    </div>
  )
}
