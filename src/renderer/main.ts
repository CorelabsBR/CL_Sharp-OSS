/*---------------------------------------------------------------------------------------------
- Copyright (c) CorelabsBR. All rights reserved.
- Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import "./compatibility";
import { IdePage } from "./pages/IdePage";
import "../styles/app.css";
import "../styles/primitives.css";

const root = document.getElementById("app");
if (!root) {
  throw new Error("Sharp-OSS root element not found.");
}

root.replaceChildren(new IdePage().element);
