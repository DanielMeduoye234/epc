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
    const { full_name, email, role, branchCode, branchName, branchLocation, joinExisting } = body;

    const admin = createAdminClient();

    const { data: existingProfile } = await admin
      .from('profiles')
      .select('id, full_name, email, role, branch_id')
      .eq('id', user.id)
      .maybeSingle();

    // Already linked to a branch — never force setup again.
    if (existingProfile?.branch_id) {
      return NextResponse.json({ success: true, alreadyLinked: true });
    }

    const resolvedRole =
      user.user_metadata?.role === 'bishop'
        ? 'bishop'
        : parseSignupRole(user.user_metadata?.role) ||
          parseSignupRole(existingProfile?.role) ||
          parseSignupRole(role) ||
          'super_admin';
    const name =
      (typeof full_name === 'string' && full_name.trim()) ||
      existingProfile?.full_name ||
      user.user_metadata?.full_name ||
      '';

    if (!name) {
      return NextResponse.json({ error: 'Full name is required.' }, { status: 400 });
    }

    let branchId: string;
    const code = typeof branchCode === 'string' ? branchCode.trim() : '';
    const wantsJoin =
      joinExisting === true ||
      resolvedRole === 'shepherd' ||
      resolvedRole === 'recorder' ||
      ((resolvedRole === 'super_admin' || resolvedRole === 'bishop') && Boolean(code) && !branchName);

    if (wantsJoin) {
      if (!code) {
        return NextResponse.json({ error: 'Branch code is required' }, { status: 400 });
      }

      const { data: branch } = await admin
        .from('branches')
        .select('id')
        .ilike('branch_code', code)
        .maybeSingle();

      if (!branch) {
        return NextResponse.json(
          { error: `No branch found with code "${code.toUpperCase()}". Ask your admin for the correct code.` },
          { status: 404 }
        );
      }

      branchId = branch.id;
    } else if (resolvedRole === 'super_admin' || resolvedRole === 'bishop') {
      if (!branchName || !code) {
        return NextResponse.json({ error: 'Branch name and code are required' }, { status: 400 });
      }

      const { data: branch, error: branchError } = await admin
        .from('branches')
        .insert({
          name: branchName,
          branch_code: code.toUpperCase(),
          location: branchLocation || null,
        })
        .select('id')
        .single();

      if (branchError) {
        // Code already exists — attach to that branch instead of failing setup.
        if (branchError.message.includes('duplicate') || branchError.message.includes('unique')) {
          const { data: existingBranch } = await admin
            .from('branches')
            .select('id')
            .ilike('branch_code', code)
            .maybeSingle();
          if (existingBranch) {
            branchId = existingBranch.id;
          } else {
            return NextResponse.json({
              error: `Branch code "${code.toUpperCase()}" is already taken. Choose a different code, or join with that code.`,
            }, { status: 400 });
          }
        } else {
          return NextResponse.json({ error: branchError.message }, { status: 400 });
        }
      } else {
        branchId = branch.id;
      }
    } else {
      return NextResponse.json({ error: 'Branch code is required' }, { status: 400 });
    }

    const { error: profileError } = await admin.from('profiles').upsert({
      id: user.id,
      full_name: name,
      email: (typeof email === 'string' && email) || existingProfile?.email || user.email || '',
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
