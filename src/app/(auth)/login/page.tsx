"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { UsersRound, ShieldCheck, Zap, MessageCircle } from "lucide-react";

// `useSearchParams` opts the component out of static prerendering
// unless it sits under a Suspense boundary. We split the form into
// a child component so the outer page can prerender the chrome
// (background, card frame) while the form hydrates with the query
// string on the client.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginPageInner />
    </Suspense>
  );
}

function LoginPageInner() {
  const searchParams = useSearchParams();
  // Forwarded from `/join/<token>` when the visitor already has an
  // account. After a successful sign-in we send them to the join
  // page to accept rather than to /dashboard.
  const inviteToken = searchParams.get("invite");
  const t = useTranslations("LoginPage");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // Full-page navigation (not router.push) so the browser issues a
    // fresh top-level request that carries the just-written Supabase
    // auth cookies to the middleware gating /dashboard. A soft
    // client-side navigation can reach the protected route before the
    // server observes the new session, so the middleware bounces it
    // back to /login — which looks like the page "just refreshing"
    // instead of signing in (issue #365). Mirrors the deliberate full
    // reload the invite-accept flow already uses in join/[token].
    const destination = inviteToken
      ? `/join/${encodeURIComponent(inviteToken)}`
      : "/dashboard";
    window.location.href = destination;
  };

  return (
    <div className="relative flex min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_35%),radial-gradient(circle_at_80%_80%,color-mix(in_oklch,var(--primary)_8%,transparent),transparent_35%)]" />

      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-7xl flex-col lg:flex-row">
        <div className="hidden flex-1 flex-col justify-between p-10 lg:flex xl:p-16">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl">
                <img
                  src="/sutraapi-icon.png"
                  alt="SutraAPI"
                  className="h-full w-full object-contain"
                />
              </div>
              <span className="text-xl font-semibold tracking-tight text-foreground">
                SutraAPI
              </span>
            </div>

            <div className="mt-24 max-w-xl">
              <p className="text-sm font-medium uppercase tracking-[0.2em] text-primary">
                WhatsApp business, simplified
              </p>
              <h1 className="mt-5 text-5xl font-semibold tracking-tight text-foreground xl:text-6xl">
                Every conversation.
                <br />
                <span className="text-primary">One workspace.</span>
              </h1>
              <p className="mt-6 max-w-lg text-lg leading-8 text-muted-foreground">
                Manage WhatsApp conversations, customers, follow-ups and
                automation from one calm, focused workspace.
              </p>

              <div className="mt-10 space-y-5">
                <div className="flex items-center gap-4">
                  <MessageCircle className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Keep every customer conversation organized
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <Zap className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Automate follow-ups and repetitive work
                  </span>
                </div>
                <div className="flex items-center gap-4">
                  <ShieldCheck className="h-5 w-5 text-primary" />
                  <span className="text-sm text-muted-foreground">
                    Built for teams that care about their customers
                  </span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-muted-foreground">
            Your conversations. Your customers. Your workspace.
          </p>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 lg:max-w-xl lg:px-10">
          <Card className="my-auto w-full max-w-md border-border bg-card/95 shadow-2xl backdrop-blur-xl">
            <CardHeader className="items-center text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl bg-primary/10 p-2">
                {inviteToken ? (
                  <UsersRound className="h-7 w-7 text-primary" />
                ) : (
                  <img
                    src="/sutraapi-icon.png"
                    alt="SutraAPI"
                    className="h-full w-full object-contain"
                  />
                )}
              </div>
              <CardTitle className="text-2xl font-semibold tracking-tight text-foreground">
                {inviteToken ? t('titleAccept') : t('titleWelcome')}
              </CardTitle>
              <CardDescription className="mt-1 max-w-sm text-center leading-6 text-muted-foreground">
                {inviteToken ? t('descAccept') : t('descWelcome')}
              </CardDescription>
            </CardHeader>
            <CardContent>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            {error && (
              <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <div className="flex flex-col gap-2">
              <Label htmlFor="email" className="text-muted-foreground">
                {t('emailLabel')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder={t('emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-muted-foreground">
                  {t('passwordLabel')}
                </Label>
                <Link
                  href="/forgot-password"
                  className="text-sm text-primary hover:text-primary/80"
                >
                  {t('forgotPassword')}
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder={t('passwordPlaceholder')}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-border bg-muted text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/20"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-11 w-full rounded-lg bg-primary font-medium text-primary-foreground shadow-lg shadow-primary/20 transition-all hover:bg-primary-hover hover:shadow-xl hover:shadow-primary/25 disabled:opacity-50"
            >
              {loading ? t('signingIn') : t('signIn')}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            {t('noAccount')}{" "}
            <Link
              href={
                inviteToken
                  ? `/signup?invite=${encodeURIComponent(inviteToken)}`
                  : "/signup"
              }
              className="text-primary hover:text-primary/80"
            >
              {t('createAccount')}
            </Link>
          </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
