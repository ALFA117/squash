"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import { VALLE_DE_BRAVO, Person } from "@/lib/sample";
import { Expense } from "@/lib/netting";

interface GroupContextType {
  name: string;
  dates: string;
  people: Person[];
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, "id">) => void;
  addPerson: (name: string) => void;
  syncUser: (user: any) => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [people, setPeople] = useState<Person[]>(VALLE_DE_BRAVO.people);
  const [expenses, setExpenses] = useState<Expense[]>(VALLE_DE_BRAVO.expenses);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from localStorage on mount
  useEffect(() => {
    const savedPeople = localStorage.getItem("squash-people");
    const savedExpenses = localStorage.getItem("squash-expenses");
    
    if (savedPeople && savedExpenses) {
      setPeople(JSON.parse(savedPeople));
      setExpenses(JSON.parse(savedExpenses));
    } else {
      setPeople(VALLE_DE_BRAVO.people);
      setExpenses(VALLE_DE_BRAVO.expenses);
    }
    setIsLoaded(true);
  }, []);

  // Save to localStorage on change
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem("squash-people", JSON.stringify(people));
      localStorage.setItem("squash-expenses", JSON.stringify(expenses));
    }
  }, [people, expenses, isLoaded]);

  const addExpense = (newExpense: Omit<Expense, "id">) => {
    const expense: Expense = {
      ...newExpense,
      id: `e${Date.now()}`,
    };
    setExpenses((current) => [...current, expense]);
  };

  const addPerson = (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;

    const normalized = trimmed.replace(/\s+/g, " ");
    const initial = normalized.charAt(0).toUpperCase();

    setPeople((current) => {
      if (current.some((person) => person.name.toLowerCase() === normalized.toLowerCase())) {
        return current;
      }

      return [
        ...current,
        {
          id: `person-${Date.now()}`,
          name: normalized,
          initial,
        },
      ];
    });
  };

  const syncUser = (privyUser: any) => {
    if (!privyUser) return;

    const rawName =
      privyUser.email?.address ||
      privyUser.phone?.number ||
      privyUser.wallet?.address ||
      privyUser.id ||
      "Tú";

    const formattedName = rawName.includes("@")
      ? rawName.split("@")[0]
      : rawName.startsWith("0x")
        ? `${rawName.slice(0, 6)}...${rawName.slice(-4)}`
        : rawName;

    const name = formattedName
      .replace(/[._-]+/g, " ")
      .trim()
      .split(" ")
      .map((part: string) => part ? part.charAt(0).toUpperCase() + part.slice(1) : part)
      .join(" ") || "Tú";

    const initial = name.trim().charAt(0)?.toUpperCase() || "T";

    setPeople((current) => {
      const exists = current.find((p) => p.id === "tu");
      if (!exists) {
        return [
          { id: "tu", name, initial, isYou: true },
          ...current,
        ];
      }

      return current.map((p) =>
        p.id === "tu"
          ? { ...p, name, initial, isYou: true }
          : p,
      );
    });
  };

  return (
    <GroupContext.Provider
      value={{
        name: VALLE_DE_BRAVO.name,
        dates: VALLE_DE_BRAVO.dates,
        people,
        expenses,
        addExpense,
        addPerson,
        syncUser,
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
