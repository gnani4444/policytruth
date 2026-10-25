import "./globals.css";

export const metadata = { title: "PolicyTruth", description: "Does your website do what your privacy policy says?" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
