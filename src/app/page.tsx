"use client";

import { useState } from 'react';
import CalculatorForm from '@/components/calculator/calculator-form';
import ResultsDisplay from '@/components/calculator/results-display';
import type { CalculationResults } from '@/types';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

export default function LogisticsCalcPage() {
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col items-center">
      <header className="mb-10 text-center">
        <h1 className="text-4xl font-extrabold tracking-tight text-primary sm:text-5xl md:text-6xl">
          Logistics Calculator
        </h1>
        <p className="mt-3 max-w-md mx-auto text-base text-muted-foreground sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
          Compare Sea Freight and Direct Rail costs to optimize your supply chain.
        </p>
      </header>

      <main className="w-full max-w-6xl space-y-8">
        <Card className="shadow-xl border-border overflow-hidden rounded-xl">
          <CardHeader className="bg-card">
            <CardTitle className="text-2xl font-semibold text-primary">Input Details</CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <CalculatorForm
              onCalculateStart={() => {
                setIsLoading(true);
                setError(null);
                setResults(null);
              }}
              onCalculateSuccess={(data) => {
                setResults(data);
                setIsLoading(false);
              }}
              onCalculateError={(errorMessage) => {
                setError(errorMessage);
                setIsLoading(false);
              }}
            />
          </CardContent>
        </Card>
        
        {(isLoading || error || results) && <Separator />}

        <Card className="shadow-xl border-border overflow-hidden rounded-xl">
          <CardHeader className="bg-card">
            <CardTitle className="text-2xl font-semibold text-primary">Calculation Results</CardTitle>
          </CardHeader>
          <CardContent className="p-6 min-h-[200px] flex flex-col justify-center">
            {isLoading && (
              <div className="flex flex-col justify-center items-center text-center py-10">
                <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
                <p className="text-lg text-muted-foreground">Calculating your logistics options...</p>
                <p className="text-sm text-muted-foreground">This might take a moment.</p>
              </div>
            )}
            {error && !isLoading && (
               <div className="text-center py-10">
                <p className="text-destructive text-lg font-medium">Calculation Error</p>
                <p className="text-muted-foreground">{error}</p>
              </div>
            )}
            {results && !isLoading && <ResultsDisplay results={results} />}
            {!isLoading && !error && !results && (
              <div className="text-center py-10">
                <p className="text-lg text-muted-foreground">
                  Enter your shipment details above and click "Calculate" to see the cost comparison.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <footer className="mt-16 mb-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} Logistics Calc. All rights reserved.</p>
        <p>Powered by Next.js & ShadCN UI</p>
      </footer>
    </div>
  );
}
