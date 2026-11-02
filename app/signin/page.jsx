"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function SignInContent() {
  const params = useSearchParams();
  const error = params.get("error");
  const message =
    error === "NOT_COLLEGE_EMAIL"
      ? "Please sign in with a college email ending in @vvce.ac.in."
      : error
        ? "Sign-in did not complete. Please try again."
        : "";
  return (
    <div>
      <h1>Sign in</h1>
      <p>Sign in with your college account. Only @vvce.ac.in accounts can sign in.</p>
      {message && <p className="error">{message}</p>}
      <p>
        <Link href="/api/auth/login">Sign in with Google</Link>
      </p>
    </div>
  );
}

export default function SignIn() {
  return (
    <Suspense>
      <SignInContent />
    </Suspense>
  );
}
