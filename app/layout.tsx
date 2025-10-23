import "./globals.css";

export const metadata = {
  title: "Fridge Feast AI",
  description: "Turn what you have into dinner ideas"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-gray-50 text-gray-900">{children}</body>
    </html>
  );
}
