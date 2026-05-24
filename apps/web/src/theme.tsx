import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

export type Theme = "light" | "dark" | "system";
type ResolvedTheme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  resolved: ResolvedTheme;
  setTheme: (theme: Theme) => void;
}

const STORAGE_KEY = "battleship-theme";

function readStored(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "light" || v === "dark" || v === "system") return v;
  } catch {
    /* noop */
  }
  return "system";
}

function resolve(t: Theme): ResolvedTheme {
  if (t === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return t;
}

function apply(r: ResolvedTheme): void {
  document.documentElement.setAttribute("data-theme", r);
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStored);
  const [resolved, setResolved] = useState<ResolvedTheme>(() =>
    resolve(theme),
  );

  const setTheme = useCallback((next: Theme) => {
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      /* noop */
    }
    setThemeState(next);
  }, []);

  // Re-resolve whenever the user choice changes
  useEffect(() => {
    const r = resolve(theme);
    setResolved(r);
    apply(r);
  }, [theme]);

  // Listen for OS preference changes when in "system" mode
  const themeRef = useRef(theme);
  themeRef.current = theme;

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");

    const handler = () => {
      if (themeRef.current === "system") {
        const r = resolve("system");
        setResolved(r);
        apply(r);
      }
    };

    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  const value = useMemo(
    () => ({ theme, resolved, setTheme }),
    [theme, resolved, setTheme],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
