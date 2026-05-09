import LoginForm from "@/app/test/login/LoginForm";
import { Suspense } from "react";
export default function Page() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
