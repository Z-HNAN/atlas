import type { PropsWithChildren } from "react";
import { BrowserRouter } from "react-router-dom";

const AppProviders = ({ children }: PropsWithChildren) => (
  <BrowserRouter
    future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
  >
    {children}
  </BrowserRouter>
);

export default AppProviders;
