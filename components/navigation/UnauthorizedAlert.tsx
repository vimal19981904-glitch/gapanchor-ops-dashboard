'use client';

import React, { useEffect, Suspense } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { toast } from 'sonner';

function UnauthorizedAlertContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unauthorizedModule = searchParams?.get('unauthorized');
    if (unauthorizedModule) {
      toast.error('🔒 Access Restricted by Administrator', {
        description: `Your account does not currently have permission to access '${unauthorizedModule}'. Please contact admin@gapanchor.com to request access.`,
        duration: 5000,
      });

      // Clean the query parameter from the URL cleanly
      const newParams = new URLSearchParams(searchParams.toString());
      newParams.delete('unauthorized');
      const newQuery = newParams.toString();
      const newUrl = newQuery ? `${pathname}?${newQuery}` : pathname;
      router.replace(newUrl, { scroll: false });
    }
  }, [searchParams, pathname, router]);

  return null;
}

export function UnauthorizedAlert() {
  return (
    <Suspense fallback={null}>
      <UnauthorizedAlertContent />
    </Suspense>
  );
}
