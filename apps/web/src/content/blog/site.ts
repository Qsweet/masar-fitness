import { STATIC_PATHS } from "@/config/routes";
import { ARTICLES } from "./articles";
import { REVIEWERS } from "./reviewers";
import type { ValidationContext } from "./validate";

/** سياق التحقق للموقع الحقيقي: المراجعون المسجَّلون ومسارات الموقع الثابتة. */
export const SITE_VALIDATION_CONTEXT: ValidationContext = {
  reviewers: REVIEWERS,
  staticPaths: STATIC_PATHS,
};

export { ARTICLES, REVIEWERS };
