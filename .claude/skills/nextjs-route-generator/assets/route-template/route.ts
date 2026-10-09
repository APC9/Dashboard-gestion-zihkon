import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

// ============ Schemas ============

const createSchema = z.object({
  // Define your creation schema
});

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ============ Types ============

export type CreateInput = z.infer<typeof createSchema>;
export type QueryParams = z.infer<typeof querySchema>;

// ============ Helpers ============

function errorResponse(message: string, status: number, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

// ============ Handlers ============

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams);
  const parsed = querySchema.safeParse(params);

  if (!parsed.success) {
    return errorResponse('Invalid query parameters', 400, parsed.error.flatten());
  }

  // TODO: Implement data fetching

  return NextResponse.json({ data: [], pagination: parsed.data });
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse('Invalid JSON body', 400);
  }

  const parsed = createSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse('Validation failed', 400, parsed.error.flatten());
  }

  // TODO: Implement creation logic

  return NextResponse.json({ data: parsed.data }, { status: 201 });
}
