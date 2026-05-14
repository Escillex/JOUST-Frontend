import type { Metadata, Viewport } from "next";
import { Poppins, Questrial } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});
const questrial = Questrial({
  variable: "--font-questrial",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Hobby+",
  description: "Hobby Plus A place for all hobbioes",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

import Navibar from "./components/Navibar";
import { UserProvider } from "./components/UserProvider";
import MobileTopBar from "./components/mobile/MobileTopBar";
import MobileBottomNav from "./components/mobile/MobileBottomNav";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${questrial.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground tracking-tight selection:bg-primary selection:text-background">
        <UserProvider>
          {/* Desktop Navigation */}
          <div className="hidden md:block sticky top-0 z-50">
            <Navibar />
          </div>

          {/* Mobile Navigation */}
          <div className="md:hidden">
            <MobileTopBar />
          </div>

          <main className="flex-grow pb-20 md:pb-0">
            {children}
          </main>

          {/* Mobile Bottom Navigation */}
          <div className="md:hidden">
            <MobileBottomNav />
          </div>
        </UserProvider>
      </body>
    </html>
  );
}
