import { Suspense } from "react";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  // Constant-folded to false in production builds, and the /api/dev/otp route
  // it calls is not compiled into them either (see next.config.ts).
  const devOtp = process.env.NODE_ENV !== "production" && Boolean(process.env.DEV_OTP_KEY);
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <Suspense>
        <LoginForm devOtp={devOtp} />
      </Suspense>
    </main>
  );
}
