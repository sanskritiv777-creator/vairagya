/**
 * Merchant → category classification.
 *
 * Categories are derived at read time from the counterparty / label text, so
 * no database migration is needed and re-classification improves instantly as
 * the keyword table grows. Anything unmatched falls back to a direction-aware
 * default (credit → Transfers, debit → Other).
 */
import {
  UtensilsCrossed, ShoppingBag, Plane, ReceiptText, Fuel, Pill, Clapperboard,
  Landmark, Briefcase, ArrowLeftRight, TrendingUp, CircleDollarSign,
  type LucideIcon,
} from "lucide-react";

export type CategoryKey =
  | "food" | "shopping" | "travel" | "bills" | "fuel" | "medicine"
  | "entertainment" | "salary" | "client" | "transfers" | "investments" | "other";

export type CategoryMeta = {
  key: CategoryKey;
  label: string;
  icon: LucideIcon;
  /** Tailwind-free explicit colors so cards stay on the purple palette. */
  color: string;
  tint: string;
};

export const CATEGORIES: Record<CategoryKey, CategoryMeta> = {
  food:          { key: "food",          label: "Food",            icon: UtensilsCrossed,   color: "#FDBA74", tint: "rgba(253,186,116,0.14)" },
  shopping:      { key: "shopping",      label: "Shopping",        icon: ShoppingBag,       color: "#F0ABFC", tint: "rgba(240,171,252,0.14)" },
  travel:        { key: "travel",        label: "Travel",          icon: Plane,             color: "#7DD3FC", tint: "rgba(125,211,252,0.14)" },
  bills:         { key: "bills",         label: "Bills",           icon: ReceiptText,       color: "#C4B5FD", tint: "rgba(196,181,253,0.14)" },
  fuel:          { key: "fuel",          label: "Fuel",            icon: Fuel,              color: "#FCA5A5", tint: "rgba(252,165,165,0.14)" },
  medicine:      { key: "medicine",      label: "Medicine",        icon: Pill,              color: "#6EE7B7", tint: "rgba(110,231,183,0.14)" },
  entertainment: { key: "entertainment", label: "Entertainment",   icon: Clapperboard,      color: "#F9A8D4", tint: "rgba(249,168,212,0.14)" },
  salary:        { key: "salary",        label: "Salary",          icon: Landmark,          color: "#34D399", tint: "rgba(52,211,153,0.14)" },
  client:        { key: "client",        label: "Client Payments", icon: Briefcase,         color: "#5EEAD4", tint: "rgba(94,234,212,0.14)" },
  transfers:     { key: "transfers",     label: "Transfers",       icon: ArrowLeftRight,    color: "#A5B4FC", tint: "rgba(165,180,252,0.14)" },
  investments:   { key: "investments",   label: "Investments",     icon: TrendingUp,        color: "#93C5FD", tint: "rgba(147,197,253,0.14)" },
  other:         { key: "other",         label: "Other",           icon: CircleDollarSign,  color: "#DDD6FE", tint: "rgba(221,214,254,0.12)" },
};

export const CATEGORY_ORDER: CategoryKey[] = [
  "food", "shopping", "travel", "bills", "fuel", "medicine", "entertainment",
  "salary", "client", "transfers", "investments", "other",
];

const RULES: { key: CategoryKey; re: RegExp }[] = [
  { key: "food", re: /\b(zomato|swiggy|dominos|domino'?s|pizza|mcdonald|kfc|burger|restaurant|cafe|coffee|starbucks|chai|dhaba|hotel\s|biryani|bakery|food|dineout|eatsure|faasos|behrouz|blinkit|zepto|instamart|bigbasket|licious|grocer|kirana|supermarket|dmart|reliance fresh)\b/i },
  { key: "fuel", re: /\b(fuel|petrol|diesel|hp\s?pay|hpcl|iocl|bpcl|indian ?oil|bharat ?petro|shell|nayara|jio-?bp|gas station|cng|pump)\b/i },
  { key: "travel", re: /\b(uber|ola|rapido|irctc|railway|indigo|air ?india|spicejet|vistara|akasa|makemytrip|goibibo|yatra|redbus|abhibus|cleartrip|ixigo|metro|dmrc|bmtc|toll|fastag|parking|oyo|airbnb|travel|flight|namma yatri)\b/i },
  { key: "bills", re: /\b(electricity|bescom|mseb|tneb|kseb|bses|adani electricity|torrent power|water bill|gas bill|broadband|airtel|jio|vi |vodafone|bsnl|act ?fibernet|hathway|dth|tata ?play|recharge|postpaid|prepaid|bill ?pay|bbps|insurance|premium|lic |rent|maintenance|emi|loan repay|credit card ?(?:bill|payment))\b/i },
  { key: "medicine", re: /\b(pharmacy|pharma|medical|medicine|apollo|1mg|pharmeasy|netmeds|wellness ?forever|medplus|hospital|clinic|diagnostic|lab|dr\.?\s|doctor|practo)\b/i },
  { key: "entertainment", re: /\b(netflix|prime ?video|hotstar|disney|spotify|gaana|wynk|youtube ?premium|jiocinema|sonyliv|zee5|bookmyshow|pvr|inox|cinepolis|cinema|movie|game|steam|playstation|xbox|dream11|rummy)\b/i },
  { key: "shopping", re: /\b(amazon|flipkart|myntra|ajio|meesho|nykaa|snapdeal|tatacliq|croma|reliance digital|decathlon|ikea|lenskart|firstcry|purplle|shop|store|mart|retail|fashion|apparel|electronics|boat|apple ?store)\b/i },
  { key: "investments", re: /\b(zerodha|groww|upstox|angel ?one|kite|coin|mutual ?fund|sip |nps |ppf|elss|smallcase|indmoney|kuvera|paytm ?money|dhan|icici ?direct|hdfc ?securities|gold ?bond|sgb|stock|equity|demat|binance|coindcx|wazirx)\b/i },
  { key: "salary", re: /\b(salary|sal cr|payroll|wages|stipend|pension|monthly pay)\b/i },
  { key: "client", re: /\b(invoice|client|consult|freelanc|retainer|upwork|fiverr|toptal|contract|project payment|professional fee|honorarium)\b/i },
  { key: "transfers", re: /\b(self|own account|neft|imps|rtgs|transfer|xfer|to ?wallet|add ?money|atm|cash ?(?:withdrawal|dep)|refund|reversal|cashback)\b/i },
];

export function categorize(text: string, direction: "credit" | "debit"): CategoryMeta {
  const hay = (text ?? "").toLowerCase();
  for (const r of RULES) {
    if (!r.re.test(hay)) continue;
    // A credit that matched a spending rule is far more likely a refund/transfer.
    if (direction === "credit" && !["salary", "client", "transfers", "investments"].includes(r.key)) {
      return CATEGORIES.transfers;
    }
    if (direction === "debit" && (r.key === "salary" || r.key === "client")) {
      return CATEGORIES.other;
    }
    return CATEGORIES[r.key];
  }
  return direction === "credit" ? CATEGORIES.client : CATEGORIES.other;
}

/** Human-friendly merchant name from a raw counterparty / UPI handle. */
export function prettyMerchant(raw: string): string {
  const base = (raw ?? "").trim();
  if (!base) return "Unknown";
  const local = base.includes("@") ? base.split("@")[0] : base;
  const cleaned = local
    .replace(/[._-]+/g, " ")
    .replace(/\b(?:pvt|ltd|limited|india|technologies|tech|services|pay|upi|bank)\b/gi, " ")
    .replace(/\d{4,}/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const final = cleaned || local;
  return final
    .split(" ")
    .map((w) => (w.length > 3 ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toUpperCase()))
    .join(" ")
    .slice(0, 32);
}
