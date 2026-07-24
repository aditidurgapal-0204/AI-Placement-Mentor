const VERSION = "1.0";

const READINESS_LABELS = Object.freeze({
  affectsReadinessScore: false,
  bands: [
    { minimum: 0, key: "foundation", label: "Foundation" },
    { minimum: 25, key: "developing", label: "Developing" },
    { minimum: 50, key: "progressing", label: "Progressing" },
    { minimum: 70, key: "competitive", label: "Competitive" },
    { minimum: 85, key: "advanced", label: "Advanced" }
  ]
});

module.exports = { VERSION, READINESS_LABELS };
