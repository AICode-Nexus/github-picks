import type { Metadata } from "next";
import { IBM_Plex_Mono, Noto_Sans_SC, Noto_Serif_SC } from "next/font/google";
import type { ReactNode } from "react";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import "../styles/globals.css";

const serif = Noto_Serif_SC({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-serif",
  display: "swap",
  preload: false,
});

const sans = Noto_Sans_SC({
  weight: "variable",
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
  preload: false,
});

const mono = IBM_Plex_Mono({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "GitHub Picks · 每日开源情报",
    template: "%s · GitHub Picks",
  },
  description: "不只看 Star 的中文 GitHub 开源项目榜单与证据分析。",
  applicationName: "GitHub Picks",
  keywords: ["GitHub", "开源项目", "GitHub Trending", "开源情报", "中文榜单"],
  robots: {
    index: true,
    follow: true,
  },
  other: {
    "github-picks-disclaimer":
      "Independent and unofficial; not affiliated with GitHub, Inc.",
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className={`${serif.variable} ${sans.variable} ${mono.variable}`}>
        <a className="skip-link" href="#main-content">
          跳到主要内容
        </a>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
