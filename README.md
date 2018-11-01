**rage-eventbus** simplifies two-way communication between the RAGE Multiplayer server, client, and browser instances.
It can be used as a full-on replacement for RAGE's built-in `mp.event` API, providing consistency and clarity.

### Examples

#### Server to Client

**Situation:** The server wants to ask a specific player if they are currently running.

##### Server-side
```javascript
const rbus = require('rage-eventbus');

const player = mp.players.at(0); // or any player object

rbus.sendClient(player, 'getIsRunning').then(running => {
    if(running){
        console.log('The player is running!');
    }else{
        console.log('The player is not running!');
    }
});

// or even just this inside an async function:
const isRunning = await rbus.sendClient(player, 'getIsRunning');
```

##### Client-side
```javascript
const rbus = require('rage-eventbus');

rbus.on('getIsRunning', () => mp.players.local.isRunning);
```

**_That's it!_** No extra code to sort out who is asking for what, or setting up multiple events on each side just to send a single piece of data back to the caller.

---

#### CEF to Server

**Situation:** A CEF instance wants a list of all vehicle license plates directly from the server.

##### Browser
```javascript
const rbus = require('rage-eventbus');

rbus.sendServer('getAllLicensePlates').then(plates => {
    alert(plates.join(', '));
});
```

##### Client-side
```javascript
// even if not using rbus on the client, it must be required somewhere before CEF can send any events
require('rage-eventbus');
```

##### Server-side
```javascript
const rbus = require('rage-eventbus');

rbus.on('getAllLicensePlates', () => {
    return mp.vehicles.toArray().map(vehicle => vehicle.plate);
});
```

With `rage-eventbus`, CEF can directly communicate with the server and vice-versa.

###### In vanilla RAGE, you would have to set up multiple events for sending/receiving on the client-side, call them from CEF, then resend the data to the server and back. It's a hassle.