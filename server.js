import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(process.cwd(), "public");
const STATIC_FILES = {
  "/": "index.html",
  "/index.html": "index.html",
  "/styles.css": "styles.css",
  "/app.js": "app.js"
};
const MAX_MATCHED_TOPICS = 3;
const MAX_UNTOUCHED_TOPICS = 4;
const VERIFIED_MIN_WORDS = 6;
const VERIFIED_MIN_SIGNALS = 2;
const VERIFIED_CONFIDENCE = 0.84; // stronger claim signal match (VERIFIED_MIN_WORDS + VERIFIED_MIN_SIGNALS)
const NEEDS_REVIEW_CONFIDENCE = 0.45; // weak claim signal match; requires manual verification

const state = {
  syllabusFingerprint: {
    topics: [],
    uploadedAt: null,
    examDate: null
  },
  knowledgeGraph: {
    mastered: [],
    gaps: []
  }
};

const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};

const parseBody = async (req) => {
  let raw = "";
  for await (const chunk of req) raw += chunk;
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const extractTopics = (syllabusText = "") =>
  syllabusText
    .split(/\n|,|;|\./)
    .map((topic) => topic.trim())
    .filter(Boolean)
    .slice(0, 25)
    .map((topic, index) => ({
      topic,
      examWeight: Math.max(5, 30 - index)
    }));

const countContradictionSignals = (content = "") => {
  const matches = content.match(/\b(contradict|incorrect|false|myth|not|never)\b/gi);
  return matches ? matches.length : 0;
};

const claimVerificationScore = (claim = "") => {
  const wordCount = claim.trim().split(/\s+/).filter(Boolean).length;
  const signals = [
    /\baccording to\b/i,
    /\bstudy\b/i,
    /\bdata\b/i,
    /\b(evidence|measured|observed)\b/i,
    /\b\d+([.,]\d+)?\b/
  ];
  const matchedSignals = signals.reduce((count, pattern) => count + Number(pattern.test(claim)), 0);
  return { wordCount, matchedSignals };
};

const routes = {
  "GET /api/health": async (_req, res) => {
    json(res, 200, { status: "ok", service: "ScholarWeb API" });
  },
  "POST /api/syllabus/dna": async (req, res) => {
    const body = await parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid JSON body" });

    const topics = extractTopics(body.syllabusText || "");
    state.syllabusFingerprint = {
      topics,
      uploadedAt: new Date().toISOString(),
      examDate: body.examDate || null
    };

    json(res, 200, {
      message: "Syllabus DNA extracted",
      fingerprint: state.syllabusFingerprint
    });
  },
  "POST /api/overlay/analyze": async (req, res) => {
    const body = await parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid JSON body" });

    const title = (body.title || "").toLowerCase();
    const content = (body.content || "").toLowerCase();
    const query = `${title} ${content}`;
    const relevantTopics = state.syllabusFingerprint.topics
      .filter(({ topic }) => query.includes(topic.toLowerCase()))
      .slice(0, MAX_MATCHED_TOPICS);
    const contradictions = relevantTopics.length ? countContradictionSignals(content) : 0;

    json(res, 200, {
      relevantTopics,
      contradictions,
      noteSuggestion: relevantTopics.length
        ? "High-signal page. Add summary to notes."
        : "Low relevance. Continue browsing."
    });
  },
  "POST /api/knowledge-graph/update": async (req, res) => {
    const body = await parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid JSON body" });

    const mastered = body.mastered || [];
    const gaps = body.gaps || [];
    state.knowledgeGraph = { mastered, gaps };
    json(res, 200, { message: "Knowledge graph updated", graph: state.knowledgeGraph });
  },
  "POST /api/lecture/intelligence": async (req, res) => {
    const body = await parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid JSON body" });

    const matchedTopics = state.syllabusFingerprint.topics.slice(0, MAX_MATCHED_TOPICS);
    const totalTopics = state.syllabusFingerprint.topics.length;
    const syllabusCoveragePercent = totalTopics
      ? Math.min(100, Math.round((matchedTopics.length / totalTopics) * 100))
      : 0;
    json(res, 200, {
      lectureUrl: body.lectureUrl || "",
      summary: "Core concepts explained with examples and problem-solving patterns.",
      predictedQuestions: matchedTopics.map(({ topic }) => `Explain ${topic} with an exam-style derivation.`),
      syllabusCoveragePercent
    });
  },
  "POST /api/misinformation/verify": async (req, res) => {
    const body = await parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid JSON body" });

    const claim = (body.claim || "").trim();
    const { wordCount, matchedSignals } = claimVerificationScore(claim);
    const verified = wordCount >= VERIFIED_MIN_WORDS && matchedSignals >= VERIFIED_MIN_SIGNALS;
    json(res, 200, {
      claim,
      verdict: verified ? "verified" : "needs-review",
      confidence: verified ? VERIFIED_CONFIDENCE : NEEDS_REVIEW_CONFIDENCE,
      sourcesChecked: 3,
      sourceCheckMode: "simulated"
    });
  },
  "POST /api/exam/countdown": async (req, res) => {
    const body = await parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid JSON body" });

    const examDate = new Date(body.examDate || state.syllabusFingerprint.examDate || Date.now());
    const diffMs = examDate.getTime() - Date.now();
    const daysLeft = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));

    const untouchedTopics = state.syllabusFingerprint.topics
      .filter(({ topic }) => !state.knowledgeGraph.mastered.includes(topic))
      .slice(0, MAX_UNTOUCHED_TOPICS);

    json(res, 200, {
      examDate: examDate.toISOString(),
      daysLeft,
      untouchedTopics,
      recommendation: untouchedTopics.length
        ? `Prioritize ${untouchedTopics[0].topic} today.`
        : "Great pace. Shift to revision and PYQs."
    });
  }
};

const getMime = (path) => {
  const ext = extname(path);
  return (
    {
      ".html": "text/html; charset=utf-8",
      ".css": "text/css; charset=utf-8",
      ".js": "application/javascript; charset=utf-8",
      ".json": "application/json; charset=utf-8"
    }[ext] || "text/plain; charset=utf-8"
  );
};

const createApp = () =>
  createServer(async (req, res) => {
    const key = `${req.method} ${req.url}`;
    if (Object.hasOwn(routes, key)) {
      const routeHandler = routes[key];
      if (typeof routeHandler === "function") {
        return routeHandler(req, res);
      }
    }

    const path = STATIC_FILES[req.url];
    if (!path) return json(res, 404, { error: "Not found" });
    try {
      const file = await readFile(join(PUBLIC_DIR, path));
      res.writeHead(200, { "Content-Type": getMime(path) });
      res.end(file);
    } catch {
      json(res, 404, { error: "Not found" });
    }
  });

if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  createApp().listen(PORT, () => {
    console.log(`ScholarWeb running on http://localhost:${PORT}`);
  });
}

export { createApp, extractTopics };
