import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SubApp } from "../types";

type SettingsProps = {
  onAddSubApp: (app: SubApp) => void;
};

const Settings = ({ onAddSubApp }: SettingsProps) => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setError("");

    const trimmedName = name.trim();
    const trimmedUrl = url.trim();

    if (!trimmedName || !trimmedUrl) {
      setError("请填写 name 和 url。");
      return;
    }

    try {
      new URL(trimmedUrl);
    } catch {
      setError("url 格式不正确，请输入完整地址。");
      return;
    }

    onAddSubApp({ name: trimmedName, url: trimmedUrl });
    navigate("/");
  };

  const handleCancel = () => {
    navigate("/");
  };

  return (
    <section className="settings-page">
      <h1 className="page-title">添加子应用</h1>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-field">
          <label htmlFor="subapp-name">name</label>
          <input
            id="subapp-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="例如：订单系统"
          />
        </div>
        <div className="form-field">
          <label htmlFor="subapp-url">url</label>
          <input
            id="subapp-url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="例如：https://example.com/"
          />
        </div>
        {error ? <div className="form-error">{error}</div> : null}
        <div className="form-actions">
          <button className="secondary-btn" type="button" onClick={handleCancel}>
            取消
          </button>
          <button className="primary-btn" type="submit">
            添加
          </button>
        </div>
      </form>
    </section>
  );
};

export default Settings;
