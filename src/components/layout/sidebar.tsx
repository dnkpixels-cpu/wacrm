"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureEntitlements } from "@/hooks/use-feature-entitlements";
import { useTotalUnread } from "@/hooks/use-total-unread";
import { useUnreadNotifications } from "@/hooks/use-unread-notifications";
import {
  Bell,
  Bot,
  CalendarDays,
  Crown,
  GitBranch,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Radio,
  Settings,
  Shield,
  User,
  UserCog,
  Users,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import type { AccountRole } from "@/lib/auth/roles";

const ROLE_CHIP: Record<
  AccountRole,
  { icon: typeof Crown; labelKey: string; className: string }
> = {
  owner: { icon: Crown, labelKey: "roleOwner", className: "border-amber-500/40 bg-amber-500/10 text-amber-300" },
  admin: { icon: Shield, labelKey: "roleAdmin", className: "border-primary/40 bg-primary/10 text-primary" },
  agent: { icon: UserCog, labelKey: "roleAgent", className: "border-border bg-muted text-foreground" },
  viewer: { icon: User, labelKey: "roleViewer", className: "border-border bg-card text-muted-foreground" },
};
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

interface NavItem { href: string; labelKey: string; icon: typeof LayoutDashboard; beta?: boolean; feature?: string; }

const navItems: NavItem[] = [
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard },
  { href: "/inbox", labelKey: "inbox", icon: MessageSquare },
  { href: "/notifications", labelKey: "notifications", icon: Bell },
  { href: "/contacts", labelKey: "contacts", icon: Users },
  { href: "/sessions", labelKey: "sessions", icon: CalendarDays, feature: "sessions" },
  { href: "/pipelines", labelKey: "pipelines", icon: GitBranch },
  { href: "/broadcasts", labelKey: "broadcasts", icon: Radio },
  { href: "/automations", labelKey: "automations", icon: Zap },
  { href: "/flows", labelKey: "flows", icon: Workflow, beta: true },
  { href: "/agents", labelKey: "aiAgents", icon: Bot },
];

const bottomNavItems = [{ href: "/settings", labelKey: "settings", icon: Settings }];

interface SidebarProps { open?: boolean; onClose?: () => void; }

import { useTranslations } from "next-intl";

export function Sidebar({ open = false, onClose }: SidebarProps) {
  const t = useTranslations("Sidebar");
  const pathname = usePathname();
  const { profile, profileLoading, account, accountRole, signOut } = useAuth();
  const { hasFeature, loading: featuresLoading } = useFeatureEntitlements();
  const totalUnread = useTotalUnread();
  const unreadNotifications = useUnreadNotifications();
  const showAccountStrip = !profileLoading && !!account?.name && account.name !== profile?.full_name;

  useEffect(() => { onClose?.(); }, [pathname]);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose?.(); };
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [open, onClose]);

  const visibleNavItems = navItems.filter((item) => !item.feature || (!featuresLoading && hasFeature(item.feature)));

  return (
    <>
      <button type="button" aria-label={t("closeMenu")} onClick={onClose} className={cn("fixed inset-0 z-30 bg-background/70 backdrop-blur-sm transition-opacity lg:hidden", open ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")} />
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex h-full w-64 flex-col border-r border-border bg-card", "transition-transform duration-200 ease-out will-change-transform", open ? "translate-x-0" : "-translate-x-full", "lg:static lg:z-0 lg:w-60 lg:translate-x-0 lg:transition-none")} aria-label="Primary">
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
          <Link href="/dashboard" className="flex items-center gap-2"><div className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-primary"><img src="/sutraapi-icon.png" alt="SutraAPI" className="h-8 w-8 object-contain" /></div><span className="text-sm font-semibold text-foreground">{t("title")}</span></Link>
          <button type="button" onClick={onClose} aria-label={t("closeMenu")} className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground lg:hidden"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4">
          <ul className="flex flex-col gap-1">
            {visibleNavItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/dashboard" && pathname.startsWith(item.href));
              const showUnreadDot = item.href === "/inbox" && totalUnread > 0 && !isActive;
              const showNotificationBadge = item.href === "/notifications" && unreadNotifications > 0;
              return <li key={item.href}><Link href={item.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><item.icon className="h-4 w-4" /><span className="flex-1">{item.href === "/sessions" ? "Sessions" : t(item.labelKey as string)}</span>{item.beta && <span aria-label={t("beta")} className="rounded-full border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-amber-300">{t("beta")}</span>}{showUnreadDot && <span aria-label={t("unreadConversations", { count: totalUnread })} className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" /><span className="relative inline-flex h-2 w-2 rounded-full bg-primary" /></span>}{showNotificationBadge && <span aria-label={t("unreadNotifications", { count: unreadNotifications })} className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">{unreadNotifications > 9 ? "9+" : unreadNotifications}</span>}</Link></li>;
            })}
          </ul>
          <div className="my-4 border-t border-border" />
          <ul className="flex flex-col gap-1">{bottomNavItems.map((item) => { const isActive = pathname.startsWith(item.href); return <li key={item.href}><Link href={item.href} className={cn("flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors lg:py-2", isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground")}><item.icon className="h-4 w-4" />{t(item.labelKey as string)}</Link></li>; })}</ul>
        </nav>
        <div className="shrink-0 border-t border-border p-3">
          {showAccountStrip && account?.name ? <div className="mb-2 flex items-center gap-2 px-3 text-xs text-muted-foreground">{account.name}</div> : null}
          <DropdownMenu><DropdownMenuTrigger asChild><button className="flex w-full items-center gap-2 rounded-lg p-2 text-left hover:bg-muted"><Avatar className="h-8 w-8"><AvatarImage src={profile?.avatar_url ?? undefined} /><AvatarFallback>{(profile?.full_name || profile?.email || "U").slice(0, 1).toUpperCase()}</AvatarFallback></Avatar><span className="min-w-0 flex-1 truncate text-sm text-foreground">{profile?.full_name || profile?.email || "User"}</span></button></DropdownMenuTrigger><DropdownMenuContent align="end" className="w-56"><DropdownMenuItem asChild><Link href="/settings?tab=profile">Profile</Link></DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onClick={() => void signOut()}><LogOut className="mr-2 h-4 w-4" />Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
        </div>
      </aside>
    </>
  );
}
