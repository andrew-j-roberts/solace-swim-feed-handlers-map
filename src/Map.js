import React from "react";
import ReactMapGL from "react-map-gl";
import { DrawRectangleMode, Editor } from "react-map-gl-draw";

const CENTER_OF_UNITED_STATES_LAT = 39.828;
const CENTER_OF_UNITED_STATES_LONG = -98.579;

const SOLACE_SE_MAPBOX_API_KEY =
  "pk.eyJ1Ijoic29sYWNlLXNlLW1hcGJveCIsImEiOiJja2I2d2ltdGEwMXQ2MnluenVydmZyYmp6In0.ePk6Xh6xW-h36y_WOVHGXA";

export default function Map() {
  const [viewport, setViewport] = React.useState({
    width: "100%",
    height: "100%",
    latitude: CENTER_OF_UNITED_STATES_LAT,
    longitude: CENTER_OF_UNITED_STATES_LONG,
    zoom: 8,
  });

  return (
    <ReactMapGL
      mapStyle="mapbox://styles/mapbox/satellite-streets-v11"
      mapboxApiAccessToken={SOLACE_SE_MAPBOX_API_KEY}
      {...viewport}
      onViewportChange={(nextViewport) => setViewport(nextViewport)}
    >
      <Editor
        // to make the lines/vertices easier to interact with
        clickRadius={12}
        mode={new DrawRectangleMode()}
      />
    </ReactMapGL>
  );
}
