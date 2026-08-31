import { NextResponse } from "next/server";
import { randomBytes } from "node:crypto";

import { createClient } from "@/lib/supabase/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;

  if (!token) {
    return NextResponse.json(
      { error: "Invalid session link" },
      { status: 400 },
    );
  }

  const supabase = await createClient();

  const { data: link, error: linkError } = await supabase
    .from("participant_session_links")
    .select("id, participant_id, session_id, expires_at, status")
    .eq("token", token)
    .maybeSingle();

  if (linkError) {
    console.error("[session-link] lookup error:", linkError);
    return NextResponse.json(
      { error: "Could not verify session link" },
      { status: 500 },
    );
  }

  if (!link || link.status !== "active") {
    return NextResponse.json(
      { error: "This session link is no longer valid" },
      { status: 404 },
    );
  }

  if (link.expires_at && new Date(link.expires_at) < new Date()) {
    return NextResponse.json(
      { error: "This session link has expired" },
      { status: 410 },
    );
  }

  const { data: session, error: sessionError } = await supabase
    .from("sessions")
    .select("id, join_url")
    .eq("id", link.session_id)
    .maybeSingle();

  if (sessionError) {
    console.error("[session-link] session lookup error:", sessionError);
    return NextResponse.json(
      { error: "Could not find session" },
      { status: 500 },
    );
  }

  if (!session?.join_url) {
    return NextResponse.json(
      { error: "The session link is not available yet" },
      { status: 404 },
    );
  }

  const { error: attendanceError } = await supabase
    .from("attendance_events")
    .insert({
      participant_id: link.participant_id,
      session_id: link.session_id,
      attended_at: new Date().toISOString(),
      source: "personalized_link",
    });

  if (attendanceError) {
    console.error("[session-link] attendance error:", attendanceError);
    return NextResponse.json(
      { error: "Could not record attendance" },
      { status: 500 },
    );
  }

  return NextResponse.redirect(session.join_url);
}

/**
 * Generate a strong token for a participant/session link.
 * Kept here temporarily; we'll move link generation into the
 * session-management flow when we build that part.
 */
export function generateSessionLinkToken(): string {
  return randomBytes(32).toString("base64url");
}
