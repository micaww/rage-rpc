import * as util from './util.js';

const environment = util.getEnvironment();
if(!environment) throw 'Unknown RAGE environment';

const ERR_NOT_FOUND = 'PROCEDURE_NOT_FOUND';

const PROCESS_EVENT = '__rpc:process';
const PROCEDURE_EXISTS = '__rpc:exists';

const glob = environment === "cef" ? window : global;

const init = !glob[PROCESS_EVENT];

if(init){
    glob.__rpcListeners = {};
    glob.__rpcPending = {};

    glob[PROCESS_EVENT] = (...args) => {
        let rawData = args[0];
        if(environment === "server") rawData = args[1];
        const data = util.parseData(rawData);


        if(data.req){ // someone is trying to remotely call a procedure
            const info = {
                id: data.id,
                environment: data.fenv || data.env
            };
            if(environment === "server") info.player = args[0];
            const promise = callProcedure(data.name, data.args, info);
            const part = {
                ret: 1,
                id: data.id
            };
            switch(environment){
                case "server": {
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
                            passEventToBrowsers({
                                ...part,
                                res
                            });
                        }).catch(err => {
                            passEventToBrowsers({
                                ...part,
                                err
                            });
                        });
                    }
                    break;
                }
                case "cef": {
                    promise.then(res => {
                        mp.trigger(PROCESS_EVENT, util.stringifyData({
                            ...part,
                            res
                        }));
                    }).catch(err => {
                        mp.trigger(PROCESS_EVENT, util.stringifyData({
                            ...part,
                            err
                        }));
                    });
                }
            }
        }else if(data.ret){ // a previously called remote procedure has returned
            const info = glob.__rpcPending[data.id];
            if(info){
                if(data.err) info.reject(data.err);
                else info.resolve(data.res);
                glob.__rpcPending[data.id] = undefined;
            }
        }
    };

    if(environment === "cef"){
        window[PROCEDURE_EXISTS] = name => !!glob.__rpcListeners[name];
    }else{
        mp.events.add(PROCESS_EVENT, glob[PROCESS_EVENT]);

        if(environment === "client"){
            // set up internal pass-through events
            register('__rpc:callServer', ([name, args], info) => {
                return _callServer(name, args, {
                    fenv: info.environment
                });
            });
            register('__rpc:callBrowsers', ([name, args], info) => {
                return _callBrowsers(name, args, null, {
                    fenv: info.environment
                });
            });
        }
    }
}

let passEventToBrowser, passEventToBrowsers;
if(environment === "client"){
    passEventToBrowser = (browser, data) => {
        const raw = util.stringifyData(data);
        browser.execute(`var process = window["${PROCESS_EVENT}"]; if(process){ process('${raw}'); }else{ mp.trigger("${PROCESS_EVENT}", '{"ret":1,"id":"${data.id}","err":"${ERR_NOT_FOUND}"}'); }`);
    };

    passEventToBrowsers = (data) => {
        mp.browsers.forEach(browser => passEventToBrowser(browser, data));
    };
}

async function callProcedure(name, args, info){
    const listener = glob.__rpcListeners[name];
    if(!listener) throw ERR_NOT_FOUND;
    return listener(args, info);
}

/**
 * Register a procedure.
 * @param {string} name - The name of the procedure.
 * @param {function} cb - The procedure's callback. The return value will be sent back to the caller.
 */
export function register(name, cb){
    if(arguments.length !== 2) throw 'register expects 2 arguments: "name" and "cb"';
    glob.__rpcListeners[name] = cb;
}

/**
 * Unregister a procedure.
 * @param {string} name - The name of the procedure.
 */
export function unregister(name){
    if(arguments.length !== 1) throw 'unregister expects 1 argument: "name"';
    glob.__rpcListeners[name] = undefined;
}

/**
 * Calls a local procedure. Only procedures registered in the same context will be resolved.
 *
 * Can be called from any environment.
 *
 * @param {string} name - The name of the locally registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
export function call(name, args){
    if(arguments.length !== 1 && arguments.length !== 2) return Promise.reject('call expects 1 or 2 arguments: "name" and optional "args"');
    return callProcedure(name, args, { environment });
}

function _callServer(name, args, extraData){
    switch(environment){
        case "server": {
            return call(name, args);
        }
        case "client": {
            const id = util.uid();
            return new Promise((resolve, reject) => {
                glob.__rpcPending[id] = {
                    resolve,
                    reject
                };
                mp.events.callRemote(PROCESS_EVENT, util.stringifyData({
                    req: 1,
                    id,
                    name,
                    env: environment,
                    args,
                    ...extraData
                }));
            });
        }
        case "cef": {
            return callClient('__rpc:callServer', [name, args]);
        }
    }
}

/**
 * Calls a remote procedure registered on the server.
 *
 * Can be called from any environment.
 *
 * @param {string} name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
export function callServer(name, args){
    if(arguments.length !== 1 && arguments.length !== 2) return Promise.reject('callServer expects 1 or 2 arguments: "name" and optional "args"');
    return _callServer(name, args, {});
}

/**
 * Calls a remote procedure registered on the client.
 *
 * Can be called from any environment.
 *
 * @param player - The player to call the procedure on.
 * @param {string} name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
// serverside
// callClient(player, name, args)
//
// clientside or cef
// callClient(name, args)
export function callClient(player, name, args){
    switch(environment){
        case "client": {
            args = name;
            name = player;
            if((arguments.length !== 1 && arguments.length !== 2) || typeof name !== "string") return Promise.reject('callClient from the client expects 1 or 2 arguments: "name" and optional "args"');
            return call(name, args);
        }
        case "server": {
            if((arguments.length !== 2 && arguments.length !== 3) || typeof player !== "object") return Promise.reject('callClient from the server expects 2 or 3 arguments: "player", "name", and optional "args"');
            const id = util.uid();
            return new Promise((resolve, reject) => {
                glob.__rpcPending[id] = {
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
            args = name;
            name = player;
            if((arguments.length !== 1 && arguments.length !== 2) || typeof name !== "string") return Promise.reject('callClient from the browser expects 1 or 2 arguments: "name" and optional "args"');
            const id = util.uid();
            return new Promise((resolve, reject) => {
                glob.__rpcPending[id] = {
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
}

function _callBrowser(id, browser, name, args, extraData){
    return new Promise((resolve, reject) => {
        glob.__rpcPending[id] = {
            resolve,
            reject
        };
        passEventToBrowser(browser, {
            req: 1,
            id,
            name,
            env: environment,
            args,
            ...extraData
        });
    });
}
async function _callBrowsers(player, name, args, extraData){
    switch(environment){
        case "client": {
            args = name;
            name = player;
            const id = util.uid();
            const numBrowsers = mp.browsers.length;
            let browser;
            for(let i = 0; i < numBrowsers; i++){
                const b = mp.browsers.at(i);
                await new Promise(resolve => {
                    const existsHandler = str => {
                        const parts = str.split(':');
                        if(parts[0] === id){
                            if(+parts[1]){
                                browser = b;
                            }
                        }
                        mp.events.remove(PROCEDURE_EXISTS, existsHandler);
                        resolve();
                    };
                    mp.events.add(PROCEDURE_EXISTS, existsHandler);
                    b.execute(`var f = window["${PROCEDURE_EXISTS}"]; mp.trigger("${PROCEDURE_EXISTS}", "${id}:"+((f && f("${name}")) ? 1 : 0));`);
                });
                if(browser) break;
            }
            if(browser) return _callBrowser(id, browser, name, args, extraData);
            throw ERR_NOT_FOUND;
        }
        case "server": {
            return callClient(player, '__rpc:callBrowsers', [name, args]);
        }
        case "cef": {
            args = name;
            name = player;
            return callClient('__rpc:callBrowsers', [name, args]);
        }
    }
}

/**
 * Calls a remote procedure registered in any browser context.
 *
 * Can be called from any environment.
 *
 * @param {object} [player] - The player to call the procedure on.
 * @param {string} name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
export function callBrowsers(player, name, args){
    switch(environment){
        case "client":
            if(arguments.length !== 1 && arguments.length !== 2) return Promise.reject('callBrowsers from the client expects 1 or 2 arguments: "name" and optional "args"');
            break;
        case "server":
            if(arguments.length !== 2 && arguments.length !== 3) return Promise.reject('callBrowsers from the server expects 2 or 3 arguments: "player", "name", and optional "args"');
            break;
        case "cef":
            if(arguments.length !== 1 && arguments.length !== 2) return Promise.reject('callBrowsers from the browser expects 1 or 2 arguments: "name" and optional "args"');
            break;
    }
    return _callBrowsers(player, name, args, {});
}

/**
 * Calls a remote procedure registered in a specific browser instance.
 *
 * Client-side environment only.
 *
 * @param {object} browser - The browser instance.
 * @param {string} name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
export function callBrowser(browser, name, args){
    if(environment !== "client") return Promise.reject('callBrowser can only be used in the client environment');
    if(arguments.length !== 2 && arguments.length !== 3) return Promise.reject('callBrowser expects 2 or 3 arguments: "browser", "name", and optional "args"');
    const id = util.uid();
    return _callBrowser(id, browser, name, args, {});
}