import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const diagnostics: Record<string, any> = {
    timestamp: new Date().toISOString(),
    env: {
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      databaseUrlPrefix: process.env.DATABASE_URL 
        ? process.env.DATABASE_URL.split('@')[1] || 'URL exists but no @' 
        : 'undefined',
      nodeEnv: process.env.NODE_ENV,
      hasJwtSecret: !!process.env.JWT_SECRET,
    }
  };

  try {
    // Attempt database query
    const userCount = await prisma.user.count();
    diagnostics.database = {
      status: 'connected',
      userCount,
    };
  } catch (error: any) {
    diagnostics.database = {
      status: 'failed',
      errorMessage: error.message || 'Unknown database connection error',
      errorDetails: JSON.stringify(error),
    };
  }

  return NextResponse.json(diagnostics, { status: diagnostics.database.status === 'failed' ? 500 : 200 });
}
