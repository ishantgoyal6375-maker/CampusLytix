import React, { useState } from 'react';
import { Send, AlertCircle, ShieldCheck, Lightbulb, Database } from 'lucide-react';
import type { ClubPulseAIResponse } from '../types';
import { apiFetch } from '../lib/api';
import { GoogleServiceIcon } from './GoogleIcons';

interface ChatTurn {
  id: string;
  role: 'user' | 'assistant';
  text?: string;
  structured?: ClubPulseAIResponse;
  error?: string;
  timestamp: string;
}

const SUGGESTED_QUESTIONS = [
  'Which club has the highest membership?',
  'Which department has the highest engagement percentage?',
  'Compare ICA Club and Coding Club.',
  'During which month was participation highest?',
  'Identify clubs with relatively low participation.',
  'Explain the difference between membership and actual event attendance.',
  'Generate an executive summary of college engagement.',
];

export const ClubPulseAIView: React.FC = () => {
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const sendQuestion = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || loading) return;

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const nextTurns = [...turns, userTurn];
    setTurns(nextTurns);
    setInput('');
    setLoading(true);

    try {
      const historyPayload = turns.slice(-4).map((t) => ({
        role: t.role,
        text: t.role === 'user' ? t.text ?? '' : t.structured?.summary ?? '',
      }));

      const data = await apiFetch<ClubPulseAIResponse>('/api/ai/ask', {
        method: 'POST',
        body: JSON.stringify({
          question: trimmed,
          history: historyPayload,
        }),
      });

      setTurns((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          structured: data,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } catch (err: any) {
      setTurns((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          error:
            err.message ||
            'CampusLytix AI could not reach the Gemini service. Verify GEMINI_API_KEY on the server.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Main Conversational Workspace */}
      <div className="lg:col-span-8 bg-white border border-slate-200/90 rounded-xl flex flex-col min-h-[640px]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <GoogleServiceIcon service="gemini_ai" className="w-7 h-7" />
            <div>
              <h2 className="text-base font-bold text-[#101B3A]">CampusLytix AI</h2>
              <p className="text-xs text-slate-500">
                Grounded strictly in verified PostgreSQL analytics · AI interpretations labeled separately
              </p>
            </div>
          </div>
          <span className="text-xs text-slate-500 font-mono">gemini-4-hydrogen</span>
        </div>

        {/* Messages Stream */}
        <div className="flex-1 p-6 space-y-6 overflow-y-auto max-h-[540px]">
          {turns.length === 0 ? (
            <div className="py-10 max-w-xl mx-auto text-center">
              <div className="w-12 h-12 rounded-xl bg-[#F4F6FC] mx-auto flex items-center justify-center mb-4">
                <GoogleServiceIcon service="gemini_ai" className="w-7 h-7" />
              </div>
              <h3 className="text-lg font-bold text-[#101B3A]">
                Ask questions about campus club engagement
              </h3>
              <p className="mt-2 text-sm text-slate-600 leading-relaxed">
                Every response pulls aggregated statistics directly from the CampusLytix PostgreSQL analytics engine—never inventing student records or figures.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTED_QUESTIONS.slice(0, 4).map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendQuestion(q)}
                    className="text-left px-3.5 py-2 text-xs font-medium text-[#101B3A] bg-[#F4F6FC] hover:bg-[#E7EEFF] hover:text-[#315EF8] border border-slate-200/80 rounded-lg transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) =>
              turn.role === 'user' ? (
                <div key={turn.id} className="flex justify-end">
                  <div className="max-w-xl bg-[#101B3A] text-white rounded-xl px-4 py-3 text-sm">
                    <div>{turn.text}</div>
                    <div className="mt-1 text-[11px] text-slate-400 text-right font-mono">
                      {turn.timestamp}
                    </div>
                  </div>
                </div>
              ) : turn.error ? (
                <div
                  key={turn.id}
                  className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-900 flex items-start gap-3"
                >
                  <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-semibold">CampusLytix AI Service Unavailable</div>
                    <div className="mt-1 text-xs text-red-800">{turn.error}</div>
                  </div>
                </div>
              ) : (
                turn.structured && (
                  <div key={turn.id} className="space-y-4">
                    {/* Executive Answer */}
                    <div className="bg-[#F8FAFF] border border-slate-200 rounded-xl p-5">
                      <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
                        <span className="font-semibold text-[#315EF8]">CampusLytix AI Response</span>
                        <span className="font-mono">{turn.timestamp}</span>
                      </div>
                      <p className="text-sm text-[#101B3A] leading-relaxed font-medium">
                        {turn.structured.summary}
                      </p>

                      {/* Verified Database Metrics — Strictly Separated */}
                      {turn.structured.verifiedMetrics.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200/80">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#18B6A0] mb-3">
                            <Database className="w-3.5 h-3.5" />
                            <span>Verified Database Metrics (PostgreSQL)</span>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            {turn.structured.verifiedMetrics.map((m, idx) => (
                              <div
                                key={idx}
                                className="bg-white border border-slate-200/80 rounded-lg px-3.5 py-2.5"
                              >
                                <div className="text-[11px] text-slate-500">{m.label}</div>
                                <div className="text-base font-bold text-[#101B3A] font-mono tabular-nums mt-0.5">
                                  {m.value}
                                </div>
                                <div className="text-[11px] text-slate-500 mt-0.5">{m.context}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* AI-Generated Interpretation */}
                      <div className="mt-4 pt-4 border-t border-slate-200/80">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#7657E8] mb-1.5">
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>AI-Generated Interpretation</span>
                        </div>
                        <p className="text-xs text-slate-700 leading-relaxed">
                          {turn.structured.interpretation}
                        </p>
                      </div>

                      {/* Evidence-Based Recommendations */}
                      {turn.structured.recommendations.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-slate-200/80">
                          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#101B3A] mb-2">
                            <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
                            <span>Evidence-Based Administrative Recommendations</span>
                          </div>
                          <ul className="space-y-1.5 text-xs text-slate-700 list-disc pl-4">
                            {turn.structured.recommendations.map((rec, idx) => (
                              <li key={idx}>{rec}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div className="mt-3 pt-2.5 border-t border-slate-200/60 text-[11px] text-slate-500">
                        Data Scope: {turn.structured.dataScopeNote}
                      </div>
                    </div>
                  </div>
                )
              )
            )
          )}

          {loading && (
            <div className="bg-[#F8FAFF] border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
              Querying verified PostgreSQL analytics and generating structured interpretation...
            </div>
          )}
        </div>

        {/* Prompt Input */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendQuestion(input);
          }}
          className="p-4 border-t border-slate-100 flex items-center gap-2.5"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask CampusLytix AI about club rankings, department engagement, or attendance trends..."
            className="flex-1 h-10 px-4 text-sm bg-[#F4F6FC] border border-slate-200 rounded-lg focus:outline-none focus:border-[#315EF8]"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-10 px-4 text-xs font-semibold text-white bg-[#315EF8] hover:bg-[#254EDB] disabled:opacity-50 rounded-lg inline-flex items-center gap-2 whitespace-nowrap shrink-0"
          >
            <Send className="w-3.5 h-3.5" />
            Ask AI
          </button>
        </form>
      </div>

      {/* Prompt Library & Governance Sidebar */}
      <div className="lg:col-span-4 space-y-5">
        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#101B3A]">Suggested Executive Prompts</h3>
          <p className="text-xs text-slate-500 mt-1">
            Click any question to run a live grounded analysis
          </p>
          <div className="mt-4 space-y-2">
            {SUGGESTED_QUESTIONS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={loading}
                onClick={() => sendQuestion(q)}
                className="w-full text-left px-3.5 py-2.5 text-xs font-medium text-slate-700 bg-[#F4F6FC] hover:bg-[#E8EEFF] hover:text-[#315EF8] rounded-lg transition-colors"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-xl p-5">
          <h3 className="text-sm font-bold text-[#101B3A]">AI Grounding &amp; Privacy Policy</h3>
          <ul className="mt-3 space-y-2 text-xs text-slate-600 leading-relaxed">
            <li>• Only aggregated institutional metrics from PostgreSQL are sent to the Gemini API.</li>
            <li>• Individual student names and email addresses are never transmitted to the AI model.</li>
            <li>• Gemini credentials remain strictly server-side and are never exposed in browser code.</li>
            <li>• Verified database numbers are visually separated from AI recommendations.</li>
          </ul>
        </div>
      </div>
    </div>
  );
};
