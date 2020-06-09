// core js dependencies
import "core-js/stable";
import "regenerator-runtime/runtime";

// react dependencies
import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

// styling
import "mapbox-gl/dist/mapbox-gl.css";
import "../tailwind.css";

ReactDOM.render(<App />, document.getElementById("root"));
