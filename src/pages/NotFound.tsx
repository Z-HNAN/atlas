import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <section className="page-card">
      <h1 className="section-title">页面不存在</h1>
      <p>请返回 Todo 首页继续管理待办。</p>
      <div className="form-actions">
        <button
          className="secondary-btn"
          type="button"
          onClick={() => navigate("/")}
        >
          返回首页
        </button>
      </div>
    </section>
  );
};

export default NotFound;
