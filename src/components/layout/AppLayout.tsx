import { useEffect } from "react";
import { NavLink, Outlet } from "react-router-dom";

const AppLayout = ({ pageTitle }: { pageTitle: string }) => {
  useEffect(() => {
    document.title = pageTitle;
  }, [pageTitle]);

  return (
    <div className="atlas-shell">
      <header className="site-header">
        <NavLink
          className="brand-lockup"
          to="/"
          aria-label="Atlas 旅行收藏首页"
        >
          <span className="brand-mark">A</span>
          <span>
            <strong>ATLAS</strong>
            <small>虚拟旅行收藏地图</small>
          </span>
        </NavLink>
        <nav aria-label="主导航">
          <NavLink to="/atlas">世界地图</NavLink>
          <NavLink to="/trips">旅行</NavLink>
          <NavLink to="/trips/new">创建计划</NavLink>
          <NavLink to="/settings">设置</NavLink>
        </nav>
      </header>
      <main className="site-main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <span>Atlas · 本地优先的虚拟旅行收藏地图</span>
        <span>地图数据 © OpenStreetMap contributors</span>
      </footer>
    </div>
  );
};

export default AppLayout;
