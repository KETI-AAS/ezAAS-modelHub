"use client";

import React, { useState } from "react";
import { sendPasswordResetEmail } from "@/api/index";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { XCircle } from "lucide-react";

interface SendResetLinkFormProps {
  onClose?: () => void;
}

function SendResetLinkForm({ onClose }: SendResetLinkFormProps) {
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (email: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const onChangeEmail = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEmail(value);
    if (!isValidEmail(value)) {
      setEmailError("Please enter a valid email address.");
    } else {
      setEmailError("");
    }
  };

  const onClickSendResetPassword = async () => {
    try {
      setLoading(true);
      await sendPasswordResetEmail(email);
      onClose?.();
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-muted-foreground">
          Enter the email address you used to sign up, and we&apos;ll send you a
          secure link to reset your password.
        </p>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="reset-email" className="text-sm font-semibold">
          Email
        </label>
        <Input
          id="reset-email"
          type="email"
          autoComplete="off"
          value={email}
          onChange={onChangeEmail}
          onKeyDown={(e) => {
            if (e.key === "Enter") onClickSendResetPassword();
          }}
          placeholder="you@example.com"
          aria-invalid={!!emailError}
        />
        {emailError && (
          <p className="flex items-center gap-1 text-xs text-destructive">
            <XCircle className="size-3.5" />
            {emailError}
          </p>
        )}
      </div>
      <Button
        disabled={email === "" || emailError !== "" || loading}
        onClick={onClickSendResetPassword}
        className="w-full"
      >
        {loading ? "Sending..." : "Send Reset Link"}
      </Button>
    </div>
  );
}

export default SendResetLinkForm;
