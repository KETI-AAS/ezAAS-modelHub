"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/constants/routes";
import { Button, buttonVariants } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Server,
  ArrowLeftRight,
  Minimize2,
  Globe,
  User,
  Menu,
  LogOut,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

function Header() {
  const [widthMode, setWidthMode] = useState<"Normal" | "Wide">("Normal");
  const [mounted, setMounted] = useState(false);

  const { t, changeLanguage } = useAuth().language;
  const { isAuthenticated, authToken, logout, user: profile } = useAuth();

  useEffect(() => {
    setMounted(true);
    const saved = (localStorage.getItem("data-layout-width") || "Normal") as "Normal" | "Wide";
    setWidthMode(saved);
    if (saved === "Wide") document.body.classList.add("layout-wide");
  }, []);

  const toggleWidthMode = () => {
    const next = widthMode === "Normal" ? "Wide" : "Normal";
    setWidthMode(next);
    localStorage.setItem("data-layout-width", next);
    document.body.classList.toggle("layout-wide", next === "Wide");
  };

  const handlePortalClick = () => {
    if (authToken) {
      window.open(
        `${process.env.NEXT_PUBLIC_PORTAL_URL}?token=${authToken.payload.jwt_access_token}`,
        "_blank"
      );
    }
  };

  if (!mounted) return null;

  const isAdmin   = profile?.user_group_seq === 1;
  const isManager = profile?.user_group_seq === 1 || profile?.user_group_seq === 2;

  const navLinks = [
    { href: ROUTES.AASMODEL.LIST,  label: t("AAS Template") },
    { href: ROUTES.SUBMODEL.LIST,  label: t("Submodel Template") },
    ...(profile ? [{ href: ROUTES.INSTANCE.LIST,  label: t("My AAS Instance") }] : []),
    { href: ROUTES.ABOUT,          label: t("About") },
    ...(isManager ? [{ href: ROUTES.DISTRIBUTE.LIST, label: t("Publish") }]    : []),
    ...(isAdmin   ? [{ href: ROUTES.USER.LIST,       label: t("Authority") }]  : []),
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <div className="mx-auto max-w-screen-2xl px-4 lg:px-8">
        <div className="flex h-14 items-center justify-between gap-4">

          {/* Left: hamburger + logo */}
          <div className="flex items-center gap-3">
            <Sheet>
              <SheetTrigger render={
                <Button variant="ghost" size="icon" className="lg:hidden">
                  <Menu className="size-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              } />
              <SheetContent side="left" className="w-72 p-0">
                <SheetHeader className="border-b border-border px-6 py-4">
                  <SheetTitle>
                    <Link href={ROUTES.HOME}>
                      <img src="/assets/media/logos/keti_logo.png" alt="KETI ezAAS" className="h-8" />
                    </Link>
                  </SheetTitle>
                </SheetHeader>
                <nav className="flex flex-col gap-1 px-4 py-4">
                  {navLinks.map((link) => (
                    <Link
                      key={link.href}
                      href={link.href}
                      className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                    >
                      <ChevronRight className="size-3.5 text-muted-foreground" />
                      {link.label}
                    </Link>
                  ))}
                  {!isAuthenticated && (
                    <Link
                      href={ROUTES.LOGIN}
                      className={cn(buttonVariants(), "mt-4 justify-center")}
                    >
                      {t("Login")}
                    </Link>
                  )}
                </nav>
              </SheetContent>
            </Sheet>

            <Link href={ROUTES.HOME} className="flex items-center">
              <img src="/assets/media/logos/keti_logo.png" alt="KETI ezAAS" className="h-8 lg:h-9" />
            </Link>
          </div>

          {/* Right: actions + user */}
          <div className="flex items-center gap-1">
            {isAuthenticated && (
              <Button variant="ghost" size="icon" onClick={handlePortalClick} title="Portal">
                <Server className="size-4" />
              </Button>
            )}

            <Button variant="ghost" size="icon" onClick={toggleWidthMode} title="Toggle layout width">
              {widthMode === "Normal"
                ? <ArrowLeftRight className="size-4" />
                : <Minimize2 className="size-4" />}
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger render={
                <Button variant="ghost" size="icon" title="Language">
                  <Globe className="size-4" />
                </Button>
              } />
              <DropdownMenuContent align="end" className="min-w-[120px]">
                <DropdownMenuItem onClick={() => changeLanguage("en")}>English</DropdownMenuItem>
                <DropdownMenuItem onClick={() => changeLanguage("ko")}>한국어</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {!isAuthenticated ? (
              <Link href={ROUTES.LOGIN} className={cn(buttonVariants({ size: "sm" }), "ml-1")}>
                {t("Login")}
              </Link>
            ) : (
              <DropdownMenu>
                <DropdownMenuTrigger render={
                  <Button variant="ghost" size="icon" className="ml-1 rounded-full">
                    <Avatar className="size-8">
                      <AvatarImage src={profile?.user_photo_url || "/assets/media/avatars/blank.png"} alt={profile?.user_name || "User"} />
                      <AvatarFallback>{profile?.user_name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
                    </Avatar>
                  </Button>
                } />
                <DropdownMenuContent align="end" className="w-64">
                  <div className="flex items-center gap-3 px-2 py-2.5">
                    <Avatar className="size-10">
                      <AvatarImage src={profile?.user_photo_url || "/assets/media/avatars/blank.png"} alt={profile?.user_name || "User"} />
                      <AvatarFallback>{profile?.user_name?.[0]?.toUpperCase() ?? "U"}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col gap-0.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{profile?.user_name}</span>
                        <Badge variant="secondary" className="text-xs">{profile?.user_group_name}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">{profile?.user_id}</span>
                    </div>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>
                    <Link href={profile?.user_seq ? ROUTES.USER.VIEW(String(profile.user_seq)) : ROUTES.USER.LIST} className="w-full">
                      {t("My Profile")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Link href={ROUTES.INSTANCE.LIST} className="w-full">{t("My AAS Instance")}</Link>
                  </DropdownMenuItem>
                  {isManager && (
                    <DropdownMenuItem>
                      <Link href={ROUTES.DISTRIBUTE.LIST} className="w-full">{t("Admin: Publish")}</Link>
                    </DropdownMenuItem>
                  )}
                  {isAdmin && (
                    <DropdownMenuItem>
                      <Link href={ROUTES.USER.LIST} className="w-full">{t("Admin: Authority")}</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => logout()}>
                    <LogOut className="size-4" />
                    {t("Log Out")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>
      </div>

      {/* ── Bottom nav (desktop) ─────────────────────────────────── */}
      <div className="hidden border-t border-border/50 lg:block">
        <div className="mx-auto max-w-screen-2xl px-4 lg:px-8">
          <nav className="flex h-11 items-center gap-1">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            {profile && (
              <div className="ml-auto">
                <Link href={ROUTES.INSTANCE.LIST} className={cn(buttonVariants({ size: "sm" }))}>
                  <User className="size-3.5" />
                  {t("My AAS Instance")}
                </Link>
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  );
}

export default Header;
