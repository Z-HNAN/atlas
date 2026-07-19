import type { PropsWithChildren } from "react";
import { BrowserRouter } from "react-router-dom";

const AppProviders = ({ children }: PropsWithChildren) => (
  <BrowserRouter>{children}</BrowserRouter>
);

export default AppProviders;
