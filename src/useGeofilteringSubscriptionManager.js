/**
 * useGeofilteringSubscriptionManager.js
 * converts filter shapes into a list of subscriptions
 * @author Andrew Roberts
 */

import { useImmer } from "use-immer";

/**
 * This function initializes an instance of a geofiltering subscription manager in
 * listening state. Parent container then needs to configure the instance using
 * setSubscribe and setUnsubscribe, which can be set to most MQTT client's subscribe/unsubscribe methods.
 * It's not totally generic, so if you want to hook up something that isn't MQTT you'll have to fiddle with the
 * addSubscription and removeSubscription method arguments.
 * @param {*} fdpsFlightPositionEventHandler
 */
export function useGeofilteringSubscriptionManager(
  fdpsFlightPositionEventHandler
) {
  /**
   * generic messaging client interface
   */

  let subscribe = function () {
    logInfo("Waiting to be initialized");
  };

  let unsubscribe = function () {
    logInfo("Waiting to be initialized");
  };

  /**
   * add subscription
   * @param {Object} props
   */
  async function addSubscription({ topicFilter, options: { qos = 0 } }) {
    try {
      await subscribe(topicFilter, { qos }, fdpsFlightPositionEventHandler);
    } catch (err) {
      // could handle re-try logic here, but don need to for this demo
      logError(err);
    }
  }

  /**
   * remove subscription
   * @param {string} topicFilter
   */
  async function removeSubscription(topicFilter) {
    try {
      await unsubscribe(topicFilter);
    } catch (err) {
      // could handle re-try logic here, but don need to for this demo
      logError(err);
    }
  }

  /**
   * setters, used by parent container to configure this instance with the methods of its mqtt client
   */

  let setSubscribe = function (_subscribe) {
    subscribe = _subscribe;
  };

  let setUnsubscribe = function (_unsubscribe) {
    unsubscribe = _unsubscribe;
  };

  /**
   * session object
   */
  const [state, updateState] = useImmer({
    filters: {
      rectangles: [],
    },
    subscriptions: {
      default: "FDPS/position/#",
    },
  });

  /**
   * handle rectangle filter map feature add event
   * @param {Object[]} rectangle
   */
  async function addFilterRectangle(rectangle) {}

  /**
   * handle rectangle filter map feature remove event
   */
  function removeFilterRectangle(rectangleName) {}

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
    // methods to interpret react-map-gl-draw events
    addFilterRectangle,
    removeFilterRectangle,
    // setters
    setSubscribe,
    setUnsubscribe,
    // utils
    logInfo,
    logError,
  };
}
