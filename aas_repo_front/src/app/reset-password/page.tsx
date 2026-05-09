"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { showToast } from "@/utils/toast";
import { ROUTES } from "@/constants/routes";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Check, X } from "lucide-react";
import Link from "next/link";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const checks = [
    { valid: /.{8,}/.test(password),    label: "At least 8 characters" },
    { valid: /[A-Za-z]/.test(password), label: "Contains a letter" },
    { valid: /[0-9]/.test(password),    label: "Contains a number" },
    { valid: /[!@#$%^&*]/.test(password), label: "Contains a symbol" },
  ];

  const passCount = checks.filter((c) => c.valid).length;
  const matchError = confirmPassword.length > 0 && password !== confirmPassword;

  const handleSubmit = async () => {
    if (!token) { showToast.error("Invalid or missing reset token."); return; }
    if (checks.some((c) => !c.valid)) { showToast.error("Password does not meet requirements."); return; }
    if (matchError || !confirmPassword) { showToast.error("Passwords do not match."); return; }

    try {
      setLoading(true);
      // TODO: call resetPassword API when backend is available
      showToast.success("Password reset successfully.");
      setTimeout(() => router.push(ROUTES.LOGIN), 1500);
    } catch {
      showToast.error("Failed to reset password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Reset your password</CardTitle>
          <CardDescription>
            Set a new secure password for your account.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="new-password">
              New Password
            </label>
            <Input
              id="new-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {/* strength bar */}
            <div className="flex gap-1 mt-1">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    i < passCount
                      ? passCount <= 1 ? "bg-destructive"
                        : passCount <= 2 ? "bg-amber-400"
                        : "bg-emerald-500"
                      : "bg-muted"
                  }`}
                />
              ))}
            </div>
            <ul className="flex flex-col gap-0.5 mt-1">
              {checks.map((c, i) => (
                <li key={i} className="flex items-center gap-1.5 text-xs">
                  {c.valid
                    ? <Check className="size-3 text-emerald-500" />
                    : <X className="size-3 text-muted-foreground" />}
                  <span className={c.valid ? "text-foreground" : "text-muted-foreground"}>
                    {c.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="confirm-password">
              Confirm Password
            </label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
              aria-invalid={matchError}
            />
            {matchError && (
              <p className="text-xs text-destructive">Passwords do not match.</p>
            )}
          </div>

          <Button
            onClick={handleSubmit}
            disabled={loading || checks.some((c) => !c.valid) || matchError || !confirmPassword}
            className="w-full"
          >
            {loading ? "Resetting..." : "Reset Password"}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            Back to{" "}
            <Link href={ROUTES.LOGIN} className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  );
}
