import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./lib/store";
import { ThemeProvider } from "./components/theme-provider";
import App from "./App";
import "./index.css";

createRoot(document.getElementById("root")!).render(
  <Provider store={store}>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </Provider>
);
