import { decodeName, fail, json } from '@/lib/api';
import { robotDetail } from '@/lib/engine';

/** GET /api/robot/Tombstone — full stats, rank and match history for one bot. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ name: string }> },
) {
  const { name } = await params;
  const robot = decodeName(name);
  if (!robot) return fail('A robot name is required.', 400);

  const detail = robotDetail(robot);
  if (!detail) return fail(`No robot named "${robot}" in the roster.`, 404);

  return json(detail);
}
