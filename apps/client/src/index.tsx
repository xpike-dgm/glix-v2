import { render } from "solid-js/web";
import { App } from "./App.js";
import "./fonts.js";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/ui.css";
import "./styles/screens.css";
import "./styles/game.css";

const root = document.getElementById("root");
if (root) render(() => <App />, root);
