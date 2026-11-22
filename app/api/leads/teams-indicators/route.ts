import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export interface ActionItemSummary {
  text: string;
  status: 'pending' | 'completed';
}

export interface LeadIndicatorData {
  hasTranscript: boolean;
  callCount: number;
  latestScore: number | null;
  actionItems: {
    total: number;
    completed: number;
    pending: number;
    status: 'none' | 'completed' | 'pending';
    items: ActionItemSummary[];
  };
}

/**
 * Parses action items from customerExperience markdown or nextAction fallback.
 */
function extractActionItems(cxText: string | null | undefined, nextActionFallback?: string | null): ActionItemSummary[] {
  const items: ActionItemSummary[] = [];
  const seen = new Set<string>();

  if (cxText) {
    const lines = cxText.split(/\r?\n/);
    let headerActionIdx = 1;
    let headerStatusIdx = 3;

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line) continue;

      // Check if it's a table row (tab or pipe delimited)
      const isTableRow = line.includes('\t') || line.includes('|');
      if (!isTableRow) continue;

      const cells = line.includes('\t')
        ? line.split('\t').map((c) => c.trim())
        : line.split('|').map((c) => c.trim()).filter(Boolean);

      if (cells.length < 2) continue;

      // Check if this row is the header
      if (cells.some((c) => /action\s*item|task/i.test(c))) {
        headerActionIdx = cells.findIndex((c) => /action\s*item|task/i.test(c));
        headerStatusIdx = cells.findIndex((c) => /status/i.test(c));
        continue;
      }

      // Check if this row contains status indicators
      const isPending = cells.some((c) => /pending/i.test(c));
      const isDone = cells.some((c) => /done|completed/i.test(c));

      if (isPending || isDone) {
        let desc = cells[headerActionIdx] || cells[1] || cells[0];
        // Clean markdown quotes or bolding
        desc = desc.replace(/^[\*\_\`\-\•\d\.\s]+/, '').replace(/[\*\_\`]+$/, '').trim();

        // Avoid header row remnants or priority words
        if (desc && !/^(priority|status|action item|gapanchor)$/i.test(desc) && !seen.has(desc.toLowerCase())) {
          seen.add(desc.toLowerCase());
          items.push({
            text: desc,
            status: isDone ? 'completed' : 'pending',
          });
        }
      }
    }
  }

  // Fallback: if no table parsed but nextAction exists
  if (items.length === 0 && nextActionFallback && nextActionFallback.trim().length > 3) {
    items.push({
      text: nextActionFallback.trim(),
      status: 'pending',
    });
  }

  return items;
}

export async function GET(req: NextRequest) {
  try {
    // Fetch all LeadCalls with customerExperience and nextAction
    const calls = await prisma.leadCall.findMany({
      select: {
        id: true,
        enquiryId: true,
        customerExperience: true,
        nextAction: true,
        score: true,
        callDate: true,
      },
      orderBy: { callDate: 'desc' },
    });

    const indicatorMap: Record<string, LeadIndicatorData> = {};

    for (const call of calls) {
      if (!indicatorMap[call.enquiryId]) {
        const items = extractActionItems(call.customerExperience, call.nextAction);
        const completedCount = items.filter((i) => i.status === 'completed').length;
        const pendingCount = items.filter((i) => i.status === 'pending').length;
        const totalCount = items.length;

        let status: 'none' | 'completed' | 'pending' = 'none';
        if (totalCount > 0) {
          status = pendingCount > 0 ? 'pending' : 'completed';
        }

        indicatorMap[call.enquiryId] = {
          hasTranscript: true,
          callCount: 1,
          latestScore: call.score,
          actionItems: {
            total: totalCount,
            completed: completedCount,
            pending: pendingCount,
            status,
            items,
          },
        };
      } else {
        // Accumulate call count
        indicatorMap[call.enquiryId].callCount += 1;
      }
    }

    return NextResponse.json({
      success: true,
      indicators: indicatorMap,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[API /api/leads/teams-indicators] Error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch teams indicators' },
      { status: 500 }
    );
  }
}
