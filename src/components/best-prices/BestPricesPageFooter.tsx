
"use client";

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import type { Translations } from '@/contexts/LocalizationContext';

interface BestPricesPageFooterProps {
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string;
}

export default function BestPricesPageFooter({ translate }: BestPricesPageFooterProps) {
  return (
    <div className="text-center mt-6">
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link href="/">
          <ArrowLeft className="mr-2 h-4 w-4" /> {translate('bestPrices_BackToCalculator_Button')}
        </Link>
      </Button>
    </div>
  );
}
