import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-50 to-stone-100 flex items-center justify-center p-4">
      <Card className="p-8 max-w-md w-full text-center">
        <div className="mb-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-stone-100 flex items-center justify-center mb-4">
            <span className="text-3xl font-serif text-stone-400">404</span>
          </div>
          <h2 className="text-2xl font-serif text-stone-800 mb-2">
            页面未找到
          </h2>
          <p className="text-stone-600 text-sm">
            您访问的页面不存在，可能已被移除或地址有误。
          </p>
        </div>
        <div className="space-y-3">
          <Link href="/">
            <Button className="w-full">返回首页</Button>
          </Link>
          <Link href="/chat">
            <Button variant="outline" className="w-full">
              开始对话
            </Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}
