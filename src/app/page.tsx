"use client";

import { useState, useEffect } from "react";
import { compareContracts, Finding } from "@/lib/comparator";
import { parseOpenApiSchema } from "@/lib/openapiParser";

const SAMPLE_EXPECTED = JSON.stringify(
  {
    schema: "http://json-schema.org/draft-07/schema#",
    type: "object",
    required: ["userId", "name", "isActive"],
    properties: {
      userId: { type: "number" },
      name: { type: "string" },
      isActive: { type: "boolean" },
      role: { type: "string", enum: ["admin", "user", "guest"] }
    }
  },
  null,
  2
);

const SAMPLE_OBSERVED = JSON.stringify(
  {
    userId: 101,
    name: "Saniya",
    isActive: "yes",
    role: "superadmin",
    location: "Delhi"
  },
  null,
  2
);

const SAMPLE_OPENAPI_YAML = `openapi: 3.0.0
info:
  title: User API
  version: 1.0.0
components:
  schemas:
    UserProfile:
      type: object
      required:
        - userId
        - name
        - isActive
      properties:
        userId:
          type: number
        name:
          type: string
        isActive:
          type: boolean
        role:
          type: string
          enum: [admin, user, guest]`;

interface HistoryItem {
  id: string;
  timestamp: string;
  totalFindings: number;
  findings: Finding[];
}

export default function Home() {
  const [expected, setExpected] = useState(SAMPLE_EXPECTED);
  const [observed, setObserved] = useState(SAMPLE_OBSERVED);
  const [findings, setFindings] = useState<Finding[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);

  // Load history from localStorage on initial mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("schemasentry_history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  const handleCompare = () => {
    setError(null);
    try {
      const normalizedSchema = parseOpenApiSchema(expected);
      const schemaString = JSON.stringify(normalizedSchema);

      const results = compareContracts(schemaString, observed);
      setFindings(results);

      // Save to History
      const newHistoryItem: HistoryItem = {
        id: Date.now().toString(),
        timestamp: new Date().toLocaleTimeString(),
        totalFindings: results.length,
        findings: results
      };

      const updatedHistory = [newHistoryItem, ...history.slice(0, 9)]; // Keep last 10
      setHistory(updatedHistory);
      localStorage.setItem("schemasentry_history", JSON.stringify(updatedHistory));
    } catch (e: any) {
      setError(e.message || "An error occurred during comparison.");
      setFindings(null);
    }
  };

  const handleClearHistory = () => {
    setHistory([]);
    localStorage.removeItem("schemasentry_history");
  };

  const handleLoadOpenApiSample = () => {
    setExpected(SAMPLE_OPENAPI_YAML);
  };

  const handleExportMarkdown = () => {
    if (!findings) return;

    let markdown = `# 🛡️ SchemaSentry Audit Report\n\n`;
    markdown += `**Timestamp:** ${new Date().toLocaleString()}\n`;
    markdown += `**Total Findings:** ${findings.length}\n\n`;
    markdown += `--- \n\n`;

    findings.forEach((f, index) => {
      markdown += `### ${index + 1}. [${f.severity.toUpperCase()}] ${f.title}\n`;
      markdown += `- **Field:** \`\${f.field}\`\n`;
      markdown += `- **Explanation:** ${f.explanation}\n`;
      markdown += `- **Expected:** \`\${f.expected}\`\n`;
      markdown += `- **Observed:** \`\${f.observed}\`\n`;
      markdown += `- **Suggested Fix:** ${f.suggestedFix}\n\n`;
    });

    navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-12 font-sans">
      <header className="max-w-6xl mx-auto mb-8 flex justify-between items-center border-b border-slate-800 pb-4">
        <div>
          <h1 className="text-2xl font-bold text-blue-400">SchemaSentry</h1>
          <p className="text-sm text-slate-400">API Contract Drift Detector</p>
        </div>
        <span className="px-3 py-1 bg-blue-900/40 text-blue-300 text-xs rounded-full border border-blue-700/50">
          MVP v0.2
        </span>
      </header>

      <section className="max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-semibold text-slate-300">
              Expected Contract / Schema (JSON or OpenAPI YAML)
            </label>
            <button
              onClick={handleLoadOpenApiSample}
              className="text-xs text-blue-400 hover:underline"
            >
              Load OpenAPI YAML Spec
            </button>
          </div>
          <textarea
            value={expected}
            onChange={(e) => setExpected(e.target.value)}
            className="w-full h-72 bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <div>
          <label className="block text-sm font-semibold mb-2 text-slate-300">
            Observed API Response Payload (JSON)
          </label>
          <textarea
            value={observed}
            onChange={(e) => setObserved(e.target.value)}
            className="w-full h-72 bg-slate-900 border border-slate-800 rounded-lg p-4 font-mono text-xs text-amber-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </section>

      <div className="max-w-6xl mx-auto mb-8 flex justify-center">
        <button
          onClick={handleCompare}
          className="px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg transition-all"
        >
          Compare Contract Drift
        </button>
      </div>

      {error && (
        <div className="max-w-6xl mx-auto p-4 bg-red-950/60 border border-red-800 text-red-300 rounded-lg mb-8 text-sm">
          ⚠️ {error}
        </div>
      )}

      {/* History Log Section */}
      {history.length > 0 && (
        <section className="max-w-6xl mx-auto mb-10 bg-slate-900/60 border border-slate-800 rounded-lg p-4">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-sm font-semibold text-slate-300">📜 Recent Audit Logs (Local History)</h3>
            <button
              onClick={handleClearHistory}
              className="text-xs text-red-400 hover:underline"
            >
              Clear History
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto pb-2">
            {history.map((item, idx) => (
              <button
                key={item.id}
                onClick={() => setFindings(item.findings)}
                className={`px-3 py-2 rounded border text-xs font-mono shrink-0 text-left transition-all ${
                  item.totalFindings > 0
                    ? "bg-red-950/40 border-red-900/60 text-red-300 hover:bg-red-900/40"
                    : "bg-emerald-950/40 border-emerald-900/60 text-emerald-300 hover:bg-emerald-900/40"
                }`}
              >
                <div className="font-bold">Run #{history.length - idx} ({item.timestamp})</div>
                <div>{item.totalFindings} findings</div>
              </button>
            ))}
          </div>
        </section>
      )}

      {findings !== null && (
        <section className="max-w-6xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-slate-200">
              Audit Results ({findings.length} Drift Findings Detected)
            </h2>
            {findings.length > 0 && (
              <button
                onClick={handleExportMarkdown}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded border border-slate-700 transition-all"
              >
                {copied ? "📋 Copied Markdown Report!" : "📥 Copy Report (Markdown)"}
              </button>
            )}
          </div>

          {findings.length === 0 ? (
            <div className="p-6 bg-emerald-950/30 border border-emerald-800 text-emerald-300 rounded-lg text-sm">
              ✅ <strong>No Contract Drift Detected:</strong> Observed response matches expected contract perfectly.
            </div>
          ) : (
            <div className="space-y-4">
              {findings.map((finding) => (
                <div
                  key={finding.id}
                  className={`p-5 rounded-lg border ${
                    finding.severity === "breaking"
                      ? "bg-red-950/30 border-red-800/80"
                      : "bg-amber-950/30 border-amber-800/80"
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-slate-100">{finding.title}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-mono uppercase ${
                        finding.severity === "breaking"
                          ? "bg-red-900 text-red-200"
                          : "bg-amber-900 text-amber-200"
                      }`}
                    >
                      {finding.severity.replace("_", " ")}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mb-3">Field: {finding.field}</p>
                  <p className="text-sm text-slate-300 mb-3">{finding.explanation}</p>
                  <div className="grid grid-cols-2 gap-4 text-xs font-mono bg-slate-900 p-3 rounded mb-3 border border-slate-800">
                    <div>
                      <span className="text-slate-500 block">Expected:</span>
                      <span className="text-green-400">{finding.expected}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 block">Observed:</span>
                      <span className="text-red-400">{finding.observed}</span>
                    </div>
                  </div>
                  <p className="text-xs text-blue-300">💡 <strong>Suggested Fix:</strong> {finding.suggestedFix}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  );
}