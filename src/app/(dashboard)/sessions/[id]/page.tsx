"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Circle, Users } from "lucide-react";

interface AttendanceRow {
  participant_id: string;
  name: string;
  phone: string | null;
  link_status: string;
  attended: boolean;
  attended_at: string | null;
  source: string | null;
  campaign: string | null;
}

interface SessionData {
  id: string;
  session_date: string;
  start_time: string;
  session_type: string;
  status: string;
}

export default function SessionAttendancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [participants, setParticipants] = useState<AttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      const { id } = await params;
      if (cancelled) return;
      setSessionId(id);

      try {
        const response = await fetch(`/api/sessions/${id}/attendance`, {
          cache: "no-store",
        });
        const data = (await response.json()) as {
          session?: SessionData;
          participants?: AttendanceRow[];
          error?: string;
        };

        if (!response.ok) throw new Error(data.error || "Could not load attendance.");
        if (!cancelled) {
          setSession(data.session ?? null);
          setParticipants(data.participants ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Could not load attendance.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [params]);

  const attendedCount = useMemo(
    () => participants.filter((participant) => participant.attended).length,
    [participants],
  );

  const attendancePercent = participants.length
    ? Math.round((attendedCount / participants.length) * 100)
    : 0;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <Link
        href="/sessions"
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Sessions
      </Link>

      {loading ? (
        <div className="rounded-xl border border-border bg-card p-8 text-sm text-muted-foreground">
          Loading attendance...
        </div>
      ) : error ? (
        <div className="rounded-xl border border-destructive/30 bg-card p-6 text-sm text-destructive">
          {error}
        </div>
      ) : session ? (
        <>
          <div>
            <p className="text-sm font-medium text-primary">SutraAPI</p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
              {session.session_type}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {session.session_date} · {session.start_time} · {session.status}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Participants</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{participants.length}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Attended</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{attendedCount}</p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">Attendance rate</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{attendancePercent}%</p>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-sm font-semibold text-foreground">Attendance tracker</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Attendance is recorded automatically when a personalized session link is redeemed.
                </p>
              </div>
              <Users className="h-5 w-5 text-muted-foreground" />
            </div>

            {participants.length === 0 ? (
              <div className="p-8 text-center text-sm text-muted-foreground">
                No participants are linked to this session yet.
              </div>
            ) : (
              <div className="divide-y divide-border">
                {participants.map((participant) => (
                  <div
                    key={participant.participant_id}
                    className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-3">
                      {participant.attended ? (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 text-muted-foreground" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-foreground">{participant.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {participant.phone || "No phone number"}
                        </p>
                      </div>
                    </div>
                    <div className="text-left sm:text-right">
                      <p className="text-sm font-medium text-foreground">
                        {participant.attended ? "Attended" : "Not attended"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {participant.attended_at
                          ? new Date(participant.attended_at).toLocaleString()
                          : "Waiting for session link click"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      ) : null}

      {sessionId ? <span className="sr-only">{sessionId}</span> : null}
    </div>
  );
}
