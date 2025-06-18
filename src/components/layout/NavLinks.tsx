
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ComponentProps } from 'react';
import { SidebarMenuItem, SidebarMenuButton } from '@/components/ui/sidebar';
import { LayoutDashboard, Calculator, Settings, Languages, HelpCircle } from 'lucide-react'; // Added HelpCircle
import { useLocalization } from '@/contexts/LocalizationContext';

type SidebarMenuButtonProps = ComponentProps<typeof SidebarMenuButton>;

interface NavLinkItemProps {
  href: string;
  icon: React.ReactNode;
  labelKey: keyof import('@/contexts/LocalizationContext').Translations;
  tooltipKey: keyof import('@/contexts/LocalizationContext').Translations;
  isActive?: boolean;
  exact?: boolean;
}

function NavLinkItem({ href, icon, labelKey, tooltipKey, isActive, exact = false }: NavLinkItemProps) {
  const pathname = usePathname();
  const { translate } = useLocalization();
  const calculatedIsActive = isActive !== undefined ? isActive : (exact ? pathname === href : pathname.startsWith(href));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={calculatedIsActive}
        tooltip={{ children: translate(tooltipKey), side: "right", align: "center" }}
      >
        <Link href={href}>
          {icon}
          <span>{translate(labelKey)}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

export function NavLinks() {
  const pathname = usePathname();
  const { language, setLanguage, translate } = useLocalization();

  return (
    <>
      <NavLinkItem
        href="/dashboard"
        icon={<LayoutDashboard />}
        labelKey="nav_Dashboard"
        tooltipKey="nav_Dashboard"
        isActive={pathname === '/dashboard'}
        exact={true}
      />
      <NavLinkItem
        href="/"
        icon={<Calculator />}
        labelKey="nav_Calculator"
        tooltipKey="nav_Calculator"
        isActive={pathname === '/'}
        exact={true}
      />
      <NavLinkItem
        href="/faq"
        icon={<HelpCircle />}
        labelKey="nav_FAQ_Title"
        tooltipKey="nav_FAQ_Tooltip"
        isActive={pathname === '/faq'}
        exact={true}
      />
      <SidebarMenuItem>
        <SidebarMenuButton tooltip={{ children: translate("settings"), side: "right", align: "center" }}>
          <Settings />
          <span>{translate("settings")}</span>
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem className="pl-7"> 
        <SidebarMenuButton
          onClick={() => setLanguage('en')}
          isActive={language === 'en'}
          variant="ghost"
          className="w-full justify-start text-sm"
        >
          <Languages className="mr-2 h-3.5 w-3.5" />
          {translate("english")}
        </SidebarMenuButton>
      </SidebarMenuItem>
      <SidebarMenuItem className="pl-7">
        <SidebarMenuButton
          onClick={() => setLanguage('ru')}
          isActive={language === 'ru'}
          variant="ghost"
          className="w-full justify-start text-sm"
        >
          <Languages className="mr-2 h-3.5 w-3.5" />
          {translate("russian")}
        </SidebarMenuButton>
      </SidebarMenuItem>
    </>
  );
}
