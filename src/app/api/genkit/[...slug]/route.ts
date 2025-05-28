
import {NextRequest} from 'next/server';
import {runFlow, listFlows} from '@genkit-ai/next';
import '@/ai/dev'; // Ensure flows are registered

// Forces the AI code to be bundled, do not remove!
import {ai} from '@/ai/genkit';
ai();

export async function POST(req: NextRequest, {params}: any) {
  const {slug, ...rest} = params;
  const body = await req.json();
  // todo: set up auth
  return runFlow(slug.join('/'), body.input, { GKE_CONTEXT: {rest} as any});
}

export async function GET(req: NextRequest) {
  return listFlows();
}
