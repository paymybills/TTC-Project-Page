import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "The Turing Circle | Projects",
  description: "Flagship content and projects from The Turing Circle",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;0,700;1,300;1,400;1,600;1,700&family=Inter:wght@300;400;500;600;700&display=swap"
        />
      </head>
      <body className="antialiased bg-math-black text-white">
        {children}
      </body>
    </html>
  );
}
