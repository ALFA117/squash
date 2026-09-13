import { NextResponse } from "next/server";
import {
  confirmShare,
  getGroup,
  GroupError,
  joinGroup,
  lockGroup,
  reissueSeat,
  removeMember,
  setPayoutWallet,
  reopenGroup,
  setOwnShare,
  setShareByAdmin,
  setSplitMode,
} from "@/lib/groups";

export const runtime = "nodejs";
export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

function fail(e: unknown) {
  const status = e instanceof GroupError ? e.status : 500;
  return NextResponse.json({ error: (e as Error).message }, { status });
}

/** GET — the group as anyone holding the link sees it. No secrets. */
export async function GET(_request: Request, { params }: Ctx) {
  const { id } = await params;
  try {
    return NextResponse.json(await getGroup(id), { headers: { "cache-control": "no-store" } });
  } catch (e) {
    return fail(e);
  }
}

/**
 * POST — every action on a group. Anything done as a person carries that
 * person's memberId and secret; groups.ts refuses it otherwise.
 */
export async function POST(request: Request, { params }: Ctx) {
  const { id } = await params;

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const memberId = String(body.memberId ?? "");
  const secret = String(body.secret ?? "");

  try {
    switch (body.action) {
      case "join":
        return NextResponse.json(await joinGroup(id, body.name), { status: 201 });
      case "mode":
        await setSplitMode(id, memberId, secret, body.mode);
        return NextResponse.json({ ok: true });
      case "set-share":
        await setShareByAdmin(id, memberId, secret, body.targetId, body.cents);
        return NextResponse.json({ ok: true });
      case "own-share":
        await setOwnShare(id, memberId, secret, body.cents);
        return NextResponse.json({ ok: true });
      case "lock":
        return NextResponse.json(
          await lockGroup(id, memberId, secret, new URL("/api/v1/net", request.url).toString()),
        );
      case "reopen":
        await reopenGroup(id, memberId, secret);
        return NextResponse.json({ ok: true });
      case "confirm":
        return NextResponse.json(await confirmShare(id, memberId, secret));
      case "reissue":
        return NextResponse.json(await reissueSeat(id, memberId, secret, body.targetId));
      case "payout-wallet":
        return NextResponse.json(await setPayoutWallet(id, memberId, secret, body.evm));
      case "remove":
        await removeMember(id, memberId, secret, body.targetId);
        return NextResponse.json({ ok: true });
      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }
  } catch (e) {
    return fail(e);
  }
}
