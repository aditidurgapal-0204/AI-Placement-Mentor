"use strict";

const studyStageFor = (year) => {
  const value = String(year || "").toLowerCase();
  if (/\b1(?:st)?\b|first/.test(value)) return "early_stage";
  if (/\b2(?:nd)?\b|second/.test(value)) return "foundation_building";
  if (/\b3(?:rd)?\b|third/.test(value)) return "placement_preparation";
  if (/\b4(?:th)?\b|fourth|final/.test(value)) return "placement_ready";
  return "unspecified";
};

module.exports = { studyStageFor };
