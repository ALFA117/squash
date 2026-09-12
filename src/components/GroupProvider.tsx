"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { VALLE_DE_BRAVO, Person } from "@/lib/sample";
import { Expense } from "@/lib/netting";

/**
 * The sample trip, kept in this browser.
 *
 * The six people are fixed: each one is a funded testnet account, so the
 * settlement can actually move money between them. Expenses can be added, and
 * they persist here. Whatever is read back from storage is checked first —
 * an older version of the app let people be renamed or invented, and one
 * stale entry with no account behind it would make the settlement fail at
 * the last step. Anything that does not fit the trip is dropped.
 */

interface GroupContextType {
  name: string;
  dates: string;
  people: Person[];
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, "id">) => void;
  resetGroup: () => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

const KEY = "squash-trip-expenses";
const PEOPLE = new Set(VALLE_DE_BRAVO.people.map((p) => p.id));

function validExpense(e: unknown): e is Expense {
  const x = e as Expense;
  return (
    !!x &&
    typeof x.id === "string" &&
    typeof x.label === "string" &&
    PEOPLE.has(x.payer) &&
    Number.isSafeInteger(x.cents) &&
    x.cents > 0 &&
    x.cents <= 10_000_000 &&
    Array.isArray(x.among) &&
    x.among.length > 0 &&
    x.among.every((id) => PEOPLE.has(id))
  );
}

function load(): Expense[] {
  try {
    // Leftovers from earlier versions of the demo, which could hold people
    // with no account. Clear them so they cannot come back.
    for (const old of ["squash-people", "squash-expenses", "squash-confirmed"]) localStorage.removeItem(old);
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null");
    if (Array.isArray(saved) && saved.length > 0 && saved.length <= 50 && saved.every(validExpense)) return saved;
  } catch {
    // unreadable storage: start from the trip as it is
  }
  return VALLE_DE_BRAVO.expenses;
}

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [expenses, setExpenses] = useState<Expense[]>(VALLE_DE_BRAVO.expenses);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setExpenses(load());
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(KEY, JSON.stringify(expenses));
    } catch {
      // private mode: the trip still works, it just is not remembered
    }
  }, [expenses, loaded]);

  const addExpense = useCallback((e: Omit<Expense, "id">) => {
    setExpenses((current) => (current.length >= 50 ? current : [...current, { ...e, id: `e${Date.now()}` }]));
  }, []);

  const resetGroup = useCallback(() => setExpenses(VALLE_DE_BRAVO.expenses), []);

  return (
    <GroupContext.Provider
      value={{
        name: VALLE_DE_BRAVO.name,
        dates: VALLE_DE_BRAVO.dates,
        people: VALLE_DE_BRAVO.people,
        expenses,
        addExpense,
        resetGroup,
      }}
    >
      {children}
    </GroupContext.Provider>
  );
}

export function useGroup() {
  const context = useContext(GroupContext);
  if (context === undefined) {
    throw new Error("useGroup must be used within a GroupProvider");
  }
  return context;
}
