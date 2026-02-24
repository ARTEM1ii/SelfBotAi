import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { AntdProvider } from '@/components/ui/AntdProvider';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'TelegramLLM — AI Assistant',
  description: 'AI assistant that learns from your files and replies in Telegram',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <AntdProvider>{children}</AntdProvider>
      </body>
    </html>
  );
}
