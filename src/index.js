const util  = require('./util.js');

const environment = util.getEnvironment();
if(!environment) throw 'Unknown RAGE environment';

const PROCESS_EVENT = '__rpc:process';
const PROCEDURE_EXISTS = '__rpc:exists';

const rpc = {};

const listeners = {};
const pending = {};

let passEventToBrowser, passEventToBrowsers;
if(environment === "client"){
    passEventToBrowser = (browser, raw) => {
        browser.execute(`var process = window["${PROCESS_EVENT}"] || function(){}; process('${raw}');`);
    };

    passEventToBrowsers = (raw) => {
        mp.browsers.forEach(browser => passEventToBrowser(browser, raw));
    };
}

async function callProcedure(name, args, info){
    if(!listeners[name]) throw 'PROCEDURE_NOT_FOUND';
    return listeners[name](args, info);
}

const processEvent = (...args) => {
    let rawData = args[0];
    if(environment === "server") rawData = args[1];
    const data = util.parseData(rawData);

    if(data.req){ // someone is trying to remotely call a procedure
        const info = {
            id: data.id,
            environment: data.env
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
    window[PROCEDURE_EXISTS] = name => !!listeners[name];
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
            /*const id = util.uid();
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
            });*/
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
// serverside
// callClient(player, name, args)
//
// clientside or cef
// callClient(name, args)
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

/**
 * Calls a remote procedure registered in any browser context.
 * @param {string} name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
//serverside
//callBrowser(player, name, args)
//
//clientside or cef
//callBrowser(name, args)
//
//clientside
//callBrowser(browser, name, args)
rpc.callBrowser = async (name, args) => {
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
    if(browser){
        return new Promise((resolve, reject) => {
            pending[id] = {
                resolve,
                reject
            };
            passEventToBrowser(browser, util.stringifyData({
                req: 1,
                id,
                name,
                env: environment,
                args
            }));
        });
    }
    return Promise.reject('PROCEDURE_NOT_FOUND');
};

module.exports = rpc;