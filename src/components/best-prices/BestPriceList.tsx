
"use client";

import React from 'react';
import type { BestPriceRoute } from '@/contexts/PricingDataContext';
import type { Translations } from '@/contexts/LocalizationContext';
import BestPriceCard from './BestPriceCard';

interface BestPriceListProps {
  bestPriceResults: BestPriceRoute[];
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string;
  handleCopyRate: (route: BestPriceRoute, index: number) => Promise<void>;
  handleCreateInstructions: (route: BestPriceRoute) => void;
}

export default function BestPriceList({
  bestPriceResults,
  translate,
  handleCopyRate,
  handleCreateInstructions,
}: BestPriceListProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {bestPriceResults.map((route, index) => (
        <BestPriceCard
          key={route.id}
          route={route}
          index={index}
          translate={translate}
          onCopyRate={handleCopyRate}
          onCreateInstructions={handleCreateInstructions}
        />
      ))}
    </div>
  );
}
