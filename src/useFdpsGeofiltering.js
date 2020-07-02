/**
 * useFdpsGeofiltering.js
 * - onFeaturesUpdate is the interface between this subscription manager and react-map-gl Editor
 * - Once configured with an MQTT or Solace client, this subscription manager will subscribe/unsubscribe...
 *   ... to topics as necessary to keep the client's subscriptions consistent with the react-map-gl-draw filters on the Map.
 *
 * @author Andrew Roberts
 */

import React from "react";
import { useImmer } from "use-immer";
import { useDebounce } from "./useDebounce";

/**
 * react-map-gl-draw to messaging client interface
 * @param {*} fdpsFlightPositionEventHandler
 */
export function useFdpsGeofiltering(fdpsFlightPositionEventHandler) {
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // map features state
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  const [state, updateState] = useImmer({
    filters: {
      rectangles: {},
    },
  });

  /**
   * useDebounce, https://dev.to/gabe_ragland/debouncing-with-react-hooks-jci
   * When the state argument updates, a timeout is set for ...
   * ... the number of milliseconds provided as the second argument.
   * The timeout is refreshed if state changes to a new value before the timeout finishes.
   * The debouncedState variable only updates when the timeout finishes.
   * E.g. onFeaturesUpdate will trigger 10-100s of state updates in a short period of time as the user drags a map feature ...
   * ... but debouncedState will only update once, 500 milliseconds after the user stops dragging ...
   * ... to the very last value of the dragging.
   */
  const debouncedState = useDebounce(state, 500);
  React.useEffect(() => {
    updateSubscriptions();
  }, [debouncedState]);

  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // react-map-gl-draw interface
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  /**
   * triggered when user adds, removes, or updates a feature on the map
   * @param {Object[]} features
   */
  function onFeaturesUpdate(features) {
    updateState((draft) => {
      draft.filters.rectangles = features.filter(
        (feature) => feature.properties?.shape === "Rectangle"
      );
    });
  }

  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // messaging client interface and helpers
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  const [{ subscribe, unsubscribeAll }, updateMessagingInterface] = useImmer({
    subscribe: () => logInfo("subscribe waiting to be initialized"),
    unsubscribeAll: () => logInfo("unsubscribeAll waiting to be initialized"),
  });

  function configureMessagingInterface({ subscribe, unsubscribeAll }) {
    updateMessagingInterface((draft) => {
      draft.subscribe = subscribe;
      draft.unsubscribeAll = unsubscribeAll;
    });
  }

  // when this client's messaging interface is updated, try to subscribe to entire feed
  React.useEffect(() => {
    addFlightPositionSubscription({ topicFilter: "FDPS/position/>" });
  }, [subscribe, unsubscribeAll]);

  /**
   * add subscription using fdpsFlightPositionEventHandler as event handler
   * @param {Object} props
   */
  function addFlightPositionSubscription({ topicFilter }) {
    subscribe(topicFilter, fdpsFlightPositionEventHandler);
  }

  /**
   * add subscription using fdpsFlightPositionEventHandler as event handler
   * @param {Object} props
   */
  function addAllFlightPositionSubscriptions() {
    state.filters.rectangles.map((rectangleFeature, _) =>
      createTopicFilters(rectangleFeature).map((topicFilter) =>
        addFlightPositionSubscription({
          topicFilter,
        })
      )
    );
  }

  /**
   * update subscriptions based on current filter rectangles
   * debounced so that dragging the handles will only add the final
   * subscriptions to the client
   */

  function updateSubscriptions() {
    // clear subscriptions
    unsubscribeAll();
    // add updated topic subscriptions
    const filterRectangleFeatures = Object.keys(state.filters.rectangles);
    // if there are rectangle filters, filter the SWIM feed
    if (filterRectangleFeatures.length > 0) {
      addAllFlightPositionSubscriptions();
    }
    // if there are no active rectangle filters, consume entire SWIM feed
    else {
      addFlightPositionSubscription({ topicFilter: "FDPS/position/>" });
    }
  }

  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-
  // utils
  // +-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-

  function createTopicFilters(mapFeature) {
    let topicFilters = [];

    if (mapFeature.properties?.shape == "Rectangle") {
      // deduplicate and sort the array
      const sortedRectangleCoordinates = sortRectangleCoordinates(
        deduplicateArray(mapFeature.geometry?.coordinates[0])
      );
      // use the sorted array to determine the size of the grid algorithm's subscription rectangle
      const topicWildcardFilterDecimalPlaces = getTopicWildcardFilterDecimalPlaces(
        getDistancesBetweenCoordinates(sortedRectangleCoordinates)
      );
      // cover the entire area of the map feature with subscription rectangles
      const {
        templateCols,
        templateRows,
      } = createSubscriptionGrid_OVERCOVERAGE({
        sortedRectangleCoordinates,
        topicWildcardFilterDecimalPlaces,
      });
      // convert grid into array of topic filter strings
      for (const longitudeCoordinate of templateCols) {
        for (const latitudeCoordinate of templateRows) {
          const latitudeFilter = getTopicFilterStringFromNumber({
            coordinate: latitudeCoordinate,
            topicWildcardFilterDecimalPlace:
              topicWildcardFilterDecimalPlaces.latitudeDecimalPlace,
          });
          const longitudeFilter = getTopicFilterStringFromNumber({
            coordinate: longitudeCoordinate,
            topicWildcardFilterDecimalPlace:
              topicWildcardFilterDecimalPlaces.longitudeDecimalPlace,
          });
          topicFilters.push(
            `FDPS/position/*/*/*/${latitudeFilter}/-${longitudeFilter}/*/*/*/*`
          );
        }
      }
    }

    // can be extended to handle different shapes here
    console.dir(topicFilters);

    return topicFilters;
  }

  function deduplicateArray(coordinatePairArray) {
    return [...new Set(coordinatePairArray)];
  }

  function sortRectangleCoordinates(coordinatePairArray) {
    let sortedCoordinatePairs = coordinatePairArray
      .slice() // immutable base array
      .sort((pairA, pairB) => {
        if (pairA[0] == pairB[0]) {
          return pairA[1] - pairB[1];
        }
        return pairA[0] - pairB[0];
      });

    return sortedCoordinatePairs;
  }

  function getDistancesBetweenCoordinates(sortedCoordinatePairArray) {
    return {
      // bottom left - bottom right
      distanceLongitude:
        sortedCoordinatePairArray[0][0] - sortedCoordinatePairArray[2][0],
      // top left - bottom left
      distanceLatitude:
        sortedCoordinatePairArray[1][1] - sortedCoordinatePairArray[0][1],
    };
  }

  function getTopicWildcardFilterDecimalPlaces({
    distanceLongitude,
    distanceLatitude,
  }) {
    // calc longitude
    let longitude_abs = Math.abs(distanceLongitude);
    let longitudeDecimalPlace;
    if (longitude_abs >= 10) {
      longitudeDecimalPlace = 10;
    } else if (longitude_abs >= 1) {
      longitudeDecimalPlace = 1;
    } else if (longitude_abs >= 0) {
      longitudeDecimalPlace = 0.1;
    } else if (longitude_abs >= 0.1) {
      longitudeDecimalPlace = 0.01;
    } else if (longitude_abs >= 0.01) {
      longitudeDecimalPlace = 0.001;
    } else if (longitude_abs >= 0.001) {
      longitudeDecimalPlace = 0.0001;
    } else {
      // handle 5 decimal points
      longitudeDecimalPlace = 0.00001;
    }
    // calc latitude
    let latitude_abs = Math.abs(distanceLatitude);
    let latitudeDecimalPlace;
    if (latitude_abs >= 10) {
      latitudeDecimalPlace = 10;
    } else if (latitude_abs >= 1) {
      latitudeDecimalPlace = 1;
    } else if (latitude_abs >= 0) {
      latitudeDecimalPlace = 0.1;
    } else if (latitude_abs >= 0.1) {
      latitudeDecimalPlace = 0.01;
    } else if (latitude_abs >= 0.01) {
      latitudeDecimalPlace = 0.001;
    } else if (latitude_abs >= 0.001) {
      latitudeDecimalPlace = 0.0001;
    } else {
      // handle 5 decimal points
      latitudeDecimalPlace = 0.00001;
    }
    return { longitudeDecimalPlace, latitudeDecimalPlace };
  }

  function getTopicFilterStringFromNumber({
    coordinate,
    topicWildcardFilterDecimalPlace,
  }) {
    // Developer note:
    // Keeping the decimal place as a Number is convenient for forming the grid, ...
    // ... but we need to convert it back to a string/array to create a topic filter string.
    // I guess could index the decimal places, but I don't think it's necessary for this.

    const coordinateArray = coordinate.toFixed(5).toString().split("");
    const decimalPointIndex = coordinateArray.indexOf(".");

    if (topicWildcardFilterDecimalPlace >= 10) {
      coordinateArray[decimalPointIndex - 1] = "*";
      return coordinateArray.slice(0, decimalPointIndex).join("");
    } else if (topicWildcardFilterDecimalPlace >= 1) {
      coordinateArray[decimalPointIndex + 1] = "*";
      return coordinateArray.slice(0, decimalPointIndex + 2).join("");
    } else if (topicWildcardFilterDecimalPlace >= 0.1) {
      coordinateArray[decimalPointIndex + 2] = "*";
      return coordinateArray.slice(0, decimalPointIndex + 3).join("");
    } else if (topicWildcardFilterDecimalPlace >= 0.01) {
      coordinateArray[decimalPointIndex + 3] = "*";
      return coordinateArray.slice(0, decimalPointIndex + 4).join("");
    } else if (topicWildcardFilterDecimalPlace >= 0.001) {
      coordinateArray[decimalPointIndex + 4] = "*";
      return coordinateArray.slice(0, decimalPointIndex + 5).join("");
    } else {
      return coordinateArray.slice(0, decimalPointIndex + 5).join("");
    }
  }

  function createSubscriptionGrid_OVERCOVERAGE({
    sortedRectangleCoordinates,
    topicWildcardFilterDecimalPlaces,
  }) {
    // template cols = longitude
    let templateCols = [];
    const longitude_max = Math.abs(sortedRectangleCoordinates[0][0]);
    const longitude_min = Math.abs(sortedRectangleCoordinates[2][0]);
    let currentLongitude = longitude_min;
    templateCols.push(currentLongitude);
    while (currentLongitude <= longitude_max) {
      currentLongitude =
        currentLongitude +
        topicWildcardFilterDecimalPlaces.longitudeDecimalPlace;
      templateCols.push(currentLongitude);
    }
    // template rows = latitude
    let templateRows = [];
    const latitude_max = Math.abs(sortedRectangleCoordinates[1][1]);
    const latitude_min = Math.abs(sortedRectangleCoordinates[0][1]);
    let currentLatitude = latitude_min;
    templateRows.push(currentLatitude);
    while (currentLatitude <= latitude_max) {
      currentLatitude =
        currentLatitude + topicWildcardFilterDecimalPlaces.latitudeDecimalPlace;
      templateRows.push(currentLatitude);
    }

    return {
      templateCols,
      templateRows,
    };
  }

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
    // messaging interface
    configureMessagingInterface,
    // react-map-gl-draw interface
    onFeaturesUpdate,
    // utils
    logInfo,
    logError,
  };
}
