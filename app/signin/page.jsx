"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import BrandLogo from "@/components/BrandLogo";

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
    <div className="signin-page">
      <div className="signin-brand">
        <BrandLogo className="signin-brand__logo" priority />
      </div>
      <p className="page-eyebrow">Welcome to Vector Flow</p>
      <h1>Sign in</h1>
      <p className="signin-page__description">Use your college account to register for events and follow your participation.</p>
      {message && <p className="error">{message}</p>}
      <Link className="signin-page__button" href="/api/auth/login">
        Continue with Google <span aria-hidden="true">→</span>
      </Link>
      <p className="signin-page__note">Only @vvce.ac.in accounts can sign in.</p>
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
