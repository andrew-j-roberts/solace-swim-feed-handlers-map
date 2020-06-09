// react libs
import React from "react";
import { useImmer } from "use-immer";
import { FixedSizeList as List } from "react-window";
import AutoSizer from "react-virtualized-auto-sizer";
// clients
import { createMqttClient } from "./mqtt-client";
import Map from "./Map";

// img

export default function App() {
  return (
    <div className="w-screen h-screen">
      <Map />
    </div>
  );
}
