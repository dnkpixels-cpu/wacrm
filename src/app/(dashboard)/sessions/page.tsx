"use client";

import { useEffect, useState } from "react";
import { CalendarDays, Clock3, MessageCircle, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SessionRow {
  id: string;
  session_date: string;
  start_time: string;
  session_type: string;
  join_url: string | null;
  status: string;
}

export default function SessionsPage() {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null);
  const [sendMessage, setSendMessage] = useState<string | null>(null);

  useEffect(() => {
    const loadSessions = async () => {
      const supabase = createClient();
      const { data, error: queryError } = await supabase
        .from("sessions")
        .select("id, session_date, start_time, session_type, join_url, status")
        .order("session_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (queryError) {
        setError(queryError.message);
      } else {
        setSessions((data ?? []) as SessionRow[]);
      }
      setLoading(false);
    };

    void loadSessions();
  }, []);

  const sendTestInvitation = async (sessionId: string) => {
    setSendingSessionId(sessionId);
    setSendMessage(null);

    try {
      const response = await fetch("/api/sessions/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: sessionId,
          participant_phone: "9966623190",
        }),
      });

      const data = (await response.json()) as {
        success?: boolean;
        error?: string;
        participant?: string;
        phone?: string;
        personalized_url?: string;
      };

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Failed to send invitation.");
      }

      setSendMessage(
        `Invitation sent to ${data.participant || "9966623190"}.`,
      );
    } catch (err) {
      setSendMessage(
        err instanceof Error ? err.message : "Failed to send invitation.",
      );
    } finally {
      setSendingSessionId(null);
    }
  };

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-primary">SutraAPI</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
            Sessions
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your upcoming and past sessions.
          </p>
        </div>
        <button
          type="button"
          disabled
          className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground opacity-60"
          title="Session creation will be added next"
        >
          <CalendarDays className="h-4 w-4" />
          Create Session
        </button>
      </div>

      {sendMessage ? (
        <div className="rounded-lg border border-border bg-card px-4 py-3 text-sm text-foreground">
          {sendMessage}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading sessions...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
          Could not load sessions: {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <CalendarDays className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold text-foreground">
            No sessions yet
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Create a session to start managing participants and invitations.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="border-b border-border px-5 py-4">
            <h2 className="text-sm font-semibold text-foreground">Sessions</h2>
          </div>
          <div className="divide-y divide-border">
            {sessions.map((session) => (
              <div
                key={session.id}
                className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-foreground">
                      {session.session_type}
                    </h3>
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                      {session.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <span className="inline-flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      {session.session_date}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Clock3 className="h-3.5 w-3.5" />
                      {session.start_time}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      Participants next
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {session.join_url ? (
                    <a
                      href={session.join_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-primary hover:underline"
                    >
                      Open session
                    </a>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void sendTestInvitation(session.id)}
                    disabled={sendingSessionId !== null}
                    className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                    title="Send sutra_session_invitation to 9966623190"
                  >
                    <MessageCircle className="h-4 w-4" />
                    {sendingSessionId === session.id
                      ? "Sending..."
                      : "Test WhatsApp"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
