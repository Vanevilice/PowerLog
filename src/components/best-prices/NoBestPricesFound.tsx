
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Info, ArrowLeft } from 'lucide-react';
import type { Translations } from '@/contexts/LocalizationContext'; // Assuming Translations type is needed

interface NoBestPricesFoundProps {
  translate: (key: keyof Translations, replacements?: Record<string, string | number>) => string;
}

export default function NoBestPricesFound({ translate }: NoBestPricesFoundProps) {
  return (
    <div className="container mx-auto p-4 md:p-8 text-center">
      <Card className="w-full max-w-lg mx-auto shadow-lg rounded-xl bg-card border border-border">
        <CardHeader>
          <div className="flex justify-center items-center mb-3">
            <Info className="h-12 w-12 text-primary" />
          </div>
          <CardTitle className="text-2xl font-semibold text-primary">{translate('bestPrices_NoResults_Title')}</CardTitle>
          <CardDescription className="text-muted-foreground">
            {translate('bestPrices_NoResults_Description')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" className="w-full">
            <Link href="/">
              <ArrowLeft className="mr-2 h-4 w-4" /> {translate('bestPrices_BackToCalculator_Button')}
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
