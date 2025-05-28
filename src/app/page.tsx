
"use client";

import { useState, useEffect } from 'react';
import PowerLogForm from '@/components/calculator/powerlog-form';
import ResultsDisplay from '@/components/calculator/results-display';
import type { CalculationResults } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Repeat, Ship, Train } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function PowerLogPage() {
  const [results, setResults] = useState<CalculationResults | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentDateTime, setCurrentDateTime] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"sea_rail" | "direct_rail">("sea_rail");

  useEffect(() => {
    const date = new Date();
    setCurrentDateTime(
      date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
    );
  }, []);

  const handleTabChange = (value: string) => {
    setActiveTab(value as "sea_rail" | "direct_rail");
    // Reset results when tab changes, or handle differently if needed
    setResults(null);
    setError(null);
  };

  return (
    <div className="container mx-auto px-4 py-8 min-h-screen flex flex-col items-center bg-background">
      <header className="mb-8 text-center">
        <div className="flex items-center justify-center mb-2">
          <Repeat className="h-10 w-10 text-primary mr-3" />
          <h1 className="text-5xl font-extrabold tracking-tight text-primary">
            PowerLog
          </h1>
        </div>
        <p className="max-w-2xl mx-auto text-lg text-muted-foreground sm:text-xl">
          Calculate shipping costs and get AI-powered insights for PowerLog.
        </p>
      </header>

      <main className="w-full max-w-3xl space-y-8">
        <Tabs defaultValue="sea_rail" className="w-full" onValueChange={handleTabChange} value={activeTab}>
          <TabsList className="grid w-full grid-cols-2 mb-6">
            <TabsTrigger value="sea_rail" className="py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Ship className="mr-2 h-5 w-5" /> Море + Ж/Д
            </TabsTrigger>
            <TabsTrigger value="direct_rail" className="py-3 text-base data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Train className="mr-2 h-5 w-5" /> Прямое ЖД
            </TabsTrigger>
          </TabsList>
          
          <Card className="shadow-xl border-border overflow-hidden rounded-xl bg-card">
            <CardContent className="p-6">
              <TabsContent value="sea_rail" className="mt-0">
                <PowerLogForm
                  mode="sea_rail"
                  currentDateTime={currentDateTime}
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
              </TabsContent>
              <TabsContent value="direct_rail" className="mt-0">
                <PowerLogForm
                  mode="direct_rail"
                  currentDateTime={currentDateTime}
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
              </TabsContent>
            </CardContent>
          </Card>
        </Tabs>
        
        {(isLoading || error || results) && <Separator className="my-8" />}

        { (isLoading || error || results) && (
          <Card className="shadow-xl border-border overflow-hidden rounded-xl bg-card">
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
              {!isLoading && !error && !results && activeTab && ( // Show prompt only if a tab is active
                <div className="text-center py-10">
                  <p className="text-lg text-muted-foreground">
                    Enter your shipment details above and click "Calculate" to see the cost comparison.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>

      <footer className="mt-16 mb-8 text-center text-sm text-muted-foreground">
        <p>&copy; {new Date().getFullYear()} PowerLog. All rights reserved.</p>
        <p>Powered by Next.js & ShadCN UI</p>
      </footer>
    </div>
  );
}
