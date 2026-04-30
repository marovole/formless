import { Skeleton } from '@/components/ui/skeleton';

export default function ChatLoading() {
  return (
    <div className="h-screen max-h-[100dvh] bg-gradient-to-b from-stone-50 to-stone-100 flex flex-col">
      <div className="flex-1 max-w-4xl w-full mx-auto p-4 flex flex-col">
        <div className="flex-shrink-0 pb-4 border-b border-stone-200/50 mb-4 space-y-3">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-64" />
        </div>
        <div className="flex-1 space-y-4">
          <Skeleton className="h-24 w-[75%] ml-auto rounded-xl" />
          <Skeleton className="h-32 w-[80%] rounded-xl" />
        </div>
        <div className="flex gap-2 pt-4">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
        </div>
      </div>
    </div>
  );
}
