import { GoogleGenAI, Type } from '@google/genai';
import { getDashboardAnalytics } from '../db/analytics.ts';

function getGeminiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY is not configured on the server. Add GEMINI_API_KEY in Settings > Secrets.'
    );
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

export interface ClubPulseAIResponse {
  summary: string;
  verifiedMetrics: Array<{
    label: string;
    value: string;
    context: string;
  }>;
  interpretation: string;
  recommendations: string[];
  dataScopeNote: string;
}

export async function askClubPulseAI(
  question: string,
  history: Array<{ role: 'user' | 'assistant'; text: string }> = []
): Promise<ClubPulseAIResponse> {
  const ai = getGeminiClient();
  const analytics = await getDashboardAnalytics({});

  // Send ONLY verified aggregated analytical data (never raw student PII)
  const verifiedContext = {
    generatedAt: analytics.generatedAt,
    kpis: analytics.kpis,
    clubRankings: analytics.clubRankings.map((c) => ({
      name: c.name,
      fullName: c.fullName,
      code: c.code,
      category: c.category,
      department: c.department,
      verifiedBlockName: c.verifiedBlockName,
      institutionalDistinction: c.institutionalDistinction,
      verificationStatus: c.verificationStatus,
      isCgcDirectory: c.isCgcDirectory,
      isSyntheticData: c.isSyntheticData,
      memberCount: c.memberCount,
      eventCount: c.eventCount,
      totalCheckIns: c.totalCheckIns,
      uniqueAttendees: c.uniqueAttendees,
      avgEventTurnout: c.avgEventTurnout,
      attendanceRatePct: c.attendanceRate,
      participationRatioPct: c.participationRatio,
    })),
    departmentAnalytics: analytics.departmentAnalytics,
    monthlyTrends: analytics.monthlyTrends,
    recentEvents: analytics.eventsList.slice(0, 12).map((e) => ({
      title: e.title,
      clubName: e.clubName,
      eventDate: e.eventDate,
      presentCount: e.presentCount,
      registeredCount: e.registeredCount,
      attendanceRatePct: e.attendanceRate,
      capacity: e.capacity,
    })),
  };

  const systemInstruction = `You are CampusLytix AI, an institutional student-club engagement analyst for CGC University.

STRICT DATA INTEGRITY RULES:
1. You MUST base EVERY numerical figure strictly on the VERIFIED_POSTGRESQL_ANALYTICS JSON provided below.
2. NEVER invent, extrapolate, or fabricate student counts, founding dates, faculty designations, acronym expansions, events, clubs, or trends that are not present in the JSON.
3. Keep institutional distinctions (e.g., "UNIVERSITY'S BIGGEST CLUB" for DSA, "LARGEST & OLDEST TECH CLUB" for D4-Community) clearly separate from calculated PostgreSQL membership counts (which may represent synthetic demo rosters where isSyntheticData is true).
4. If the user asks about something absent from the dataset or marked PENDING_VERIFICATION, state clearly that the information is awaiting institutional verification.
5. Clearly separate verified database statistics (placed in "verifiedMetrics") from your analytical interpretation ("interpretation") and administrative recommendations ("recommendations").
6. Keep language executive, clear, concise, and institutional.

VERIFIED_POSTGRESQL_ANALYTICS:
${JSON.stringify(verifiedContext)}`;

  const conversationSnippet = history
    .slice(-4)
    .map((h) => `${h.role === 'user' ? 'Administrator' : 'CampusLytix AI'}: ${h.text}`)
    .join('\n');

  const prompt = conversationSnippet
    ? `Previous context:\n${conversationSnippet}\n\nCurrent question: ${question}`
    : question;

  let response;
  try {
    response = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: 'Direct 1-3 sentence executive answer grounded strictly in the provided analytics JSON.',
            },
            verifiedMetrics: {
              type: Type.ARRAY,
              description: 'Exact verified numerical statistics extracted directly from the PostgreSQL analytics payload.',
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING },
                  value: { type: Type.STRING },
                  context: { type: Type.STRING },
                },
              },
            },
            interpretation: {
              type: Type.STRING,
              description: 'AI-generated analytical explanation comparing patterns, gaps, or trends in the verified data.',
            },
            recommendations: {
              type: Type.ARRAY,
              description: '2 to 4 concrete, evidence-based administrative recommendations.',
              items: { type: Type.STRING },
            },
            dataScopeNote: {
              type: Type.STRING,
              description: 'Brief note specifying what verified dataset slice was analyzed and any data limitations.',
            },
          },
          required: [
            'summary',
            'verifiedMetrics',
            'interpretation',
            'recommendations',
            'dataScopeNote',
          ],
        },
      },
    });
  } catch (error: any) {
    throw new Error(formatGeminiError(error));
  }

  const rawText = (response.text ?? '').trim();
  if (!rawText) {
    throw new Error('Gemini returned an empty response.');
  }

  return JSON.parse(rawText) as ClubPulseAIResponse;
}

function formatGeminiError(error: any): string {
  const raw = typeof error?.message === 'string' ? error.message : '';
  if (raw.startsWith('{')) {
    try {
      const parsed = JSON.parse(raw);
      const msg = parsed?.error?.message;
      const status = parsed?.error?.status;
      if (msg) {
        return status === 'RESOURCE_EXHAUSTED'
          ? `${msg} You can check or update your API key in Settings > Secrets.`
          : msg;
      }
    } catch {
      // Fallback to raw message
    }
  }
  return raw || 'Unable to reach Gemini API. Verify your API key in Settings > Secrets.';
}

export async function testGeminiConnection(): Promise<{
  connected: boolean;
  model: string;
  message: string;
}> {
  if (!process.env.GEMINI_API_KEY) {
    return {
      connected: false,
      model: 'gemini-4-hydrogen',
      message: 'GEMINI_API_KEY is not configured in server environment.',
    };
  }
  try {
    const ai = getGeminiClient();
    const res = await ai.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: 'Respond with exactly: OK',
    });
    const ok = Boolean(res.text && res.text.trim().length > 0);
    return {
      connected: ok,
      model: 'gemini-4-hydrogen',
      message: ok
        ? 'Verified live connectivity to Gemini API (gemini-4-hydrogen).'
        : 'Gemini API returned an empty response.',
    };
  } catch (error: any) {
    return {
      connected: false,
      model: 'gemini-4-hydrogen',
      message: formatGeminiError(error),
    };
  }
}
