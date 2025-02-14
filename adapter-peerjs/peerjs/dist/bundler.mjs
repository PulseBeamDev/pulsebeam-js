import {pack as $gCcbY$pack, unpack as $gCcbY$unpack} from "peerjs-js-binarypack";
import $gCcbY$webrtcadapter from "webrtc-adapter";
import {Encoder as $gCcbY$Encoder, decodeMultiStream as $gCcbY$decodeMultiStream} from "@msgpack/msgpack";


function $parcel$export(e, n, v, s) {
  Object.defineProperty(e, n, {get: v, set: s, enumerable: true, configurable: true});
}
class $fcbcc7538a6776d5$export$f1c5f4c9cb95390b {
    constructor(){
        this.chunkedMTU = 16300 // The original 60000 bytes setting does not work when sending data from Firefox to Chrome, which is "cut off" after 16384 bytes and delivered individually.
        ;
        // Binary stuff
        this._dataCount = 1;
        this.chunk = (blob)=>{
            const chunks = [];
            const size = blob.byteLength;
            const total = Math.ceil(size / this.chunkedMTU);
            let index = 0;
            let start = 0;
            while(start < size){
                const end = Math.min(size, start + this.chunkedMTU);
                const b = blob.slice(start, end);
                const chunk = {
                    __peerData: this._dataCount,
                    n: index,
                    data: b,
                    total: total
                };
                chunks.push(chunk);
                start = end;
                index++;
            }
            this._dataCount++;
            return chunks;
        };
    }
}
function $fcbcc7538a6776d5$export$52c89ebcdc4f53f2(bufs) {
    let size = 0;
    for (const buf of bufs)size += buf.byteLength;
    const result = new Uint8Array(size);
    let offset = 0;
    for (const buf of bufs){
        result.set(buf, offset);
        offset += buf.byteLength;
    }
    return result;
}




const $fb63e766cfafaab9$var$webRTCAdapter = //@ts-ignore
(0, $gCcbY$webrtcadapter).default || (0, $gCcbY$webrtcadapter);
const $fb63e766cfafaab9$export$25be9502477c137d = new class {
    isWebRTCSupported() {
        return typeof RTCPeerConnection !== "undefined";
    }
    isBrowserSupported() {
        const browser = this.getBrowser();
        const version = this.getVersion();
        const validBrowser = this.supportedBrowsers.includes(browser);
        if (!validBrowser) return false;
        if (browser === "chrome") return version >= this.minChromeVersion;
        if (browser === "firefox") return version >= this.minFirefoxVersion;
        if (browser === "safari") return !this.isIOS && version >= this.minSafariVersion;
        return false;
    }
    getBrowser() {
        return $fb63e766cfafaab9$var$webRTCAdapter.browserDetails.browser;
    }
    getVersion() {
        return $fb63e766cfafaab9$var$webRTCAdapter.browserDetails.version || 0;
    }
    isUnifiedPlanSupported() {
        const browser = this.getBrowser();
        const version = $fb63e766cfafaab9$var$webRTCAdapter.browserDetails.version || 0;
        if (browser === "chrome" && version < this.minChromeVersion) return false;
        if (browser === "firefox" && version >= this.minFirefoxVersion) return true;
        if (!window.RTCRtpTransceiver || !("currentDirection" in RTCRtpTransceiver.prototype)) return false;
        let tempPc;
        let supported = false;
        try {
            tempPc = new RTCPeerConnection();
            tempPc.addTransceiver("audio");
            supported = true;
        } catch (e) {} finally{
            if (tempPc) tempPc.close();
        }
        return supported;
    }
    toString() {
        return `Supports:
    browser:${this.getBrowser()}
    version:${this.getVersion()}
    isIOS:${this.isIOS}
    isWebRTCSupported:${this.isWebRTCSupported()}
    isBrowserSupported:${this.isBrowserSupported()}
    isUnifiedPlanSupported:${this.isUnifiedPlanSupported()}`;
    }
    constructor(){
        this.isIOS = typeof navigator !== "undefined" ? [
            "iPad",
            "iPhone",
            "iPod"
        ].includes(navigator.platform) : false;
        this.supportedBrowsers = [
            "firefox",
            "chrome",
            "safari"
        ];
        this.minFirefoxVersion = 59;
        this.minChromeVersion = 72;
        this.minSafariVersion = 605;
    }
}();


const $9a84a32bf0bf36bb$export$f35f128fd59ea256 = (id)=>{
    // Allow empty ids
    return !id || /^[A-Za-z0-9]+(?:[ _-][A-Za-z0-9]+)*$/.test(id);
};


const $0e5fd1585784c252$export$4e61f672936bec77 = ()=>Math.random().toString(36).slice(2);


const $4f4134156c446392$var$DEFAULT_CONFIG = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        },
        {
            urls: [
                "turn:eu-0.turn.peerjs.com:3478",
                "turn:us-0.turn.peerjs.com:3478"
            ],
            username: "peerjs",
            credential: "peerjsp"
        }
    ],
    sdpSemantics: "unified-plan"
};
class $4f4134156c446392$export$f8f26dd395d7e1bd extends (0, $fcbcc7538a6776d5$export$f1c5f4c9cb95390b) {
    noop() {}
    blobToArrayBuffer(blob, cb) {
        const fr = new FileReader();
        fr.onload = function(evt) {
            if (evt.target) cb(evt.target.result);
        };
        fr.readAsArrayBuffer(blob);
        return fr;
    }
    binaryStringToArrayBuffer(binary) {
        const byteArray = new Uint8Array(binary.length);
        for(let i = 0; i < binary.length; i++)byteArray[i] = binary.charCodeAt(i) & 0xff;
        return byteArray.buffer;
    }
    isSecure() {
        return location.protocol === "https:";
    }
    constructor(...args){
        super(...args);
        this.CLOUD_HOST = "0.peerjs.com";
        this.CLOUD_PORT = 443;
        // Browsers that need chunking:
        this.chunkedBrowsers = {
            Chrome: 1,
            chrome: 1
        };
        // Returns browser-agnostic default config
        this.defaultConfig = $4f4134156c446392$var$DEFAULT_CONFIG;
        this.browser = (0, $fb63e766cfafaab9$export$25be9502477c137d).getBrowser();
        this.browserVersion = (0, $fb63e766cfafaab9$export$25be9502477c137d).getVersion();
        this.pack = $gCcbY$pack;
        this.unpack = $gCcbY$unpack;
        /**
	 * A hash of WebRTC features mapped to booleans that correspond to whether the feature is supported by the current browser.
	 *
	 * :::caution
	 * Only the properties documented here are guaranteed to be present on `util.supports`
	 * :::
	 */ this.supports = function() {
            const supported = {
                browser: (0, $fb63e766cfafaab9$export$25be9502477c137d).isBrowserSupported(),
                webRTC: (0, $fb63e766cfafaab9$export$25be9502477c137d).isWebRTCSupported(),
                audioVideo: false,
                data: false,
                binaryBlob: false,
                reliable: false
            };
            if (!supported.webRTC) return supported;
            let pc;
            try {
                pc = new RTCPeerConnection($4f4134156c446392$var$DEFAULT_CONFIG);
                supported.audioVideo = true;
                let dc;
                try {
                    dc = pc.createDataChannel("_PEERJSTEST", {
                        ordered: true
                    });
                    supported.data = true;
                    supported.reliable = !!dc.ordered;
                    // Binary test
                    try {
                        dc.binaryType = "blob";
                        supported.binaryBlob = !(0, $fb63e766cfafaab9$export$25be9502477c137d).isIOS;
                    } catch (e) {}
                } catch (e) {} finally{
                    if (dc) dc.close();
                }
            } catch (e) {} finally{
                if (pc) pc.close();
            }
            return supported;
        }();
        // Ensure alphanumeric ids
        this.validateId = (0, $9a84a32bf0bf36bb$export$f35f128fd59ea256);
        this.randomToken = (0, $0e5fd1585784c252$export$4e61f672936bec77);
    }
}
const $4f4134156c446392$export$7debb50ef11d5e0b = new $4f4134156c446392$export$f8f26dd395d7e1bd();



const $257947e92926277a$var$LOG_PREFIX = "PeerJS: ";
var $257947e92926277a$export$243e62d78d3b544d;
(function(LogLevel) {
    /**
	 * Prints no logs.
	 */ LogLevel[LogLevel["Disabled"] = 0] = "Disabled";
    /**
	 * Prints only errors.
	 */ LogLevel[LogLevel["Errors"] = 1] = "Errors";
    /**
	 * Prints errors and warnings.
	 */ LogLevel[LogLevel["Warnings"] = 2] = "Warnings";
    /**
	 * Prints all logs.
	 */ LogLevel[LogLevel["All"] = 3] = "All";
})($257947e92926277a$export$243e62d78d3b544d || ($257947e92926277a$export$243e62d78d3b544d = {}));
class $257947e92926277a$var$Logger {
    get logLevel() {
        return this._logLevel;
    }
    set logLevel(logLevel) {
        this._logLevel = logLevel;
    }
    log(...args) {
        if (this._logLevel >= 3) this._print(3, ...args);
    }
    warn(...args) {
        if (this._logLevel >= 2) this._print(2, ...args);
    }
    error(...args) {
        if (this._logLevel >= 1) this._print(1, ...args);
    }
    setLogFunction(fn) {
        this._print = fn;
    }
    _print(logLevel, ...rest) {
        const copy = [
            $257947e92926277a$var$LOG_PREFIX,
            ...rest
        ];
        for(const i in copy)if (copy[i] instanceof Error) copy[i] = "(" + copy[i].name + ") " + copy[i].message;
        if (logLevel >= 3) console.log(...copy);
        else if (logLevel >= 2) console.warn("WARNING", ...copy);
        else if (logLevel >= 1) console.error("ERROR", ...copy);
    }
    constructor(){
        this._logLevel = 0;
    }
}
var $257947e92926277a$export$2e2bcd8739ae039 = new $257947e92926277a$var$Logger();


var $c4dcfd1d1ea86647$exports = {};
"use strict";
var $c4dcfd1d1ea86647$var$has = Object.prototype.hasOwnProperty, $c4dcfd1d1ea86647$var$prefix = "~";
/**
 * Constructor to create a storage for our `EE` objects.
 * An `Events` instance is a plain object whose properties are event names.
 *
 * @constructor
 * @private
 */ function $c4dcfd1d1ea86647$var$Events() {}
//
// We try to not inherit from `Object.prototype`. In some engines creating an
// instance in this way is faster than calling `Object.create(null)` directly.
// If `Object.create(null)` is not supported we prefix the event names with a
// character to make sure that the built-in object properties are not
// overridden or used as an attack vector.
//
if (Object.create) {
    $c4dcfd1d1ea86647$var$Events.prototype = Object.create(null);
    //
    // This hack is needed because the `__proto__` property is still inherited in
    // some old browsers like Android 4, iPhone 5.1, Opera 11 and Safari 5.
    //
    if (!new $c4dcfd1d1ea86647$var$Events().__proto__) $c4dcfd1d1ea86647$var$prefix = false;
}
/**
 * Representation of a single event listener.
 *
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} [once=false] Specify if the listener is a one-time listener.
 * @constructor
 * @private
 */ function $c4dcfd1d1ea86647$var$EE(fn, context, once) {
    this.fn = fn;
    this.context = context;
    this.once = once || false;
}
/**
 * Add a listener for a given event.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} context The context to invoke the listener with.
 * @param {Boolean} once Specify if the listener is a one-time listener.
 * @returns {EventEmitter}
 * @private
 */ function $c4dcfd1d1ea86647$var$addListener(emitter, event, fn, context, once) {
    if (typeof fn !== "function") throw new TypeError("The listener must be a function");
    var listener = new $c4dcfd1d1ea86647$var$EE(fn, context || emitter, once), evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event;
    if (!emitter._events[evt]) emitter._events[evt] = listener, emitter._eventsCount++;
    else if (!emitter._events[evt].fn) emitter._events[evt].push(listener);
    else emitter._events[evt] = [
        emitter._events[evt],
        listener
    ];
    return emitter;
}
/**
 * Clear event by name.
 *
 * @param {EventEmitter} emitter Reference to the `EventEmitter` instance.
 * @param {(String|Symbol)} evt The Event name.
 * @private
 */ function $c4dcfd1d1ea86647$var$clearEvent(emitter, evt) {
    if (--emitter._eventsCount === 0) emitter._events = new $c4dcfd1d1ea86647$var$Events();
    else delete emitter._events[evt];
}
/**
 * Minimal `EventEmitter` interface that is molded against the Node.js
 * `EventEmitter` interface.
 *
 * @constructor
 * @public
 */ function $c4dcfd1d1ea86647$var$EventEmitter() {
    this._events = new $c4dcfd1d1ea86647$var$Events();
    this._eventsCount = 0;
}
/**
 * Return an array listing the events for which the emitter has registered
 * listeners.
 *
 * @returns {Array}
 * @public
 */ $c4dcfd1d1ea86647$var$EventEmitter.prototype.eventNames = function eventNames() {
    var names = [], events, name;
    if (this._eventsCount === 0) return names;
    for(name in events = this._events)if ($c4dcfd1d1ea86647$var$has.call(events, name)) names.push($c4dcfd1d1ea86647$var$prefix ? name.slice(1) : name);
    if (Object.getOwnPropertySymbols) return names.concat(Object.getOwnPropertySymbols(events));
    return names;
};
/**
 * Return the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Array} The registered listeners.
 * @public
 */ $c4dcfd1d1ea86647$var$EventEmitter.prototype.listeners = function listeners(event) {
    var evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event, handlers = this._events[evt];
    if (!handlers) return [];
    if (handlers.fn) return [
        handlers.fn
    ];
    for(var i = 0, l = handlers.length, ee = new Array(l); i < l; i++)ee[i] = handlers[i].fn;
    return ee;
};
/**
 * Return the number of listeners listening to a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Number} The number of listeners.
 * @public
 */ $c4dcfd1d1ea86647$var$EventEmitter.prototype.listenerCount = function listenerCount(event) {
    var evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event, listeners = this._events[evt];
    if (!listeners) return 0;
    if (listeners.fn) return 1;
    return listeners.length;
};
/**
 * Calls each of the listeners registered for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @returns {Boolean} `true` if the event had listeners, else `false`.
 * @public
 */ $c4dcfd1d1ea86647$var$EventEmitter.prototype.emit = function emit(event, a1, a2, a3, a4, a5) {
    var evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event;
    if (!this._events[evt]) return false;
    var listeners = this._events[evt], len = arguments.length, args, i;
    if (listeners.fn) {
        if (listeners.once) this.removeListener(event, listeners.fn, undefined, true);
        switch(len){
            case 1:
                return listeners.fn.call(listeners.context), true;
            case 2:
                return listeners.fn.call(listeners.context, a1), true;
            case 3:
                return listeners.fn.call(listeners.context, a1, a2), true;
            case 4:
                return listeners.fn.call(listeners.context, a1, a2, a3), true;
            case 5:
                return listeners.fn.call(listeners.context, a1, a2, a3, a4), true;
            case 6:
                return listeners.fn.call(listeners.context, a1, a2, a3, a4, a5), true;
        }
        for(i = 1, args = new Array(len - 1); i < len; i++)args[i - 1] = arguments[i];
        listeners.fn.apply(listeners.context, args);
    } else {
        var length = listeners.length, j;
        for(i = 0; i < length; i++){
            if (listeners[i].once) this.removeListener(event, listeners[i].fn, undefined, true);
            switch(len){
                case 1:
                    listeners[i].fn.call(listeners[i].context);
                    break;
                case 2:
                    listeners[i].fn.call(listeners[i].context, a1);
                    break;
                case 3:
                    listeners[i].fn.call(listeners[i].context, a1, a2);
                    break;
                case 4:
                    listeners[i].fn.call(listeners[i].context, a1, a2, a3);
                    break;
                default:
                    if (!args) for(j = 1, args = new Array(len - 1); j < len; j++)args[j - 1] = arguments[j];
                    listeners[i].fn.apply(listeners[i].context, args);
            }
        }
    }
    return true;
};
/**
 * Add a listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */ $c4dcfd1d1ea86647$var$EventEmitter.prototype.on = function on(event, fn, context) {
    return $c4dcfd1d1ea86647$var$addListener(this, event, fn, context, false);
};
/**
 * Add a one-time listener for a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn The listener function.
 * @param {*} [context=this] The context to invoke the listener with.
 * @returns {EventEmitter} `this`.
 * @public
 */ $c4dcfd1d1ea86647$var$EventEmitter.prototype.once = function once(event, fn, context) {
    return $c4dcfd1d1ea86647$var$addListener(this, event, fn, context, true);
};
/**
 * Remove the listeners of a given event.
 *
 * @param {(String|Symbol)} event The event name.
 * @param {Function} fn Only remove the listeners that match this function.
 * @param {*} context Only remove the listeners that have this context.
 * @param {Boolean} once Only remove one-time listeners.
 * @returns {EventEmitter} `this`.
 * @public
 */ $c4dcfd1d1ea86647$var$EventEmitter.prototype.removeListener = function removeListener(event, fn, context, once) {
    var evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event;
    if (!this._events[evt]) return this;
    if (!fn) {
        $c4dcfd1d1ea86647$var$clearEvent(this, evt);
        return this;
    }
    var listeners = this._events[evt];
    if (listeners.fn) {
        if (listeners.fn === fn && (!once || listeners.once) && (!context || listeners.context === context)) $c4dcfd1d1ea86647$var$clearEvent(this, evt);
    } else {
        for(var i = 0, events = [], length = listeners.length; i < length; i++)if (listeners[i].fn !== fn || once && !listeners[i].once || context && listeners[i].context !== context) events.push(listeners[i]);
        //
        // Reset the array, or remove it completely if we have no more listeners.
        //
        if (events.length) this._events[evt] = events.length === 1 ? events[0] : events;
        else $c4dcfd1d1ea86647$var$clearEvent(this, evt);
    }
    return this;
};
/**
 * Remove all listeners, or those of the specified event.
 *
 * @param {(String|Symbol)} [event] The event name.
 * @returns {EventEmitter} `this`.
 * @public
 */ $c4dcfd1d1ea86647$var$EventEmitter.prototype.removeAllListeners = function removeAllListeners(event) {
    var evt;
    if (event) {
        evt = $c4dcfd1d1ea86647$var$prefix ? $c4dcfd1d1ea86647$var$prefix + event : event;
        if (this._events[evt]) $c4dcfd1d1ea86647$var$clearEvent(this, evt);
    } else {
        this._events = new $c4dcfd1d1ea86647$var$Events();
        this._eventsCount = 0;
    }
    return this;
};
//
// Alias methods names because people roll like that.
//
$c4dcfd1d1ea86647$var$EventEmitter.prototype.off = $c4dcfd1d1ea86647$var$EventEmitter.prototype.removeListener;
$c4dcfd1d1ea86647$var$EventEmitter.prototype.addListener = $c4dcfd1d1ea86647$var$EventEmitter.prototype.on;
//
// Expose the prefix.
//
$c4dcfd1d1ea86647$var$EventEmitter.prefixed = $c4dcfd1d1ea86647$var$prefix;
//
// Allow `EventEmitter` to be imported as module namespace.
//
$c4dcfd1d1ea86647$var$EventEmitter.EventEmitter = $c4dcfd1d1ea86647$var$EventEmitter;
$c4dcfd1d1ea86647$exports = $c4dcfd1d1ea86647$var$EventEmitter;



var $78455e22dea96b8c$exports = {};

$parcel$export($78455e22dea96b8c$exports, "ConnectionType", () => $78455e22dea96b8c$export$3157d57b4135e3bc);
$parcel$export($78455e22dea96b8c$exports, "PeerErrorType", () => $78455e22dea96b8c$export$9547aaa2e39030ff);
$parcel$export($78455e22dea96b8c$exports, "BaseConnectionErrorType", () => $78455e22dea96b8c$export$7974935686149686);
$parcel$export($78455e22dea96b8c$exports, "DataConnectionErrorType", () => $78455e22dea96b8c$export$49ae800c114df41d);
$parcel$export($78455e22dea96b8c$exports, "SerializationType", () => $78455e22dea96b8c$export$89f507cf986a947);
$parcel$export($78455e22dea96b8c$exports, "SocketEventType", () => $78455e22dea96b8c$export$3b5c4a4b6354f023);
$parcel$export($78455e22dea96b8c$exports, "ServerMessageType", () => $78455e22dea96b8c$export$adb4a1754da6f10d);
var $78455e22dea96b8c$export$3157d57b4135e3bc;
(function(ConnectionType) {
    ConnectionType["Data"] = "data";
    ConnectionType["Media"] = "media";
})($78455e22dea96b8c$export$3157d57b4135e3bc || ($78455e22dea96b8c$export$3157d57b4135e3bc = {}));
var $78455e22dea96b8c$export$9547aaa2e39030ff;
(function(PeerErrorType) {
    /**
	 * The client's browser does not support some or all WebRTC features that you are trying to use.
	 */ PeerErrorType["BrowserIncompatible"] = "browser-incompatible";
    /**
	 * You've already disconnected this peer from the server and can no longer make any new connections on it.
	 */ PeerErrorType["Disconnected"] = "disconnected";
    /**
	 * The ID passed into the Peer constructor contains illegal characters.
	 */ PeerErrorType["InvalidID"] = "invalid-id";
    /**
	 * The API key passed into the Peer constructor contains illegal characters or is not in the system (cloud server only).
	 */ PeerErrorType["InvalidKey"] = "invalid-key";
    /**
	 * Lost or cannot establish a connection to the signalling server.
	 */ PeerErrorType["Network"] = "network";
    /**
	 * The peer you're trying to connect to does not exist.
	 */ PeerErrorType["PeerUnavailable"] = "peer-unavailable";
    /**
	 * PeerJS is being used securely, but the cloud server does not support SSL. Use a custom PeerServer.
	 */ PeerErrorType["SslUnavailable"] = "ssl-unavailable";
    /**
	 * Unable to reach the server.
	 */ PeerErrorType["ServerError"] = "server-error";
    /**
	 * An error from the underlying socket.
	 */ PeerErrorType["SocketError"] = "socket-error";
    /**
	 * The underlying socket closed unexpectedly.
	 */ PeerErrorType["SocketClosed"] = "socket-closed";
    /**
	 * The ID passed into the Peer constructor is already taken.
	 *
	 * :::caution
	 * This error is not fatal if your peer has open peer-to-peer connections.
	 * This can happen if you attempt to {@apilink Peer.reconnect} a peer that has been disconnected from the server,
	 * but its old ID has now been taken.
	 * :::
	 */ PeerErrorType["UnavailableID"] = "unavailable-id";
    /**
	 * Native WebRTC errors.
	 */ PeerErrorType["WebRTC"] = "webrtc";
})($78455e22dea96b8c$export$9547aaa2e39030ff || ($78455e22dea96b8c$export$9547aaa2e39030ff = {}));
var $78455e22dea96b8c$export$7974935686149686;
(function(BaseConnectionErrorType) {
    BaseConnectionErrorType["NegotiationFailed"] = "negotiation-failed";
    BaseConnectionErrorType["ConnectionClosed"] = "connection-closed";
})($78455e22dea96b8c$export$7974935686149686 || ($78455e22dea96b8c$export$7974935686149686 = {}));
var $78455e22dea96b8c$export$49ae800c114df41d;
(function(DataConnectionErrorType) {
    DataConnectionErrorType["NotOpenYet"] = "not-open-yet";
    DataConnectionErrorType["MessageToBig"] = "message-too-big";
})($78455e22dea96b8c$export$49ae800c114df41d || ($78455e22dea96b8c$export$49ae800c114df41d = {}));
var $78455e22dea96b8c$export$89f507cf986a947;
(function(SerializationType) {
    SerializationType["Binary"] = "binary";
    SerializationType["BinaryUTF8"] = "binary-utf8";
    SerializationType["JSON"] = "json";
    SerializationType["None"] = "raw";
})($78455e22dea96b8c$export$89f507cf986a947 || ($78455e22dea96b8c$export$89f507cf986a947 = {}));
var $78455e22dea96b8c$export$3b5c4a4b6354f023;
(function(SocketEventType) {
    SocketEventType["Message"] = "message";
    SocketEventType["Disconnected"] = "disconnected";
    SocketEventType["Error"] = "error";
    SocketEventType["Close"] = "close";
})($78455e22dea96b8c$export$3b5c4a4b6354f023 || ($78455e22dea96b8c$export$3b5c4a4b6354f023 = {}));
var $78455e22dea96b8c$export$adb4a1754da6f10d;
(function(ServerMessageType) {
    ServerMessageType["Heartbeat"] = "HEARTBEAT";
    ServerMessageType["Candidate"] = "CANDIDATE";
    ServerMessageType["Offer"] = "OFFER";
    ServerMessageType["Answer"] = "ANSWER";
    ServerMessageType["Open"] = "OPEN";
    ServerMessageType["Error"] = "ERROR";
    ServerMessageType["IdTaken"] = "ID-TAKEN";
    ServerMessageType["InvalidKey"] = "INVALID-KEY";
    ServerMessageType["Leave"] = "LEAVE";
    ServerMessageType["Expire"] = "EXPIRE";
})($78455e22dea96b8c$export$adb4a1754da6f10d || ($78455e22dea96b8c$export$adb4a1754da6f10d = {}));


var $f5f881ec4575f1fc$exports = {};
$f5f881ec4575f1fc$exports = JSON.parse('{"name":"peerjs","version":"1.5.4","keywords":["peerjs","webrtc","p2p","rtc"],"description":"PeerJS client","homepage":"https://peerjs.com","bugs":{"url":"https://github.com/peers/peerjs/issues"},"repository":{"type":"git","url":"https://github.com/peers/peerjs"},"license":"MIT","contributors":["Michelle Bu <michelle@michellebu.com>","afrokick <devbyru@gmail.com>","ericz <really.ez@gmail.com>","Jairo <kidandcat@gmail.com>","Jonas Gloning <34194370+jonasgloning@users.noreply.github.com>","Jairo Caro-Accino Viciana <jairo@galax.be>","Carlos Caballero <carlos.caballero.gonzalez@gmail.com>","hc <hheennrryy@gmail.com>","Muhammad Asif <capripio@gmail.com>","PrashoonB <prashoonbhattacharjee@gmail.com>","Harsh Bardhan Mishra <47351025+HarshCasper@users.noreply.github.com>","akotynski <aleksanderkotbury@gmail.com>","lmb <i@lmb.io>","Jairooo <jairocaro@msn.com>","Moritz St\xfcckler <moritz.stueckler@gmail.com>","Simon <crydotsnakegithub@gmail.com>","Denis Lukov <denismassters@gmail.com>","Philipp Hancke <fippo@andyet.net>","Hans Oksendahl <hansoksendahl@gmail.com>","Jess <jessachandler@gmail.com>","khankuan <khankuan@gmail.com>","DUODVK <kurmanov.work@gmail.com>","XiZhao <kwang1imsa@gmail.com>","Matthias Lohr <matthias@lohr.me>","=frank tree <=frnktrb@googlemail.com>","Andre Eckardt <aeckardt@outlook.com>","Chris Cowan <agentme49@gmail.com>","Alex Chuev <alex@chuev.com>","alxnull <alxnull@e.mail.de>","Yemel Jardi <angel.jardi@gmail.com>","Ben Parnell <benjaminparnell.94@gmail.com>","Benny Lichtner <bennlich@gmail.com>","fresheneesz <bitetrudpublic@gmail.com>","bob.barstead@exaptive.com <bob.barstead@exaptive.com>","chandika <chandika@gmail.com>","emersion <contact@emersion.fr>","Christopher Van <cvan@users.noreply.github.com>","eddieherm <edhermoso@gmail.com>","Eduardo Pinho <enet4mikeenet@gmail.com>","Evandro Zanatta <ezanatta@tray.net.br>","Gardner Bickford <gardner@users.noreply.github.com>","Gian Luca <gianluca.cecchi@cynny.com>","PatrickJS <github@gdi2290.com>","jonnyf <github@jonathanfoss.co.uk>","Hizkia Felix <hizkifw@gmail.com>","Hristo Oskov <hristo.oskov@gmail.com>","Isaac Madwed <i.madwed@gmail.com>","Ilya Konanykhin <ilya.konanykhin@gmail.com>","jasonbarry <jasbarry@me.com>","Jonathan Burke <jonathan.burke.1311@googlemail.com>","Josh Hamit <josh.hamit@gmail.com>","Jordan Austin <jrax86@gmail.com>","Joel Wetzell <jwetzell@yahoo.com>","xizhao <kevin.wang@cloudera.com>","Alberto Torres <kungfoobar@gmail.com>","Jonathan Mayol <mayoljonathan@gmail.com>","Jefferson Felix <me@jsfelix.dev>","Rolf Erik Lekang <me@rolflekang.com>","Kevin Mai-Husan Chia <mhchia@users.noreply.github.com>","Pepijn de Vos <pepijndevos@gmail.com>","JooYoung <qkdlql@naver.com>","Tobias Speicher <rootcommander@gmail.com>","Steve Blaurock <sblaurock@gmail.com>","Kyrylo Shegeda <shegeda@ualberta.ca>","Diwank Singh Tomer <singh@diwank.name>","So\u0308ren Balko <Soeren.Balko@gmail.com>","Arpit Solanki <solankiarpit1997@gmail.com>","Yuki Ito <yuki@gnnk.net>","Artur Zayats <zag2art@gmail.com>"],"funding":{"type":"opencollective","url":"https://opencollective.com/peer"},"collective":{"type":"opencollective","url":"https://opencollective.com/peer"},"files":["dist/*"],"sideEffects":["lib/global.ts","lib/supports.ts"],"main":"dist/bundler.cjs","module":"dist/bundler.mjs","browser-minified":"dist/peerjs.min.js","browser-unminified":"dist/peerjs.js","browser-minified-msgpack":"dist/serializer.msgpack.mjs","types":"dist/types.d.ts","engines":{"node":">= 14"},"targets":{"types":{"source":"lib/exports.ts"},"main":{"source":"lib/exports.ts","sourceMap":{"inlineSources":true}},"module":{"source":"lib/exports.ts","includeNodeModules":["eventemitter3"],"sourceMap":{"inlineSources":true}},"browser-minified":{"context":"browser","outputFormat":"global","optimize":true,"engines":{"browsers":"chrome >= 83, edge >= 83, firefox >= 80, safari >= 15"},"source":"lib/global.ts"},"browser-unminified":{"context":"browser","outputFormat":"global","optimize":false,"engines":{"browsers":"chrome >= 83, edge >= 83, firefox >= 80, safari >= 15"},"source":"lib/global.ts"},"browser-minified-msgpack":{"context":"browser","outputFormat":"esmodule","isLibrary":true,"optimize":true,"engines":{"browsers":"chrome >= 83, edge >= 83, firefox >= 102, safari >= 15"},"source":"lib/dataconnection/StreamConnection/MsgPack.ts"}},"scripts":{"contributors":"git-authors-cli --print=false && prettier --write package.json && git add package.json package-lock.json && git commit -m \\"chore(contributors): update and sort contributors list\\"","check":"tsc --noEmit && tsc -p e2e/tsconfig.json --noEmit","watch":"parcel watch","build":"rm -rf dist && parcel build","prepublishOnly":"npm run build","test":"jest","test:watch":"jest --watch","coverage":"jest --coverage --collectCoverageFrom=\\"./lib/**\\"","format":"prettier --write .","format:check":"prettier --check .","semantic-release":"semantic-release","e2e":"wdio run e2e/wdio.local.conf.ts","e2e:bstack":"wdio run e2e/wdio.bstack.conf.ts"},"devDependencies":{"@parcel/config-default":"^2.9.3","@parcel/packager-ts":"^2.9.3","@parcel/transformer-typescript-tsc":"^2.9.3","@parcel/transformer-typescript-types":"^2.9.3","@semantic-release/changelog":"^6.0.1","@semantic-release/git":"^10.0.1","@swc/core":"^1.3.27","@swc/jest":"^0.2.24","@types/jasmine":"^4.3.4","@wdio/browserstack-service":"^8.11.2","@wdio/cli":"^8.11.2","@wdio/globals":"^8.11.2","@wdio/jasmine-framework":"^8.11.2","@wdio/local-runner":"^8.11.2","@wdio/spec-reporter":"^8.11.2","@wdio/types":"^8.10.4","http-server":"^14.1.1","jest":"^29.3.1","jest-environment-jsdom":"^29.3.1","mock-socket":"^9.0.0","parcel":"^2.9.3","prettier":"^3.0.0","semantic-release":"^21.0.0","ts-node":"^10.9.1","typescript":"^5.0.0","wdio-geckodriver-service":"^5.0.1"},"dependencies":{"@msgpack/msgpack":"^2.8.0","eventemitter3":"^4.0.7","peerjs-js-binarypack":"^2.1.0","webrtc-adapter":"^9.0.0"},"alias":{"process":false,"buffer":false}}');


class $8f5bfa60836d261d$export$4798917dbf149b79 extends (0, $c4dcfd1d1ea86647$exports.EventEmitter) {
    constructor(secure, host, port, path, key, pingInterval = 5000){
        super();
        this.pingInterval = pingInterval;
        this._disconnected = true;
        this._messagesQueue = [];
        const wsProtocol = secure ? "wss://" : "ws://";
        this._baseUrl = wsProtocol + host + ":" + port + path + "peerjs?key=" + key;
    }
    start(id, token) {
        this._id = id;
        const wsUrl = `${this._baseUrl}&id=${id}&token=${token}`;
        if (!!this._socket || !this._disconnected) return;
        this._socket = new WebSocket(wsUrl + "&version=" + (0, $f5f881ec4575f1fc$exports.version));
        this._disconnected = false;
        this._socket.onmessage = (event)=>{
            let data;
            try {
                data = JSON.parse(event.data);
                (0, $257947e92926277a$export$2e2bcd8739ae039).log("Server message received:", data);
            } catch (e) {
                (0, $257947e92926277a$export$2e2bcd8739ae039).log("Invalid server message", event.data);
                return;
            }
            this.emit((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Message, data);
        };
        this._socket.onclose = (event)=>{
            if (this._disconnected) return;
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Socket closed.", event);
            this._cleanup();
            this._disconnected = true;
            this.emit((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Disconnected);
        };
        // Take care of the queue of connections if necessary and make sure Peer knows
        // socket is open.
        this._socket.onopen = ()=>{
            if (this._disconnected) return;
            this._sendQueuedMessages();
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Socket open");
            this._scheduleHeartbeat();
        };
    }
    _scheduleHeartbeat() {
        this._wsPingTimer = setTimeout(()=>{
            this._sendHeartbeat();
        }, this.pingInterval);
    }
    _sendHeartbeat() {
        if (!this._wsOpen()) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Cannot send heartbeat, because socket closed`);
            return;
        }
        const message = JSON.stringify({
            type: (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Heartbeat
        });
        this._socket.send(message);
        this._scheduleHeartbeat();
    }
    /** Is the websocket currently open? */ _wsOpen() {
        return !!this._socket && this._socket.readyState === 1;
    }
    /** Send queued messages. */ _sendQueuedMessages() {
        //Create copy of queue and clear it,
        //because send method push the message back to queue if smth will go wrong
        const copiedQueue = [
            ...this._messagesQueue
        ];
        this._messagesQueue = [];
        for (const message of copiedQueue)this.send(message);
    }
    /** Exposed send for DC & Peer. */ send(data) {
        if (this._disconnected) return;
        // If we didn't get an ID yet, we can't yet send anything so we should queue
        // up these messages.
        if (!this._id) {
            this._messagesQueue.push(data);
            return;
        }
        if (!data.type) {
            this.emit((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Error, "Invalid message");
            return;
        }
        if (!this._wsOpen()) return;
        const message = JSON.stringify(data);
        this._socket.send(message);
    }
    close() {
        if (this._disconnected) return;
        this._cleanup();
        this._disconnected = true;
    }
    _cleanup() {
        if (this._socket) {
            this._socket.onopen = this._socket.onmessage = this._socket.onclose = null;
            this._socket.close();
            this._socket = undefined;
        }
        clearTimeout(this._wsPingTimer);
    }
}






class $b82fb8fc0514bfc1$export$89e6bb5ad64bf4a {
    constructor(connection){
        this.connection = connection;
    }
    /** Returns a PeerConnection object set up correctly (for data, media). */ startConnection(options) {
        const peerConnection = this._startPeerConnection();
        // Set the connection's PC.
        this.connection.peerConnection = peerConnection;
        if (this.connection.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Media && options._stream) this._addTracksToConnection(options._stream, peerConnection);
        // What do we need to do now?
        if (options.originator) {
            const dataConnection = this.connection;
            const config = {
                ordered: !!options.reliable
            };
            const dataChannel = peerConnection.createDataChannel(dataConnection.label, config);
            dataConnection._initializeDataChannel(dataChannel);
            this._makeOffer();
        } else this.handleSDP("OFFER", options.sdp);
    }
    /** Start a PC. */ _startPeerConnection() {
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Creating RTCPeerConnection.");
        const peerConnection = new RTCPeerConnection(this.connection.provider.options.config);
        this._setupListeners(peerConnection);
        return peerConnection;
    }
    /** Set up various WebRTC listeners. */ _setupListeners(peerConnection) {
        const peerId = this.connection.peer;
        const connectionId = this.connection.connectionId;
        const connectionType = this.connection.type;
        const provider = this.connection.provider;
        // ICE CANDIDATES.
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Listening for ICE candidates.");
        peerConnection.onicecandidate = (evt)=>{
            if (!evt.candidate || !evt.candidate.candidate) return;
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Received ICE candidates for ${peerId}:`, evt.candidate);
            provider.socket.send({
                type: (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Candidate,
                payload: {
                    candidate: evt.candidate,
                    type: connectionType,
                    connectionId: connectionId
                },
                dst: peerId
            });
        };
        peerConnection.oniceconnectionstatechange = ()=>{
            switch(peerConnection.iceConnectionState){
                case "failed":
                    (0, $257947e92926277a$export$2e2bcd8739ae039).log("iceConnectionState is failed, closing connections to " + peerId);
                    this.connection.emitError((0, $78455e22dea96b8c$export$7974935686149686).NegotiationFailed, "Negotiation of connection to " + peerId + " failed.");
                    this.connection.close();
                    break;
                case "closed":
                    (0, $257947e92926277a$export$2e2bcd8739ae039).log("iceConnectionState is closed, closing connections to " + peerId);
                    this.connection.emitError((0, $78455e22dea96b8c$export$7974935686149686).ConnectionClosed, "Connection to " + peerId + " closed.");
                    this.connection.close();
                    break;
                case "disconnected":
                    (0, $257947e92926277a$export$2e2bcd8739ae039).log("iceConnectionState changed to disconnected on the connection with " + peerId);
                    break;
                case "completed":
                    peerConnection.onicecandidate = ()=>{};
                    break;
            }
            this.connection.emit("iceStateChanged", peerConnection.iceConnectionState);
        };
        // DATACONNECTION.
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Listening for data channel");
        // Fired between offer and answer, so options should already be saved
        // in the options hash.
        peerConnection.ondatachannel = (evt)=>{
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Received data channel");
            const dataChannel = evt.channel;
            const connection = provider.getConnection(peerId, connectionId);
            connection._initializeDataChannel(dataChannel);
        };
        // MEDIACONNECTION.
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Listening for remote stream");
        peerConnection.ontrack = (evt)=>{
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Received remote stream");
            const stream = evt.streams[0];
            const connection = provider.getConnection(peerId, connectionId);
            if (connection.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Media) {
                const mediaConnection = connection;
                this._addStreamToMediaConnection(stream, mediaConnection);
            }
        };
    }
    cleanup() {
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Cleaning up PeerConnection to " + this.connection.peer);
        const peerConnection = this.connection.peerConnection;
        if (!peerConnection) return;
        this.connection.peerConnection = null;
        //unsubscribe from all PeerConnection's events
        peerConnection.onicecandidate = peerConnection.oniceconnectionstatechange = peerConnection.ondatachannel = peerConnection.ontrack = ()=>{};
        const peerConnectionNotClosed = peerConnection.signalingState !== "closed";
        let dataChannelNotClosed = false;
        const dataChannel = this.connection.dataChannel;
        if (dataChannel) dataChannelNotClosed = !!dataChannel.readyState && dataChannel.readyState !== "closed";
        if (peerConnectionNotClosed || dataChannelNotClosed) peerConnection.close();
    }
    async _makeOffer() {
        const peerConnection = this.connection.peerConnection;
        const provider = this.connection.provider;
        try {
            const offer = await peerConnection.createOffer(this.connection.options.constraints);
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Created offer.");
            if (this.connection.options.sdpTransform && typeof this.connection.options.sdpTransform === "function") offer.sdp = this.connection.options.sdpTransform(offer.sdp) || offer.sdp;
            try {
                await peerConnection.setLocalDescription(offer);
                (0, $257947e92926277a$export$2e2bcd8739ae039).log("Set localDescription:", offer, `for:${this.connection.peer}`);
                let payload = {
                    sdp: offer,
                    type: this.connection.type,
                    connectionId: this.connection.connectionId,
                    metadata: this.connection.metadata
                };
                if (this.connection.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Data) {
                    const dataConnection = this.connection;
                    payload = {
                        ...payload,
                        label: dataConnection.label,
                        reliable: dataConnection.reliable,
                        serialization: dataConnection.serialization
                    };
                }
                provider.socket.send({
                    type: (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Offer,
                    payload: payload,
                    dst: this.connection.peer
                });
            } catch (err) {
                // TODO: investigate why _makeOffer is being called from the answer
                if (err != "OperationError: Failed to set local offer sdp: Called in wrong state: kHaveRemoteOffer") {
                    provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err);
                    (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to setLocalDescription, ", err);
                }
            }
        } catch (err_1) {
            provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err_1);
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to createOffer, ", err_1);
        }
    }
    async _makeAnswer() {
        const peerConnection = this.connection.peerConnection;
        const provider = this.connection.provider;
        try {
            const answer = await peerConnection.createAnswer();
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Created answer.");
            if (this.connection.options.sdpTransform && typeof this.connection.options.sdpTransform === "function") answer.sdp = this.connection.options.sdpTransform(answer.sdp) || answer.sdp;
            try {
                await peerConnection.setLocalDescription(answer);
                (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Set localDescription:`, answer, `for:${this.connection.peer}`);
                provider.socket.send({
                    type: (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Answer,
                    payload: {
                        sdp: answer,
                        type: this.connection.type,
                        connectionId: this.connection.connectionId
                    },
                    dst: this.connection.peer
                });
            } catch (err) {
                provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err);
                (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to setLocalDescription, ", err);
            }
        } catch (err_1) {
            provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err_1);
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to create answer, ", err_1);
        }
    }
    /** Handle an SDP. */ async handleSDP(type, sdp) {
        sdp = new RTCSessionDescription(sdp);
        const peerConnection = this.connection.peerConnection;
        const provider = this.connection.provider;
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Setting remote description", sdp);
        const self = this;
        try {
            await peerConnection.setRemoteDescription(sdp);
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Set remoteDescription:${type} for:${this.connection.peer}`);
            if (type === "OFFER") await self._makeAnswer();
        } catch (err) {
            provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err);
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to setRemoteDescription, ", err);
        }
    }
    /** Handle a candidate. */ async handleCandidate(ice) {
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`handleCandidate:`, ice);
        try {
            await this.connection.peerConnection.addIceCandidate(ice);
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Added ICE candidate for:${this.connection.peer}`);
        } catch (err) {
            this.connection.provider.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).WebRTC, err);
            (0, $257947e92926277a$export$2e2bcd8739ae039).log("Failed to handleCandidate, ", err);
        }
    }
    _addTracksToConnection(stream, peerConnection) {
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`add tracks from stream ${stream.id} to peer connection`);
        if (!peerConnection.addTrack) return (0, $257947e92926277a$export$2e2bcd8739ae039).error(`Your browser does't support RTCPeerConnection#addTrack. Ignored.`);
        stream.getTracks().forEach((track)=>{
            peerConnection.addTrack(track, stream);
        });
    }
    _addStreamToMediaConnection(stream, mediaConnection) {
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`add stream ${stream.id} to media connection ${mediaConnection.connectionId}`);
        mediaConnection.addStream(stream);
    }
}





class $23779d1881157a18$export$6a678e589c8a4542 extends (0, $c4dcfd1d1ea86647$exports.EventEmitter) {
    /**
	 * Emits a typed error message.
	 *
	 * @internal
	 */ emitError(type, err) {
        (0, $257947e92926277a$export$2e2bcd8739ae039).error("Error:", err);
        // @ts-ignore
        this.emit("error", new $23779d1881157a18$export$98871882f492de82(`${type}`, err));
    }
}
class $23779d1881157a18$export$98871882f492de82 extends Error {
    /**
	 * @internal
	 */ constructor(type, err){
        if (typeof err === "string") super(err);
        else {
            super();
            Object.assign(this, err);
        }
        this.type = type;
    }
}


class $5045192fc6d387ba$export$23a2a68283c24d80 extends (0, $23779d1881157a18$export$6a678e589c8a4542) {
    /**
	 * Whether the media connection is active (e.g. your call has been answered).
	 * You can check this if you want to set a maximum wait time for a one-sided call.
	 */ get open() {
        return this._open;
    }
    constructor(/**
		 * The ID of the peer on the other end of this connection.
		 */ peer, provider, options){
        super();
        this.peer = peer;
        this.provider = provider;
        this.options = options;
        this._open = false;
        this.metadata = options.metadata;
    }
}


class $5c1d08c7c57da9a3$export$4a84e95a2324ac29 extends (0, $5045192fc6d387ba$export$23a2a68283c24d80) {
    static #_ = this.ID_PREFIX = "mc_";
    /**
	 * For media connections, this is always 'media'.
	 */ get type() {
        return (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Media;
    }
    get localStream() {
        return this._localStream;
    }
    get remoteStream() {
        return this._remoteStream;
    }
    constructor(peerId, provider, options){
        super(peerId, provider, options);
        this._localStream = this.options._stream;
        this.connectionId = this.options.connectionId || $5c1d08c7c57da9a3$export$4a84e95a2324ac29.ID_PREFIX + (0, $4f4134156c446392$export$7debb50ef11d5e0b).randomToken();
        this._negotiator = new (0, $b82fb8fc0514bfc1$export$89e6bb5ad64bf4a)(this);
        if (this._localStream) this._negotiator.startConnection({
            _stream: this._localStream,
            originator: true
        });
    }
    /** Called by the Negotiator when the DataChannel is ready. */ _initializeDataChannel(dc) {
        this.dataChannel = dc;
        this.dataChannel.onopen = ()=>{
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc connection success`);
            this.emit("willCloseOnRemote");
        };
        this.dataChannel.onclose = ()=>{
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc closed for:`, this.peer);
            this.close();
        };
    }
    addStream(remoteStream) {
        (0, $257947e92926277a$export$2e2bcd8739ae039).log("Receiving stream", remoteStream);
        this._remoteStream = remoteStream;
        super.emit("stream", remoteStream); // Should we call this `open`?
    }
    /**
	 * @internal
	 */ handleMessage(message) {
        const type = message.type;
        const payload = message.payload;
        switch(message.type){
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Answer:
                // Forward to negotiator
                this._negotiator.handleSDP(type, payload.sdp);
                this._open = true;
                break;
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Candidate:
                this._negotiator.handleCandidate(payload.candidate);
                break;
            default:
                (0, $257947e92926277a$export$2e2bcd8739ae039).warn(`Unrecognized message type:${type} from peer:${this.peer}`);
                break;
        }
    }
    /**
     * When receiving a {@apilink PeerEvents | `call`} event on a peer, you can call
     * `answer` on the media connection provided by the callback to accept the call
     * and optionally send your own media stream.

     *
     * @param stream A WebRTC media stream.
     * @param options
     * @returns
     */ answer(stream, options = {}) {
        if (this._localStream) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).warn("Local stream already exists on this MediaConnection. Are you answering a call twice?");
            return;
        }
        this._localStream = stream;
        if (options && options.sdpTransform) this.options.sdpTransform = options.sdpTransform;
        this._negotiator.startConnection({
            ...this.options._payload,
            _stream: stream
        });
        // Retrieve lost messages stored because PeerConnection not set up.
        const messages = this.provider._getMessages(this.connectionId);
        for (const message of messages)this.handleMessage(message);
        this._open = true;
    }
    /**
	 * Exposed functionality for users.
	 */ /**
	 * Closes the media connection.
	 */ close() {
        if (this._negotiator) {
            this._negotiator.cleanup();
            this._negotiator = null;
        }
        this._localStream = null;
        this._remoteStream = null;
        if (this.provider) {
            this.provider._removeConnection(this);
            this.provider = null;
        }
        if (this.options && this.options._stream) this.options._stream = null;
        if (!this.open) return;
        this._open = false;
        super.emit("close");
    }
}






class $abf266641927cd89$export$2c4e825dc9120f87 {
    constructor(_options){
        this._options = _options;
    }
    _buildRequest(method) {
        const protocol = this._options.secure ? "https" : "http";
        const { host: host, port: port, path: path, key: key } = this._options;
        const url = new URL(`${protocol}://${host}:${port}${path}${key}/${method}`);
        // TODO: Why timestamp, why random?
        url.searchParams.set("ts", `${Date.now()}${Math.random()}`);
        url.searchParams.set("version", (0, $f5f881ec4575f1fc$exports.version));
        return fetch(url.href, {
            referrerPolicy: this._options.referrerPolicy
        });
    }
    /** Get a unique ID from the server via XHR and initialize with it. */ async retrieveId() {
        try {
            const response = await this._buildRequest("id");
            if (response.status !== 200) throw new Error(`Error. Status:${response.status}`);
            return response.text();
        } catch (error) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).error("Error retrieving ID", error);
            let pathError = "";
            if (this._options.path === "/" && this._options.host !== (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST) pathError = " If you passed in a `path` to your self-hosted PeerServer, you'll also need to pass in that same path when creating a new Peer.";
            throw new Error("Could not get an ID from the server." + pathError);
        }
    }
    /** @deprecated */ async listAllPeers() {
        try {
            const response = await this._buildRequest("peers");
            if (response.status !== 200) {
                if (response.status === 401) {
                    let helpfulError = "";
                    if (this._options.host === (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST) helpfulError = "It looks like you're using the cloud server. You can email team@peerjs.com to enable peer listing for your API key.";
                    else helpfulError = "You need to enable `allow_discovery` on your self-hosted PeerServer to use this feature.";
                    throw new Error("It doesn't look like you have permission to list peers IDs. " + helpfulError);
                }
                throw new Error(`Error. Status:${response.status}`);
            }
            return response.json();
        } catch (error) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).error("Error retrieving list peers", error);
            throw new Error("Could not get list peers from the server." + error);
        }
    }
}










class $6366c4ca161bc297$export$d365f7ad9d7df9c9 extends (0, $5045192fc6d387ba$export$23a2a68283c24d80) {
    static #_ = this.ID_PREFIX = "dc_";
    static #_2 = this.MAX_BUFFERED_AMOUNT = 8388608;
    get type() {
        return (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Data;
    }
    constructor(peerId, provider, options){
        super(peerId, provider, options);
        this.connectionId = this.options.connectionId || $6366c4ca161bc297$export$d365f7ad9d7df9c9.ID_PREFIX + (0, $0e5fd1585784c252$export$4e61f672936bec77)();
        this.label = this.options.label || this.connectionId;
        this.reliable = !!this.options.reliable;
        this._negotiator = new (0, $b82fb8fc0514bfc1$export$89e6bb5ad64bf4a)(this);
        this._negotiator.startConnection(this.options._payload || {
            originator: true,
            reliable: this.reliable
        });
    }
    /** Called by the Negotiator when the DataChannel is ready. */ _initializeDataChannel(dc) {
        this.dataChannel = dc;
        this.dataChannel.onopen = ()=>{
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc connection success`);
            this._open = true;
            this.emit("open");
        };
        this.dataChannel.onmessage = (e)=>{
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc onmessage:`, e.data);
        // this._handleDataMessage(e);
        };
        this.dataChannel.onclose = ()=>{
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} dc closed for:`, this.peer);
            this.close();
        };
    }
    /**
	 * Exposed functionality for users.
	 */ /** Allows user to close connection. */ close(options) {
        if (options?.flush) {
            this.send({
                __peerData: {
                    type: "close"
                }
            });
            return;
        }
        if (this._negotiator) {
            this._negotiator.cleanup();
            this._negotiator = null;
        }
        if (this.provider) {
            this.provider._removeConnection(this);
            this.provider = null;
        }
        if (this.dataChannel) {
            this.dataChannel.onopen = null;
            this.dataChannel.onmessage = null;
            this.dataChannel.onclose = null;
            this.dataChannel = null;
        }
        if (!this.open) return;
        this._open = false;
        super.emit("close");
    }
    /** Allows user to send data. */ send(data, chunked = false) {
        if (!this.open) {
            this.emitError((0, $78455e22dea96b8c$export$49ae800c114df41d).NotOpenYet, "Connection is not open. You should listen for the `open` event before sending messages.");
            return;
        }
        return this._send(data, chunked);
    }
    async handleMessage(message) {
        const payload = message.payload;
        switch(message.type){
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Answer:
                await this._negotiator.handleSDP(message.type, payload.sdp);
                break;
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Candidate:
                await this._negotiator.handleCandidate(payload.candidate);
                break;
            default:
                (0, $257947e92926277a$export$2e2bcd8739ae039).warn("Unrecognized message type:", message.type, "from peer:", this.peer);
                break;
        }
    }
}


class $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b extends (0, $6366c4ca161bc297$export$d365f7ad9d7df9c9) {
    get bufferSize() {
        return this._bufferSize;
    }
    _initializeDataChannel(dc) {
        super._initializeDataChannel(dc);
        this.dataChannel.binaryType = "arraybuffer";
        this.dataChannel.addEventListener("message", (e)=>this._handleDataMessage(e));
    }
    _bufferedSend(msg) {
        if (this._buffering || !this._trySend(msg)) {
            this._buffer.push(msg);
            this._bufferSize = this._buffer.length;
        }
    }
    // Returns true if the send succeeds.
    _trySend(msg) {
        if (!this.open) return false;
        if (this.dataChannel.bufferedAmount > (0, $6366c4ca161bc297$export$d365f7ad9d7df9c9).MAX_BUFFERED_AMOUNT) {
            this._buffering = true;
            setTimeout(()=>{
                this._buffering = false;
                this._tryBuffer();
            }, 50);
            return false;
        }
        try {
            this.dataChannel.send(msg);
        } catch (e) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).error(`DC#:${this.connectionId} Error when sending:`, e);
            this._buffering = true;
            this.close();
            return false;
        }
        return true;
    }
    // Try to send the first message in the buffer.
    _tryBuffer() {
        if (!this.open) return;
        if (this._buffer.length === 0) return;
        const msg = this._buffer[0];
        if (this._trySend(msg)) {
            this._buffer.shift();
            this._bufferSize = this._buffer.length;
            this._tryBuffer();
        }
    }
    close(options) {
        if (options?.flush) {
            this.send({
                __peerData: {
                    type: "close"
                }
            });
            return;
        }
        this._buffer = [];
        this._bufferSize = 0;
        super.close();
    }
    constructor(...args){
        super(...args);
        this._buffer = [];
        this._bufferSize = 0;
        this._buffering = false;
    }
}




class $9fcfddb3ae148f88$export$f0a5a64d5bb37108 extends (0, $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b) {
    close(options) {
        super.close(options);
        this._chunkedData = {};
    }
    constructor(peerId, provider, options){
        super(peerId, provider, options);
        this.chunker = new (0, $fcbcc7538a6776d5$export$f1c5f4c9cb95390b)();
        this.serialization = (0, $78455e22dea96b8c$export$89f507cf986a947).Binary;
        this._chunkedData = {};
    }
    // Handles a DataChannel message.
    _handleDataMessage({ data: data }) {
        const deserializedData = (0, $gCcbY$unpack)(data);
        // PeerJS specific message
        const peerData = deserializedData["__peerData"];
        if (peerData) {
            if (peerData.type === "close") {
                this.close();
                return;
            }
            // Chunked data -- piece things back together.
            // @ts-ignore
            this._handleChunk(deserializedData);
            return;
        }
        this.emit("data", deserializedData);
    }
    _handleChunk(data) {
        const id = data.__peerData;
        const chunkInfo = this._chunkedData[id] || {
            data: [],
            count: 0,
            total: data.total
        };
        chunkInfo.data[data.n] = new Uint8Array(data.data);
        chunkInfo.count++;
        this._chunkedData[id] = chunkInfo;
        if (chunkInfo.total === chunkInfo.count) {
            // Clean up before making the recursive call to `_handleDataMessage`.
            delete this._chunkedData[id];
            // We've received all the chunks--time to construct the complete data.
            // const data = new Blob(chunkInfo.data);
            const data = (0, $fcbcc7538a6776d5$export$52c89ebcdc4f53f2)(chunkInfo.data);
            this._handleDataMessage({
                data: data
            });
        }
    }
    _send(data, chunked) {
        const blob = (0, $gCcbY$pack)(data);
        if (blob instanceof Promise) return this._send_blob(blob);
        if (!chunked && blob.byteLength > this.chunker.chunkedMTU) {
            this._sendChunks(blob);
            return;
        }
        this._bufferedSend(blob);
    }
    async _send_blob(blobPromise) {
        const blob = await blobPromise;
        if (blob.byteLength > this.chunker.chunkedMTU) {
            this._sendChunks(blob);
            return;
        }
        this._bufferedSend(blob);
    }
    _sendChunks(blob) {
        const blobs = this.chunker.chunk(blob);
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`DC#${this.connectionId} Try to send ${blobs.length} chunks...`);
        for (const blob of blobs)this.send(blob, true);
    }
}




class $bbaee3f15f714663$export$6f88fe47d32c9c94 extends (0, $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b) {
    _handleDataMessage({ data: data }) {
        super.emit("data", data);
    }
    _send(data, _chunked) {
        this._bufferedSend(data);
    }
    constructor(...args){
        super(...args);
        this.serialization = (0, $78455e22dea96b8c$export$89f507cf986a947).None;
    }
}





class $817f931e3f9096cf$export$48880ac635f47186 extends (0, $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b) {
    // Handles a DataChannel message.
    _handleDataMessage({ data: data }) {
        const deserializedData = this.parse(this.decoder.decode(data));
        // PeerJS specific message
        const peerData = deserializedData["__peerData"];
        if (peerData && peerData.type === "close") {
            this.close();
            return;
        }
        this.emit("data", deserializedData);
    }
    _send(data, _chunked) {
        const encodedData = this.encoder.encode(this.stringify(data));
        if (encodedData.byteLength >= (0, $4f4134156c446392$export$7debb50ef11d5e0b).chunkedMTU) {
            this.emitError((0, $78455e22dea96b8c$export$49ae800c114df41d).MessageToBig, "Message too big for JSON channel");
            return;
        }
        this._bufferedSend(encodedData);
    }
    constructor(...args){
        super(...args);
        this.serialization = (0, $78455e22dea96b8c$export$89f507cf986a947).JSON;
        this.encoder = new TextEncoder();
        this.decoder = new TextDecoder();
        this.stringify = JSON.stringify;
        this.parse = JSON.parse;
    }
}



class $416260bce337df90$var$PeerOptions {
}
class $416260bce337df90$export$ecd1fc136c422448 extends (0, $23779d1881157a18$export$6a678e589c8a4542) {
    static #_ = this.DEFAULT_KEY = "peerjs";
    /**
	 * The brokering ID of this peer
	 *
	 * If no ID was specified in {@apilink Peer | the constructor},
	 * this will be `undefined` until the {@apilink PeerEvents | `open`} event is emitted.
	 */ get id() {
        return this._id;
    }
    get options() {
        return this._options;
    }
    get open() {
        return this._open;
    }
    /**
	 * @internal
	 */ get socket() {
        return this._socket;
    }
    /**
	 * A hash of all connections associated with this peer, keyed by the remote peer's ID.
	 * @deprecated
	 * Return type will change from Object to Map<string,[]>
	 */ get connections() {
        const plainConnections = Object.create(null);
        for (const [k, v] of this._connections)plainConnections[k] = v;
        return plainConnections;
    }
    /**
	 * true if this peer and all of its connections can no longer be used.
	 */ get destroyed() {
        return this._destroyed;
    }
    /**
	 * false if there is an active connection to the PeerServer.
	 */ get disconnected() {
        return this._disconnected;
    }
    constructor(id, options){
        super();
        this._serializers = {
            raw: (0, $bbaee3f15f714663$export$6f88fe47d32c9c94),
            json: (0, $817f931e3f9096cf$export$48880ac635f47186),
            binary: (0, $9fcfddb3ae148f88$export$f0a5a64d5bb37108),
            "binary-utf8": (0, $9fcfddb3ae148f88$export$f0a5a64d5bb37108),
            default: (0, $9fcfddb3ae148f88$export$f0a5a64d5bb37108)
        };
        this._id = null;
        this._lastServerId = null;
        // States.
        this._destroyed = false // Connections have been killed
        ;
        this._disconnected = false // Connection to PeerServer killed but P2P connections still active
        ;
        this._open = false // Sockets and such are not yet open.
        ;
        this._connections = new Map() // All connections for this peer.
        ;
        this._lostMessages = new Map() // src => [list of messages]
        ;
        let userId;
        // Deal with overloading
        if (id && id.constructor == Object) options = id;
        else if (id) userId = id.toString();
        // Configurize options
        options = {
            debug: 0,
            host: (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST,
            port: (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_PORT,
            path: "/",
            key: $416260bce337df90$export$ecd1fc136c422448.DEFAULT_KEY,
            token: (0, $4f4134156c446392$export$7debb50ef11d5e0b).randomToken(),
            config: (0, $4f4134156c446392$export$7debb50ef11d5e0b).defaultConfig,
            referrerPolicy: "strict-origin-when-cross-origin",
            serializers: {},
            ...options
        };
        this._options = options;
        this._serializers = {
            ...this._serializers,
            ...this.options.serializers
        };
        // Detect relative URL host.
        if (this._options.host === "/") this._options.host = window.location.hostname;
        // Set path correctly.
        if (this._options.path) {
            if (this._options.path[0] !== "/") this._options.path = "/" + this._options.path;
            if (this._options.path[this._options.path.length - 1] !== "/") this._options.path += "/";
        }
        // Set whether we use SSL to same as current host
        if (this._options.secure === undefined && this._options.host !== (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST) this._options.secure = (0, $4f4134156c446392$export$7debb50ef11d5e0b).isSecure();
        else if (this._options.host == (0, $4f4134156c446392$export$7debb50ef11d5e0b).CLOUD_HOST) this._options.secure = true;
        // Set a custom log function if present
        if (this._options.logFunction) (0, $257947e92926277a$export$2e2bcd8739ae039).setLogFunction(this._options.logFunction);
        (0, $257947e92926277a$export$2e2bcd8739ae039).logLevel = this._options.debug || 0;
        this._api = new (0, $abf266641927cd89$export$2c4e825dc9120f87)(options);
        this._socket = this._createServerConnection();
        // Sanity checks
        // Ensure WebRTC supported
        if (!(0, $4f4134156c446392$export$7debb50ef11d5e0b).supports.audioVideo && !(0, $4f4134156c446392$export$7debb50ef11d5e0b).supports.data) {
            this._delayedAbort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).BrowserIncompatible, "The current browser does not support WebRTC");
            return;
        }
        // Ensure alphanumeric id
        if (!!userId && !(0, $4f4134156c446392$export$7debb50ef11d5e0b).validateId(userId)) {
            this._delayedAbort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).InvalidID, `ID "${userId}" is invalid`);
            return;
        }
        if (userId) this._initialize(userId);
        else this._api.retrieveId().then((id)=>this._initialize(id)).catch((error)=>this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).ServerError, error));
    }
    _createServerConnection() {
        const socket = new (0, $8f5bfa60836d261d$export$4798917dbf149b79)(this._options.secure, this._options.host, this._options.port, this._options.path, this._options.key, this._options.pingInterval);
        socket.on((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Message, (data)=>{
            this._handleMessage(data);
        });
        socket.on((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Error, (error)=>{
            this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).SocketError, error);
        });
        socket.on((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Disconnected, ()=>{
            if (this.disconnected) return;
            this.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).Network, "Lost connection to server.");
            this.disconnect();
        });
        socket.on((0, $78455e22dea96b8c$export$3b5c4a4b6354f023).Close, ()=>{
            if (this.disconnected) return;
            this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).SocketClosed, "Underlying socket is already closed.");
        });
        return socket;
    }
    /** Initialize a connection with the server. */ _initialize(id) {
        this._id = id;
        this.socket.start(id, this._options.token);
    }
    /** Handles messages from the server. */ _handleMessage(message) {
        const type = message.type;
        const payload = message.payload;
        const peerId = message.src;
        switch(type){
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Open:
                this._lastServerId = this.id;
                this._open = true;
                this.emit("open", this.id);
                break;
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Error:
                this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).ServerError, payload.msg);
                break;
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).IdTaken:
                this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).UnavailableID, `ID "${this.id}" is taken`);
                break;
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).InvalidKey:
                this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).InvalidKey, `API KEY "${this._options.key}" is invalid`);
                break;
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Leave:
                (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Received leave message from ${peerId}`);
                this._cleanupPeer(peerId);
                this._connections.delete(peerId);
                break;
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Expire:
                this.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).PeerUnavailable, `Could not connect to peer ${peerId}`);
                break;
            case (0, $78455e22dea96b8c$export$adb4a1754da6f10d).Offer:
                {
                    // we should consider switching this to CALL/CONNECT, but this is the least breaking option.
                    const connectionId = payload.connectionId;
                    let connection = this.getConnection(peerId, connectionId);
                    if (connection) {
                        connection.close();
                        (0, $257947e92926277a$export$2e2bcd8739ae039).warn(`Offer received for existing Connection ID:${connectionId}`);
                    }
                    // Create a new connection.
                    if (payload.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Media) {
                        const mediaConnection = new (0, $5c1d08c7c57da9a3$export$4a84e95a2324ac29)(peerId, this, {
                            connectionId: connectionId,
                            _payload: payload,
                            metadata: payload.metadata
                        });
                        connection = mediaConnection;
                        this._addConnection(peerId, connection);
                        this.emit("call", mediaConnection);
                    } else if (payload.type === (0, $78455e22dea96b8c$export$3157d57b4135e3bc).Data) {
                        const dataConnection = new this._serializers[payload.serialization](peerId, this, {
                            connectionId: connectionId,
                            _payload: payload,
                            metadata: payload.metadata,
                            label: payload.label,
                            serialization: payload.serialization,
                            reliable: payload.reliable
                        });
                        connection = dataConnection;
                        this._addConnection(peerId, connection);
                        this.emit("connection", dataConnection);
                    } else {
                        (0, $257947e92926277a$export$2e2bcd8739ae039).warn(`Received malformed connection type:${payload.type}`);
                        return;
                    }
                    // Find messages.
                    const messages = this._getMessages(connectionId);
                    for (const message of messages)connection.handleMessage(message);
                    break;
                }
            default:
                {
                    if (!payload) {
                        (0, $257947e92926277a$export$2e2bcd8739ae039).warn(`You received a malformed message from ${peerId} of type ${type}`);
                        return;
                    }
                    const connectionId = payload.connectionId;
                    const connection = this.getConnection(peerId, connectionId);
                    if (connection && connection.peerConnection) // Pass it on.
                    connection.handleMessage(message);
                    else if (connectionId) // Store for possible later use
                    this._storeMessage(connectionId, message);
                    else (0, $257947e92926277a$export$2e2bcd8739ae039).warn("You received an unrecognized message:", message);
                    break;
                }
        }
    }
    /** Stores messages without a set up connection, to be claimed later. */ _storeMessage(connectionId, message) {
        if (!this._lostMessages.has(connectionId)) this._lostMessages.set(connectionId, []);
        this._lostMessages.get(connectionId).push(message);
    }
    /**
	 * Retrieve messages from lost message store
	 * @internal
	 */ //TODO Change it to private
    _getMessages(connectionId) {
        const messages = this._lostMessages.get(connectionId);
        if (messages) {
            this._lostMessages.delete(connectionId);
            return messages;
        }
        return [];
    }
    /**
	 * Connects to the remote peer specified by id and returns a data connection.
	 * @param peer The brokering ID of the remote peer (their {@apilink Peer.id}).
	 * @param options for specifying details about Peer Connection
	 */ connect(peer, options = {}) {
        options = {
            serialization: "default",
            ...options
        };
        if (this.disconnected) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).warn("You cannot connect to a new Peer because you called .disconnect() on this Peer and ended your connection with the server. You can create a new Peer to reconnect, or call reconnect on this peer if you believe its ID to still be available.");
            this.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).Disconnected, "Cannot connect to new Peer after disconnecting from server.");
            return;
        }
        const dataConnection = new this._serializers[options.serialization](peer, this, options);
        this._addConnection(peer, dataConnection);
        return dataConnection;
    }
    /**
	 * Calls the remote peer specified by id and returns a media connection.
	 * @param peer The brokering ID of the remote peer (their peer.id).
	 * @param stream The caller's media stream
	 * @param options Metadata associated with the connection, passed in by whoever initiated the connection.
	 */ call(peer, stream, options = {}) {
        if (this.disconnected) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).warn("You cannot connect to a new Peer because you called .disconnect() on this Peer and ended your connection with the server. You can create a new Peer to reconnect.");
            this.emitError((0, $78455e22dea96b8c$export$9547aaa2e39030ff).Disconnected, "Cannot connect to new Peer after disconnecting from server.");
            return;
        }
        if (!stream) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).error("To call a peer, you must provide a stream from your browser's `getUserMedia`.");
            return;
        }
        const mediaConnection = new (0, $5c1d08c7c57da9a3$export$4a84e95a2324ac29)(peer, this, {
            ...options,
            _stream: stream
        });
        this._addConnection(peer, mediaConnection);
        return mediaConnection;
    }
    /** Add a data/media connection to this peer. */ _addConnection(peerId, connection) {
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`add connection ${connection.type}:${connection.connectionId} to peerId:${peerId}`);
        if (!this._connections.has(peerId)) this._connections.set(peerId, []);
        this._connections.get(peerId).push(connection);
    }
    //TODO should be private
    _removeConnection(connection) {
        const connections = this._connections.get(connection.peer);
        if (connections) {
            const index = connections.indexOf(connection);
            if (index !== -1) connections.splice(index, 1);
        }
        //remove from lost messages
        this._lostMessages.delete(connection.connectionId);
    }
    /** Retrieve a data/media connection for this peer. */ getConnection(peerId, connectionId) {
        const connections = this._connections.get(peerId);
        if (!connections) return null;
        for (const connection of connections){
            if (connection.connectionId === connectionId) return connection;
        }
        return null;
    }
    _delayedAbort(type, message) {
        setTimeout(()=>{
            this._abort(type, message);
        }, 0);
    }
    /**
	 * Emits an error message and destroys the Peer.
	 * The Peer is not destroyed if it's in a disconnected state, in which case
	 * it retains its disconnected state and its existing connections.
	 */ _abort(type, message) {
        (0, $257947e92926277a$export$2e2bcd8739ae039).error("Aborting!");
        this.emitError(type, message);
        if (!this._lastServerId) this.destroy();
        else this.disconnect();
    }
    /**
	 * Destroys the Peer: closes all active connections as well as the connection
	 * to the server.
	 *
	 * :::caution
	 * This cannot be undone; the respective peer object will no longer be able
	 * to create or receive any connections, its ID will be forfeited on the server,
	 * and all of its data and media connections will be closed.
	 * :::
	 */ destroy() {
        if (this.destroyed) return;
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Destroy peer with ID:${this.id}`);
        this.disconnect();
        this._cleanup();
        this._destroyed = true;
        this.emit("close");
    }
    /** Disconnects every connection on this peer. */ _cleanup() {
        for (const peerId of this._connections.keys()){
            this._cleanupPeer(peerId);
            this._connections.delete(peerId);
        }
        this.socket.removeAllListeners();
    }
    /** Closes all connections to this peer. */ _cleanupPeer(peerId) {
        const connections = this._connections.get(peerId);
        if (!connections) return;
        for (const connection of connections)connection.close();
    }
    /**
	 * Disconnects the Peer's connection to the PeerServer. Does not close any
	 *  active connections.
	 * Warning: The peer can no longer create or accept connections after being
	 *  disconnected. It also cannot reconnect to the server.
	 */ disconnect() {
        if (this.disconnected) return;
        const currentId = this.id;
        (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Disconnect peer with ID:${currentId}`);
        this._disconnected = true;
        this._open = false;
        this.socket.close();
        this._lastServerId = currentId;
        this._id = null;
        this.emit("disconnected", currentId);
    }
    /** Attempts to reconnect with the same ID.
	 *
	 * Only {@apilink Peer.disconnect | disconnected peers} can be reconnected.
	 * Destroyed peers cannot be reconnected.
	 * If the connection fails (as an example, if the peer's old ID is now taken),
	 * the peer's existing connections will not close, but any associated errors events will fire.
	 */ reconnect() {
        if (this.disconnected && !this.destroyed) {
            (0, $257947e92926277a$export$2e2bcd8739ae039).log(`Attempting reconnection to server with ID ${this._lastServerId}`);
            this._disconnected = false;
            this._initialize(this._lastServerId);
        } else if (this.destroyed) throw new Error("This peer cannot reconnect to the server. It has already been destroyed.");
        else if (!this.disconnected && !this.open) // Do nothing. We're still connecting the first time.
        (0, $257947e92926277a$export$2e2bcd8739ae039).error("In a hurry? We're still trying to make the initial connection!");
        else throw new Error(`Peer ${this.id} cannot reconnect because it is not disconnected from the server!`);
    }
    /**
	 * Get a list of available peer IDs. If you're running your own server, you'll
	 * want to set allow_discovery: true in the PeerServer options. If you're using
	 * the cloud server, email team@peerjs.com to get the functionality enabled for
	 * your key.
	 */ listAllPeers(cb = (_)=>{}) {
        this._api.listAllPeers().then((peers)=>cb(peers)).catch((error)=>this._abort((0, $78455e22dea96b8c$export$9547aaa2e39030ff).ServerError, error));
    }
}






class $20dbe68149d7aad9$export$72aa44612e2200cd extends (0, $6366c4ca161bc297$export$d365f7ad9d7df9c9) {
    constructor(peerId, provider, options){
        super(peerId, provider, {
            ...options,
            reliable: true
        });
        this._CHUNK_SIZE = 32768;
        this._splitStream = new TransformStream({
            transform: (chunk, controller)=>{
                for(let split = 0; split < chunk.length; split += this._CHUNK_SIZE)controller.enqueue(chunk.subarray(split, split + this._CHUNK_SIZE));
            }
        });
        this._rawSendStream = new WritableStream({
            write: async (chunk, controller)=>{
                const openEvent = new Promise((resolve)=>this.dataChannel.addEventListener("bufferedamountlow", resolve, {
                        once: true
                    }));
                // if we can send the chunk now, send it
                // if not, we wait until at least half of the sending buffer is free again
                await (this.dataChannel.bufferedAmount <= (0, $6366c4ca161bc297$export$d365f7ad9d7df9c9).MAX_BUFFERED_AMOUNT - chunk.byteLength || openEvent);
                // TODO: what can go wrong here?
                try {
                    this.dataChannel.send(chunk);
                } catch (e) {
                    (0, $257947e92926277a$export$2e2bcd8739ae039).error(`DC#:${this.connectionId} Error when sending:`, e);
                    controller.error(e);
                    this.close();
                }
            }
        });
        this.writer = this._splitStream.writable.getWriter();
        this._rawReadStream = new ReadableStream({
            start: (controller)=>{
                this.once("open", ()=>{
                    this.dataChannel.addEventListener("message", (e)=>{
                        controller.enqueue(e.data);
                    });
                });
            }
        });
        this._splitStream.readable.pipeTo(this._rawSendStream);
    }
    _initializeDataChannel(dc) {
        super._initializeDataChannel(dc);
        this.dataChannel.binaryType = "arraybuffer";
        this.dataChannel.bufferedAmountLowThreshold = (0, $6366c4ca161bc297$export$d365f7ad9d7df9c9).MAX_BUFFERED_AMOUNT / 2;
    }
}


class $6e39230ab36396ad$export$80f5de1a66c4d624 extends (0, $20dbe68149d7aad9$export$72aa44612e2200cd) {
    constructor(peerId, provider, options){
        super(peerId, provider, options);
        this.serialization = "MsgPack";
        this._encoder = new (0, $gCcbY$Encoder)();
        (async ()=>{
            for await (const msg of (0, $gCcbY$decodeMultiStream)(this._rawReadStream)){
                // @ts-ignore
                if (msg.__peerData?.type === "close") {
                    this.close();
                    return;
                }
                this.emit("data", msg);
            }
        })();
    }
    _send(data) {
        return this.writer.write(this._encoder.encode(data));
    }
}


class $1e0aff16be2c328e$export$d72c7bf8eef50853 extends (0, $416260bce337df90$export$ecd1fc136c422448) {
    constructor(...args){
        super(...args);
        this._serializers = {
            MsgPack: $6e39230ab36396ad$export$80f5de1a66c4d624,
            default: (0, $6e39230ab36396ad$export$80f5de1a66c4d624)
        };
    }
}







var $dd0187d7f28e386f$export$2e2bcd8739ae039 = (0, $416260bce337df90$export$ecd1fc136c422448);


export {$dd0187d7f28e386f$export$2e2bcd8739ae039 as default, $4f4134156c446392$export$7debb50ef11d5e0b as util, $a229bedbcaa6ca23$export$ff7c9d4c11d94e8b as BufferedConnection, $20dbe68149d7aad9$export$72aa44612e2200cd as StreamConnection, $6e39230ab36396ad$export$80f5de1a66c4d624 as MsgPack, $416260bce337df90$export$ecd1fc136c422448 as Peer, $1e0aff16be2c328e$export$d72c7bf8eef50853 as MsgPackPeer, $23779d1881157a18$export$98871882f492de82 as PeerError, $78455e22dea96b8c$export$3157d57b4135e3bc as ConnectionType, $78455e22dea96b8c$export$9547aaa2e39030ff as PeerErrorType, $78455e22dea96b8c$export$7974935686149686 as BaseConnectionErrorType, $78455e22dea96b8c$export$49ae800c114df41d as DataConnectionErrorType, $78455e22dea96b8c$export$89f507cf986a947 as SerializationType, $78455e22dea96b8c$export$3b5c4a4b6354f023 as SocketEventType, $78455e22dea96b8c$export$adb4a1754da6f10d as ServerMessageType};
//# sourceMappingURL=bundler.mjs.map
