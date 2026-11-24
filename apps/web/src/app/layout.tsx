import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mama Tee Spaza · Books",
  description: "Simple books for small businesses: everyday actions become proper double-entry books.",
};

export const viewport: Viewport = {
  themeColor: "#0F5D43",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en-ZA">
      <body>
        {children}
        <Toaster position="top-center" richColors={false} />
      </body>
    </html>
  );
}
