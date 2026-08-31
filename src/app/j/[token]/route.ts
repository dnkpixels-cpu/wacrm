import { NextResponse } from "next/server";

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

  const { data, error } = await supabase.rpc("redeem_session_link", {
    p_token: token,
  });

  if (error) {
    console.error("[session-link] redeem error:", error);

    const message = error.message?.toLowerCase() ?? "";

    if (message.includes("expired")) {
      return NextResponse.json(
        { error: "This session link has expired" },
        { status: 410 },
      );
    }

    if (
      message.includes("invalid") ||
      message.includes("no longer active") ||
      message.includes("not available")
    ) {
      return NextResponse.json(
        { error: "This session link is no longer valid" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      { error: "Could not process session link" },
      { status: 500 },
    );
  }

  const joinUrl = data?.[0]?.join_url;

  if (!joinUrl) {
    return NextResponse.json(
      { error: "Session link is not available yet" },
      { status: 404 },
    );
  }

  return NextResponse.redirect(joinUrl);
}
