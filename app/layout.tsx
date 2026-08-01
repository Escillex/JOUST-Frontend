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
  description: "Hobby Plus — a place for all hobbies",
  icons: {
    icon: "/h+small.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

import Navibar from "./components/Navibar";
import { UserProvider } from "./components/UserProvider";
import { NotificationProvider } from "./components/NotificationProvider";
import { ToastProvider } from "./components/ui/Toast";
import MobileTopBar from "./components/mobile/MobileTopBar";
import MobileBottomNav from "./components/mobile/MobileBottomNav";
import InitialAppLoader from "./components/InitialAppLoader";
import ServiceWorkerRegister from "./components/ServiceWorkerRegister";
import OfflineBanner from "./components/ui/OfflineBanner";

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${poppins.variable} ${questrial.variable} h-full w-full overflow-x-hidden antialiased`}
    >
      <body className="min-h-full w-full overflow-x-hidden flex flex-col bg-background text-foreground tracking-tight selection:bg-primary selection:text-background">
        {/* Enables on-device caching of build files and images
            (production only) and makes the site installable. */}
        <ServiceWorkerRegister />
        {/* Sits above everything, including the navigation, because a stale
            screen must never be able to look current. */}
        <OfflineBanner />
        <UserProvider>
          <NotificationProvider>
          <ToastProvider>
          <InitialAppLoader>
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
          </InitialAppLoader>
          </ToastProvider>
          </NotificationProvider>
        </UserProvider>
      </body>
    </html>
  );
}
