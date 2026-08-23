import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeMode = "dark" | "light";

interface ThemeContextType {
  themeMode: ThemeMode;
  isDark: boolean;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem("cf_theme");
    return saved === "light" ? "light" : "dark";
  });

  const isDark = themeMode === "dark";

  useEffect(() => {
    localStorage.setItem("cf_theme", themeMode);
    const root = document.documentElement;
    const body = document.body;
    if (themeMode === "dark") {
      root.classList.add("dark");
      root.classList.remove("light");
      root.style.colorScheme = "dark";
      body.style.backgroundColor = "#000000";
      body.style.color = "#ffffff";
    } else {
      root.classList.add("light");
      root.classList.remove("dark");
      root.style.colorScheme = "light";
      body.style.backgroundColor = "#ffffff";
      body.style.color = "#000000";
    }
  }, [themeMode]);

  const toggleTheme = () => {
    setThemeModeState((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  return (
    <ThemeContext.Provider value={{ themeMode, isDark, toggleTheme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
