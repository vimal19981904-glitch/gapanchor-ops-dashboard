import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { DEFAULT_TRAINERS, syncWorkWithUsTrainers } from '@/lib/trainers-sync';

export async function GET() {
  try {
    let trainers = await prisma.trainerRegistration.findMany({
      orderBy: { createdAt: 'desc' },
    });

    if (trainers.length === 0) {
      await syncWorkWithUsTrainers();
      trainers = await prisma.trainerRegistration.findMany({
        orderBy: { createdAt: 'desc' },
      });
    }

    // Compute summary analytics for Donut chart and KPIs
    const totalTrainers = trainers.length;
    const trainerCount = trainers.filter((t) => t.role === 'Trainer' || t.role === 'Both').length;
    const employeeCount = trainers.filter((t) => t.role === 'Employee' || t.role === 'Both').length;
    const bothCount = trainers.filter((t) => t.role === 'Both').length;

    const totalBatchesTaken = trainers.reduce((acc, t) => acc + (t.totalBatches || 0), 0);
    const totalJobSupportLeads = trainers.reduce((acc, t) => acc + (t.jobSupportLeads || 0), 0);

    // Distribution by course for Donut chart
    const courseDistribution = [
      { name: 'Manhattan WMS', value: trainers.filter((t) => t.primaryCourse === 'Manhattan WMS').length, color: '#38bdf8' },
      { name: 'Blue Yonder', value: trainers.filter((t) => t.primaryCourse === 'Blue Yonder').length, color: '#818cf8' },
      { name: 'Kinaxis', value: trainers.filter((t) => t.primaryCourse === 'Kinaxis').length, color: '#34d399' },
      { name: 'SAP S/4HANA', value: trainers.filter((t) => t.primaryCourse === 'SAP S/4HANA').length, color: '#fbbf24' },
    ];

    // Workload breakdown for Donut chart
    const roleDistribution = [
      { name: 'Batch Trainers', value: trainerCount, color: '#6366f1' },
      { name: 'Job Support Staff', value: employeeCount, color: '#06b6d4' },
      { name: 'Dual Role (Both)', value: bothCount, color: '#10b981' },
    ];

    return NextResponse.json({
      success: true,
      trainers,
      summary: {
        totalTrainers,
        trainerCount,
        employeeCount,
        bothCount,
        totalBatchesTaken,
        totalJobSupportLeads,
        courseDistribution,
        roleDistribution,
      },
    });
  } catch (error: any) {
    console.error('Error fetching trainers:', error);
    // Fallback if DB fails
    return NextResponse.json({
      success: true,
      trainers: DEFAULT_TRAINERS,
      summary: {
        totalTrainers: DEFAULT_TRAINERS.length,
        trainerCount: 4,
        employeeCount: 3,
        bothCount: 2,
        totalBatchesTaken: 56,
        totalJobSupportLeads: 45,
        courseDistribution: [
          { name: 'Manhattan WMS', value: 2, color: '#38bdf8' },
          { name: 'Blue Yonder', value: 2, color: '#818cf8' },
          { name: 'Kinaxis', value: 1, color: '#34d399' },
          { name: 'SAP S/4HANA', value: 1, color: '#fbbf24' },
        ],
        roleDistribution: [
          { name: 'Batch Trainers', value: 4, color: '#6366f1' },
          { name: 'Job Support Staff', value: 3, color: '#06b6d4' },
          { name: 'Dual Role (Both)', value: 2, color: '#10b981' },
        ],
      },
    });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, phone, role, primaryCourse, status, experienceYears, notes } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ success: false, error: 'Trainer name is required' }, { status: 400 });
    }

    const trainer = await prisma.trainerRegistration.create({
      data: {
        name: name.trim(),
        email: email || null,
        phone: phone || null,
        role: role || 'Trainer',
        primaryCourse: primaryCourse || 'Manhattan WMS',
        status: status || 'Active',
        experienceYears: typeof experienceYears === 'number' ? experienceYears : 3.0,
        notes: notes || null,
        source: 'manual',
      },
    });

    return NextResponse.json({ success: true, trainer });
  } catch (error: any) {
    console.error('Error creating trainer:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, email, phone, role, status, primaryCourse, totalBatches, jobSupportLeads, experienceYears, notes } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Trainer ID is required' }, { status: 400 });
    }

    const updated = await prisma.trainerRegistration.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(email !== undefined && { email }),
        ...(phone !== undefined && { phone }),
        ...(role && { role }),
        ...(status && { status }),
        ...(primaryCourse && { primaryCourse }),
        ...(typeof totalBatches === 'number' && { totalBatches }),
        ...(typeof jobSupportLeads === 'number' && { jobSupportLeads }),
        ...(typeof experienceYears === 'number' && { experienceYears }),
        ...(notes !== undefined && { notes }),
      },
    });

    return NextResponse.json({ success: true, trainer: updated });
  } catch (error: any) {
    console.error('Error updating trainer:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Trainer ID required' }, { status: 400 });
    }

    const trainer = await prisma.trainerRegistration.findUnique({ where: { id } });
    if (trainer) {
      await prisma.trainerRegistration.delete({
        where: { id },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error deleting trainer:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
