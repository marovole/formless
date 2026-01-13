import { cn } from '@/lib/utils'

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string
}

export function Skeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800', className)}
      {...props}
    />
  )
}

export function SkeletonText({ className, ...props }: SkeletonProps) {
  return (
    <Skeleton
      className={cn('h-4 w-full', className)}
      {...props}
    />
  )
}

export function SkeletonCard({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('rounded-lg border border-zinc-200 p-4', className)}
      {...props}
    >
      <div className="space-y-3">
        <Skeleton className="h-4 w-1/3" />
        <SkeletonText />
        <SkeletonText />
        <SkeletonText className="w-2/3" />
      </div>
    </div>
  )
}

export function SkeletonButton({ className, ...props }: SkeletonProps) {
  return (
    <Skeleton
      className={cn('h-10 w-24 rounded-md', className)}
      {...props}
    />
  )
}

export function SkeletonAvatar({ className, ...props }: SkeletonProps) {
  return (
    <Skeleton
      className={cn('h-10 w-10 rounded-full', className)}
      {...props}
    />
  )
}

export function SkeletonInput({ className, ...props }: SkeletonProps) {
  return (
    <Skeleton
      className={cn('h-10 w-full rounded-md', className)}
      {...props}
    />
  )
}
