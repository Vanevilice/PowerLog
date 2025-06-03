
"use client";

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function PageTransitionLoader() {
  const pathname = usePathname();
  const [isLoading, setIsLoading] = useState(false);
  const previousPathname = useRef(pathname);

  useEffect(() => {
    if (previousPathname.current !== pathname) {
      setIsLoading(true);
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 700); // Adjust duration as needed (e.g., 700ms)

      previousPathname.current = pathname; // Update previous pathname

      return () => {
        clearTimeout(timer);
      };
    }
  }, [pathname]);

  if (!isLoading) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-background/70 backdrop-blur-sm">
      <Loader2 className="h-16 w-16 animate-spin text-primary" />
    </div>
  );
}
