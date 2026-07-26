'use client';

import { useEffect } from 'react';
import { logger } from '@/lib/logger';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logger.error('Fatal UI error:', error);
  }, [error]);

  return (
    <html lang="en" className="dark">
      <body className="antialiased">
        <div
          style={{
            display: 'flex',
            minHeight: '100vh',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1rem',
            padding: '1.5rem',
            textAlign: 'center',
            background: '#0a0a0a',
            color: '#fafafa',
            fontFamily: 'system-ui, sans-serif',
          }}
        >
          <h1 style={{ fontSize: '1.125rem', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: '0.875rem', opacity: 0.7, maxWidth: '28rem' }}>
            CoChart hit an unexpected error. Please reload the page.
          </p>
          <button
            onClick={reset}
            style={{
              borderRadius: '0.375rem',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              background: '#fafafa',
              color: '#0a0a0a',
              cursor: 'pointer',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
