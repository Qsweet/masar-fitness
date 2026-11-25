import { money } from "@masar/domain";
import { whatsappUrl } from "@/config/club";
import { FRIENDS_OFFER, SERVICES, type ServiceId, type ServiceOffer } from "@/config/services";
import { countText } from "@/i18n/count";
import type { Dictionary } from "@/i18n/dictionaries";
import { fill } from "@/i18n/fill";
import { formatMonths, moneyParts, type MoneyParts } from "@/i18n/format";
import type { Locale } from "@/i18n/locales";

export interface PackageView {
  readonly sessions: string;
  readonly price: MoneyParts;
}

/** بطاقة خدمة جاهزة للعرض: كل نص ورقم محسوب هنا على الخادم من config/services.ts والقاموس. */
export interface ServiceView {
  readonly id: ServiceId;
  readonly name: string;
  readonly line: string;
  readonly note: string;
  /** «من 6 إلى 24 جلسة» */
  readonly range: string;
  /** «من 720 ر.س»، غائب حين لا يُعرف أن أقل سعر هنا هو أقل سعر للخدمة (lowestConfirmed) */
  readonly from: string | undefined;
  readonly packages: readonly PackageView[];
  /** واتساب برسالة تسمّي الخدمة */
  readonly askHref: string;
}

function priceText(priceMinor: number, template: string, locale: Locale): string {
  const { amount, unit } = moneyParts(money(priceMinor), locale);
  return fill(template, { amount, unit });
}

function toServiceView(service: ServiceOffer, dictionary: Dictionary, locale: Locale): ServiceView {
  const { services } = dictionary;
  const copy = services.items[service.id];
  const forms = services.units[service.unit];
  const counts = service.packages.map((item) => item.sessions);
  const prices = service.packages.map((item) => item.priceMinor);
  return {
    id: service.id,
    name: copy.name,
    line: copy.line,
    note: copy.note,
    range: fill(services.range, {
      min: String(Math.min(...counts)),
      max: String(Math.max(...counts)),
      unit: forms.many,
    }),
    from: service.lowestConfirmed
      ? priceText(Math.min(...prices), services.from, locale)
      : undefined,
    packages: service.packages.map((item) => ({
      sessions: countText(item.sessions, forms),
      price: moneyParts(money(item.priceMinor), locale),
    })),
    askHref: whatsappUrl(fill(services.whatsappMessage, { service: copy.name })),
  };
}

export function serviceViews(dictionary: Dictionary, locale: Locale): ServiceView[] {
  return SERVICES.map((service) => toServiceView(service, dictionary, locale));
}

export interface FriendsView {
  readonly line: string;
  readonly price: MoneyParts;
  readonly perPerson: string;
  readonly href: string;
}

/** عرض الأصدقاء: المدة لكل شخص، والإجمالي، وحصة الشخص (الإجمالي ÷ العدد، مقرّبًا لأقرب هللة). */
export function friendsView(dictionary: Dictionary, locale: Locale): FriendsView {
  const { friends } = dictionary;
  const perPersonMinor = Math.round(FRIENDS_OFFER.priceMinor / FRIENDS_OFFER.people);
  return {
    line: fill(friends.line, {
      term: formatMonths(FRIENDS_OFFER.paidMonths, locale),
      bonus: formatMonths(FRIENDS_OFFER.bonusMonths, locale),
    }),
    price: moneyParts(money(FRIENDS_OFFER.priceMinor), locale),
    perPerson: priceText(perPersonMinor, friends.perPerson, locale),
    href: whatsappUrl(friends.whatsappMessage),
  };
}
