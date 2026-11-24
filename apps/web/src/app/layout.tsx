import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "@fontsource-variable/bricolage-grotesque";
import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "Mama Tee Spaza · Books",
  description: "Simple books for small businesses: everyday actions become proper double-entry books.",
};

export const viewport: Viewport = {
  themeColor: "#17704A",
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
