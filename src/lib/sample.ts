import type { Expense } from "./netting";

export interface Person {
  id: string;
  name: string;
  initial: string;
  isYou?: boolean;
}

/**
 * The demo group. Amounts are in cents and were chosen so the equal split
 * lands on round pesos — a judge can redo the arithmetic on paper.
 *
 * Total 15,624.00 / 6 = 2,604.00 each.
 */
export const VALLE_DE_BRAVO = {
  id: "grp_8fa2",
  name: "Valle de Bravo",
  dates: "14 al 16 de febrero",

  people: [
    { id: "tu", name: "Tú", initial: "T", isYou: true },
    { id: "rosa", name: "Rosa", initial: "R" },
    { id: "mariana", name: "Mariana", initial: "M" },
    { id: "ana", name: "Ana", initial: "A" },
    { id: "diego", name: "Diego", initial: "D" },
    { id: "luis", name: "Luis", initial: "L" },
  ] as Person[],

  expenses: [
    {
      id: "e1",
      label: "Casa completa, 2 noches",
      payer: "rosa",
      cents: 464_400,
      among: ["tu", "rosa", "mariana", "ana", "diego", "luis"],
    },
    {
      id: "e2",
      label: "Cena y bar del sábado",
      payer: "mariana",
      cents: 371_400,
      among: ["tu", "rosa", "mariana", "ana", "diego", "luis"],
    },
    {
      id: "e3",
      label: "Súper y desayunos",
      payer: "ana",
      cents: 317_400,
      among: ["tu", "rosa", "mariana", "ana", "diego", "luis"],
    },
    {
      id: "e4",
      label: "Combustible ida y vuelta",
      payer: "luis",
      cents: 203_400,
      among: ["tu", "rosa", "mariana", "ana", "diego", "luis"],
    },
    {
      id: "e5",
      label: "Lancha en la presa",
      payer: "diego",
      cents: 149_400,
      among: ["tu", "rosa", "mariana", "ana", "diego", "luis"],
    },
    {
      id: "e6",
      label: "Casetas de la autopista",
      payer: "tu",
      cents: 56_400,
      among: ["tu", "rosa", "mariana", "ana", "diego", "luis"],
    },
  ] as Expense[],
};

export function personName(id: string): string {
  return VALLE_DE_BRAVO.people.find((p) => p.id === id)?.name ?? id;
}

export function personInitial(id: string): string {
  return VALLE_DE_BRAVO.people.find((p) => p.id === id)?.initial ?? id[0].toUpperCase();
}

/**
 * The trip is a Mexican trip, so its data is written in Spanish. In English
 * the person you play reads "You", the dates read in English and the sample
 * expenses get English labels — at render time only: what is sent to the
 * engine stays byte-for-byte the same, so switching language never buys the
 * same plan twice.
 */
export function tripPeople(locale: "en" | "es"): Person[] {
  if (locale === "es") return VALLE_DE_BRAVO.people;
  return VALLE_DE_BRAVO.people.map((p) => (p.isYou ? { ...p, name: "You", initial: "Y" } : p));
}

export function tripDates(locale: "en" | "es"): string {
  return locale === "es" ? VALLE_DE_BRAVO.dates : "February 14–16";
}

const LABELS_EN: Record<string, string> = {
  "Casa completa, 2 noches": "Whole house, 2 nights",
  "Cena y bar del sábado": "Saturday dinner and bar",
  "Súper y desayunos": "Groceries and breakfasts",
  "Combustible ida y vuelta": "Fuel, there and back",
  "Lancha en la presa": "Boat on the lake",
  "Casetas de la autopista": "Highway tolls",
};

export function expenseLabel(label: string, locale: "en" | "es"): string {
  return locale === "es" ? label : (LABELS_EN[label] ?? label);
}
