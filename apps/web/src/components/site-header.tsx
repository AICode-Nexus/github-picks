import { BookOpenText, Menu } from "lucide-react";
import Link from "next/link";

const navigation = [
  { href: "/", label: "今日榜单" },
  { href: "/#directions", label: "技术方向" },
  { href: "/sources/", label: "信源状态" },
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
          <span className="brand__tag">每日开源情报</span>
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
