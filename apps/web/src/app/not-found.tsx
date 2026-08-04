import { ArrowLeft } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found" id="main-content">
      <p className="eyebrow">INTELLIGENCE GAP / 404</p>
      <p className="not-found__code">404</p>
      <h1>这份情报尚未收录</h1>
      <p>路径可能已经变更，或者项目没有达到本期证据门槛。</p>
      <Link className="button-link" href="/">
        <ArrowLeft aria-hidden="true" size={18} />
        返回今日榜单
      </Link>
    </main>
  );
}
