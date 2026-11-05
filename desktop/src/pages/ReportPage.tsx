import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookmarkPlus,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cpu,
  Globe,
  Loader2,
  Quote,
  RotateCcw,
  ThumbsDown,
  ThumbsUp,
  TriangleAlert,
} from "lucide-react";
import { Topbar } from "../components/layout/Topbar";
import { Button } from "../components/ui/Button";
import { backend } from "../lib/backend";
import { cn, errorMessage, formatDateTime, scoreTone } from "../lib/utils";
import { useAppStore } from "../stores/appStore";
import type { EvaluationRecord } from "../types";

export function ReportPage() {
  const { evaluationId = "" } = useParams();
  const navigate = useNavigate();
  const showToast = useAppStore((state) => state.showToast);
  const setActiveProfile = useAppStore((state) => state.setActiveProfile);
  const [record, setRecord] = useState<EvaluationRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    backend
      .getEvaluation(evaluationId)
      .then((data) => {
        if (!mounted) return;
        setRecord(data);
        setActiveProfile(data.profileId);
      })
      .catch((err) => {
        if (mounted) setError(errorMessage(err));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [evaluationId, setActiveProfile]);

  if (loading) {
    return (
      <>
        <Topbar breadcrumb={[{ label: "评估报告" }, { label: "加载中" }]} />
        <main className="flex flex-1 items-center justify-center">
          <div className="flex items-center gap-2 text-[12.5px] text-[#9691A6]">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在加载评估报告…
          </div>
        </main>
      </>
    );
  }

  if (error || !record) {
    return (
      <>
        <Topbar breadcrumb={[{ label: "评估报告" }]} />
        <main className="flex flex-1 items-center justify-center px-9">
          <div className="max-w-[420px] rounded-2xl border border-[#F5DCE0] bg-white p-7 text-center shadow-card">
            <CircleAlert className="mx-auto h-6 w-6 text-[#C25867]" />
            <h2 className="mt-3 text-[15px] font-semibold text-[#2B273C]">
              无法打开评估报告
            </h2>
            <p className="mt-2 text-[12px] leading-6 text-[#8D889C]">
              {error || "评估记录不存在或已删除。"}
            </p>
            <Button className="mt-5" size="sm" variant="outline" onClick={() => navigate("/")}>
              返回首页
            </Button>
          </div>
        </main>
      </>
    );
  }

  const report = record.report;
  const tone = scoreTone(report.score);
  const coverText = report.bookTitle.slice(0, 2) || "书";
  const verdictTone =
    report.score >= 70
      ? {
          box: "border-[#DDF3E8] bg-[#F4FBF7]",
          title: "text-[#227A50]",
          note: "text-[#5E8F76]",
          iconBg: "bg-[#DDF3E8] text-[#1F9D62]",
          icon: CheckCircle2,
        }
      : report.score >= 55
        ? {
            box: "border-[#F5E3CC] bg-[#FFFBF4]",
            title: "text-[#94601F]",
            note: "text-[#A5824E]",
            iconBg: "bg-[#F8E8D2] text-[#B4742E]",
            icon: TriangleAlert,
          }
        : {
            box: "border-[#F5DCE0] bg-[#FFF7F8]",
            title: "text-[#9C4052]",
            note: "text-[#B06A78]",
            iconBg: "bg-[#F9DDE2] text-[#C25867]",
            icon: CircleAlert,
          };
  const VerdictIcon = verdictTone.icon;

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "画像工作台", to: `/workspace/${record.profileId}` },
          { label: "评估报告" },
        ]}
        actions={
          <button
            className="flex h-9 items-center gap-1.5 rounded-lg border border-[#E6E3EE] bg-white px-3 text-[12.5px] font-medium text-[#5E5971] transition hover:border-[#D5CDF6] hover:text-[#4E3FC7]"
            onClick={() => navigate(`/workspace/${record.profileId}`)}
            type="button"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            返回工作台
          </button>
        }
      />

      <main className="mx-auto w-full max-w-[1000px] flex-1 px-9 pb-16 pt-7">
        <div className="mb-4 flex items-center justify-between px-0.5">
          <div>
            <h1 className="text-[20px] font-semibold tracking-[-0.02em] text-[#211E31]">
              小说评估报告
            </h1>
            <p className="mt-1 text-[11.5px] text-[#918CA2]">
              使用画像「{report.profileName || record.profileId}」·{" "}
              {report.chapterRange || record.chapterRange} · 结果仅供参考
            </p>
          </div>
          <Link
            className="text-[11.5px] font-medium text-[#6C5CE7] transition hover:text-[#4C3DC4]"
            to={`/workspace/${record.profileId}`}
          >
            再评估一本
          </Link>
        </div>

        <section className="animate-fade-up overflow-hidden rounded-2xl border border-[#E4E1F2] bg-white shadow-[0_28px_64px_-40px_rgba(45,35,100,0.55)]">
          <div className="border-b border-[#F0EDF6] bg-[#FCFBFE] p-5 lg:p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="relative flex h-[88px] w-[64px] shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#DCD5F4] bg-gradient-to-br from-[#40366B] to-[#7565B8] shadow-[0_10px_20px_-14px_rgba(50,38,110,0.8)]">
                <span className="absolute left-1 top-1 h-3 w-3 border-l border-t border-white/25" />
                <span className="absolute bottom-1 right-1 h-3 w-3 border-b border-r border-white/25" />
                <span className="text-[17px] font-medium tracking-[0.18em] text-white [writing-mode:vertical-rl]">
                  {coverText}
                </span>
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-medium tracking-[0.04em] text-[#8F83C9]">
                  评估结果 · {report.genre || "小说"}
                </p>
                <h2 className="mt-1.5 text-[18px] font-semibold tracking-[-0.01em] text-[#232034]">
                  《{report.bookTitle}》
                </h2>
                <p className="mt-1 text-[11px] text-[#918CA2]">
                  {report.author || "作者信息未获取"}
                </p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {(report.tags.length
                    ? report.tags
                    : [report.genre].filter(Boolean)
                  ).map((tag) => (
                    <span
                      className="rounded-md bg-white px-2 py-0.5 text-[10px] text-[#6F6983] ring-1 ring-[#ECE8F5]"
                      key={tag}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div
                className="relative flex h-[76px] w-[76px] shrink-0 items-center justify-center rounded-full"
                style={{
                  background: `conic-gradient(${tone.ring} 0% ${report.score}%, #ECE9F8 ${report.score}% 100%)`,
                }}
              >
                <div className="flex h-[62px] w-[62px] flex-col items-center justify-center rounded-full bg-white">
                  <span className="text-[20px] font-semibold leading-none tabular-nums text-[#2A2540]">
                    {report.score}
                  </span>
                  <span className="mt-1 text-[9px] text-[#9A95A8]">匹配度</span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 lg:p-6">
            <div className={cn("flex items-start gap-2.5 rounded-xl border px-4 py-3", verdictTone.box)}>
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  verdictTone.iconBg,
                )}
              >
                <VerdictIcon className="h-[11px] w-[11px]" />
              </span>
              <div>
                <p className={cn("text-[12.5px] font-semibold", verdictTone.title)}>
                  {report.verdict}
                </p>
                <p className={cn("mt-1 text-[11px] leading-5", verdictTone.note)}>
                  {report.verdictNote}
                </p>
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-2">
              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#ECF9F2] text-[#249667]">
                    <ThumbsUp className="h-3 w-3" />
                  </span>
                  <h3 className="text-[12px] font-semibold text-[#3A344C]">推荐理由</h3>
                  <span className="text-[10px] text-[#AAA5B5]">与你的画像高度相关</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {(report.reasons.length
                    ? report.reasons
                    : [{ title: "暂无足够明确的推荐理由", description: "本次分析获取的正文有限，建议试读后再判断。" }]
                  ).map((item, index) => (
                    <li className="flex items-start gap-2.5" key={`${item.title}-${index}`}>
                      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#34A874]" />
                      <div>
                        <p className="text-[12px] font-medium text-[#38334A]">{item.title}</p>
                        <p className="mt-1 text-[11.5px] leading-5 text-[#817C91]">
                          {item.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#FFF3F4] text-[#C25867]">
                    <TriangleAlert className="h-3 w-3" />
                  </span>
                  <h3 className="text-[12px] font-semibold text-[#3A344C]">需要留意</h3>
                  <span className="text-[10px] text-[#AAA5B5]">可能触发你的弃书点</span>
                </div>
                <ul className="mt-3 space-y-3">
                  {(report.risks.length
                    ? report.risks
                    : [{ title: "暂未发现明显风险", description: "前几章样本中未出现与画像明显冲突的特征。" }]
                  ).map((item, index) => (
                    <li className="flex items-start gap-2.5" key={`${item.title}-${index}`}>
                      <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D0833D]" />
                      <div>
                        <p className="text-[12px] font-medium text-[#38334A]">{item.title}</p>
                        <p className="mt-1 text-[11.5px] leading-5 text-[#817C91]">
                          {item.description}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {report.quote ? (
              <div className="mt-5 rounded-xl border border-[#EEECF6] bg-[#FAFAFD] px-4 py-3.5">
                <div className="flex items-center gap-2 text-[10px] font-medium tracking-[0.04em] text-[#9994A8]">
                  <Quote className="h-3 w-3 text-[#9A8DEE]" />
                  文风样本
                </div>
                <p className="mt-2 text-[12px] leading-6 text-[#514B63]">{report.quote}</p>
                {report.quoteSource ? (
                  <p className="mt-1 text-[10px] text-[#A29DAD]">{report.quoteSource}</p>
                ) : null}
              </div>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EDF6] bg-[#FCFCFE] px-5 py-4 lg:px-6">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-[#A09BAC]">
              <span className="flex items-center gap-1.5">
                <Clock3 className="h-3 w-3" />
                评估于 {formatDateTime(report.createdAt || record.createdAt)}
              </span>
              <span className="flex items-center gap-1.5">
                <Cpu className="h-3 w-3" />
                模型 {report.modelName || record.modelName || "—"}
              </span>
              <span className="flex min-w-0 items-center gap-1.5">
                <Globe className="h-3 w-3 shrink-0" />
                <span className="truncate">{report.baseUrl || "—"}</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  showToast("已记录“暂不考虑”，可继续查看其他作品", "info");
                  navigate(`/workspace/${record.profileId}`);
                }}
              >
                <ThumbsDown className="h-3.5 w-3.5" />
                暂不考虑
              </Button>
              <Button
                size="sm"
                onClick={() => showToast("已加入想读清单", "bookmark")}
              >
                <BookmarkPlus className="h-3.5 w-3.5" />
                加入想读清单
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => navigate(`/workspace/${record.profileId}`)}
              >
                <RotateCcw className="h-3.5 w-3.5" />
                再评估
              </Button>
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-[10px] leading-5 text-[#A09BAC]">
          匹配度来自你配置的模型对前十章内容与当前画像的估计，不代表经过统计验证的客观概率。
        </p>
      </main>
    </>
  );
}
