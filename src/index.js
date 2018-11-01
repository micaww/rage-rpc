const util  = require('./util.js');

const environment = util.getEnvironment();
if(!environment) throw 'Unknown RAGE environment';

const PROCESS_EVENT = '__rpc:process';

const rpc = {};

const listeners = {};
const pending = {};

async function callProcedure(name, args, info){
    if(!listeners[name]) throw 'PROCEDURE_NOT_FOUND';
    return listeners[name](args, info);
}

let passEventToBrowsers;
if(environment === "client"){
    passEventToBrowsers = (raw) => {
        mp.browsers.forEach(browser => {
            browser.execute(`var process = window["${PROCESS_EVENT}"] || function(){}; process('${raw}');`);
        });
    };
}

const processEvent = (...args) => {
    let rawData = args[0];
    if(environment === "server") rawData = args[1];
    const data = util.parseData(rawData);

    if(data.thru && environment === "client"){
        if(data.req){ // a CEF request is trying to get to the server
            mp.events.callRemote(PROCESS_EVENT, rawData);
        }else if(data.ret){ // a server response is trying to get to a CEF instance
            passEventToBrowsers(rawData);
        }
        return;
    }

    if(data.req){ // someone is trying to remotely call a procedure
        const info = {
            id: data.id,
            environment: data.env
        };
        if(environment === "server") info.player = args[0];
        const promise = callProcedure(data.name, data.args, info);
        switch(environment){
            case "server": {
                const part = {
                    ret: 1,
                    id: data.id
                };
                if(data.thru) part.thru = 1;
                promise.then(res => {
                    info.player.call(PROCESS_EVENT, [util.stringifyData({
                        ...part,
                        res
                    })]);
                }).catch(err => {
                    info.player.call(PROCESS_EVENT, [util.stringifyData({
                        ...part,
                        err
                    })]);
                });
                break;
            }
            case "client": {
                const part = {
                    ret: 1,
                    id: data.id
                };
                if(data.env === "server"){
                    promise.then(res => {
                        mp.events.callRemote(PROCESS_EVENT, util.stringifyData({
                            ...part,
                            res
                        }));
                    }).catch(err => {
                        mp.events.callRemote(PROCESS_EVENT, util.stringifyData({
                            ...part,
                            err
                        }));
                    });
                }else if(data.env === "cef"){
                    promise.then(res => {
                        passEventToBrowsers(util.stringifyData({
                            ...part,
                            res
                        }));
                    }).catch(err => {
                        passEventToBrowsers(util.stringifyData({
                            ...part,
                            err
                        }));
                    });
                }
                break;
            }
        }
    }else if(data.ret){ // a previously called remote procedure has returned
        const info = pending[data.id];
        if(info){
            if(data.err) info.reject(data.err);
            else info.resolve(data.res);
            pending[data.id] = undefined;
        }
    }
};

if(environment === "cef"){
    window[PROCESS_EVENT] = processEvent;
}else{
    mp.events.add(PROCESS_EVENT, processEvent);
}

/**
 * Register a procedure.
 * @param {string} name - The name of the procedure.
 * @param {function} cb - The procedure's callback. The return value will be sent back to the caller.
 */
rpc.register = (name, cb) => {
    listeners[name] = cb;
};

/**
 * Unregister a procedure.
 * @param {string} name - The name of the procedure.
 */
rpc.unregister = (name) => {
    listeners[name] = undefined;
};

/**
 * Calls a local procedure.
 * @param {string} name - The name of the locally registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
rpc.call = (name, args) => callProcedure(name, args, { environment });

/**
 * Calls a remote procedure registered on the server.
 * @param {string} name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
rpc.callServer = (name, args) => {
    switch(environment){
        case "server": {
            return rpc.call(name, args);
        }
        case "client": {
            const id = util.uid();
            return new Promise((resolve, reject) => {
                pending[id] = {
                    resolve,
                    reject
                };
                mp.events.callRemote(PROCESS_EVENT, util.stringifyData({
                    req: 1,
                    id,
                    name,
                    env: environment,
                    args
                }));
            });
        }
        case "cef": {
            const id = util.uid();
            return new Promise((resolve, reject) => {
                pending[id] = {
                    resolve,
                    reject
                };
                mp.trigger(PROCESS_EVENT, util.stringifyData({
                    req: 1,
                    id,
                    name,
                    env: environment,
                    args,
                    thru: 1
                }));
            });
        }
    }
};

/**
 * Calls a remote procedure registered on the client.
 * @param [player] - The player to call the procedure on.
 * @param {string} name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
rpc.callClient = (player, name, args) => {
    if(typeof player === "string"){
        if(environment === "server") return Promise.reject('This syntax can only be used in browser and client environments.');
        args = name;
        name = player;
    }
    switch(environment){
        case "client": {
            if(player === mp.players.local) return rpc.call(name, args);
            else return Promise.reject('Only the server can RPC to other clients.');
        }
        case "server": {
            const id = util.uid();
            return new Promise((resolve, reject) => {
                pending[id] = {
                    resolve,
                    reject
                };
                player.call(PROCESS_EVENT, [util.stringifyData({
                    req: 1,
                    id,
                    name,
                    env: environment,
                    args
                })]);
            });
        }
        case "cef": {
            const id = util.uid();
            return new Promise((resolve, reject) => {
                pending[id] = {
                    resolve,
                    reject
                };
                mp.trigger(PROCESS_EVENT, util.stringifyData({
                    req: 1,
                    id,
                    name,
                    env: environment,
                    args
                }));
            });
        }
    }
};

module.exports = rpc;