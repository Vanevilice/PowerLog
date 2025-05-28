
"use client";

import PortPriceFinderForm from "@/components/pricing-form/PortPriceFinderForm";
// PricingDataProvider is removed from here, as it's now in layout.tsx

export default function Home() {
  return (
      <main className="flex min-h-screen flex-col items-center justify-start p-4 md:p-8 bg-gradient-to-br from-slate-50 to-sky-100 dark:from-slate-900 dark:to-sky-900">
        <PortPriceFinderForm />
      </main>
  );
}
