
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { LayoutDashboard, Calculator, Settings } from 'lucide-react';

type SidebarMenuButtonProps = ComponentProps<typeof SidebarMenuButton>;

interface NavLinkItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  tooltipText: string;
  isActive?: boolean; // Allow manual override if needed, but default to path check
  exact?: boolean; // Whether the path should be an exact match
}

function NavLinkItem({ href, icon, label, tooltipText, isActive, exact = false }: NavLinkItemProps) {
  const pathname = usePathname();
  const calculatedIsActive = isActive !== undefined ? isActive : (exact ? pathname === href : pathname.startsWith(href));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={calculatedIsActive}
        tooltip={{ children: tooltipText, side: "right", align: "center" }}
      >
        <Link href={href}>
          {icon}
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavLinks() {
  const pathname = usePathname();

  return (
    <>
      <NavLinkItem
        href="/dashboard"
        icon={<LayoutDashboard />}
        label="Dashboard"
        tooltipText="Dashboard"
        isActive={pathname === '/dashboard'}
        exact={true}
      />
      <NavLinkItem
        href="/"
        icon={<Calculator />}
        label="Calculator"
        tooltipText="Calculator"
        isActive={pathname === '/'}
        exact={true}
      />
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={{ children: "Settings", side: "right", align: "center" }}>
          <Settings />
          <span>Settings</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}
