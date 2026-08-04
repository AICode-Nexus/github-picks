import { ScanSearch } from "lucide-react";

export interface EmptyRankingProps {
  title?: string;
}

export function EmptyRanking({
  title = "本期项目未达到当前证据门槛",
}: EmptyRankingProps) {
  return (
    <div className="empty-ranking">
      <ScanSearch aria-hidden="true" size={30} strokeWidth={1.5} />
      <div>
        <h2>{title}</h2>
        <p className="empty-ranking__description">
          这不代表该方向没有好项目，而是现有候选尚未同时满足证据覆盖、置信度与风险约束。后续观测会继续补充。
        </p>
      </div>
    </div>
  );
}
