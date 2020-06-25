/**
 * useFdpsFeed.js
 * @author Andrew Roberts
 */

import { useImmer } from "use-immer";

export function useFdpsFeed() {
  /**
   * session object
   */
  const [session, updateSession] = useImmer({
    aircrafts: {},
    messagesReceived: 0,
  });

  /**
   * event handler that integrates geofiltering client with an instance of a Solace compatible client
   */
  const fdpsFlightPositionEventHandler = (topic, message, packet) =>
    onFdpsFlightPositionEvent(parseTopic(splitTopic(topic)));

  /**
   * update session using incoming fdpsFlightPositionEvents
   * @param {Object} fdpsFlightPositionEvent
   */
  function onFdpsFlightPositionEvent(fdpsFlightPositionEvent) {
    updateSession((draft) => {
      // store latest tick for each aircraft
      draft.aircrafts[
        fdpsFlightPositionEvent.aircraftIdentifier
      ] = fdpsFlightPositionEvent;
      // increment messagesReceived count
      draft.messagesReceived = draft.messagesReceived + 1;
    });
  }

  /**
   * returns object representation of provided fdpsFlightPositionEvent topic
   * @param {*} topic
   * @returns {Object}
   */
  function parseTopic(topicArray) {
    return {
      root: topicArray[0],
      feed: topicArray[1],
      identifier: topicArray[2],
      fdpsFlightStatus: topicArray[3],
      aircraftIdentifier: topicArray[4],
      lat: topicArray[5],
      lon: topicArray[6],
      actualSpeed: topicArray[7],
      altitude: topicArray[8],
      trackVelocityX: topicArray[9],
      trackVelocityY: topicArray[10],
    };
  }

  function splitTopic(topic) {
    return topic.split("/");
  }

  return { session, fdpsFlightPositionEventHandler };
}
