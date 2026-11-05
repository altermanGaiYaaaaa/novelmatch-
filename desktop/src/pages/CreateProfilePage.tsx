import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CircleAlert,
  Info,
  Lightbulb,
  ShieldCheck,
  UserRoundPlus,
  WandSparkles,
} from "lucide-react";
import { Topbar } from "../components/layout/Topbar";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { GENRES, MAX_PROFILE_NAME } from "../lib/constants";
import { backend } from "../lib/backend";
import { cn, errorMessage } from "../lib/utils";
import { useAppStore } from "../stores/appStore";

export function CreateProfilePage() {
  const navigate = useNavigate();
  const upsertProfile = useAppStore((state) => state.upsertProfile);
  const showToast = useAppStore((state) => state.showToast);
  const [name, setName] = useState("");
  const [genre, setGenre] = useState("");
  const [customGenre, setCustomGenre] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const genreRef = useRef<HTMLDivElement>(null);

  const hideError = () => {
    if (error) setError("");
  };

  const handleCreate = async () => {
    const trimmedName = name.trim();
    if (!trimmedName && !genre) {
      setError("请先填写画像名称，并选择一个偏好题材。");
      return;
    }
    if (!trimmedName) {
      setError("给这套画像起一个容易辨认的名字吧。");
      return;
    }
    if (!genre) {
      setError("还差一步：请选择一个偏好题材。");
      genreRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    if (genre === "其他" && !customGenre.trim()) {
      setError("请填写自定义题材，方便后续按题材整理画像。");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const profile = await backend.createProfile(
        trimmedName,
        genre,
        genre === "其他" ? customGenre.trim() : undefined,
      );
      upsertProfile(profile);
      showToast("画像已创建，开始补充参考小说", "sparkles");
      navigate(`/setup/${profile.id}`);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Topbar
        breadcrumb={[
          { label: "我的画像", to: "/" },
          { label: "新建画像" },
        ]}
        actions={
          <Link
            className="flex items-center gap-1.5 text-[12.5px] text-[#7C7790] transition hover:text-[#5B4BD6]"
            to="/"
          >
            <ArrowLeft className="h-[14px] w-[14px]" />
            返回工作台
          </Link>
        }
      />

      <main className="mx-auto w-full max-w-[1220px] flex-1 px-9 pb-16 pt-9">
        <div className="flex items-end justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#F1EDFF] text-[#5B4BD6]">
                <UserRoundPlus className="h-4 w-4" />
              </span>
              <h1 className="text-[24px] font-semibold tracking-[-0.02em] text-[#1F1C30]">
                新建阅读品味画像
              </h1>
            </div>
            <p className="mt-2.5 text-[13px] leading-6 text-[#7A758C]">
              先告诉 NovelMatch 你怎么称呼这套画像、最常读什么，之后可以继续补充作品与偏好细节。
            </p>
          </div>
          <span className="hidden items-center gap-1.5 rounded-lg border border-[#E9E6F3] bg-white px-3 py-1.5 text-[11px] text-[#8A859C] sm:flex">
            <ShieldCheck className="h-[13px] w-[13px] text-[#8D7FE0]" />
            画像默认仅自己可见
          </span>
        </div>

        <div className="mt-7 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="overflow-hidden rounded-2xl border border-[#E8E6F1] bg-white shadow-card">
            <div className="p-7 lg:p-8">
              <div>
                <div className="flex items-center justify-between">
                  <label
                    className="text-[13.5px] font-semibold text-[#2B273C]"
                    htmlFor="profileName"
                  >
                    画像名称
                    <span className="ml-1 text-[11px] font-normal text-[#B04A5D]">
                      必填
                    </span>
                  </label>
                  <span className="text-[11px] tabular-nums text-[#A29DAF]">
                    {name.length} / {MAX_PROFILE_NAME}
                  </span>
                </div>
                <Input
                  autoComplete="off"
                  className="mt-2.5 h-11 text-[13.5px]"
                  id="profileName"
                  maxLength={MAX_PROFILE_NAME}
                  onChange={(event) => {
                    setName(event.target.value);
                    hideError();
                  }}
                  placeholder="例如：偏爱冷峻权谋的玄幻读者"
                  value={name}
                />
                <p className="mt-2 text-[11.5px] leading-5 text-[#918CA2]">
                  一个容易辨认的名字，方便在工作台快速切换不同阅读口味。
                </p>
              </div>

              <div className="my-7 h-px bg-[#F0EEF5]" />

              <div ref={genreRef}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[13.5px] font-semibold text-[#2B273C]">
                      偏好题材
                    </span>
                    <span className="rounded-md bg-[#F3F0FF] px-1.5 py-0.5 text-[10px] font-medium text-[#6557C4]">
                      单选
                    </span>
                  </div>
                  <span className="text-[11.5px] text-[#9A96A8]">
                    选择最接近你近期口味的一个题材
                  </span>
                </div>
                <p className="mt-2 text-[11.5px] leading-5 text-[#918CA2]">
                  题材只用于确定匹配方向的起点，创建后仍可修改。
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  {GENRES.map((item) => {
                    const selected = genre === item.name;
                    const Icon = item.icon;
                    return (
                      <button
                        aria-pressed={selected}
                        className={cn(
                          "relative flex h-[96px] flex-col justify-between rounded-xl border p-3.5 text-left transition",
                          selected
                            ? "border-[#6C5CE7] bg-[#F7F4FF] shadow-[inset_0_0_0_1px_#6C5CE7,0_10px_20px_-18px_rgba(78,63,199,0.65)]"
                            : "border-[#E8E6F0] bg-white hover:border-[#CFC7F2] hover:bg-[#FCFBFF]",
                        )}
                        key={item.name}
                        onClick={() => {
                          setGenre(item.name);
                          hideError();
                        }}
                        type="button"
                      >
                        <span
                          className={cn(
                            "flex h-7 w-7 items-center justify-center rounded-lg transition",
                            selected
                              ? "bg-[#E9E3FF] text-[#5B4BD6]"
                              : "bg-[#F4F2FC] text-[#6C5CE7]",
                          )}
                        >
                          <Icon className="h-[15px] w-[15px]" />
                        </span>
                        <span className="block">
                          <span
                            className={cn(
                              "block text-[12.5px] font-medium",
                              selected ? "text-[#4E3FC7]" : "text-[#332E46]",
                            )}
                          >
                            {item.name}
                          </span>
                          <span className="mt-0.5 block truncate text-[9.5px] text-[#9A95A9]">
                            {item.subtitle}
                          </span>
                        </span>
                        <span
                          className={cn(
                            "absolute right-2.5 top-2.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#6C5CE7] text-white transition",
                            selected ? "scale-100 opacity-100" : "scale-75 opacity-0",
                          )}
                        >
                          <svg
                            className="h-2.5 w-2.5"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            viewBox="0 0 24 24"
                          >
                            <path
                              d="M20 6 9 17l-5-5"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            />
                          </svg>
                        </span>
                      </button>
                    );
                  })}
                </div>

                {genre === "其他" ? (
                  <div className="mt-3 rounded-xl border border-[#E8E6F0] bg-[#FCFBFF] p-3.5">
                    <label
                      className="text-[11.5px] font-medium text-[#5F5A72]"
                      htmlFor="customGenre"
                    >
                      自定义题材
                    </label>
                    <Input
                      autoComplete="off"
                      className="mt-2"
                      id="customGenre"
                      maxLength={12}
                      onChange={(event) => {
                        setCustomGenre(event.target.value);
                        hideError();
                      }}
                      placeholder="例如：克苏鲁、群像权谋"
                      value={customGenre}
                    />
                  </div>
                ) : null}
              </div>

              {error ? (
                <div className="mt-6 flex items-start gap-2 rounded-xl border border-[#F5DCE0] bg-[#FFF7F8] px-3.5 py-2.5 text-[12px] leading-5 text-[#B04A5D]">
                  <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#F0EEF5] bg-[#FCFCFE] px-7 py-5 lg:px-8">
              <p className="flex items-center gap-1.5 text-[11.5px] text-[#9691A6]">
                <Info className="h-[13px] w-[13px]" />
                创建后仍可继续编辑题材与偏好关键词
              </p>
              <div className="flex items-center gap-2.5">
                <Link
                  className="inline-flex h-10 items-center justify-center rounded-xl border border-[#E5E2EC] bg-white px-4 text-[13px] font-medium text-[#605B73] transition hover:border-[#D8D3E5] hover:bg-[#FAF9FC]"
                  to="/"
                >
                  取消
                </Link>
                <Button
                  className="h-10"
                  loading={saving}
                  onClick={handleCreate}
                >
                  创建画像
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </section>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-[#E8E6F1] bg-white p-5 shadow-[0_14px_32px_-30px_rgba(44,36,96,0.45)]">
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#F3F0FF] text-[#5B4BD6]">
                  <WandSparkles className="h-3.5 w-3.5" />
                </span>
                <h2 className="text-[13px] font-semibold text-[#2C283C]">
                  创建后你会得到
                </h2>
              </div>
              <ul className="mt-4 space-y-4">
                {[
                  [
                    "一套专属品味画像",
                    "包含偏好关键词、喜欢的特征和需要避开的雷点。",
                  ],
                  [
                    "小说匹配评估能力",
                    "粘贴链接即可获得匹配度、推荐理由与风险提示。",
                  ],
                  [
                    "持续校准的阅读偏好",
                    "每次标记喜欢或不喜欢，都会让判断更接近你的真实口味。",
                  ],
                ].map(([title, text], index) => (
                  <li className="flex gap-3" key={title}>
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#F4F1FF] text-[10px] font-semibold text-[#6557C4]">
                      {index + 1}
                    </span>
                    <div>
                      <p className="text-[12px] font-medium text-[#3A344C]">{title}</p>
                      <p className="mt-1 text-[11px] leading-5 text-[#8D889C]">{text}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-[#EEEAF8] bg-[#FAF9FF] p-5">
              <div className="flex items-center gap-2 text-[12px] font-medium text-[#534A74]">
                <Lightbulb className="h-[14px] w-[14px] text-[#8D7FE0]" />
                填写建议
              </div>
              <p className="mt-3 text-[11.5px] leading-6 text-[#807B92]">
                选择最近三个月最常读的题材，匹配会更聚焦。名称越具体，之后切换画像时越容易辨认。
              </p>
            </div>

            <div className="flex items-center gap-2 px-1 text-[11px] text-[#A09CAC]">
              <span className="h-1 w-1 rounded-full bg-[#C3BDD6]" />
              创建过程只需填写这一页
            </div>
          </aside>
        </div>
      </main>
    </>
  );
}
