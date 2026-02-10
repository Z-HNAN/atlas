import { useNavigate } from "react-router-dom";

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <section className="page-card">
      <h1 className="section-title">页面不存在</h1>
      <p>请返回首页重新选择应用。</p>
      <div className="form-actions">
        <button className="secondary-btn" onClick={() => navigate("/")}
>
          返回首页
        </button>
      </div>
    </section>
  );
};

export default NotFound;
