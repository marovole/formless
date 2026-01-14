'use client'

import { useState } from 'react'
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
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useMutation, useQuery } from 'convex/react'
import { api } from '@/convex/_generated/api'

type Prompt = {
  id: string
  name: string
  role: string
  language: string
  content: string
  version: number
  is_active: boolean
  description: string | null
}

export default function PromptsPage() {
  const prompts = useQuery(api.prompts.list, {}) as Prompt[] | undefined
  const updatePrompt = useMutation(api.prompts.update)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [editContent, setEditContent] = useState('')

  const handleEdit = (prompt: Prompt) => {
    setEditingPrompt(prompt)
    setEditContent(prompt.content)
  }

  const handleSave = async () => {
    if (!editingPrompt) return

    try {
      await updatePrompt({
        id: editingPrompt.id as any,
        content: editContent,
      })

      setEditingPrompt(null)
    } catch (error) {
      console.error('Failed to update prompt:', error)
    }
  }

  const handleToggleActive = async (prompt: Prompt) => {
    try {
      await updatePrompt({ id: prompt.id as any, is_active: !prompt.is_active })
    } catch (error) {
      console.error('Failed to update prompt:', error)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-50 p-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Prompt Management</h1>
          <p className="mt-2 text-zinc-600">
            Manage system prompts for different roles
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Prompts</CardTitle>
            <CardDescription>
              System prompts and their configurations
            </CardDescription>
          </CardHeader>
          <CardContent>
            {prompts === undefined ? (
              <p className="text-center text-zinc-500">Loading...</p>
            ) : prompts.length === 0 ? (
              <p className="text-center text-zinc-500">No prompts configured</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Language</TableHead>
                    <TableHead>Version</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {prompts.map((prompt) => (
                    <TableRow key={prompt.id}>
                      <TableCell className="font-medium">
                        {prompt.name}
                      </TableCell>
                      <TableCell>{prompt.role}</TableCell>
                      <TableCell className="uppercase">
                        {prompt.language}
                      </TableCell>
                      <TableCell>v{prompt.version}</TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                            prompt.is_active
                              ? 'bg-green-100 text-green-700'
                              : 'bg-zinc-100 text-zinc-700'
                          }`}
                        >
                          {prompt.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(prompt)}
                          >
                            Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleActive(prompt)}
                          >
                            {prompt.is_active ? 'Disable' : 'Enable'}
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

        <Dialog
          open={!!editingPrompt}
          onOpenChange={(open) => !open && setEditingPrompt(null)}
        >
          <DialogContent className="max-w-4xl">
            <DialogHeader>
              <DialogTitle>Edit Prompt: {editingPrompt?.name}</DialogTitle>
              <DialogDescription>
                Version {editingPrompt?.version} → v
                {(editingPrompt?.version || 0) + 1}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Content</Label>
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="min-h-[400px] font-mono text-sm"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingPrompt(null)}>
                Cancel
              </Button>
              <Button onClick={handleSave}>Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}
