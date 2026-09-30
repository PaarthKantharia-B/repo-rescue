import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AuthProvider } from "@/components/providers/AuthProvider";
import { VisitorTracker } from "@/components/providers/VisitorTracker";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Repo Rescue | Codeforces for Open Source",
  description: "Discover issues, evaluate RR difficulty, solve PRs, and earn auditable RR points on the global open-source leaderboard.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable} dark`}>
      <body className="min-h-screen flex flex-col justify-between bg-[#070a11] text-slate-100 font-sans">
        <AuthProvider>
          <VisitorTracker />
          <div>
            <Navbar />
            <main>{children}</main>
          </div>
          <Footer />
        </AuthProvider>
      </body>
    </html>
  );
}
