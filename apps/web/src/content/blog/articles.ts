import { ARTICLE as CHOOSE_MEMBERSHIP_DURATION } from "./articles/choose-gym-membership-duration-buraidah";
import { ARTICLE as EXERCISE_PER_WEEK } from "./articles/how-much-exercise-per-week-who-guidelines";
import { ARTICLE as TRAINING_IN_RAMADAN } from "./articles/training-while-fasting-ramadan-guide";
import type { Article } from "./types";

/**
 * مقالات المدونة. كل مقال في مجلده تحت articles/ (النسختان والمراجع)، منقول حرفيًا من مسودته
 * المراجَعة. لا يُنشر إلا بمراجعة مدرب مسمّى (docs/BLOG.md)، وكل مقال يمر ببوابة النشر في
 * الاختبارات وعند تحميل الخادم.
 */
export const ARTICLES: readonly Article[] = [
  CHOOSE_MEMBERSHIP_DURATION,
  EXERCISE_PER_WEEK,
  TRAINING_IN_RAMADAN,
];
