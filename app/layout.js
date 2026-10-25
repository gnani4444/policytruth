import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains", display: "swap" });

export const metadata = { title: "PolicyTruth", description: "Does your website do what your privacy policy says?" };
export const viewport = { width: "device-width", initialScale: 1, themeColor: "#ffffff" };

export default function RootLayout({ children }) {
  return (
    <html lang="en-GB" className={`${archivo.variable} ${mono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
