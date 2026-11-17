import { ClerkProvider } from "@clerk/nextjs";
import type { Metadata } from "next";
import localFont from "next/font/local";
import { connection } from "next/server";

import "./globals.css";

const display = localFont({
  src: "../node_modules/@fontsource-variable/inter-tight/files/inter-tight-latin-wght-normal.woff2",
  variable: "--font-display",
  weight: "100 900",
  display: "swap",
});

const mono = localFont({
  src: [
    {
      path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-500-normal.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff2",
      weight: "600",
      style: "normal",
    },
  ],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "FACET — Capability exchange",
  description:
    "Discover, verify and publish executable capabilities for autonomous agents.",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await connection();
  const publishableKey = process.env["NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"];

  return (
    <html lang="en">
      <body className={`${display.variable} ${mono.variable}`}>
        {publishableKey ? (
          <ClerkProvider
            publishableKey={publishableKey}
            signInUrl="/sign-in"
            signUpUrl="/sign-up"
            signInFallbackRedirectUrl="/"
            signUpFallbackRedirectUrl="/"
            appearance={{
              options: {
                logoImageUrl: "/facet-mark.svg",
              },
              variables: {
                colorBackground: "#ffffff",
                colorForeground: "#09090b",
                colorMutedForeground: "#52525b",
                colorPrimary: "#050505",
                colorPrimaryForeground: "#dfff4f",
                colorInput: "#f4f4f5",
                colorInputForeground: "#09090b",
                borderRadius: "0px",
              },
              elements: {
                card: {
                  border: "1px solid #18181b",
                  boxShadow: "0 24px 60px rgba(0, 0, 0, 0.5)",
                },
                userProfileRootBox: {
                  border: "1px solid #18181b",
                },
              },
            }}
          >
            {children}
          </ClerkProvider>
        ) : (
          children
        )}
      </body>
    </html>
  );
}
