
import type { Metadata } from 'next';
import { Inter } from '@next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import Link from 'next/link';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarTrigger,
  SidebarContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
} from '@/components/ui/sidebar';
import { Home, Settings, Calculator, Repeat, Menu, LayoutDashboard } from 'lucide-react'; // Added LayoutDashboard
import { PricingDataProvider } from '@/contexts/PricingDataContext';

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
        <PricingDataProvider> {/* Provider wraps the entire content including SidebarProvider */}
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
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild tooltip={{children: "Dashboard", side:"right", align:"center"}}>
                      <Link href="/dashboard">
                        <LayoutDashboard /> {/* Changed icon to LayoutDashboard for better fit */}
                        <span>Dashboard</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild isActive={true} tooltip={{children: "Calculator", side:"right", align:"center"}}>
                      <Link href="/">
                        <Calculator />
                        <span>Calculator</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton tooltip={{children: "Settings", side:"right", align:"center"}}>
                      <Settings />
                      <span>Settings</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
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

            <SidebarInset> {/* This is where {children} will render */}
              <div className="flex flex-col h-full">
                <header className="flex h-14 items-center gap-4 border-b bg-background px-4 sticky top-0 z-30 lg:px-6">
                  <div className="md:hidden">
                    <SidebarTrigger>
                      <Menu className="h-5 w-5" />
                    </SidebarTrigger>
                  </div>
                  <div className="flex-1">
                    {/* The page title will likely be set by individual pages or a more dynamic header component */}
                    {/* For now, removing the static "Logistics Calculator" to avoid confusion */}
                  </div>
                </header>
                <main className="flex-1 overflow-auto">
                  {children}
                </main>
              </div>
            </SidebarInset>
          </SidebarProvider>
        </PricingDataProvider>
        <Toaster />
      </body>
    </html>
  );
}
