const { createHash } = require("node:crypto");

// Resume-derived scoring now consumes the validated ResumeFacts contract when
// available, so cached results from the prior parser-only model are not valid.
const SCORE_MODEL_VERSION = "deterministic-readiness-2.1";

const round2 = (value) =>
  Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;

const contributionId = ({ index, source, category, points }) =>
  `contribution-${createHash("sha256")
    .update(
      JSON.stringify({
        index,
        source,
        category: category || "uncategorized",
        points: round2(points)
      })
    )
    .digest("hex")
    .slice(0, 16)}`;

const signFor = (points) => {
  if (points > 0) return "positive";
  if (points < 0) return "negative";
  return "neutral";
};

const buildCategorySummaries = (contributions, categoryMaximums = {}) => {
  const summaries = new Map();

  contributions.forEach((contribution) => {
    const category = contribution.category || "uncategorized";

    if (!summaries.has(category)) {
      summaries.set(category, {
        category,
        earnedPoints: 0,
        maximumPoints:
          Number(categoryMaximums[category]) ||
          Number(contribution.maximum) ||
          null,
        contributionIds: []
      });
    }

    const summary = summaries.get(category);
    summary.earnedPoints += contribution.points;
    summary.contributionIds.push(contribution.id);

    if (
      summary.maximumPoints === null &&
      Number.isFinite(Number(contribution.maximum))
    ) {
      summary.maximumPoints = Number(contribution.maximum);
    }
  });

  return [...summaries.values()].map((summary) => ({
    ...summary,
    earnedPoints: round2(summary.earnedPoints),
    maximumPoints:
      summary.maximumPoints === null
        ? null
        : round2(summary.maximumPoints)
  }));
};

const adaptScoreBreakdownToLedger = (scoreBreakdown) => {
  if (
    !scoreBreakdown ||
    !Array.isArray(scoreBreakdown.contributions)
  ) {
    throw new TypeError(
      "A score breakdown with ordered contributions is required."
    );
  }

  const contributions = scoreBreakdown.contributions.map(
    (contribution, index) => {
      const source =
        typeof contribution.source === "string"
          ? contribution.source
          : `unknown.${index}`;

      const points = round2(contribution.points);
      const category = contribution.category || "uncategorized";

      return {
        ...contribution,
        id: contributionId({
          index,
          source,
          category,
          points
        }),
        index,
        source,
        category,
        points,
        sign: signFor(points)
      };
    }
  );

  const adjustedTotal = round2(
    contributions.reduce(
      (total, contribution) => total + contribution.points,
      0
    )
  );

  const positiveContributionIds = contributions
    .filter(({ sign }) => sign === "positive")
    .map(({ id }) => id);

  const negativeContributionIds = contributions
    .filter(({ sign }) => sign === "negative")
    .map(({ id }) => id);

  const neutralContributionIds = contributions
    .filter(({ sign }) => sign === "neutral")
    .map(({ id }) => id);

  return {
    modelVersion: SCORE_MODEL_VERSION,

    score: Number(scoreBreakdown.score) || 0,

    rawScore: round2(
      scoreBreakdown.rawScore ?? adjustedTotal
    ),

    adjustedTotal,

    targetDifficultyFactor: Number(
      scoreBreakdown.targetDifficultyFactor ?? 1
    ),

    categoryScores: scoreBreakdown.categoryScores || {},

    categoryMaximums: scoreBreakdown.categoryMaximums || {},

    categorySummaries: buildCategorySummaries(
      contributions,
      scoreBreakdown.categoryMaximums
    ),

    contributions,

    positiveContributionIds,

    negativeContributionIds,

    neutralContributionIds,

    strongestPositiveContributionIds: contributions
      .filter(({ points }) => points > 0)
      .sort((a, b) => b.points - a.points)
      .slice(0, 5)
      .map(({ id }) => id),

    strongestNegativeContributionIds: contributions
      .filter(({ points }) => points < 0)
      .sort((a, b) => a.points - b.points)
      .slice(0, 5)
      .map(({ id }) => id),

    boundingRule: {
      minimum: 0,
      maximum: 100,
      rounding: "nearest_integer"
    }
  };
};

module.exports = {
  SCORE_MODEL_VERSION,
  contributionId,
  adaptScoreBreakdownToLedger
};
