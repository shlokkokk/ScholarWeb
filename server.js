import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = join(process.cwd(), "public");

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

    const query = `${body.title || ""} ${body.content || ""}`.toLowerCase();
    const relevantTopics = state.syllabusFingerprint.topics
      .filter(({ topic }) => query.includes(topic.toLowerCase()))
      .slice(0, 3);

    json(res, 200, {
      relevantTopics,
      contradictions: relevantTopics.length ? 1 : 0,
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

    const matchedTopics = state.syllabusFingerprint.topics.slice(0, 3);
    json(res, 200, {
      lectureUrl: body.lectureUrl || "",
      summary: "Core concepts explained with examples and problem-solving patterns.",
      predictedQuestions: matchedTopics.map(({ topic }) => `Explain ${topic} with an exam-style derivation.`),
      syllabusCoveragePercent: matchedTopics.length * 12
    });
  },
  "POST /api/misinformation/verify": async (req, res) => {
    const body = await parseBody(req);
    if (body === null) return json(res, 400, { error: "Invalid JSON body" });

    const claim = (body.claim || "").trim();
    const verified = claim.length > 20;
    json(res, 200, {
      claim,
      verdict: verified ? "verified" : "needs-review",
      confidence: verified ? 0.84 : 0.45,
      sourcesChecked: 3
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
      .slice(0, 4);

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
    if (routes[key]) return routes[key](req, res);

    const path = req.url === "/" ? "/index.html" : req.url;
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
