'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function VisitorTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (pathname?.startsWith('/admin') || pathname?.startsWith('/api')) return;

    // Retrieve or generate persistent anonymous visitor ID
    let visitorId = localStorage.getItem('rr_visitor_id');
    if (!visitorId) {
      visitorId = 'v_' + Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
      localStorage.setItem('rr_visitor_id', visitorId);
    }

    // Send non-blocking visit beacon
    try {
      fetch('/api/track-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: pathname || '/',
          visitorId,
        }),
      }).catch(() => {
        // Silently ignore network errors
      });
    } catch (err) {
      // Ignore
    }
  }, [pathname]);

  return null;
}
