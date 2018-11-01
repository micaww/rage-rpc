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

const processEvent = (...args) => {
    let data = args[0];
    if(environment === "server") data = args[1];
    data = util.parseData(data);

    if(data.req){ // someone is trying to remotely call a procedure
        const info = {
            id: data.id,
            environment: data.env
        };
        if(environment === "server") info.player = args[0];
        const promise = callProcedure(data.name, data.args, info);
        switch(environment){
            case "server": {
                promise.then(res => {
                    info.player.call(PROCESS_EVENT, [util.stringifyData({
                        ret: 1,
                        id: data.id,
                        res
                    })]);
                }).catch(err => {
                    info.player.call(PROCESS_EVENT, [util.stringifyData({
                        ret: 1,
                        id: data.id,
                        err
                    })]);
                });
                break;
            }
            case "client": {
                promise.then(res => {
                    mp.events.callRemote(PROCESS_EVENT, util.stringifyData({
                        ret: 1,
                        id: data.id,
                        res
                    }));
                }).catch(err => {
                    mp.events.callRemote(PROCESS_EVENT, util.stringifyData({
                        ret: 1,
                        id: data.id,
                        err
                    }));
                });
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

mp.events.add(PROCESS_EVENT, processEvent);

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
    }
};

/**
 * Calls a remote procedure registered on the client.
 * @param player - The player to call the procedure on.
 * @param {string} name - The name of the registered procedure.
 * @param args - Any parameters for the procedure.
 * @returns {Promise} - The result from the procedure.
 */
rpc.callClient = (player, name, args) => {
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
    }
};

module.exports = rpc;