import { Ghost } from 'lucide-react';
import type { Metadata } from 'next';
import { Button, EmptyState } from '@/components/ui';

export const metadata: Metadata = { title: 'Not found' };

export default function NotFound() {
  return (
    <div className="shell flex min-h-dvh items-center justify-center py-32">
      <EmptyState
        icon={<Ghost />}
        title="404 — no such bot in the box"
        description="That route does not exist. The arena is still standing, though."
        action={
          <>
            <Button href="/" variant="primary">
              Back to the arena
            </Button>
            <Button href="/roster" variant="secondary">
              Browse the roster
            </Button>
          </>
        }
        className="w-full max-w-lg"
      />
    </div>
  );
}
