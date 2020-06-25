/**
 * solace-client.js
 * @author Andrew Roberts
 */

import solace from "solclientjs";
import produce from "immer";

/**
 * A factory function that returns a solclientjs session wrapper.
 * If hostUrl or options are not provided, the client will attempt to
 * connect using Solace PubSub+ friendly defaults.
 * @param {string} hostUrl
 * @param {object} options
 */
export function createSolaceClient({
  // assign defaults if the values aren't included in the provided object,
  url = "ws://localhost:8000",
  vpnName = "default",
  userName = "default",
  password = "",

  ...rest
}) {
  /**
   * initialize solclientjs
   */
  let factoryProps = new solace.SolclientFactoryProperties();
  factoryProps.profile = solace.SolclientFactoryProfiles.version10;
  solace.SolclientFactory.init(factoryProps);

  /**
   * Private reference to the client connection objects
   */
  let session = null;
  let client = null;

  /**
   * Private map between topic subscriptions and their associated handler callbacks.
   * Messages are dispatched to all topic subscriptions that match the incoming message's topic.
   * subscribe and unsubscribe modify this object.
   */
  let subscriptions = produce({}, () => {});

  /**
   * event handlers
   *
   * solclientjs exposes session lifecycle events, or callbacks related to the session with the broker.
   * The methods below are sensible defaults, and can be modified using the exposed setters.
   * Source documentation here:
   */

  let onUpNotice = (sessionEvent) => {
    logInfo(`Connected`);
  };

  let onConnectFailedError = (sessionEvent) => {
    logError(`Connect failed`);
  };

  let onDisconnected = (sessionEvent) => {
    logInfo(`Disconnected`);
    if (session !== null) {
      session.dispose();
      //subscribed = false;
      session = null;
    }
  };

  // onMessage handler configured to dispatch incoming messages to
  // the associated handlers of all matching topic subscriptions.
  const onMessage = (message) => {
    const topic = message.getDestination().getName();
    for (const topicSubscription of Object.keys(subscriptions)) {
      if (topicMatchesTopicFilter(topicSubscription, topic)) {
        subscriptions[topicSubscription](message);
      }
    }
  };

  /**
   * event handler setters
   */

  function setOnUpNotice(_onUpNotice) {
    onUpNotice = _onUpNotice;
  }

  function setConnectFailedError(_onConnectFailedError) {
    onConnectFailedError = _onConnectFailedError;
  }

  function setDisconnected(_onDisconnected) {
    onDisconnected = _onDisconnected;
  }

  /**
   * Overloaded solclientjs connect method.
   * Resolves with a solclientjs session wrapper object if UP_NOTICE ,
   * rejects if there is an error while connecting.
   *
   *  Solace docs:  https://docs.solace.com/API-Developer-Online-Ref-Documentation/js/solace.Session.html#connect
   */
  async function connect() {
    return new Promise((resolve, reject) => {
      // guard: if session is already connected, do not try to connect again.
      if (session !== null) {
        logError("Error from connect() - already connected.");
        reject();
      }
      // guard: check url protocol
      if (url.indexOf("ws") != 0) {
        reject(
          "HostUrl must be the WebMessaging Endpoint that begins with either ws:// or wss://."
        );
      }

      // initialize session
      try {
        session = solace.SolclientFactory.createSession({
          url,
          vpnName,
          userName,
          password,
          connectRetries: 3,
          publisherProperties: {
            acknowledgeMode: solace.MessagePublisherAcknowledgeMode.PER_MESSAGE,
          },
        });
      } catch (error) {
        logError(error);
        reject();
      }

      /**
       * configure session event listeners
       */

      //The UP_NOTICE dictates whether the session has been established
      session.on(solace.SessionEventCode.UP_NOTICE, (sessionEvent) => {
        onUpNotice();
        resolve();
      });

      //The CONNECT_FAILED_ERROR implies a connection failure
      session.on(
        solace.SessionEventCode.CONNECT_FAILED_ERROR,
        (sessionEvent) => {
          onConnectFailedError();
          reject();
        }
      );

      //DISCONNECTED implies the client was disconnected
      session.on(solace.SessionEventCode.DISCONNECTED, (sessionEvent) => {
        onDisconnected();
      });

      //ACKNOWLEDGED MESSAGE implies that the broker has confirmed message receipt
      session.on(
        solace.SessionEventCode.ACKNOWLEDGED_MESSAGE,
        (sessionEvent) => {
          log(
            "Delivery of message with correlation key = " +
              sessionEvent.correlationKey +
              " confirmed."
          );
        }
      );

      //REJECTED_MESSAGE implies that the broker has rejected the message
      session.on(
        solace.SessionEventCode.REJECTED_MESSAGE_ERROR,
        (sessionEvent) => {
          log(
            "Delivery of message with correlation key = " +
              sessionEvent.correlationKey +
              " rejected, info: " +
              sessionEvent.infoStr
          );
        }
      );

      //SUBSCRIPTION ERROR implies that there was an error in subscribing on a topic
      session.on(solace.SessionEventCode.SUBSCRIPTION_ERROR, (sessionEvent) => {
        logError(`Cannot subscribe to topic: ${sessionEvent.correlationKey}`);
        // remove subscription
        subscriptions = produce(subscriptions, (draft) => {
          delete draft[sessionEvent.correlationKey];
        });
      });

      //SUBSCRIPTION_OK implies that a subscription was succesfully applied/removed from the broker
      session.on(solace.SessionEventCode.SUBSCRIPTION_OK, (sessionEvent) => {
        log(
          `Session co-relation-key for event: ${sessionEvent.correlationKey}`
        );
        //Check if the topic exists in the map
        if (topicSubscriptions.get(sessionEvent.correlationKey)) {
          //If the subscription shows as subscribed, then this is a callback for unsubscripition
          if (
            topicSubscriptions.get(sessionEvent.correlationKey).isSubscribed
          ) {
            //Remove the topic from the map
            topicSubscriptions.delete(sessionEvent.correlationKey);
            log(
              `Successfully unsubscribed from topic: ${sessionEvent.correlationKey}`
            );
          } else {
            //Otherwise, this is a callback for subscribing
            topicSubscriptions.get(
              sessionEvent.correlationKey
            ).isSubscribed = true;
            log(
              `Successfully subscribed to topic: ${sessionEvent.correlationKey}`
            );
          }
        }
      });

      //Message callback function
      session.on(solace.SessionEventCode.MESSAGE, (message) => {
        //Get the topic name from the message's destination
        let topicName: string = message.getDestination().getName();

        //Iterate over all subscriptions in the subscription map
        for (let sub of Array.from(this.topicSubscriptions.keys())) {
          //Replace all * in the topic filter with a .* to make it regex compatible
          let regexdSub = sub.replace(/\*/g, ".*");

          //if the last character is a '>', replace it with a .* to make it regex compatible
          if (sub.lastIndexOf(">") == sub.length - 1)
            regexdSub = regexdSub
              .substring(0, regexdSub.length - 1)
              .concat(".*");

          let matched = topicName.match(regexdSub);

          //if the matched index starts at 0, then the topic is a match with the topic filter
          if (matched && matched.index == 0) {
            //Edge case if the pattern is a match but the last character is a *
            if (regexdSub.lastIndexOf("*") == sub.length - 1) {
              //Check if the number of topic sections are equal
              if (regexdSub.split("/").length != topicName.split("/").length)
                return;
            }
            //Proceed with the message callback for the topic subscription if the subscription is active
            if (
              this.topicSubscriptions.get(sub) &&
              this.topicSubscriptions.get(sub).isSubscribed &&
              this.topicSubscriptions.get(sub).callback != null
            )
              console.log(`Got callback for ${sub}`);
            this.topicSubscriptions.get(sub).callback(message);
          }
        }
      });
      // connect the session
      try {
        this.session.connect();
      } catch (error) {
        this.log(error.toString());
      }
    });
  }

  /**
   * Overloaded solclientjs subscribe method.
   * Extends default subscribe behavior by accepting a handler argument
   * that is called with any incoming messages that match the topic subscription.
   * https://docs.solace.com/API-Developer-Online-Ref-Documentation/js/solace.Session.html#subscribe
   * @param {string} topic
   * @param {any} handler
   */
  async function subscribe(topic, handler) {
    return new Promise(async (resolve, reject) => {
      //Check if the session has been established
      if (!this.session) {
        logError(
          "[WARNING] Cannot subscribe because not connected to Solace message router!"
        );
        reject();
      }
      //Check if the subscription already exists
      if (this.topicSubscriptions.get(topicName)) {
        this.log(`[WARNING] Already subscribed to ${topicName}.`);
        return;
      }
      this.log(`Subscribing to ${topicName}`);
      //Create a subscription object with the callback, upon succesful subscription, the object will be updated
      let subscriptionObject: SubscriptionObject = new SubscriptionObject(
        callback,
        false
      );
      this.topicSubscriptions.set(topicName, subscriptionObject);
      try {
        //Session subscription
        this.session.subscribe(
          solace.SolclientFactory.createTopicDestination(topicName),
          true, // generate confirmation when subscription is added successfully
          topicName, // use topic name as correlation key
          10000 // 10 seconds timeout for this operation
        );
      } catch (error) {
        this.log(error.toString());
      }
    });
  }

  /**
   * Overloaded MQTT.js Client unsubscribe method.
   * Extends default unsubscribe behavior by removing any handlers
   * that were associated with the topic subscription.
   * https://github.com/mqttjs/MQTT.js/blob/master/README.md#subscribe
   * @param {string} topic
   * @param {object} options
   * @param {any} handler
   */
  async function unsubscribe(topic) {
    return new Promise((resolve, reject) => {
      // guard: do not try to unsubscribe if client has not yet been connected
      if (!client) {
        logError(`, client is not connected`);
        reject();
      }
      // remove event handler
      subscriptions = produce(subscriptions, (draft) => {
        delete draft[topic];
      });
      // unsubscribe from topic on client
      client.unsubscribe(topic, {}, function onUnsubAck(err) {
        // guard: err != null indicates an error occurs if client is disconnecting
        if (err) reject(err);
        // else, unsubscription verified
        resolve();
      });
    });
  }

  /**
   * Unsubscribes the client from all its topic subscriptions
   */
  async function unsubscribeAll() {
    return new Promise(async (resolve, reject) => {
      // guard: do not try to unsubscribe if client has not yet been connected
      if (!client) {
        logError(`, client is not connected`);
        reject();
      }
      // unsubscribe from all topics on client
      Object.keys(subscriptions).map((topicFilter, _) =>
        console.log(topicFilter)
      );

      await Promise.all(
        Object.keys(subscriptions).map((topicFilter, _) =>
          unsubscribe(topicFilter)
        )
      ).catch((err) => reject(err));

      resolve();
    });
  }

  /**
   * info level logger
   * @param {string} message
   */
  function logInfo(message) {
    const log = {
      clientId,
      username,
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
      clientId,
      username,
      time: new Date().toISOString(),
      error: error,
    };
    console.error(JSON.stringify(errorLog));
  }

  /**
   * This factory function returns an object that only exposes methods to configure and connect the client.
   * Methods to add subscriptions (and all others) are exposed in the client the connect method resolves with.
   */
  return produce({}, (draft) => {
    // overloaded solclientjs methods
    draft.connect = connect;
    // setters for solclientjs session event handlers
    draft.setOnUpNotice = setOnUpNotice;
    draft.setConnectFailedError = setConnectFailedError;
    draft.setDisconnected = setDisconnected;
    // utility functions
    draft.logInfo = logInfo;
    draft.logError = logError;
  });
}

/**
 * Return a boolean indicating whether the topic filter the topic.
 * @param {string} topicFilter
 * @param {string} topic
 */
export function topicMatchesTopicFilter(topicFilter, topic) {
  // convert topic filter to a regex and see if the incoming topic matches it
  let topicFilterRegex = convertSolaceTopicFilterToRegex(topicFilter);
  let match = topic.match(topicFilterRegex);

  // if the match index starts at 0, the topic matches the topic filter
  if (match && match.index == 0) {
    // guard: check edge case where the pattern is a match but the last character is *
    if (topicFilterRegex.lastIndexOf("*") == topic.length - 1) {
      // if the number of topic sections are not equal, the match is a false positive
      if (topicFilterRegex.split("/").length != topic.split("/").length) {
        return false;
      }
    }
    // if no edge case guards return early, the match is genuine
    return true;
  }

  // else the match object is empty, and the topic is not a match with the topic filter
  else {
    return false;
  }
}

/**
 * Convert Solace topic filter wildcards and system symbols into regex
 * Useful resource for learning: https://regexr.com/
 * @param {string} topicFilter
 */
export function convertSolaceTopicFilterToRegex(topicFilter) {
  // convert single-level wildcard * to .*, or "any character, zero or more repetitions", ...
  // ... as well as Solace system characters "#"
  let topicFilterRegex = topicFilter.replace(/\*/g, ".*").replace(/\#/g, ".*");
  // convert multi-level wildcard > to .* if it is in a valid position in the topic filter
  if (topicFilter.lastIndexOf(">") == topicFilter.length - 1) {
    topicFilterRegex = topicFilterRegex
      .substring(0, topicFilterRegex.length - 1)
      .concat(".*");
  }

  return topicFilterRegex;
}

/**
 * Attempt to serialize provided message.
 * Logs and rejects on errors, resolves with publish-safe string on success.
 * @param {object|string|number|null} message
 */
export function serializeMessage(message) {
  return new Promise((resolve, reject) => {
    try {
      // handle non-null objects
      if (typeof message === "object" && message !== null) {
        resolve(JSON.stringify(message));
      }

      // handle numbers
      if (typeof message === "number") {
        resolve(message.toString());
      }

      // handle booleans
      if (typeof message === "boolean") {
        resolve(String.valueOf(message));
      }
      // handle strings
      if (typeof message === "string") {
        resolve(message);
      }

      // handle null
      if (message === null) {
        resolve("");
      }
    } catch (error) {
      /**
       * if you pass an object to this function that can't be stringified,
       * this catch block will catch and log the error
       */
      logError(error);
      reject();
    }
  });
}
