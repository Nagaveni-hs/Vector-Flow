"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect } from "react";
import BrandLogo from "@/components/BrandLogo";

function SignInContent() {
  const router = useRouter();
  const params = useSearchParams();
  // P0 (B1) fallback: the middleware already redirects a signed-in
  // user away from /signin, but if this page is ever reached with a
  // valid session (for example from the browser Back button after a
  // client-side navigation), send them Home instead of showing the
  // sign-in card to someone who is already signed in.
  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) router.replace("/");
      })
      .catch(() => {});
  }, [router]);
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
