import type { Metadata } from "next";
import type { ReactNode } from "react";
import { SiteFooter } from "../components/site-footer";
import { SiteHeader } from "../components/site-header";
import "../styles/globals.css";

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
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body>
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
