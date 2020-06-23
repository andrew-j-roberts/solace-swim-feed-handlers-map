/**
 * useGeofilteringSubscriptionManager.js
 * converts filter shapes into a list of subscriptions
 * @author Andrew Roberts
 */

import React from "react";
import { useImmer } from "use-immer";
import { useDebounce } from "./useDebounce";

/**
 * react-map-gl-draw to messaging client integration layer, just happens to be a React hook.
 *
 * Parent container then needs to configure the instance using
 * setSubscribe and setUnsubscribe, which can be set to most MQTT client's subscribe/unsubscribe methods.
 *
 * updateSubscriptions is exposed so that the parent container can start manually refresh the subscription manager
 * if there are changes to its messaging client, like on startup.
 *
 * It's not totally generic, so if you want to hook up something that isn't MQTT you'll have to fiddle with the
 * addSubscription and removeSubscription method arguments.
 * @param {*} fdpsFlightPositionEventHandler
 */
export function useGeofilteringSubscriptionManager(
  fdpsFlightPositionEventHandler
) {
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // data
  // internal
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  const [state, updateState] = useImmer({
    filters: {
      rectangles: {},
    },
  });

  // useDebounce, https://dev.to/gabe_ragland/debouncing-with-react-hooks-jci
  // Now we call our hook, passing in the current state value.
  // The hook will only return the latest value (what we passed in) ...
  // ... if it's been more than 500ms since it was last called.
  // Otherwise, it will return the previous value of state.
  // The goal is to only have the API call fire when user stops interacting ...
  // ... with the map so that we aren't calling subscribe 1000s of times during editing.
  const debouncedState = useDebounce(state, 500);

  React.useEffect(
    () => {
      console.log("Hello");
    },
    // This is the useEffect input array
    // Our useEffect function will only execute if this value changes ...
    // ... and thanks to our hook it will only change if the original ...
    // value (state) hasn't changed for more than 500ms.
    [debouncedState]
  );

  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // lifecycle
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  /**
   * called when this subscription manager is configured with mqtt
   */
  async function start() {
    // subscribe to entire feed
    await addSubscription({ topicFilter: "FDPS/position/#" });
  }

  /**
   * update subscriptions based on current filter rectangles
   * debounced so that dragging the handles will only add the final
   * subscriptions to the client
   */

  async function updateSubscriptions() {
    // clear subscriptions
    await unsubscribeAll();
    // add updated topic subscriptions
    const rectangles = Object.keys(state.filters.rectangles);
    // if there are rectangle filters, filter the SWIM feed
    if (rectangles.length > 0) {
    }
    // if there are no active rectangle filters, consume entire SWIM feed
    else {
      await addSubscription({ topicFilter: "FDPS/position/#" });
    }
  }

  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // methods to interpret react-map-gl-draw events
  // internal
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  /**
   * triggered when user adds, removes, or updates a feature on the map
   * @param {Object[]} features
   */
  function onFeaturesUpdate(features) {
    const rectangleFilters = features.filter(
      (feature) => feature.properties?.shape === "Rectangle"
    );
    updateState((draft) => {
      draft.filters.rectangles = rectangleFilters;
    });
  }

  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // private messaging client interface and helpers
  // internal
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  let subscribe = async function () {
    logInfo("Waiting to be initialized");
  };

  let unsubscribe = async function () {
    logInfo("Waiting to be initialized");
  };

  let unsubscribeAll = async function () {
    logInfo("Waiting to be initialized");
  };

  /**
   * add subscription using fdpsFlightPositionEventHandler as event handler
   * @param {Object} props
   */
  async function addSubscription({
    topicFilter,
    options: { qos = 0 } = { qos: 0 },
  }) {
    try {
      await subscribe(topicFilter, { qos }, fdpsFlightPositionEventHandler);
    } catch (err) {
      // could handle re-try logic here, but don need to for this demo
      logError(err);
    }
  }

  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // setters
  // used by parent container to configure this instance with the methods of its mqtt client
  // internal
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  let setSubscribe = function (_subscribe) {
    subscribe = _subscribe;
  };

  let setUnsubscribe = function (_unsubscribe) {
    unsubscribe = _unsubscribe;
  };

  let setUnsubscribeAll = function (_unsubscribeAll) {
    unsubscribeAll = _unsubscribeAll;
  };

  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // utils
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  /**
   * info level logger
   * @param {string} message
   */
  function logInfo(message) {
    const log = {
      component: "geofiltering-subscription-manager",
      time: new Date().toISOString(),
      msg: message,
    };
    console.log(JSON.stringify(log));
  }

  /**
   * error level logger
   * @param {string} message
   */
  function logError(error) {
    const errorLog = {
      component: "geofiltering-subscription-manager",
      time: new Date().toISOString(),
      error: error,
    };
    console.error(JSON.stringify(errorLog));
  }

  return {
    // data
    subscriptions: state.subscriptions,
    // lifecycle
    start,
    // methods to interpret react-map-gl-draw events
    onFeaturesUpdate,
    // setters
    setSubscribe,
    setUnsubscribe,
    // utils
    logInfo,
    logError,
  };
}
