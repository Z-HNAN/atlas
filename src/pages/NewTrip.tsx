import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTravelPlanner } from "../features/trips/hooks/useTravelPlanner";
import type {
  GeneratedTravelPlan,
  TravelPlanInput,
  Trip,
  TripDraft,
} from "../features/trips/types/trips";
import type { TripOperation } from "../features/trips/hooks/useTrips";

interface NewTripProps {
  onAddTrip: (draft: TripDraft) => TripOperation<Trip>;
  onAddGeneratedTrip: (plan: GeneratedTravelPlan) => TripOperation<Trip>;
}

const NewTrip = ({ onAddTrip, onAddGeneratedTrip }: NewTripProps) => {
  const navigate = useNavigate();
  const planner = useTravelPlanner();
  const [mode, setMode] = useState<"ai" | "manual">("ai");
  const [error, setError] = useState("");
  const [manual, setManual] = useState<TripDraft>({
    title: "",
    summary: "",
    region: "",
    theme: "",
  });
  const [input, setInput] = useState<TravelPlanInput>({
    prompt:
      "我想在日本进行一次一小时左右的自然景观飞行，希望看到山、湖泊和小镇，不想经过太大的城市。",
    region: "日本",
    theme: "自然景观",
    durationMinutes: 60,
    pointCount: 5,
    preferences: "适合低空目视探索，地点顺序自然。",
  });
  const aiDisabledReason = !planner.hasKey
    ? "请先在设置页保存 DeepSeek Key，按钮才会启用。"
    : planner.loading
      ? "请求正在进行，请等待本次生成完成。"
      : "";

  const handleManual = async (event: FormEvent) => {
    event.preventDefault();
    const result = await onAddTrip(manual);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    navigate(`/trips/${result.value.id}`);
  };

  const handleGenerate = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    const generated = await planner.generate(input);
    if (!generated.ok) {
      setError(generated.error);
      return;
    }
    const saved = await onAddGeneratedTrip(generated.value);
    if (!saved.ok) {
      setError(saved.error);
      return;
    }
    navigate(`/trips/${saved.value.id}`);
  };

  return (
    <div className="content-page narrow-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">新建旅行</p>
          <h1>下一次，想去哪里？</h1>
          <p>AI 负责提供灵感与顺序，真实坐标仍由地图查询和你亲自确认。</p>
        </div>
      </header>
      <div className="segmented-control" aria-label="创建方式">
        <button
          type="button"
          aria-pressed={mode === "ai"}
          onClick={() => setMode("ai")}
        >
          AI 生成计划
        </button>
        <button
          type="button"
          aria-pressed={mode === "manual"}
          onClick={() => setMode("manual")}
        >
          手工创建
        </button>
      </div>

      {mode === "ai" ? (
        <form
          className="form-card"
          onSubmit={(event) => void handleGenerate(event)}
        >
          <div className="form-intro">
            <span className="step-number">01</span>
            <div>
              <h2>描述旅行想法</h2>
              <p>越像和旅行顾问聊天，结果越自然。</p>
            </div>
          </div>
          <label className="form-field">
            <span>旅行描述</span>
            <textarea
              rows={6}
              value={input.prompt}
              onChange={(event) =>
                setInput({ ...input, prompt: event.target.value })
              }
            />
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>地区</span>
              <input
                value={input.region}
                onChange={(event) =>
                  setInput({ ...input, region: event.target.value })
                }
                placeholder="例如：日本关东"
              />
            </label>
            <label className="form-field">
              <span>主题</span>
              <input
                value={input.theme}
                onChange={(event) =>
                  setInput({ ...input, theme: event.target.value })
                }
                placeholder="例如：山湖与小镇"
              />
            </label>
          </div>
          <div className="form-row">
            <label className="form-field">
              <span>预计时长（分钟）</span>
              <input
                type="number"
                min={15}
                max={480}
                value={input.durationMinutes}
                onChange={(event) =>
                  setInput({
                    ...input,
                    durationMinutes: Number(event.target.value),
                  })
                }
              />
            </label>
            <label className="form-field">
              <span>地点数量</span>
              <input
                type="number"
                min={2}
                max={12}
                value={input.pointCount}
                onChange={(event) =>
                  setInput({ ...input, pointCount: Number(event.target.value) })
                }
              />
            </label>
          </div>
          <label className="form-field">
            <span>偏好（可选）</span>
            <input
              value={input.preferences}
              onChange={(event) =>
                setInput({ ...input, preferences: event.target.value })
              }
            />
          </label>
          {!planner.hasKey ? (
            <div className="notice-panel">
              <strong>还没有 DeepSeek Key</strong>
              <p>Key 只保存在当前浏览器，不会进入旅行数据或云端快照。</p>
              <Link className="text-link" to="/settings">
                前往安全设置
              </Link>
            </div>
          ) : null}
          <button
            className="primary-btn wide-btn"
            type="submit"
            disabled={!planner.hasKey || planner.loading}
            aria-describedby={
              aiDisabledReason ? "deepseek-generate-disabled-reason" : undefined
            }
          >
            {planner.loading ? "正在生成旅行计划…" : "让 DeepSeek 规划路线"}
          </button>
          {aiDisabledReason ? (
            <p
              id="deepseek-generate-disabled-reason"
              className="action-hint"
              role="status"
            >
              {aiDisabledReason}
            </p>
          ) : null}
        </form>
      ) : (
        <form
          className="form-card"
          onSubmit={(event) => void handleManual(event)}
        >
          <div className="form-intro">
            <span className="step-number">01</span>
            <div>
              <h2>创建空白计划</h2>
              <p>保存后在详情页逐个添加地点并确认坐标。</p>
            </div>
          </div>
          <label className="form-field">
            <span>旅行标题</span>
            <input
              required
              value={manual.title}
              onChange={(event) =>
                setManual({ ...manual, title: event.target.value })
              }
              placeholder="例如：阿尔卑斯湖区周末飞行"
            />
          </label>
          <label className="form-field">
            <span>简介</span>
            <textarea
              rows={4}
              value={manual.summary}
              onChange={(event) =>
                setManual({ ...manual, summary: event.target.value })
              }
            />
          </label>
          <div className="form-row">
            <label className="form-field">
              <span>地区</span>
              <input
                value={manual.region}
                onChange={(event) =>
                  setManual({ ...manual, region: event.target.value })
                }
              />
            </label>
            <label className="form-field">
              <span>主题</span>
              <input
                value={manual.theme}
                onChange={(event) =>
                  setManual({ ...manual, theme: event.target.value })
                }
              />
            </label>
          </div>
          <button className="primary-btn wide-btn" type="submit">
            创建草稿
          </button>
        </form>
      )}
      {error || planner.error ? (
        <div className="form-error" role="alert">
          {error || planner.error}
        </div>
      ) : null}
    </div>
  );
};

export default NewTrip;
