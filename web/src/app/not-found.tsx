import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function NotFound() {
  return (
    <div className="flex h-screen w-full flex-col items-center justify-center gap-4 bg-background px-6 text-center text-foreground">
      <div className="flex flex-col gap-1">
        <h1 className="text-lg font-semibold">Page not found</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          That page doesn&apos;t exist. It may have moved, or the link is wrong.
        </p>
      </div>
      <Button asChild>
        <Link href="/chart">Open a chart</Link>
      </Button>
    </div>
  );
}
