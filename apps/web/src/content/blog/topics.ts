import type { Dictionary } from "@/i18n/dictionaries";

/**
 * موضوعات المدونة بترتيب عرضها في الفهرس (PRODUCT_SPEC §7): قرار الاشتراك أولًا،
 * ثم التمرين والاستشفاء والتغذية. اسم كل موضوع ووصفه في القاموس (blog.topics).
 */
export const TOPIC_IDS = ["choosing", "training", "recovery", "nutrition"] as const;
export type TopicId = (typeof TOPIC_IDS)[number];

export function topicText(dictionary: Dictionary, topic: TopicId): { label: string; lead: string } {
  return dictionary.blog.topics[topic];
}
