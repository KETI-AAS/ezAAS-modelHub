/**
 * 파일명: src/app/login/LoginContent.tsx
 * 설명: shadcn/ui 기반으로 재작성된 로그인 페이지 컴포넌트.
 *       Mantine modals → shadcn Dialog로 교체.
 */
"use client";

import { useState } from "react";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";
import { showToast } from "@/utils/toast";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import SendResetLinkForm from "@/components/feature/login/SendResetLinkForm";

interface LoginContentProps {
  redirectUrl: string;
}

export default function LoginContent({ redirectUrl }: LoginContentProps) {
  const { login, loginWithSocial } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [resetOpen, setResetOpen] = useState(false);

  const onClickLogin = () => {
    if (!email) return showToast.error("Please enter email");
    if (!password) return showToast.error("Please enter password");
    login(email, password, redirectUrl);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left: form panel */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 lg:flex-none lg:w-[480px]">
        <div className="w-full max-w-sm">
          {/* Logo (mobile) */}
          <div className="mb-8 flex justify-center lg:hidden">
            <Link href={ROUTES.HOME}>
              <img
                src="/assets/media/logos/keti_logo.png"
                alt="KETI ezAAS Model Hub"
                className="h-10"
              />
            </Link>
          </div>

          {/* Heading */}
          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Log in
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              KETI ezAAS Model Hub
            </p>
          </div>

          {/* Social login */}
          <div className="flex flex-col gap-3 mb-6">
            <Button
              variant="outline"
              className="w-full"
              onClick={() => loginWithSocial("google")}
            >
              <img
                src="assets/media/svg/brand-logos/google-icon.svg"
                alt="Google"
                className="size-4"
                data-icon="inline-start"
              />
              Sign in with Google
            </Button>
          </div>

          {/* Separator */}
          <div className="relative mb-6">
            <Separator />
            <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-3 text-xs text-muted-foreground">
              Or with email
            </span>
          </div>

          {/* Form fields */}
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="email"
                type="text"
                placeholder="you@example.com"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onClickLogin()}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="text-sm font-medium">
                  Password
                </label>
                <button
                  onClick={() => setResetOpen(true)}
                  className="text-xs text-muted-foreground underline-offset-4 hover:underline hover:text-foreground transition-colors"
                >
                  Forgot password?
                </button>
                <Dialog open={resetOpen} onOpenChange={setResetOpen}>
                  <DialogContent className="sm:max-w-sm">
                    <DialogHeader>
                      <DialogTitle>Reset your password</DialogTitle>
                    </DialogHeader>
                    <SendResetLinkForm onClose={() => setResetOpen(false)} />
                  </DialogContent>
                </Dialog>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && onClickLogin()}
              />
            </div>

            <Button className="w-full mt-2" onClick={onClickLogin}>
              Log In
            </Button>
          </div>

          {/* Sign up link */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Not a member yet?{" "}
            <Link
              href={ROUTES.SIGNUP}
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Right: brand panel (desktop only) */}
      <div
        className="hidden lg:flex flex-1 flex-col items-center justify-center bg-primary px-12 py-16"
        style={{
          backgroundImage: "url(/assets/media/aas/auth-bg.png)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex flex-col items-center gap-6 text-center">
          <Link href={ROUTES.HOME}>
            <img
              src="assets/media/logos/keti_logo_w.png"
              alt="KETI"
              className="h-16"
            />
          </Link>
          <h2 className="text-3xl font-bold text-white">
            KETI ezAAS Model Hub
          </h2>
          <p className="max-w-xs text-sm text-white/80 leading-relaxed">
            ezAAS Model Hub for Industrial Digital Twin — central repository for
            AAS and Submodel Templates
          </p>
        </div>
      </div>
    </div>
  );
}
