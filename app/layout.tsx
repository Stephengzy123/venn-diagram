import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://venn-diagram.vercel.app"),
  title: "Venn Diagram Tool",
  description: "Create and highlight a Venn diagram with up to five circles.",
  openGraph: {
    title: "Venn Diagram Tool",
    description: "Create and highlight overlapping sets.",
    images: ["/og.png"],
  },
  twitter: {
    card: "summary_large_image",
    title: "Venn Diagram Tool",
    description: "Create and highlight overlapping sets.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
