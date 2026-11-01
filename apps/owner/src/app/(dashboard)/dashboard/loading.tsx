import { OwnerSkeleton } from "@/components/ui/OwnerPrimitives";
export default function Loading() { return <div className="space-y-6"><div className="owner-skeleton h-20" /><div className="grid grid-cols-2 gap-4 xl:grid-cols-4">{[0,1,2,3].map(key=><div key={key} className="owner-skeleton h-36" />)}</div><div className="owner-panel"><OwnerSkeleton rows={4} /></div></div>; }
