import type { Metadata } from "next";
import { Inter, Outfit, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { createClient } from '@/utils/supabase/server';
import Navbar from "./components/Navbar";
import ThemeToggle from "./components/ThemeToggle";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-serif-source",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Siddhant | The Living Legal Archive",
  description: "Democratizing Indian Legal Education through continuous community co-creation.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let userData = null;
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('username, full_display_name, profile_photo')
      .eq('id', user.id)
      .maybeSingle();

    const username = profile?.username
      || user.user_metadata?.username
      || user.email?.split('@')[0]
      || 'user';
    const displayName = profile?.full_display_name || username;

    userData = {
      username,
      displayName,
      profilePhoto: profile?.profile_photo || null,
      profileUrl: `/profile/${username}`,
    };
  }

  return (
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${outfit.variable} ${sourceSerif.variable}`}>
      <body>
        <div className="app-container">
          <Navbar user={userData} />
          <main className="main-content">
            {children}
          </main>
          <ThemeToggle />
        </div>
      </body>
    </html>
  );
}
