import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { PostAuthRedirect } from "@/components/post-auth-redirect";
import { ThemeProvider } from "@/components/theme-provider";
import { THEME_STORAGE_KEY } from "@/lib/theme";

const themeScript = `
(function () {
  var key = ${JSON.stringify(THEME_STORAGE_KEY)};
  var mode = "system";
  try {
    var stored = window.localStorage.getItem(key);
    if (stored === "system" || stored === "light" || stored === "dark") {
      mode = stored;
    }
  } catch (error) {}
  var prefersDark =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  var isDark = mode === "dark" || (mode === "system" && prefersDark);
  var root = document.documentElement;
  root.classList.toggle("dark", isDark);
  root.style.colorScheme = isDark ? "dark" : "light";
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", isDark ? "#0a0a0a" : "#ffffff");
})();
`;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Gruppo Alpini — Portale dei soci",
  description:
    "Portale riservato ai soci del Gruppo Alpini: accedi per consultare e aggiornare il tuo profilo.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      lang="it"
      suppressHydrationWarning
    >
      <head>
        <meta content="#ffffff" name="theme-color" />
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full flex flex-col">
        <ThemeProvider>
          <AuthProvider>
            <PostAuthRedirect />
            {children}
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
