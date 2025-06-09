
import type { Metadata } from 'next';
import { Inter } from '@next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Repeat, Menu } from 'lucide-react'; 
import { PricingDataProvider } from '@/contexts/PricingDataContext';
import { LocalizationProvider } from '@/contexts/LocalizationContext'; // Import LocalizationProvider
import { NavLinks } from '@/components/layout/NavLinks';
import PageTransitionLoader from '@/components/layout/PageTransitionLoader';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'Logistics Calc',
  description: 'Multimodal Logistics Calculator for Sea Freight and Direct Rail',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} antialiased`}>
        <LocalizationProvider> {/* Wrap with LocalizationProvider */}
          <PricingDataProvider>
            <SidebarProvider defaultOpen={true}>
              <Sidebar collapsible="icon" variant="sidebar" side="left">
                <SidebarHeader className="p-3 flex justify-between items-center">
                  <div className="flex items-center gap-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:w-full">
                    <Repeat className="h-7 w-7 text-primary flex-shrink-0" />
                    <span className="font-bold text-xl group-data-[collapsible=icon]:hidden whitespace-nowrap">PowerLog</span>
                  </div>
                </SidebarHeader>
                <SidebarContent className="p-2">
                  <SidebarMenu>
                    <NavLinks />
                  </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="p-2">
                  <div className="text-xs text-muted-foreground group-data-[collapsible=icon]:hidden text-center">
                    © {new Date().getFullYear()} PowerLog
                  </div>
                  <div className="hidden group-data-[collapsible=icon]:block text-center">
                    <Repeat className="h-4 w-4 mx-auto"/>
                  </div>
                </SidebarFooter>
              </Sidebar>

              <SidebarInset>
                <div className="flex flex-col h-full">
                  <header className="flex h-14 items-center gap-4 border-b bg-background px-4 sticky top-0 z-30 lg:px-6">
                    <div className="md:hidden">
                      <SidebarTrigger>
                        <Menu className="h-5 w-5" />
                      </SidebarTrigger>
                    </div>
                    <div className="flex-1">
                    </div>
                  </header>
                  <main className="flex-1 overflow-auto">
                    {children}
                  </main>
                </div>
              </SidebarInset>
            </SidebarProvider>
          </PricingDataProvider>
        </LocalizationProvider>
        <Toaster />
        <PageTransitionLoader />
      </body>
    </html>
  );
}
