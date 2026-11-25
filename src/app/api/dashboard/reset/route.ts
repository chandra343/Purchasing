import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getVerifiedUserSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const session = await getVerifiedUserSession();
    if (!session) {
      return NextResponse.json(
        {
          success: false,
          requiresRelogin: true,
          error: "Akses ditolak: Anda harus login dengan ID Card untuk mereset dashboard Anda.",
        },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => ({}))) as { idCard?: string };
    const cleanId = body?.idCard?.trim().toUpperCase();

    if (cleanId && cleanId !== session.idCard) {
      return NextResponse.json(
        {
          success: false,
          error: `Akses ditolak: Akun ${session.idCard} hanya berwenang mereset dashboard miliknya sendiri.`,
        },
        { status: 403 }
      );
    }

    const staff = await prisma.purchasingStaff.findUnique({ where: { id: session.userId } });
    if (!staff) {
      return NextResponse.json(
        { success: false, error: `Staf dengan ID Card "${session.idCard}" tidak ditemukan.` },
        { status: 404 }
      );
    }

    await prisma.purchasingStaff.update({
      where: { id: staff.id },
      data: { dashboardConfigJson: null },
    });

    return NextResponse.json({
      success: true,
      message: `Tampilan dashboard akun ${staff.name} (${session.idCard}) telah dipulihkan ke Default.`,
    });
  } catch (err: unknown) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Gagal memulihkan tampilan default.",
      },
      { status: 500 }
    );
  }
}
