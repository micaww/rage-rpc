**rage-rpc** simplifies two-way communication between the RAGE Multiplayer server, client, and browser instances by providing a easy-to-use API for calling remote code and retrieving results.

---

## Examples

### Server to Client

**Situation:** The server wants to ask a specific player if they are currently climbing anything.

##### Client-side
```javascript
const rpc = require('rage-rpc');

rpc.register('getIsClimbing', () => mp.players.local.isClimbing());
```

##### Server-side
```javascript
const rpc = require('rage-rpc');

const player = mp.players.at(0);

rpc.callClient(player, 'getIsClimbing').then(climbing => {
    if(climbing){
        console.log('The player is climbing!');
    }else{
        console.log('The player is not climbing!');
    }
});

// or even just this inside an async function:
const isClimbing = await rpc.callClient(player, 'getIsClimbing');
```

**_That's it!_** No extra code to sort out who is asking for what, or setting up multiple events on each side just to send a single piece of data back to the caller.

---

### CEF to Server

**Situation:** A CEF instance wants a list of all vehicle license plates directly from the server.

##### Server-side
```javascript
const rpc = require('rage-rpc');

rpc.register('getAllLicensePlates', () => mp.vehicles.toArray().map(vehicle => vehicle.numberPlate));
```

##### Client-side
```javascript
// even if not using RPC on the client, it must be required somewhere before CEF can send any events
require('rage-rpc');
```

##### Browser
```javascript
const rpc = require('rage-rpc');

rpc.callServer('getAllLicensePlates').then(plates => {
    alert(plates.join(', '));
});
```

With `rage-rpc`, CEF can directly communicate with the server and vice-versa, without having to pass everything through the client-side JS.

###### In vanilla RAGE, you would have to set up multiple events for sending/receiving on the client-side, call them from CEF, then resend the data to the server and back. It's a huge hassle.

---

### Client to Server

**Situation:** Give the clients/CEF the ability to log to the server's console.

##### Server-side
```javascript
const rpc = require('rage-rpc');

rpc.register('log', (message, info) => {
    /*
    the second argument, info, gives information about the request such as
    - the internal ID of the request
    - the environment in which the request was sent (server, client, or cef)
    - the player who sent the request, if any
    */
    
    console.log(info.player.name+': '+message);
});
```

##### Client-side OR Browser
```javascript
const rpc = require('rage-rpc');

function log(message){
    return rpc.callServer('log', message);
}

// send it and forget it
log("Hello, Server!");

// send it again, but make sure it was successfully received
log("Hello again!").then(() => {
    // the server acknowledged and processed the message
}).catch(() => {
    // the message either timed out or the procedure was never registered
});
```

Note that once any side of the game registers a procedure, any context can immediately start accessing it. You could call `rpc.callServer('log', message);` from any CEF instance or anywhere in the client without any further setup.
