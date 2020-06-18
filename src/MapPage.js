/**
 * src/Map.js
 * Interactive map that lets the user filter what set of the SWIM feed to receive.
 * Based off example here: http://visgl.github.io/react-map-gl/examples/draw-polygon
 */

import React from "react";
import { createMqttClient } from "./mqtt-client";
import { useImmer } from "use-immer";
import { useSize } from "./useSize";
import { useWindowDimensions } from "./useWindowDimensions";
import { useSwimFeed } from "./useSwimFeed";
import { useGeofilteringSubscriptionManager } from "./useGeofilteringSubscriptionManager";

import ReactMapGL from "react-map-gl";
import {
  DrawRectangleMode,
  EditingMode,
  Editor,
  RENDER_STATE,
} from "react-map-gl-draw";

// config
import { mapboxConfig } from "./mapbox.config";
import { solaceConfig } from "./solace.config";

//img
import SvgMousePointer from "../img/SvgMousePointer";
import SvgRectangleEdit from "../img/SvgRectangleEdit";
import SvgTrashcan from "../img/SvgTrashcan";
import SvgAirplane from "../img/SvgAirplane";
import SvgMail from "../img/SvgMail";
import SvgMenuRetract from "../img/SvgMenuRetract";
import SvgMenuExpand from "../img/SvgMenuExpand";
import SvgArrowDown from "../img/SvgArrowDown";

// constants
const SOLACE_SE_MAPBOX_API_KEY = mapboxConfig.API_KEY;
const CENTER_OF_UNITED_STATES_LAT = 39.828;
const CENTER_OF_UNITED_STATES_LONG = -98.579;
const ReactMapGL_modes = {
  editing: {
    text: "Editing mode",
    description: `Let's you select, edit, or drag shapes. Click the shape once to select it, and then once the shape is selected click-hold-and-drag the shape's verticies to edit it, or click-hold-and-drag the shape's body to drag it. `,
  },
  drawRectangle: {
    text: "Draw filters",
    description: `Draw rectangle shaped filters on the map that will filter the SWIM feed this
                  application receives. The filtering is done by Solace using
                  wildcard filtering on the lat/lon coordinate string that's part of the topic
                  the SWIM data is published on. Click once to start drawing, and again to place the shape.`,
  },
};

export function MapPage() {
  /**
   * mqtt client
   */

  const [mqttClient, setMqttClient] = React.useState(null);

  // initial setup for mqtt client
  React.useEffect(() => {
    async function createMqttSession() {
      let mqttClientConfig = {
        hostUrl: solaceConfig.SOLACE_MQTT_HOST_URL,
        options: {
          username: solaceConfig.SOLACE_USERNAME,
          password: solaceConfig.SOLACE_PASSWORD,
        },
      };

      let mqttClient = createMqttClient(mqttClientConfig);

      mqttClient = await mqttClient.connect().catch(() => {
        // handle retry logic here, for this demo just log to console
        mqttClient.logError("Cannot connect");
      });

      // set up topic subscriptions to attract relevant event flows
      try {
        await mqttClient.subscribe(
          "FDPS/position/#",
          { qos: 1 },
          fdpsFlightPositionEventHandler
        );
      } catch (err) {
        // could handle re-try logic here, but don need to for this demo
        mqttClient.logError(err);
      }

      setMqttClient(mqttClient);
    }

    createMqttSession();
  }, []); // empty dependencies array, means only runs once

  /**
   * page data
   */

  const geofilteringSubscriptionManager = useGeofilteringSubscriptionManager();

  const { session, fdpsFlightPositionEventHandler } = useSwimFeed();

  // update geofilteringSubscriptionManager when mqtt client changes
  React.useEffect(() => {
    if (mqttClient) {
      geofilteringSubscriptionManager.setSubscribe(mqttClient.subscribe);
    }
    // else on disconnect, revert to idle state... should be a state machine going to refactor this weekend
    else {
      geofilteringSubscriptionManager.setSubscribe(() =>
        geofilteringSubscriptionManager.logInfo(
          "Waiting for MQTT client to connect"
        )
      );
      geofilteringSubscriptionManager.setUnsubscribe(() =>
        geofilteringSubscriptionManager.logInfo(
          "Waiting for MQTT client to connect"
        )
      );
    }
  }, [mqttClient]);

  /**
   * window sizes
   */

  const contentRef = React.useRef(null);
  const { width: contentWidth, height: contentHeight } = useSize(contentRef);
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();

  /**
   * map state and methods
   */

  const [viewport, setViewport] = React.useState({
    latitude: CENTER_OF_UNITED_STATES_LAT,
    longitude: CENTER_OF_UNITED_STATES_LONG,
    zoom: 4,
  });

  // redraw if the map's parent container changes sizes because of window resize
  React.useEffect(() => {
    redrawMap();
  }, [contentWidth, contentHeight, windowWidth, windowHeight]);

  function redrawMap() {
    setViewport({
      ...viewport,
    });
  }

  /**
   * editor ref, state, and methods
   */

  const editorRef = React.useRef(null);

  const [editorState, updateEditorState] = useImmer({
    modeId: "editing",
    modeHandler: null,
    features: [],
    selectedFeatureIndex: null,
    toggleState: "EXPANDED",
  });

  /*
    onUpdate (Function, Optional) - callback when any feature is updated. Receives an object containing the following parameters
      data (Feature[]) - the updated list of GeoJSON features.
      editType (String) - addFeature, addPosition, finishMovePosition
      editContext (Array) - list of edit objects, depend on editType, each object may contain featureIndexes, editHandleIndexes, screenCoords, mapCoords.
  */
  function onUpdate({ data }) {
    console.log(data);
    updateEditorState((draft) => {
      draft.features = data;
    });
  }

  /*
    onSelect (Function, Optional) - callback when clicking a position when selectable set to true. Receives an object containing the following parameters
      selectedFeature: selected feature. null if clicked an empty space.
      selectedFeatureIndex: selected feature index.null if clicked an empty space.
      editHandleIndex: selected editHandle index. null if clicked an empty space.
      screenCoords: screen coordinates of the clicked position.
      mapCoords: map coordinates of the clicked position.
   */
  function onSelect(options) {
    console.dir(options);
    updateEditorState((draft) => {
      draft.selectedFeatureIndex = options?.selectedFeatureIndex;
    });
  }

  function deleteShape() {
    const selectedIndex = editorState.selectedFeatureIndex;
    if (selectedIndex !== null && selectedIndex >= 0) {
      /* delete from editor */
      editorRef.current.deleteFeatures(selectedIndex);
      /* update app state */
      updateEditorState((draft) => {
        // https://stackoverflow.com/questions/5767325/how-can-i-remove-a-specific-item-from-an-array
        draft.features.splice(selectedIndex, 1);
      });
    }
  }

  return (
    <div
      style={{ maxHeight: windowHeight, maxWidth: windowWidth }}
      className="flex h-full max-h-screen max-w-screen"
    >
      {/* sidebar if expanded*/}
      {editorState.toggleState === "EXPANDED" && (
        <div
          style={{ width: "40ch", minWidth: "40ch" }}
          className="flex-shrink-0"
        >
          {/* header */}
          <div className="px-4 py-5 sm:p-6">
            <div className="flex items-center">
              <button
                className="inline-flex items-center mr-2 px-2.5 py-1.5 text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150"
                title="Rectangle tool"
                onClick={() =>
                  updateEditorState((draft) => {
                    draft.toggleState = "RETRACTED";
                  })
                }
              >
                <SvgMenuRetract height={"1rem"} />
              </button>
              <h1 className="text-xl">SWIM Feed GUI</h1>
            </div>
          </div>
          {/* toolbar */}
          <div className="px-4 py-5 sm:p-6 h-72">
            <h2 className="text-lg text-gray-800">
              {ReactMapGL_modes[editorState.modeId].text}
            </h2>
            <div className="flex mt-2">
              <button
                className={`${
                  editorState.modeId === "editing"
                    ? "border-2 border-green-400"
                    : "border border-gray-300"
                } inline-flex items-center h-12 w-12 mr-2 px-2.5 py-1.5 text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150`}
                title="Rectangle tool"
                onClick={() =>
                  updateEditorState((draft) => {
                    draft.modeId = "editing";
                    draft.modeHandler = new EditingMode();
                  })
                }
              >
                <SvgMousePointer className="h-full" />
              </button>
              <button
                className={`${
                  editorState.modeId === "drawRectangle"
                    ? "border-2 border-green-400"
                    : "border border-gray-300"
                } inline-flex items-center h-12 w-12 mr-2 px-2.5 py-1.5 text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150`}
                title="Rectangle tool"
                onClick={() =>
                  updateEditorState((draft) => {
                    draft.modeId = "drawRectangle";
                    draft.modeHandler = new DrawRectangleMode();
                  })
                }
              >
                <SvgRectangleEdit className="h-full" />
              </button>
            </div>
            <p className="mt-2 text-gray-600">
              {ReactMapGL_modes[editorState.modeId].description}
            </p>
          </div>
          {/* filter lsit */}
          <div className="px-4 py-5 sm:p-6 h-72">
            <h2 className="text-lg text-gray-800">Active filters</h2>
            <div className="flex flex-col w-full mt-2">
              {editorState.features.map((item, index) => {
                return <FeatureListRow item={item} index={index} />;
              })}
            </div>
          </div>
          {/* metrics */}
          <div class="px-4 py-5 sm:p-6">
            <h2 className="text-lg text-gray-800">Session metrics</h2>
            <div class="flex items-center mt-2">
              <div class="flex-shrink-0 border rounded-md p-3 h-16 w-24 flex items-center justify-center">
                <SvgAirplane className="w-full" />
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm leading-5 font-medium text-gray-500 truncate">
                    Total tracked aircrafts
                  </dt>
                  <dd class="flex items-baseline">
                    <div class="text-2xl leading-8 font-semibold text-gray-900">
                      {Object.keys(session.aircrafts).length}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
            <div class="flex items-center mt-6">
              <div class="flex-shrink-0 border rounded-md p-3 h-16 w-24 flex items-center justify-center">
                <SvgMail className="w-3/5" />
              </div>
              <div class="ml-5 w-0 flex-1">
                <dl>
                  <dt class="text-sm leading-5 font-medium text-gray-500 truncate">
                    SWIM messages received
                  </dt>
                  <dd class="flex items-baseline">
                    <div class="text-2xl leading-8 font-semibold text-gray-900">
                      {session.messagesReceived}
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* map */}
      <div className="flex-grow h-full">
        <div className="relative w-full h-full" ref={contentRef}>
          <ReactMapGL
            {...viewport}
            width="100%"
            height="100%"
            mapStyle="mapbox://styles/mapbox/satellite-streets-v11"
            mapboxApiAccessToken={SOLACE_SE_MAPBOX_API_KEY}
            onViewportChange={(nextViewport) => setViewport(nextViewport)}
          >
            <Editor
              ref={editorRef}
              clickRadius={12} // to make the lines/vertices easier to interact with
              mode={editorState.modeHandler}
              onSelect={onSelect}
              onUpdate={onUpdate}
              featureStyle={getFeatureStyle}
              editHandleStyle={getEditHandleStyle}
              editHandleShape={"circle"}
            />
            {/* toolbar overlay, visible if sidebar is retracted */}
            {editorState.toggleState === "RETRACTED" && (
              <div className="absolute top-0 left-0 p-2 m-4">
                <div className="flex flex-col">
                  <button
                    className="inline-flex h-12 w-12 items-center px-2.5 py-1.5 text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150"
                    title="Rectangle tool"
                    onClick={() =>
                      updateEditorState((draft) => {
                        draft.toggleState = "EXPANDED";
                      })
                    }
                  >
                    <SvgMenuExpand className="h-full" />
                  </button>
                  <button
                    className={`${
                      editorState.modeId === "editing"
                        ? "border-2 border-green-400"
                        : "border border-gray-300"
                    } inline-flex mt-2 h-12 w-12 items-center px-2.5 py-1.5 text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150`}
                    title="Rectangle tool"
                    onClick={() =>
                      updateEditorState((draft) => {
                        draft.modeId = "editing";
                        draft.modeHandler = new EditingMode();
                      })
                    }
                  >
                    <SvgMousePointer className="h-full" />
                  </button>
                  <button
                    className={`${
                      editorState.modeId === "drawRectangle"
                        ? "border-2 border-green-400"
                        : "border border-gray-300"
                    } inline-flex mt-2 h-12 w-12 items-center px-2.5 py-1.5 text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150`}
                    title="Rectangle tool"
                    onClick={() =>
                      updateEditorState((draft) => {
                        draft.modeId = "drawRectangle";
                        draft.modeHandler = new DrawRectangleMode();
                      })
                    }
                  >
                    <SvgRectangleEdit className="h-full" />
                  </button>
                  <button
                    className="inline-flex mt-2 h-12 w-12 items-center px-2.5 py-1.5 border border-gray-300 text-xs leading-4 font-medium rounded text-gray-700 bg-white hover:text-gray-500 focus:outline-none focus:border-blue-300 focus:shadow-outline-blue active:text-gray-800 active:bg-gray-50 transition ease-in-out duration-150"
                    title="Delete"
                    onClick={deleteShape}
                  >
                    <SvgTrashcan className="h-full" />
                  </button>
                </div>
              </div>
            )}
          </ReactMapGL>
        </div>
      </div>
    </div>
  );
}

function FeatureListRow({ item, index }) {
  return (
    <div className="flex items-center">
      <div className="flex items-center justify-center w-12 h-12 p-3">
        <SvgArrowDown className="h-full" />
      </div>
      <div className="flex items-center justify-center w-12 h-12 p-3 ml-2">
        <SvgRectangleEdit className="h-full" />
      </div>
      <div className="ml-2">
        {item.properties.shape} {index}
      </div>
      <div className="flex items-center justify-end flex-grow w-12 h-12 p-3 text-red-500 fill-current">
        <SvgTrashcan className="h-full" />
      </div>
    </div>
  );
}

/* -+-+-+ pretend this is utils.js, you teleported without pressing a keystroke 🤧 its better this way I promise -+-+-+ */

// react-map-gl-draw styling

function getEditHandleStyle({ feature, state }) {
  switch (state) {
    case RENDER_STATE.SELECTED:
    case RENDER_STATE.HOVERED:
    case RENDER_STATE.UNCOMMITTED:
      return {
        fill: "rgb(251, 176, 59)",
        fillOpacity: 1,
        stroke: "rgb(255, 255, 255)",
        strokeWidth: 2,
        r: 7,
      };

    default:
      return {
        fill: "rgb(251, 176, 59)",
        fillOpacity: 1,
        stroke: "rgb(255, 255, 255)",
        strokeWidth: 2,
        r: 5,
      };
  }
}

function getFeatureStyle({ feature, index, state }) {
  switch (state) {
    case RENDER_STATE.SELECTED:
    case RENDER_STATE.HOVERED:
    case RENDER_STATE.UNCOMMITTED:
    case RENDER_STATE.CLOSING:
      return {
        stroke: "rgb(251, 176, 59)",
        strokeWidth: 2,
        fill: "rgb(251, 176, 59)",
        fillOpacity: 0.3,
        strokeDasharray: "4,2",
      };

    default:
      return {
        stroke: "rgb(60, 178, 208)",
        strokeWidth: 2,
        fill: "rgb(60, 178, 208)",
        fillOpacity: 0.1,
      };
  }
}
