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
  syncUser: (user: any) => void;
}

const GroupContext = createContext<GroupContextType | undefined>(undefined);

export function GroupProvider({ children }: { children: React.ReactNode }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
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

  const syncUser = (privyUser: any) => {
    if (!privyUser) return;
    
    setPeople((current) => {
      const exists = current.find((p) => p.id === "tu");
      if (exists) {
        // Update "tu" with real info if possible
        return current.map((p) => 
          p.id === "tu" 
            ? { ...p, name: privyUser.email?.address || privyUser.id.slice(0, 8) } 
            : p
        );
      }
      return current;
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
