import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isMasterAdminProtected, recordAuditLog } from '@/lib/auth/rbac';

/**
 * GET /api/admin/users
 * Returns list of all accounts for Master Admin.
 */
export async function GET(req: Request) {
  try {
    const session = getSessionUser(req);
    if (!session || (session.role !== 'admin' && session.email.toLowerCase() !== 'admin@gapanchor.com')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Master Admin access required.' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        assignedCourse: true,
        allowedUIs: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { assignedEnquiries: true },
        },
      },
      orderBy: [
        { role: 'asc' }, // admin first
        { name: 'asc' },
      ],
    });

    return NextResponse.json({ success: true, users });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * POST /api/admin/users
 * Create a new team employee or administrator account.
 */
export async function POST(req: Request) {
  try {
    const session = getSessionUser(req);
    if (!session || (session.role !== 'admin' && session.email.toLowerCase() !== 'admin@gapanchor.com')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Master Admin access required.' }, { status: 403 });
    }

    const { name, email, password, assignedCourse, role, allowedUIs } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ success: false, error: 'Name, email, and password are required.' }, { status: 400 });
    }

    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existing) {
      return NextResponse.json({ success: false, error: 'An account with this email already exists.' }, { status: 409 });
    }

    // Default permissions for new employee
    const defaultAllowed = allowedUIs && Array.isArray(allowedUIs) ? allowedUIs : ['enquiries'];
    const safeRole = role === 'administrator' ? 'administrator' : 'employee';

    const newUser = await prisma.user.create({
      data: {
        name: name.trim(),
        email: cleanEmail,
        password: password.trim(),
        role: safeRole,
        assignedCourse: assignedCourse || 'General Supply Chain',
        allowedUIs: defaultAllowed,
        isActive: true,
      },
    });

    await recordAuditLog({
      actor: session,
      action: 'USER_CREATED',
      targetUserId: newUser.id,
      targetEmail: newUser.email,
      details: {
        name: newUser.name,
        role: newUser.role,
        assignedCourse: newUser.assignedCourse,
        allowedUIs: newUser.allowedUIs,
      },
    });

    return NextResponse.json({ success: true, user: newUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/users
 * Update user permissions, reset password, toggle active state, or change course.
 */
export async function PATCH(req: Request) {
  try {
    const session = getSessionUser(req);
    if (!session || (session.role !== 'admin' && session.email.toLowerCase() !== 'admin@gapanchor.com')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Master Admin access required.' }, { status: 403 });
    }

    const { id, allowedUIs, password, isActive, assignedCourse, name, email, role } = await req.json();

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // IMMUTABLE MASTER ADMIN LOCK:
    if (isMasterAdminProtected(targetUser.email)) {
      if (isActive === false) {
        return NextResponse.json({
          success: false,
          error: 'Forbidden: The Master Admin account cannot be deactivated.',
        }, { status: 403 });
      }
    }

    const updateData: any = {};
    const auditDetails: any = {};

    if (name !== undefined && typeof name === 'string' && name.trim()) {
      updateData.name = name.trim();
      auditDetails.name = name.trim();
    }

    if (email !== undefined && typeof email === 'string' && email.trim()) {
      const cleanEmail = email.trim().toLowerCase();
      if (!isMasterAdminProtected(targetUser.email)) {
        const duplicate = await prisma.user.findFirst({
          where: { email: cleanEmail, NOT: { id } },
        });
        if (duplicate) {
          return NextResponse.json({ success: false, error: 'An account with this email address already exists.' }, { status: 409 });
        }
        updateData.email = cleanEmail;
        auditDetails.email = cleanEmail;
      }
    }

    if (role !== undefined && typeof role === 'string') {
      if (!isMasterAdminProtected(targetUser.email)) {
        updateData.role = role === 'administrator' ? 'administrator' : 'employee';
        auditDetails.role = updateData.role;
      }
    }

    if (allowedUIs !== undefined && Array.isArray(allowedUIs)) {
      updateData.allowedUIs = allowedUIs;
      auditDetails.allowedUIs = allowedUIs;
    }

    if (password !== undefined && password.trim().length > 0) {
      updateData.password = password.trim();
      auditDetails.passwordReset = true;
    }

    if (isActive !== undefined && typeof isActive === 'boolean') {
      updateData.isActive = isActive;
      auditDetails.isActive = isActive;
    }

    if (assignedCourse !== undefined) {
      updateData.assignedCourse = assignedCourse;
      auditDetails.assignedCourse = assignedCourse;
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: updateData,
    });

    await recordAuditLog({
      actor: session,
      action: 'PERMISSIONS_UPDATED',
      targetUserId: updatedUser.id,
      targetEmail: updatedUser.email,
      details: auditDetails,
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/users
 * Delete an employee account. Master Admin is protected against deletion.
 */
export async function DELETE(req: Request) {
  try {
    const session = getSessionUser(req);
    if (!session || (session.role !== 'admin' && session.email.toLowerCase() !== 'admin@gapanchor.com')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Master Admin access required.' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'User ID is required.' }, { status: 400 });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!targetUser) {
      return NextResponse.json({ success: false, error: 'User not found.' }, { status: 404 });
    }

    // IMMUTABLE MASTER ADMIN LOCK:
    if (isMasterAdminProtected(targetUser.email)) {
      return NextResponse.json({
        success: false,
        error: 'Forbidden: The Master Admin account cannot be deleted.',
      }, { status: 403 });
    }

    // Unassign their enquiries back to unassigned pool before deletion
    await prisma.enquiry.updateMany({
      where: { assignedToId: id },
      data: { assignedToId: null, assignedToName: null },
    });

    await prisma.user.delete({
      where: { id },
    });

    await recordAuditLog({
      actor: session,
      action: 'USER_DELETED',
      targetUserId: id,
      targetEmail: targetUser.email,
      details: { deletedUserName: targetUser.name },
    });

    return NextResponse.json({ success: true, message: `Account for ${targetUser.email} deleted.` });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
