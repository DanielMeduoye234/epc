'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Preloader from './Preloader';

const SKIP_PREFIXES = ['/login', '/signup', '/auth'];

export default function PreloaderWrapper() {
  const pathname = usePathname();
  const [showPreloader, setShowPreloader] = useState(false);

  useEffect(() => {
    if (SKIP_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
      setShowPreloader(false);
      return;
    }
    try {
      if (sessionStorage.getItem('epc-preloader-seen')) {
        setShowPreloader(false);
        return;
      }
      sessionStorage.setItem('epc-preloader-seen', '1');
      setShowPreloader(true);
    } catch {
      setShowPreloader(false);
    }
  }, [pathname]);

  if (!showPreloader) return null;

  return (
    <Preloader
      onFinish={() => {
        setShowPreloader(false);
      }}
    />
  );
}
