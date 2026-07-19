import { type FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDeepSeekTaskBreakdown } from "../features/todos/hooks/useDeepSeekTaskBreakdown";
import type { TodoOperationResult } from "../features/todos/hooks/useTodos";
import type {
  TodoDraft,
  TodoFilter,
  TodoItem,
} from "../features/todos/types/todos";

type HomeProps = {
  todos: TodoItem[];
  onAddTodo: (draft: TodoDraft) => TodoOperationResult;
  onAddSuggestedTodos: (titles: string[]) => TodoOperationResult;
  onToggleTodo: (id: string) => TodoOperationResult;
  onRemoveTodo: (id: string) => TodoOperationResult;
  onClearCompleted: () => TodoOperationResult;
};

const FILTERS: { value: TodoFilter; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "active", label: "进行中" },
  { value: "completed", label: "已完成" },
];

const Home = ({
  todos,
  onAddTodo,
  onAddSuggestedTodos,
  onToggleTodo,
  onRemoveTodo,
  onClearCompleted,
}: HomeProps) => {
  const navigate = useNavigate();
  const deepSeek = useDeepSeekTaskBreakdown();
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [filter, setFilter] = useState<TodoFilter>("all");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const completedCount = todos.filter((todo) => todo.completed).length;
  const activeCount = todos.length - completedCount;
  const visibleTodos = useMemo(
    () =>
      todos.filter((todo) => {
        if (filter === "active") return !todo.completed;
        if (filter === "completed") return todo.completed;
        return true;
      }),
    [filter, todos],
  );

  const clearFeedback = () => {
    setError("");
    setMessage("");
  };

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    clearFeedback();
    const result = onAddTodo({ title, notes });
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setTitle("");
    setNotes("");
    setSuggestions([]);
    setMessage("待办已加入列表。");
  };

  const handleBreakdown = async () => {
    clearFeedback();
    const result = await deepSeek.breakdown(title, notes);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuggestions(result.value);
    setMessage("DeepSeek 已生成子任务，请确认后加入待办。");
  };

  const handleAddSuggestions = () => {
    clearFeedback();
    const result = onAddSuggestedTodos(suggestions);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSuggestions([]);
    setMessage("子任务已加入待办列表。");
  };

  const runTodoOperation = (
    action: () => TodoOperationResult,
    successMessage: string,
  ) => {
    clearFeedback();
    const result = action();
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setMessage(successMessage);
  };

  return (
    <section className="home-page todo-page">
      <header className="home-header">
        <div>
          <p className="eyebrow">LOCAL-FIRST TODO</p>
          <h1 className="home-title">Todo Seed</h1>
          <p className="home-subtitle">
            一个可离线使用、可安全恢复，也能用 DeepSeek 拆解任务的种子应用。
          </p>
        </div>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => navigate("/settings")}
        >
          设置与数据
        </button>
      </header>

      <div className="todo-stats" aria-label="待办统计">
        <div>
          <strong>{activeCount}</strong>
          <span>进行中</span>
        </div>
        <div>
          <strong>{completedCount}</strong>
          <span>已完成</span>
        </div>
        <div>
          <strong>{todos.length}</strong>
          <span>全部</span>
        </div>
      </div>

      <section className="todo-composer" aria-labelledby="todo-composer-title">
        <div className="section-heading-row">
          <div>
            <p className="eyebrow">CAPTURE</p>
            <h2 id="todo-composer-title" className="section-title">
              记下下一件事
            </h2>
          </div>
          {!deepSeek.hasKey ? (
            <button
              type="button"
              className="text-btn"
              onClick={() => navigate("/settings")}
            >
              配置 DeepSeek Key
            </button>
          ) : null}
        </div>
        <form className="todo-form" onSubmit={handleAdd}>
          <div className="form-field">
            <label htmlFor="todo-title">待办标题</label>
            <input
              id="todo-title"
              value={title}
              maxLength={120}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="例如：准备下周的项目复盘"
            />
          </div>
          <div className="form-field">
            <label htmlFor="todo-notes">补充说明（可选）</label>
            <textarea
              id="todo-notes"
              value={notes}
              maxLength={500}
              rows={3}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="补充背景、期限或完成标准"
            />
          </div>
          <div className="form-actions todo-form-actions">
            <button
              className="secondary-btn"
              type="button"
              disabled={!deepSeek.hasKey || !title.trim() || deepSeek.loading}
              onClick={() => void handleBreakdown()}
            >
              {deepSeek.loading ? "正在拆解…" : "DeepSeek 拆解"}
            </button>
            <button
              className="primary-btn"
              type="submit"
              disabled={!title.trim()}
            >
              加入待办
            </button>
          </div>
        </form>

        {suggestions.length > 0 ? (
          <div className="suggestion-panel" aria-live="polite">
            <div className="suggestion-heading">
              <strong>建议的子任务</strong>
              <span>加入前可先确认内容</span>
            </div>
            <ol>
              {suggestions.map((suggestion) => (
                <li key={suggestion}>{suggestion}</li>
              ))}
            </ol>
            <div className="form-actions">
              <button
                className="secondary-btn"
                type="button"
                onClick={() => setSuggestions([])}
              >
                清除建议
              </button>
              <button
                className="primary-btn"
                type="button"
                onClick={handleAddSuggestions}
              >
                全部加入待办
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="todo-list-section" aria-labelledby="todo-list-title">
        <div className="todo-list-toolbar">
          <div>
            <p className="eyebrow">FOCUS</p>
            <h2 id="todo-list-title" className="section-title">
              待办列表
            </h2>
          </div>
          <div className="filter-group" aria-label="筛选待办">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                className="filter-btn"
                aria-pressed={filter === item.value}
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {visibleTodos.length > 0 ? (
          <ul className="todo-list">
            {visibleTodos.map((todo) => (
              <li
                key={todo.id}
                className={`todo-item${todo.completed ? " is-completed" : ""}`}
              >
                <label className="todo-check">
                  <input
                    type="checkbox"
                    checked={todo.completed}
                    onChange={() =>
                      runTodoOperation(
                        () => onToggleTodo(todo.id),
                        todo.completed ? "待办已恢复。" : "待办已完成。",
                      )
                    }
                  />
                  <span className="sr-only">
                    {todo.completed ? "恢复" : "完成"} {todo.title}
                  </span>
                </label>
                <div className="todo-content">
                  <strong>{todo.title}</strong>
                  {todo.notes ? <p>{todo.notes}</p> : null}
                </div>
                <button
                  type="button"
                  className="todo-delete-btn"
                  aria-label={`删除 ${todo.title}`}
                  onClick={() => {
                    if (!window.confirm(`确认删除“${todo.title}”吗？`)) return;
                    runTodoOperation(
                      () => onRemoveTodo(todo.id),
                      "待办已删除。",
                    );
                  }}
                >
                  删除
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="todo-empty">
            <strong>
              {todos.length === 0 ? "从一件小事开始" : "这个视图暂时为空"}
            </strong>
            <p>
              {todos.length === 0
                ? "上方添加的待办会保存在当前浏览器，即使离线也能继续使用。"
                : "切换筛选条件，或者添加一个新的待办。"}
            </p>
          </div>
        )}

        {completedCount > 0 ? (
          <div className="clear-completed-row">
            <button
              type="button"
              className="text-btn danger-text-btn"
              onClick={() => {
                if (
                  !window.confirm(`确认清除 ${completedCount} 条已完成待办吗？`)
                )
                  return;
                runTodoOperation(onClearCompleted, "已完成待办已清除。");
              }}
            >
              清除已完成（{completedCount}）
            </button>
          </div>
        ) : null}
      </section>

      {error || deepSeek.error ? (
        <div className="form-error" role="alert">
          {error || deepSeek.error}
        </div>
      ) : null}
      {message ? (
        <div className="form-success" role="status">
          {message}
        </div>
      ) : null}
    </section>
  );
};

export default Home;
