"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { ROUTES } from "@/constants/routes";
import { showToast } from "@/utils/toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Check, X } from "lucide-react";

export default function SignUpPage() {
  const { signUpWithCredential } = useAuth();

  const [email, setEmail]               = useState("");
  const [emailError, setEmailError]     = useState("");
  const [password, setPassword]         = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading]           = useState(false);

  const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const checks = [
    { valid: /.{8,}/.test(password),      label: "At least 8 characters" },
    { valid: /[A-Za-z]/.test(password),   label: "Contains a letter" },
    { valid: /[0-9]/.test(password),      label: "Contains a number" },
    { valid: /[!@#$%^&*]/.test(password), label: "Contains a symbol" },
  ];

  const passCount  = checks.filter((c) => c.valid).length;
  const matchError = confirmPassword.length > 0 && password !== confirmPassword;

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setEmail(v);
    setEmailError(isValidEmail(v) ? "" : "Please enter a valid email address.");
  };

  const handleSignUp = async () => {
    if (!email || !password || !confirmPassword) {
      showToast.error("Please fill in all fields."); return;
    }
    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address."); return;
    }
    if (checks.some((c) => !c.valid)) {
      showToast.error("Password does not meet requirements."); return;
    }
    if (password !== confirmPassword) {
      showToast.error("Passwords do not match."); return;
    }
    try {
      setLoading(true);
      await signUpWithCredential(email, password);
    } catch {
      showToast.error("Sign up failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-muted/30 flex items-center justify-center px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Create an account</CardTitle>
          <CardDescription>Sign up for KETI ezAAS Model Hub</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {/* Email */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="email">Email</label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={handleEmailChange}
              aria-invalid={!!emailError}
            />
            {emailError && <p className="text-xs text-destructive">{emailError}</p>}
          </div>

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="password">Password</label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
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
            <ul className="flex flex-col gap-0.5 mt-0.5">
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

          {/* Confirm */}
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium" htmlFor="confirm">Confirm Password</label>
            <Input
              id="confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSignUp()}
              aria-invalid={matchError}
            />
            {matchError && <p className="text-xs text-destructive">Passwords do not match.</p>}
          </div>

          <Button onClick={handleSignUp} disabled={loading} className="w-full mt-1">
            {loading ? "Creating account..." : "Sign up"}
          </Button>

          <Separator />

          <p className="text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href={ROUTES.LOGIN} className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
