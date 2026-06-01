const output = document.querySelector("#output");

const post = async (path, body = {}) => {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  return response.json();
};

const csv = (value) =>
  value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);

const actions = {
  dna: () =>
    post("/api/syllabus/dna", {
      syllabusText: document.querySelector("#syllabusText").value,
      examDate: document.querySelector("#examDate").value
    }),
  overlay: () =>
    post("/api/overlay/analyze", {
      title: document.querySelector("#overlayTitle").value,
      content: document.querySelector("#overlayContent").value
    }),
  graph: () =>
    post("/api/knowledge-graph/update", {
      mastered: csv(document.querySelector("#mastered").value),
      gaps: csv(document.querySelector("#gaps").value)
    }),
  lecture: () =>
    post("/api/lecture/intelligence", {
      lectureUrl: document.querySelector("#lectureUrl").value
    }),
  verify: () =>
    post("/api/misinformation/verify", {
      claim: document.querySelector("#claim").value
    }),
  countdown: () => post("/api/exam/countdown")
};

document.querySelectorAll("button[data-action]").forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.action;
    const result = await actions[action]();
    output.textContent = JSON.stringify(result, null, 2);
  });
});
