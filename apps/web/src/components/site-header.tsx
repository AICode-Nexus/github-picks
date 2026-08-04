import { BookOpenText } from "lucide-react";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="GitHub Picks 首页">
          <BookOpenText aria-hidden="true" size={20} strokeWidth={1.8} />
          <span className="brand__name">GitHub Picks</span>
          <span className="brand__tag">DAILY OSS INTELLIGENCE</span>
        </Link>
        <p className="site-header__descriptor">每日可追溯的开源价值榜</p>
      </div>
    </header>
  );
}
