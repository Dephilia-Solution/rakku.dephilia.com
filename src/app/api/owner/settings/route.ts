import { NextRequest, NextResponse } from "next/server";
import { getOwnerSessionFromCookies } from "@/lib/auth/owner-session";
import type { OwnerSession } from "@/types";
import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";

type OwnerWithCompany = OwnerSession & { company_id: string };

async function requireOwner(): Promise<OwnerWithCompany | null> {
  const session = await getOwnerSessionFromCookies();
  if (!session) return null;
  if (!session.company_id) return null;
  return session as OwnerWithCompany;
}

export async function GET() {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const supabase = createAdminClient();
  const { data: company } = await supabase
    .from("companies")
    .select("id, name, code, slug, logo_url, status, created_at")
    .eq("id", session.company_id)
    .single();

  if (!company) {
    return NextResponse.json(
      { error: "Perusahaan tidak ditemukan" },
      { status: 404 }
    );
  }

  return NextResponse.json({ company });
}

export async function PUT(request: NextRequest) {
  const session = await requireOwner();
  if (!session) {
    return NextResponse.json(
      { error: "Anda belum memiliki perusahaan" },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Body tidak valid" }, { status: 400 });
  }

  const supabase = createAdminClient();

  // Ganti password company
  if (body.new_company_password) {
    if (body.new_company_password.length < 6) {
      return NextResponse.json(
        { error: "Password perusahaan minimal 6 karakter" },
        { status: 400 }
      );
    }

    const passwordHash = await bcrypt.hash(body.new_company_password, 10);
    const { error } = await supabase
      .from("companies")
      .update({ password_hash: passwordHash })
      .eq("id", session.company_id);

    if (error) {
      return NextResponse.json(
        { error: "Gagal mengubah password perusahaan" },
        { status: 400 }
      );
    }
    return NextResponse.json({ success: true, updated: "password" });
  }

  // Update profil company (name, logo_url)
  const updateData: Record<string, unknown> = {};
  if (body.name !== undefined) {
    updateData.name = String(body.name).trim();
  }
  if (body.logo_url !== undefined) {
    updateData.logo_url = body.logo_url;
  }

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "Tidak ada data diubah" }, { status: 400 });
  }

  const { data: updated, error } = await supabase
    .from("companies")
    .update(updateData)
    .eq("id", session.company_id)
    .select("id, name, code, slug, logo_url")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Gagal mengupdate profil" }, { status: 400 });
  }

  return NextResponse.json({ company: updated });
}
