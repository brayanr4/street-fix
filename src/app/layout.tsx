import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Street Fix",
  description: "Snap a problem on your street. Street Fix reports it to the right agency and follows up until it's fixed.",
  appleWebApp: { capable: true, title: "Street Fix", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#18202b",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en-AU" className={`${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
