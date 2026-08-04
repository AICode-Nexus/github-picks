import { BookOpenText, Menu } from "lucide-react";
import Link from "next/link";

const navigation = [
  { href: "/", label: "今日" },
  { href: "/rankings/7d/", label: "7 天榜" },
  { href: "/rankings/30d/", label: "30 天榜" },
  { href: "/rankings/90d/", label: "90 天榜" },
  { href: "/rankings/180d/", label: "180 天榜" },
  { href: "/history/", label: "历史" },
  { href: "/sources/", label: "信源" },
] as const;

function NavigationLinks() {
  return (
    <>
      {navigation.map((item) => (
        <Link href={item.href} key={item.href}>
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="GitHub Picks 首页">
          <BookOpenText aria-hidden="true" size={20} strokeWidth={1.8} />
          <span className="brand__name">GitHub Picks</span>
          <span className="brand__tag">开源情报排行</span>
        </Link>

        <nav className="desktop-nav" aria-label="主导航">
          <NavigationLinks />
        </nav>

        <details className="mobile-nav">
          <summary aria-label="打开导航">
            <Menu aria-hidden="true" size={20} />
            <span>导航</span>
          </summary>
          <nav aria-label="移动端主导航">
            <NavigationLinks />
          </nav>
        </details>
      </div>
    </header>
  );
}
