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
