## Motivation

A very common workflow when developing with any kind of client-server platform is not only sending data between the server and clients, but also receiving data back after performing some kind of action. An example would be a client asking for information from a database in order to display to the user. One technique to achieve this is called [remote procedure calls (RPC)](https://en.wikipedia.org/wiki/Remote_procedure_call) which allows one application context to call code in a completely separate context and return the result back to the caller, as if it were local to begin with.

In RAGE Multiplayer, this kind of functionality is not supported natively. In order for a player to ask something of the server, the server must set up an event handler that the player calls remotely, then the server does its processing and calls _another_ event handler that resides on the client. There are many pitfalls to this approach, including but not limited to messy code and false identification (am i sending the response to the right caller instance?). Natively, the server cannot directly communicate with CEF instances at all. You have to route *all requests* through the client. Suddenly, you have 16 different events to handle one simple data request. It's horrible. And when your codebase starts growing, it becomes a huge hassle to deal with.

This is pretty much what everybody has learned to deal with, until now. `rage-rpc` simplifies two-way communication between the RAGE Multiplayer server, client, and browser instances by providing a easy-to-use API for calling remote code and retrieving results. **Any context can call a function that resides in any other context and immediately get access to its return value without messing with events.** This means any CEF instance can call code on the server, the client, or any other CEF instances and easily see the result.

---

## Installation

#### Option 1

You can install via [npm](https://github.com/npm/cli)

```
npm i -S rage-rpc
```

From here, you can simply require the package in any RAGE context:

```javascript
const rpc = require('rage-rpc');
```

#### Option 2

In the `dist/` folder of this repository is a single minified JS file that you can download and require into any RAGE context. It works the same as the above option, but you'll have to manually redownload the file when new versions are released.

```javascript
const rpc = require('./rage-rpc.min.js');
```

#### Option 3 (Browser Only)

In order to use `require` in the browser, you'll need either an AMD loader or some kind of bundler like Webpack. If those options don't suit your project, you can load the file into browser contexts with just a script tag before the code you use it in. It will expose a global `rpc` variable that you can use on your page.

```html
<html>
    <head>
        <title>My CEF Page</title>
        <script type="text/javascript" src="./rage-rpc.min.js"></script>
        <script type="text/javascript">
            rpc.register('hi', () => 'hello from cef!');
            
            // ...
        </script>
    </head>
</html>
```

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
