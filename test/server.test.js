import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { createApp, extractTopics } from "../server.js";

test("extractTopics builds weighted topic list", () => {
  const result = extractTopics("Kinematics\nThermodynamics\nElectrostatics");
  assert.equal(result.length, 3);
  assert.equal(result[0].topic, "Kinematics");
  assert.equal(result[0].examWeight, 30);
  assert.ok(result[0].examWeight >= result[1].examWeight);
});

test("syllabus dna and countdown endpoints respond", async () => {
  const app = createApp();
  app.listen(0);
  await once(app, "listening");

  const { port } = app.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const dnaRes = await fetch(`${baseUrl}/api/syllabus/dna`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ syllabusText: "Kinematics, Thermodynamics" })
  });
  assert.equal(dnaRes.status, 200);

  const countdownRes = await fetch(`${baseUrl}/api/exam/countdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ examDate: "2099-01-01" })
  });
  assert.equal(countdownRes.status, 200);
  const payload = await countdownRes.json();
  assert.ok(payload.daysLeft > 0);

  app.close();
});

test("countdown floors negative days at zero", async () => {
  const app = createApp();
  app.listen(0);
  await once(app, "listening");

  const { port } = app.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const countdownRes = await fetch(`${baseUrl}/api/exam/countdown`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ examDate: "2000-01-01" })
  });
  assert.equal(countdownRes.status, 200);
  const payload = await countdownRes.json();
  assert.equal(payload.daysLeft, 0);

  app.close();
});
