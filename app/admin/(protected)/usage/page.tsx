'use client'

import { useQuery } from 'convex/react'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { api } from '@/convex/_generated/api'

type UsageStats = {
  total_calls_today: number
  successful_calls_today: number
  total_tokens_today: number
  keys_status: Array<{
    id: string
    provider: string
    model_name: string | null
    daily_limit: number
    daily_used: number
  }>
  recent_usage: Array<{
    id: string
    provider: string
    model_name: string | null
    tokens_used: number
    success: boolean
    created_at: string
  }>
}

export default function UsagePage() {
  const stats = useQuery(api.api_keys.getUsageStats, {}) as UsageStats | undefined

  if (stats === undefined) {
    return (
      <div className="min-h-screen bg-zinc-50 p-8">
        <div className="mx-auto max-w-7xl space-y-8">
          <Skeleton className="h-10 w-48" />
          <div className="grid gap-4 md:grid-cols-3">
            <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
            <Card><CardHeader><Skeleton className="h-4 w-32" /></CardHeader><CardContent><Skeleton className="h-8 w-16" /></CardContent></Card>
          </div>
          <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
          <Card><CardHeader><Skeleton className="h-6 w-40" /></CardHeader><CardContent><Skeleton className="h-32 w-full" /></CardContent></Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-7xl space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Usage Statistics</h1>
          <p className="mt-2 text-zinc-600">API usage and analytics</p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Total Calls Today
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.total_calls_today || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Successful Calls
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {stats?.successful_calls_today || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Total Tokens
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">
                {stats?.total_tokens_today || 0}
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Keys Status</CardTitle>
            <CardDescription>Daily usage for each API key</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.keys_status && stats.keys_status.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Used</TableHead>
                      <TableHead>Limit</TableHead>
                      <TableHead>Remaining</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.keys_status.map((key) => (
                      <TableRow key={key.id}>
                        <TableCell className="font-medium">
                          {key.provider}
                        </TableCell>
                        <TableCell>{key.model_name || '-'}</TableCell>
                        <TableCell>{key.daily_used}</TableCell>
                        <TableCell>{key.daily_limit}</TableCell>
                        <TableCell>
                          {key.daily_limit - key.daily_used}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-zinc-500">No API keys configured</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Usage</CardTitle>
            <CardDescription>Last 50 API calls</CardDescription>
          </CardHeader>
          <CardContent>
            {stats?.recent_usage && stats.recent_usage.length > 0 ? (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Provider</TableHead>
                      <TableHead>Model</TableHead>
                      <TableHead>Tokens</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Time</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {stats.recent_usage.map((usage) => (
                      <TableRow key={usage.id}>
                        <TableCell>{usage.provider}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {usage.model_name || '-'}
                        </TableCell>
                        <TableCell>{usage.tokens_used || 0}</TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                              usage.success
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {usage.success ? 'Success' : 'Failed'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-zinc-500">
                          {new Date(usage.created_at).toLocaleString()}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-center text-zinc-500">No usage data yet</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
