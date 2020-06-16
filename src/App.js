import React from "react";
import { WindowDimensionsProvider } from "./useWindowDimensions";
import { MapPage } from "./MapPage";

export default function App() {
  return (
    <WindowDimensionsProvider>
      <div className="w-screen h-screen max-h-screen max-w-screen">
        <MapPage />
      </div>
    </WindowDimensionsProvider>
  );
}
