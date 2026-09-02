import { NextResponse } from "next/server";
import { requireRole, toErrorResponse } from "@/lib/auth/account";
import { requireFeature } from "@/lib/features";
import { supabaseAdmin } from "@/lib/flows/admin-client";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { accountId } = await requireRole("agent");
    await requireFeature(accountId, "sessions");
    const { id } = await params;
    const admin = supabaseAdmin();

    const { data: session, error: sessionError } = await admin
      .from("sessions")
      .select("id, session_date, start_time, session_type, status")
      .eq("id", id)
      .eq("account_id", accountId)
      .single();

    if (sessionError || !session) return NextResponse.json({ error: "Session not found" }, { status: 404 });

    const { data: links, error: linksError } = await admin
      .from("participant_session_links")
      .select("id, participant_id, token, status")
      .eq("session_id", id);
    if (linksError) throw linksError;

    const participantIds = [...new Set((links ?? []).map((link) => link.participant_id))];
    const { data: participants, error: participantsError } = participantIds.length
      ? await admin.from("participants").select("id, name, phone").in("id", participantIds)
      : { data: [], error: null };
    if (participantsError) throw participantsError;

    const { data: attendance, error: attendanceError } = await admin
      .from("attendance_events")
      .select("id, participant_id, session_id, attended_at, source, campaign, created_at")
      .eq("session_id", id)
      .order("attended_at", { ascending: true });
    if (attendanceError) throw attendanceError;

    const participantMap = new Map((participants ?? []).map((participant) => [participant.id, participant]));
    const attendanceMap = new Map((attendance ?? []).map((event) => [event.participant_id, event]));
    const rows = (links ?? []).map((link) => {
      const participant = participantMap.get(link.participant_id);
      const event = attendanceMap.get(link.participant_id);
      return {
        participant_id: link.participant_id,
        name: participant?.name ?? "Unknown participant",
        phone: participant?.phone ?? null,
        link_status: link.status,
        attended: Boolean(event),
        attended_at: event?.attended_at ?? null,
        source: event?.source ?? null,
        campaign: event?.campaign ?? null,
      };
    });

    return NextResponse.json({ session, participants: rows });
  } catch (error) {
    console.error("Error loading session attendance:", error);
    return toErrorResponse(error);
  }
}
