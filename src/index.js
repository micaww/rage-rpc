const util  = require('./util.js');

//const isClient = !!mp.game.joaat;
//const isCEF = !!mp.trigger;

const listeners = {};

/*mp.events.add('rbus:process', (data) => {

});*/

const rbus = {};

/**
 * Register an event listener.
 * @param {string} eventName - The name of the event.
 * @param {function} cb - The event's callback. The return value will be sent back to the caller.
 */
rbus.on = (eventName, cb) => {
    if(!listeners[eventName]) listeners[eventName] = [];
    listeners[eventName].push(cb);
};

/**
 * Unregister an event listener.
 * @param {string} eventName - The name of the event.
 * @param {function} cb - The callback that was registered with `on`.
 */
rbus.off = (eventName, cb) => {
    if(!listeners[eventName]) return;
    listeners[eventName] = listeners[eventName].filter(listener => listener !== cb);
};

/**
 * Calls a local event listener.
 * @param {string} eventName - The name of the event.
 * @returns {Promise} - The result from the local event listener.
 */
rbus.send = (eventName) => {
    if(!listeners[eventName] || !listeners[eventName].length) return Promise.reject('NO_LISTENERS');
    return Promise.resolve(listeners[eventName][0]());
};

/**
 * Calls a remote event listener residing on the server.
 * @param {string} eventName - The name of the event.
 * @returns {Promise} - The result from the remote event listener.
 */
rbus.sendServer = (eventName) => {

};

/**
 * Calls a remote event listener residing on the client.
 * @param player - The player to send to
 * @param {string} eventName - The name of the event
 * @returns {Promise} - The result from the remote event listener
 */
rbus.sendClient = (player, eventName) => {

};

module.exports = rbus;