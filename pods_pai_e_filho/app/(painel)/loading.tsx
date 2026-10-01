import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="grid gap-5" aria-busy="true" aria-label="Carregando">
      <div className="grid gap-2">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-8 w-48 max-w-full" />
        <Skeleton className="h-3 w-72 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Skeleton className="h-56" />
        <Skeleton className="h-56" />
      </div>
    </div>
  );
}
