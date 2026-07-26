const {
  validatePresentationSafeGeminiOutput,
} = require("../../contracts/presentationSafeGemini.v1");

const numberTokens = (value) =>
  String(value || "").match(/\b\d+(?:\.\d+)?\b/g) || [];

const collectApprovedNumbers = (input) =>
  new Set(numberTokens(JSON.stringify(input)));

const outputTexts = (output) =>
  [
    output?.diagnosis,
    ...(output?.strengths || []).map(({ text }) => text),
    ...(output?.scoreBlockers || []).map(({ text }) => text),
    ...(output?.careerRisks || []).map(({ text }) => text),
    output?.priority?.text,
  ].filter((value) => typeof value === "string");

const INTERNAL_LANGUAGE =
  /\b(?:verified evidence(?: supports)?|meaningful placement strength|preparation runway|professional-context evidence|assessed foundations|employability consideration|score contribution|capability family|reasoning dimension|confidence aggregation)\b/i;

const sentenceCount = (value) =>
  (String(value || "").match(/[.!?](?:\s|$)/g) || []).length;

const wordCount = (value) =>
  String(value || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;

const normalize = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9+#.]+/g, " ")
    .trim();

const asArray = (value) => {
  if (Array.isArray(value)) {
    return value;
  }

  if (value && typeof value === "object") {
    return [value];
  }

  return [];
};

const evidenceInsights = (input) => [
  ...(input?.strengths || []),
  ...(input?.scoreBlockers || []),
  ...(input?.careerRisks || []),
  ...(input?.priority ? [input.priority] : []),
];

/**
 * Supports both:
 * - the current DTO shape using `facts`
 * - the older DTO shape using `evidence`
 */
const safeEvidence = (input) =>
  evidenceInsights(input).flatMap((insight) => [
    ...asArray(insight?.facts),
    ...asArray(insight?.evidence),
  ]);

const walkObjects = (value, visitor, seen = new WeakSet()) => {
  if (!value || typeof value !== "object") {
    return;
  }

  if (seen.has(value)) {
    return;
  }

  seen.add(value);

  if (!Array.isArray(value)) {
    visitor(value);
  }

  Object.values(value).forEach((child) => {
    if (child && typeof child === "object") {
      walkObjects(child, visitor, seen);
    }
  });
};

const addNormalizedString = (set, value) => {
  if (typeof value !== "string") {
    return;
  }

  const normalized = normalize(value);

  if (normalized) {
    set.add(normalized);
  }
};

const addStringCollection = (set, value) => {
  if (typeof value === "string") {
    addNormalizedString(set, value);
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => {
      if (typeof item === "string") {
        addNormalizedString(set, item);
      } else if (item && typeof item === "object") {
        addNormalizedString(set, item.name);
        addNormalizedString(set, item.value);
        addNormalizedString(set, item.label);
      }
    });
  }
};

const approvedProjectNames = (input) => {
  const projects = new Set();
  const roots = safeEvidence(input);

  walkObjects(roots, (object) => {
    addNormalizedString(projects, object.projectName);
    addNormalizedString(projects, object.project_name);

    if (object.project && typeof object.project === "object") {
      addNormalizedString(projects, object.project.name);
      addNormalizedString(projects, object.project.projectName);
    }

    asArray(object.projectExamples).forEach((project) => {
      addNormalizedString(projects, project?.name);
      addNormalizedString(projects, project?.projectName);
    });

    asArray(object.projects).forEach((project) => {
      addNormalizedString(projects, project?.name);
      addNormalizedString(projects, project?.projectName);
    });

    const type = normalize(
      object.type || object.kind || object.category || object.factType
    );

    const hasProjectIndicators =
      type.includes("project") ||
      object.technologies ||
      object.techStack ||
      object.capabilities ||
      object.deployed !== undefined ||
      object.deployment !== undefined;

    if (hasProjectIndicators) {
      addNormalizedString(projects, object.name);
      addNormalizedString(projects, object.title);
    }
  });

  return projects;
};

const approvedTechnologies = (input) => {
  const technologies = new Set();
  const roots = safeEvidence(input);

  walkObjects(roots, (object) => {
    addStringCollection(technologies, object.technologies);
    addStringCollection(technologies, object.technology);
    addStringCollection(technologies, object.techStack);
    addStringCollection(technologies, object.tech_stack);
    addStringCollection(technologies, object.frameworks);
    addStringCollection(technologies, object.tools);

    asArray(object.projectExamples).forEach((project) => {
      addStringCollection(technologies, project?.technologies);
      addStringCollection(technologies, project?.techStack);
      addStringCollection(technologies, project?.tools);
      addStringCollection(technologies, project?.frameworks);
    });
  });

  return technologies;
};

const normalizeSkillName = (value) => {
  const normalized = normalize(value);

  const aliases = {
    "operating system": "os",
    "operating systems": "os",
    "computer network": "networks",
    "computer networks": "networks",
    network: "networks",
  };

  return aliases[normalized] || normalized;
};

const approvedSkillPairs = (input) => {
  const pairs = new Set();
  const roots = safeEvidence(input);

  walkObjects(roots, (object) => {
    const skill =
      object.skill ||
      object.skillName ||
      object.skill_name ||
      object.subject ||
      object.area;

    const level =
      object.level ||
      object.skillLevel ||
      object.skill_level ||
      object.proficiency;

    if (skill && level) {
      pairs.add(
        `${normalizeSkillName(skill)}:${normalize(level)}`
      );
    }

    asArray(object.skillFacts).forEach((fact) => {
      const factSkill =
        fact?.skill ||
        fact?.skillName ||
        fact?.subject ||
        fact?.area;

      const factLevel =
        fact?.level ||
        fact?.skillLevel ||
        fact?.proficiency;

      if (factSkill && factLevel) {
        pairs.add(
          `${normalizeSkillName(factSkill)}:${normalize(factLevel)}`
        );
      }
    });
  });

  return pairs;
};

const claimProjectNames = (text) =>
  [
    ...String(text || "").matchAll(
      /\b([A-Z][A-Za-z0-9+#.-]*(?:\s+[A-Z][A-Za-z0-9+#.-]*){0,4})\s+(?:[Pp]roject|[Aa]pplication|[Pp]latform|[Ww]ebsite|[Ss]ervice)\b/g
    ),
  ]
    .map((match) => normalize(match[1]))
    .filter(
      (name) =>
        ![
          "your",
          "the",
          "this",
          "a",
          "an",
          "full stack",
          "frontend",
          "backend",
          "machine learning",
        ].includes(name)
    );

const claimTechnologyAfterMarker = (text) =>
  [
    ...String(text || "").matchAll(
      /\b(?:using|built with|implemented with|developed with|through)\s+([A-Z][A-Za-z0-9+#.-]{1,30})\b/g
    ),
  ].map((match) => normalize(match[1]));

const collectFactObjects = (input) => {
  const facts = [];

  walkObjects(safeEvidence(input), (object) => {
    facts.push(object);
  });

  return facts;
};

const validateGeminiGrounding = (output, input) => {
  const contract = validatePresentationSafeGeminiOutput(output, input);
  const errors = [...contract.errors];
  const approvedNumbers = collectApprovedNumbers(input);

  if (typeof output?.diagnosis === "string") {
    const sentences = sentenceCount(output.diagnosis);
    const words = wordCount(output.diagnosis);

    if (sentences < 3 || sentences > 7) {
      errors.push(
        "diagnosis must contain between three and seven complete sentences"
      );
    }

    if (words < 45 || words > 190) {
      errors.push(
        "diagnosis must contain between 45 and 190 words"
      );
    }
  }

  const projects = approvedProjectNames(input);
  const technologies = approvedTechnologies(input);
  const skills = approvedSkillPairs(input);

  outputTexts(output).forEach((value, index) => {
    if (INTERNAL_LANGUAGE.test(value)) {
      errors.push(
        `output text ${index} contains internal analytics language`
      );
    }

    numberTokens(value).forEach((number) => {
      if (!approvedNumbers.has(number)) {
        errors.push(
          `output text ${index} contains unapproved numeric claim ${number}`
        );
      }
    });

    claimProjectNames(value).forEach((name) => {
      const isApproved = [...projects].some(
        (approved) =>
          approved === name ||
          approved.startsWith(`${name} `) ||
          name.startsWith(`${approved} `)
      );

      if (!isApproved) {
        errors.push(
          `output text ${index} contains unapproved project name ${name}`
        );
      }
    });

    claimTechnologyAfterMarker(value).forEach((technology) => {
      if (!technologies.has(technology)) {
        errors.push(
          `output text ${index} contains unapproved technology ${technology}`
        );
      }
    });

    [
      ...String(value).matchAll(
        /\b(beginner|intermediate|advanced|weak|average|strong)\s+(?:level\s+)?(dsa|dbms|operating systems?|os|computer networks?|networks?|aptitude|communication)\b/gi
      ),
    ].forEach((match) => {
      const skill = normalizeSkillName(match[2]);
      const level = normalize(match[1]);

      if (!skills.has(`${skill}:${level}`)) {
        errors.push(
          `output text ${index} contains unapproved skill-level claim`
        );
      }
    });
  });

  const combined = normalize(outputTexts(output).join(" "));
  const facts = collectFactObjects(input);

  const hasFact = (type) =>
    facts.some((fact) => {
      const normalizedType = normalize(type);
      const factTypes = [
        fact.type,
        fact.capability,
        fact.factType,
        fact.kind,
        fact.category,
      ].map(normalize).filter(Boolean);
      const evidenceTypes = Array.isArray(fact.evidenceTypes)
        ? fact.evidenceTypes.map(normalize)
        : [];

      if (!factTypes.includes(normalizedType) && !evidenceTypes.includes(normalizedType)) {
        return false;
      }

      const detail =
        fact.detail ??
        fact.value ??
        fact.exists ??
        fact.detected;

      return (
        detail === "detected" ||
        detail === true ||
        detail?.exists === true ||
        Boolean(detail)
      );
    });

  if (
    /\binternship\b/.test(combined) &&
    !hasFact("internship") &&
    !/\b(?:absence|without|no|limited|needs?|gain)\b/.test(combined)
  ) {
    errors.push("output contains unsupported internship claim");
  }

  if (
    /\bgithub\b|\bcode portfolio\b/.test(combined) &&
    !hasFact("code_portfolio") &&
    !/\b(?:absence|without|no|limited|needs?|gain|publish|build|complete|improve|add)\b/.test(combined)
  ) {
    errors.push("output contains unsupported GitHub claim");
  }

  if (
    /\bcertif(?:icate|ication|ied)\b/.test(combined) &&
    !hasFact("certification") &&
    !hasFact("certification_detail")
  ) {
    errors.push("output contains unsupported certification claim");
  }

  (output?.careerRisks || []).forEach(({ text }, index) => {
    const claimsScoreEffect =
      /\b(?:lower(?:s|ed)?|reduce[sd]?|decrease[sd]?|deduct(?:s|ed)?|costs?)\b[^.]{0,50}\b(?:score|readiness points?)\b|\b(?:score|readiness points?)\b[^.]{0,50}\b(?:lower(?:s|ed)?|reduce[sd]?|decrease[sd]?|deduct(?:s|ed)?)\b/i.test(
        text || ""
      );

    const explicitlyNegatesScoreEffect =
      /\b(?:does|did|will|would|can)\s+not\s+(?:lower|reduce|decrease|deduct|cost)\b/i.test(
        text || ""
      );

    if (claimsScoreEffect && !explicitlyNegatesScoreEffect) {
      errors.push(
        `careerRisks[${index}] must not claim current score causality`
      );
    }
  });

  return {
    valid: errors.length === 0,
    errors,
  };
};

module.exports = {
  validateGeminiGrounding,
};
