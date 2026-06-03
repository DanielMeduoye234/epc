import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { userId, full_name, email, role, branchCode, branchName, branchLocation } = body;

    if (!userId || !full_name || !role) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const admin = createAdminClient();
    let branchId: string;

    if (role === 'super_admin' || role === 'bishop') {
      if (!branchName || !branchCode) {
        return NextResponse.json({ error: 'Branch name and code are required' }, { status: 400 });
      }

      const { data: branch, error: branchError } = await admin
        .from('branches')
        .insert({
          name: branchName,
          branch_code: (branchCode as string).toUpperCase(),
          location: branchLocation || null,
        })
        .select('id')
        .single();

      if (branchError) {
        const msg =
          branchError.message.includes('duplicate') || branchError.message.includes('unique')
            ? `Branch code "${(branchCode as string).toUpperCase()}" is already taken. Choose a different code.`
            : branchError.message;
        return NextResponse.json({ error: msg }, { status: 400 });
      }

      branchId = branch.id;
    } else {
      if (!branchCode) {
        return NextResponse.json({ error: 'Branch code is required' }, { status: 400 });
      }

      const { data: branch } = await admin
        .from('branches')
        .select('id')
        .ilike('branch_code', (branchCode as string).trim())
        .maybeSingle();

      if (!branch) {
        return NextResponse.json(
          { error: `No branch found with code "${(branchCode as string).toUpperCase()}". Ask your admin for the correct code.` },
          { status: 404 }
        );
      }

      branchId = branch.id;
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: userId,
      full_name,
      email: email || '',
      role,
      branch_id: branchId,
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[setup-account] Unexpected error:', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
