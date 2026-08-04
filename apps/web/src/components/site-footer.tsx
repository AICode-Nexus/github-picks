import { GitBranch } from "lucide-react";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <p className="site-footer__brand">GitHub Picks</p>
        <p>把公开信号整理成可追溯的中文开源情报。</p>
      </div>
      <a
        className="site-footer__github"
        href="https://github.com/"
        target="_blank"
        rel="noreferrer"
        aria-label="访问 GitHub"
      >
        <GitBranch aria-hidden="true" size={17} />
        GitHub
      </a>
      <p className="site-footer__legal">
        独立、非官方项目，与 GitHub, Inc.
        不存在隶属或合作关系。榜单用于发现线索，不替代生产选型与安全审查。
      </p>
    </footer>
  );
}
