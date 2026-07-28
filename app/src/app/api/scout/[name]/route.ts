import { decodeName, fail, json } from '@/lib/api';
import { getRobot, scoutingReport } from '@/lib/engine';

/**
 * GET /api/scout/Riptide — archetype, strengths, weaknesses and the best/worst
 * matchups found by running the bot against the entire roster.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const robot = decodeName(name);
  if (!robot) return fail('A robot name is required.', 400);
  if (!getRobot(robot)) return fail(`No robot named "${robot}" in the roster.`, 404);

  const report = scoutingReport(robot);
  if (!report) return fail('Could not build a scouting report.', 422);

  return json(report);
}
