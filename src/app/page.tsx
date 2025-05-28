
"use client";

import PortPriceFinderForm from "@/components/pricing-form/PortPriceFinderForm";
import { PricingDataProvider } from "@/contexts/PricingDataContext";

export default function Home() {
  return (
    <PricingDataProvider>
      <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-8 bg-gradient-to-br from-slate-50 to-sky-100 dark:from-slate-900 dark:to-sky-900">
        <PortPriceFinderForm />
      </main>
    </PricingDataProvider>
  );
}
