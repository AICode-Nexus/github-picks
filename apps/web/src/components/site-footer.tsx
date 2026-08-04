import { GitBranch } from "lucide-react";
import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="site-footer__brand">GitHub Picks</p>
        <p>把公开信号整理成可追溯的中文开源情报。</p>
      </div>
      <nav aria-label="页脚导航">
        <Link href="/">今日榜单</Link>
        <Link href="/rankings/30d/">近 30 天榜</Link>
        <Link href="/history/">历史日报</Link>
        <Link href="/sources/">信源状态</Link>
        <a
          href="https://github.com/"
          target="_blank"
          rel="noreferrer"
          aria-label="访问 GitHub"
        >
          <GitBranch aria-hidden="true" size={17} />
          GitHub
        </a>
      </nav>
      <p className="site-footer__legal">
        独立、非官方项目，与 GitHub, Inc.
        不存在隶属或合作关系。榜单用于发现线索，不替代生产选型与安全审查。
      </p>
    </footer>
  );
}
