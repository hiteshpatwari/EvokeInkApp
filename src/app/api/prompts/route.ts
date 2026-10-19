import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { generateWithFallback } from "@/server/generatePrompts";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const payload: unknown = await request.json();
    const result = await generateWithFallback(payload);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          message: "Please check the worksheet details and try again.",
          issues: error.issues,
        },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { message: "Prompts could not be generated. Please try again." },
      { status: 500 },
    );
  }
}
