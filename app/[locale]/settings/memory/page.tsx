'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthGuard } from '@/lib/hooks/useAuth';
import { useMutation, useQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft } from 'lucide-react';

export default function MemorySettingsPage() {
  useAuthGuard();
  const router = useRouter();
  const [clearing, setClearing] = useState(false);

  const counts = useQuery(api.agent_memories.count, {} as any) as any;
  const clearAll = useMutation(api.agent_memories.clearAll);

  const onClear = async () => {
    if (clearing) return;
    const ok = confirm('确定要清除所有记忆吗？这会让长老不再记得与你有关的信息。');
    if (!ok) return;
    setClearing(true);
    try {
      await clearAll({});
      alert('已清除');
    } finally {
      setClearing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 via-amber-50 to-stone-100">
      <div className="border-b border-stone-200 bg-white/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="text-stone-600 hover:text-stone-900"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            返回
          </Button>
          <h1 className="text-2xl font-serif text-stone-800">记忆设置</h1>
          <div className="w-20" />
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <Card className="p-6">
          <h2 className="text-xl font-semibold text-stone-800 mb-2">记忆概览</h2>
          <p className="text-sm text-stone-600">
            长老已记住 <span className="font-medium text-stone-800">{counts?.active ?? 0}</span> 条与你有关的信息。
          </p>
        </Card>

        <Card className="p-6">
          <h2 className="text-xl font-semibold text-stone-800 mb-2">清除记忆</h2>
          <p className="text-sm text-stone-600 mb-4">
            你可以随时清除所有记忆。清除后，长老不会在新对话里引用这些信息。
          </p>
          <Button variant="destructive" onClick={onClear} disabled={clearing}>
            {clearing ? '清除中...' : '清除所有记忆'}
          </Button>
        </Card>
      </div>
    </div>
  );
}
