/**
 * مسارات الموقع الثابتة بلا بادئة لغة. المصدر الواحد للروابط الداخلية في المحتوى:
 * رابط داخلي في مقال يجب أن يكون أحد هذه أو مقالًا في المدونة (انظر content/blog/validate.ts).
 * صفحات الاشتراكات الفردية ليست هنا عمدًا: معرّفاتها من القاعدة وقد تتغير، والمقال يوصي بها عبر مكوّن التوصية.
 */
export const ROUTES = {
  home: "/",
  memberships: "/memberships",
  blog: "/blog",
  costPerVisit: "/tools/cost-per-visit",
} as const;

export const STATIC_PATHS: readonly string[] = Object.values(ROUTES);

export function articlePath(slug: string): string {
  return `${ROUTES.blog}/${slug}`;
}

export function planPath(slug: string): string {
  return `${ROUTES.memberships}/${slug}`;
}

/** السلة: خلف علم الشراء وغير مفهرسة، فليست في ROUTES (خريطة الموقع وروابط المحتوى). */
export const CART_PATH = "/cart";
