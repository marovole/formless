'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

type ApiKey = {
  id: string
  provider: 'chutes' | 'openrouter'
  api_key: string
  model_name: string | null
  daily_limit: number
  daily_used: number
  priority: number
  is_active: boolean
  last_used_at: string | null
  created_at: string
}

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [formData, setFormData] = useState({
    provider: 'chutes' as 'chutes' | 'openrouter',
    api_key: '',
    model_name: '',
    daily_limit: 1000,
    priority: 1,
  })

  const fetchKeys = async () => {
    try {
      const response = await fetch('/api/admin/api-keys')
      const data = await response.json()
      setKeys(data.data || [])
    } catch (error) {
      console.error('Failed to fetch API keys:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchKeys()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await fetch('/api/admin/api-keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        setDialogOpen(false)
        setFormData({
          provider: 'chutes',
          api_key: '',
          model_name: '',
          daily_limit: 1000,
          priority: 1,
        })
        fetchKeys()
      }
    } catch (error) {
      console.error('Failed to create API key:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this API key?')) return

    try {
      await fetch(`/api/admin/api-keys/${id}`, { method: 'DELETE' })
      fetchKeys()
    } catch (error) {
      console.error('Failed to delete API key:', error)
    }
  }

  const handleToggleActive = async (key: ApiKey) => {
    try {
      await fetch(`/api/admin/api-keys/${key.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !key.is_active }),
      })
      fetchKeys()
    } catch (error) {
      console.error('Failed to update API key:', error)
    }
  }

  const maskApiKey = (key: string) => {
    if (key.length <= 8) return key
    return key.slice(0, 4) + '...' + key.slice(-4)
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">API Key Management</h1>
            <p className="mt-2 text-zinc-600">
              Manage API keys for LLM providers
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>Add API Key</Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleSubmit}>
                <DialogHeader>
                  <DialogTitle>Add New API Key</DialogTitle>
                  <DialogDescription>
                    Configure a new API key for LLM provider
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="provider">Provider</Label>
                    <Select
                      value={formData.provider}
                      onValueChange={(value: 'chutes' | 'openrouter') =>
                        setFormData({ ...formData, provider: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="chutes">Chutes</SelectItem>
                        <SelectItem value="openrouter">OpenRouter</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="api_key">API Key</Label>
                    <Input
                      id="api_key"
                      type="password"
                      value={formData.api_key}
                      onChange={(e) =>
                        setFormData({ ...formData, api_key: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="model_name">Model Name (Optional)</Label>
                    <Input
                      id="model_name"
                      value={formData.model_name}
                      onChange={(e) =>
                        setFormData({ ...formData, model_name: e.target.value })
                      }
                      placeholder="e.g., deepseek-r1, glm-4.5-air"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="daily_limit">Daily Limit</Label>
                    <Input
                      id="daily_limit"
                      type="number"
                      value={formData.daily_limit}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          daily_limit: parseInt(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="priority">Priority (lower = higher)</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={formData.priority}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          priority: parseInt(e.target.value),
                        })
                      }
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">Add Key</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>API Keys</CardTitle>
            <CardDescription>
              Active API keys and their usage statistics
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-center text-zinc-500">Loading...</p>
            ) : keys.length === 0 ? (
              <p className="text-center text-zinc-500">No API keys configured</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Provider</TableHead>
                    <TableHead>Model</TableHead>
                    <TableHead>API Key</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Usage</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {keys.map((key) => (
                    <TableRow key={key.id}>
                      <TableCell className="font-medium">
                        {key.provider}
                      </TableCell>
                      <TableCell>{key.model_name || '-'}</TableCell>
                      <TableCell className="font-mono text-sm">
                        {maskApiKey(key.api_key)}
                      </TableCell>
                      <TableCell>{key.priority}</TableCell>
                      <TableCell>
                        {key.daily_used} / {key.daily_limit}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            key.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {key.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(key)}
                          >
                            {key.is_active ? 'Disable' : 'Enable'}
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(key.id)}
                          >
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
