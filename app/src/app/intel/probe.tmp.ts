/** Temporary harness: exercises the fallback branch of the intel route. */
import { GET } from '@/app/api/intel/[name]/route';

async function main() {
  const res = await GET(new Request('http://localhost/api/intel/Riptide'), {
    params: Promise.resolve({ name: 'Riptide' }),
  });
  const body = await res.json();
  console.log('http', res.status);
  console.log('status', body.provenance?.status);
  console.log('error', body.error);
  console.log('message', body.message);
  console.log('local', body.local?.robot, body.local?.builder);
  console.log('diff', body.diff);
}

void main();
