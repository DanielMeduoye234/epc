import { createAdminClient } from '@/lib/supabase/admin';
import { getRequestUser, parseSignupRole } from '@/lib/request-user';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const user = await getRequestUser(request);
    if (!user) {
      return NextResponse.json({ error: 'Sign in before setting up an account.' }, { status: 401 });
    }

    const body = await request.json();
    const { full_name, email, role, branchCode, branchName, branchLocation } = body;
    const resolvedRole =
      user.user_metadata?.role === 'bishop'
        ? 'bishop'
        : parseSignupRole(user.user_metadata?.role) || parseSignupRole(role) || 'super_admin';
    const name = (typeof full_name === 'string' && full_name.trim()) || user.user_metadata?.full_name || '';

    if (!name) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    let branchId: string;

    if (resolvedRole === 'super_admin' || resolvedRole === 'bishop') {
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
      id: user.id,
      full_name: name,
      email: (typeof email === 'string' && email) || user.email || '',
      role: resolvedRole,
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
