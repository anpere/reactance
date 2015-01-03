(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);throw new Error("Cannot find module '"+o+"'")}var f=n[o]={exports:{}};t[o][0].call(f.exports,function(e){var n=t[o][1][e];return s(n?n:e)},f,f.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
/**
 * Standalone extraction of Backbone.Events, no external dependency required.
 * Degrades nicely when Backone/underscore are already available in the current
 * global context.
 *
 * Note that docs suggest to use underscore's `_.extend()` method to add Events
 * support to some given object. A `mixin()` method has been added to the Events
 * prototype to avoid using underscore for that sole purpose:
 *
 *     var myEventEmitter = BackboneEvents.mixin({});
 *
 * Or for a function constructor:
 *
 *     function MyConstructor(){}
 *     MyConstructor.prototype.foo = function(){}
 *     BackboneEvents.mixin(MyConstructor.prototype);
 *
 * (c) 2009-2013 Jeremy Ashkenas, DocumentCloud Inc.
 * (c) 2013 Nicolas Perriault
 */
/* global exports:true, define, module */
(function() {
  var root = this,
      nativeForEach = Array.prototype.forEach,
      hasOwnProperty = Object.prototype.hasOwnProperty,
      slice = Array.prototype.slice,
      idCounter = 0;

  // Returns a partial implementation matching the minimal API subset required
  // by Backbone.Events
  function miniscore() {
    return {
      keys: Object.keys || function (obj) {
        if (typeof obj !== "object" && typeof obj !== "function" || obj === null) {
          throw new TypeError("keys() called on a non-object");
        }
        var key, keys = [];
        for (key in obj) {
          if (obj.hasOwnProperty(key)) {
            keys[keys.length] = key;
          }
        }
        return keys;
      },

      uniqueId: function(prefix) {
        var id = ++idCounter + '';
        return prefix ? prefix + id : id;
      },

      has: function(obj, key) {
        return hasOwnProperty.call(obj, key);
      },

      each: function(obj, iterator, context) {
        if (obj == null) return;
        if (nativeForEach && obj.forEach === nativeForEach) {
          obj.forEach(iterator, context);
        } else if (obj.length === +obj.length) {
          for (var i = 0, l = obj.length; i < l; i++) {
            iterator.call(context, obj[i], i, obj);
          }
        } else {
          for (var key in obj) {
            if (this.has(obj, key)) {
              iterator.call(context, obj[key], key, obj);
            }
          }
        }
      },

      once: function(func) {
        var ran = false, memo;
        return function() {
          if (ran) return memo;
          ran = true;
          memo = func.apply(this, arguments);
          func = null;
          return memo;
        };
      }
    };
  }

  var _ = miniscore(), Events;

  // Backbone.Events
  // ---------------

  // A module that can be mixed in to *any object* in order to provide it with
  // custom events. You may bind with `on` or remove with `off` callback
  // functions to an event; `trigger`-ing an event fires all callbacks in
  // succession.
  //
  //     var object = {};
  //     _.extend(object, Backbone.Events);
  //     object.on('expand', function(){ alert('expanded'); });
  //     object.trigger('expand');
  //
  Events = {

    // Bind an event to a `callback` function. Passing `"all"` will bind
    // the callback to all events fired.
    on: function(name, callback, context) {
      if (!eventsApi(this, 'on', name, [callback, context]) || !callback) return this;
      this._events || (this._events = {});
      var events = this._events[name] || (this._events[name] = []);
      events.push({callback: callback, context: context, ctx: context || this});
      return this;
    },

    // Bind an event to only be triggered a single time. After the first time
    // the callback is invoked, it will be removed.
    once: function(name, callback, context) {
      if (!eventsApi(this, 'once', name, [callback, context]) || !callback) return this;
      var self = this;
      var once = _.once(function() {
        self.off(name, once);
        callback.apply(this, arguments);
      });
      once._callback = callback;
      return this.on(name, once, context);
    },

    // Remove one or many callbacks. If `context` is null, removes all
    // callbacks with that function. If `callback` is null, removes all
    // callbacks for the event. If `name` is null, removes all bound
    // callbacks for all events.
    off: function(name, callback, context) {
      var retain, ev, events, names, i, l, j, k;
      if (!this._events || !eventsApi(this, 'off', name, [callback, context])) return this;
      if (!name && !callback && !context) {
        this._events = {};
        return this;
      }

      names = name ? [name] : _.keys(this._events);
      for (i = 0, l = names.length; i < l; i++) {
        name = names[i];
        if (events = this._events[name]) {
          this._events[name] = retain = [];
          if (callback || context) {
            for (j = 0, k = events.length; j < k; j++) {
              ev = events[j];
              if ((callback && callback !== ev.callback && callback !== ev.callback._callback) ||
                  (context && context !== ev.context)) {
                retain.push(ev);
              }
            }
          }
          if (!retain.length) delete this._events[name];
        }
      }

      return this;
    },

    // Trigger one or many events, firing all bound callbacks. Callbacks are
    // passed the same arguments as `trigger` is, apart from the event name
    // (unless you're listening on `"all"`, which will cause your callback to
    // receive the true name of the event as the first argument).
    trigger: function(name) {
      if (!this._events) return this;
      var args = slice.call(arguments, 1);
      if (!eventsApi(this, 'trigger', name, args)) return this;
      var events = this._events[name];
      var allEvents = this._events.all;
      if (events) triggerEvents(events, args);
      if (allEvents) triggerEvents(allEvents, arguments);
      return this;
    },

    // Tell this object to stop listening to either specific events ... or
    // to every object it's currently listening to.
    stopListening: function(obj, name, callback) {
      var listeners = this._listeners;
      if (!listeners) return this;
      var deleteListener = !name && !callback;
      if (typeof name === 'object') callback = this;
      if (obj) (listeners = {})[obj._listenerId] = obj;
      for (var id in listeners) {
        listeners[id].off(name, callback, this);
        if (deleteListener) delete this._listeners[id];
      }
      return this;
    }

  };

  // Regular expression used to split event strings.
  var eventSplitter = /\s+/;

  // Implement fancy features of the Events API such as multiple event
  // names `"change blur"` and jQuery-style event maps `{change: action}`
  // in terms of the existing API.
  var eventsApi = function(obj, action, name, rest) {
    if (!name) return true;

    // Handle event maps.
    if (typeof name === 'object') {
      for (var key in name) {
        obj[action].apply(obj, [key, name[key]].concat(rest));
      }
      return false;
    }

    // Handle space separated event names.
    if (eventSplitter.test(name)) {
      var names = name.split(eventSplitter);
      for (var i = 0, l = names.length; i < l; i++) {
        obj[action].apply(obj, [names[i]].concat(rest));
      }
      return false;
    }

    return true;
  };

  // A difficult-to-believe, but optimized internal dispatch function for
  // triggering events. Tries to keep the usual cases speedy (most internal
  // Backbone events have 3 arguments).
  var triggerEvents = function(events, args) {
    var ev, i = -1, l = events.length, a1 = args[0], a2 = args[1], a3 = args[2];
    switch (args.length) {
      case 0: while (++i < l) (ev = events[i]).callback.call(ev.ctx); return;
      case 1: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1); return;
      case 2: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2); return;
      case 3: while (++i < l) (ev = events[i]).callback.call(ev.ctx, a1, a2, a3); return;
      default: while (++i < l) (ev = events[i]).callback.apply(ev.ctx, args);
    }
  };

  var listenMethods = {listenTo: 'on', listenToOnce: 'once'};

  // Inversion-of-control versions of `on` and `once`. Tell *this* object to
  // listen to an event in another object ... keeping track of what it's
  // listening to.
  _.each(listenMethods, function(implementation, method) {
    Events[method] = function(obj, name, callback) {
      var listeners = this._listeners || (this._listeners = {});
      var id = obj._listenerId || (obj._listenerId = _.uniqueId('l'));
      listeners[id] = obj;
      if (typeof name === 'object') callback = this;
      obj[implementation](name, callback, this);
      return this;
    };
  });

  // Aliases for backwards compatibility.
  Events.bind   = Events.on;
  Events.unbind = Events.off;

  // Mixin utility
  Events.mixin = function(proto) {
    var exports = ['on', 'once', 'off', 'trigger', 'stopListening', 'listenTo',
                   'listenToOnce', 'bind', 'unbind'];
    _.each(exports, function(name) {
      proto[name] = this[name];
    }, this);
    return proto;
  };

  // Export Events as BackboneEvents depending on current context
  if (typeof exports !== 'undefined') {
    if (typeof module !== 'undefined' && module.exports) {
      exports = module.exports = Events;
    }
    exports.BackboneEvents = Events;
  }else if (typeof define === "function") {
    define(function() {
      return Events;
    });
  } else {
    root.BackboneEvents = Events;
  }
})(this);

},{}],2:[function(require,module,exports){
module.exports = require('./backbone-events-standalone');

},{"./backbone-events-standalone":1}],3:[function(require,module,exports){
"use strict";
module.exports = colorStyleForPlayer;
function colorStyleForPlayer(player) {
  var numColors = 10;
  var offset = 8;
  var mult = 3;
  var colorNum = Math.abs(hashString(player) * mult + offset) % (numColors) + 1;
  return ("namelet-" + colorNum);
}
function getColorFromString(player) {
  var colors = ["#c0392b", "#27ae60", "#3498db", "#9b59b6", "#f1c40f", "#e67e22", "#e74c3c"];
  return colors[hashString(player) % colors.length];
}
function hashString(str) {
  var hash = 0,
      i,
      chr,
      len;
  if (str.length == 0)
    return hash;
  for (i = 0, len = str.length; i < len; i++) {
    chr = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  return hash;
}


//# sourceURL=/home/miles/code/reactance/scripts/color.js
},{}],4:[function(require,module,exports){
"use strict";
var BackboneEvents = require("backbone-events-standalone");
module.exports = Dispatcher;
function Dispatcher() {
  this._eventer = BackboneEvents.mixin({});
}
Dispatcher.prototype.dispatch = function(action, payload) {
  if (_.isString(action)) {
    payload = _.extend({action: action}, payload);
  } else {
    payload = action;
  }
  console.log(("dispatch: " + payload.action));
  this._eventer.trigger('action', payload);
};
Dispatcher.prototype.bake = function(action, field) {
  return function(input) {
    var payload = {action: action};
    if (field != undefined) {
      payload[field] = input;
    }
    this.dispatch(payload);
  }.bind(this);
};
Dispatcher.prototype.onAction = function(callback) {
  this._eventer.on('action', callback);
};
Dispatcher.prototype.offAction = function(callback) {
  this._eventer.off('action', callback);
};


//# sourceURL=/home/miles/code/reactance/scripts/dispatcher.js
},{"backbone-events-standalone":2}],5:[function(require,module,exports){
"use strict";
var Store = require('./store');
module.exports = GameState;
function GameState(dispatcher) {
  Store.mixin(this);
  this.playerNames = ['Miles', 'Jess', 'Brandon', 'Ciara', 'Chris'];
  this.settings = {
    merlin: true,
    mordred: false,
    percival: false,
    morgana: false,
    oberon: false
  };
  this.roles = null;
  this.disabledReason = null;
  this.updateRoles();
  dispatcher.onAction(function(payload) {
    var actions = GameState.actions;
    if (_.isFunction(actions[payload.action])) {
      actions[payload.action].call(this, payload);
      this.save();
    }
  }.bind(this));
}
var PERSIST_KEYS = ['playerNames', 'settings', 'roles', 'disabledReason'];
GameState.prototype.save = function() {
  var $__0 = this;
  var persist = {};
  PERSIST_KEYS.forEach((function(key) {
    return persist[key] = $__0[key];
  }));
  store.set('store.gamestate', persist);
};
GameState.prototype.load = function() {
  var $__0 = this;
  var persist = store.get('store.gamestate');
  if (persist !== undefined) {
    PERSIST_KEYS.forEach((function(key) {
      return $__0[key] = persist[key];
    }));
  }
  this.updateRoles();
};
GameState.prototype.getRole = function(name) {
  var $__0 = this;
  if (this.roles === null)
    return null;
  var role = _.extend({}, this.roles[name]);
  if (role.spy) {
    role.otherSpies = _.filter(this.getSpies(), (function(theirName) {
      return !$__0.roles[theirName].oberon && name != theirName;
    }));
    if (this.settings.oberon) {
      role.hasOberon = true;
    }
  }
  if (role.merlin) {
    role.spies = _.filter(this.getSpies(), (function(name) {
      return !$__0.roles[name].mordred;
    }));
  }
  if (role.percival) {
    role.merlins = this.getMerlins();
  }
  return role;
};
GameState.prototype.getSpies = function() {
  var $__0 = this;
  return _.filter(this.playerNames, (function(name) {
    return $__0.roles[name].spy;
  }));
};
GameState.prototype.getMerlins = function() {
  var $__0 = this;
  return _.filter(this.playerNames, (function(name) {
    return $__0.roles[name].morgana || $__0.roles[name].merlin;
  }));
};
GameState.prototype.assignRoles = function() {
  var $__0 = this;
  var numPlayers = this.playerNames.length;
  var numSpies = {
    5: 2,
    6: 2,
    7: 3,
    8: 3,
    9: 3,
    10: 4
  }[numPlayers];
  var shuffledNames = _.shuffle(this.playerNames);
  this.roles = {};
  shuffledNames.forEach((function(name, i) {
    $__0.roles[name] = {spy: i < numSpies};
  }));
  var unassignedSpies = shuffledNames.slice(0, numSpies);
  var unassignedResistance = shuffledNames.slice(numSpies);
  if (this.settings.merlin) {
    var merlinName = unassignedResistance[0];
    unassignedResistance.splice(0, 1);
    this.roles[merlinName].merlin = true;
  }
  if (this.settings.morgana) {
    var morganaName = unassignedSpies[0];
    unassignedSpies.splice(0, 1);
    this.roles[morganaName].morgana = true;
  }
  if (this.settings.percival) {
    var percivalName = unassignedResistance[0];
    unassignedResistance.splice(0, 1);
    this.roles[percivalName].percival = true;
  }
  if (this.settings.mordred) {
    var mordredName = unassignedSpies[0];
    unassignedSpies.splice(0, 1);
    this.roles[mordredName].mordred = true;
  }
  if (this.settings.oberon) {
    var oberonName = unassignedSpies[0];
    unassignedSpies.splice(0, 1);
    this.roles[oberonName].oberon = true;
  }
  this.emitChange();
};
GameState.prototype.updateRoles = function(clear) {
  if (clear) {
    this.roles = null;
  }
  if (this.roles !== null)
    return;
  if (this.playerNames.length < 5) {
    this.disabledReason = 'tooFew';
  } else if (this.playerNames.length > 10) {
    this.disabledReason = 'tooMany';
  } else if (this.playerNames.length < 7 && this.settings.mordred && this.settings.morgana && this.settings.oberon) {
    this.disabledReason = 'tooFew';
  } else {
    this.disabledReason = null;
    this.assignRoles();
  }
};
GameState.actions = {};
GameState.actions.addPlayer = function($__1) {
  var name = $__1.name;
  if (!_.contains(this.playerNames, name)) {
    this.playerNames.push(name);
    this.updateRoles(true);
    this.emitChange();
  }
};
GameState.actions.deletePlayer = function($__1) {
  var name = $__1.name;
  this.playerNames = _.without(this.playerNames, name);
  this.updateRoles(true);
  this.emitChange();
};
GameState.actions.changeSettings = function($__1) {
  var settings = $__1.settings;
  _.extend(this.settings, settings);
  this.updateRoles(true);
  this.emitChange();
};
GameState.actions.newRoles = function() {
  this.updateRoles(true);
};


//# sourceURL=/home/miles/code/reactance/scripts/game-state.js
},{"./store":20}],6:[function(require,module,exports){
"use strict";
var Tabs = React.createFactory(require('./tabs.jsx'));
var SetupPage = React.createFactory(require('./setup-page.jsx'));
var RolesPage = React.createFactory(require('./roles-page.jsx'));
var MissionPage = React.createFactory(require('./mission-page.jsx'));
var Dispatcher = require('./dispatcher');
var UIState = require('./ui-state');
var GameState = require('./game-state');
var MissionState = require('./mission-state');
var store_reset = require('./store-reset');
var dispatcher = new Dispatcher();
var dispatch = dispatcher.dispatch.bind(dispatcher);
var uistate = new UIState(dispatcher);
var gamestate = new GameState(dispatcher);
var missionstate = new MissionState(dispatcher);
store_reset(3);
uistate.load();
gamestate.load();
missionstate.load();
var renderApp = function() {
  var setupPage = SetupPage({
    playerNames: gamestate.playerNames,
    settings: gamestate.settings,
    onAddName: dispatcher.bake('addPlayer', 'name'),
    onDeleteName: dispatcher.bake('deletePlayer', 'name'),
    onChangeSettings: dispatcher.bake('changeSettings', 'settings'),
    onNewRoles: dispatcher.bake('newRoles')
  });
  var rolesPage = RolesPage({
    disabledReason: gamestate.disabledReason,
    playerNames: gamestate.playerNames,
    selectedPlayer: uistate.selectedPlayer,
    selectedRole: gamestate.getRole(uistate.selectedPlayer),
    selectionConfirmed: uistate.selectionConfirmed,
    onClickShow: dispatcher.bake('selectPlayer', 'name'),
    onClickConfirm: dispatcher.bake('confirmPlayer', 'name'),
    onClickCancel: dispatcher.bake('deselectPlayer'),
    onClickOk: dispatcher.bake('deselectPlayer', 'name')
  });
  var missionPage = MissionPage({
    numPlayers: gamestate.playerNames.length,
    passes: missionstate.passes,
    fails: missionstate.fails,
    history: missionstate.history,
    revealed: uistate.missionRevealed,
    onVote: dispatcher.bake('missionVote', 'pass'),
    onReveal: dispatcher.bake('missionReveal'),
    onReset: dispatcher.bake('missionReset')
  });
  React.render(Tabs({
    activeTab: uistate.tab,
    onChangeTab: dispatcher.bake('changeTab', 'tab'),
    tabs: {
      setup: {
        name: 'Setup',
        content: setupPage
      },
      roles: {
        name: 'Roles',
        content: rolesPage
      },
      mission: {
        name: 'Mission',
        content: missionPage
      }
    }
  }), document.getElementById('app'));
};
React.initializeTouchEvents(true);
renderApp();
uistate.onChange(renderApp);
gamestate.onChange(renderApp);
missionstate.onChange(renderApp);


//# sourceURL=/home/miles/code/reactance/scripts/index.js
},{"./dispatcher":4,"./game-state":5,"./mission-page.jsx":8,"./mission-state":9,"./roles-page.jsx":15,"./setup-page.jsx":17,"./store-reset":19,"./tabs.jsx":21,"./ui-state":22}],7:[function(require,module,exports){
/** @jsx React.DOM */

var PT = React.PropTypes

var LabeledNumber = React.createClass({displayName: "LabeledNumber",
    propTypes: {
        num: PT.number.isRequired,
        name: PT.string.isRequired,
    },

    render: function() {
        return React.createElement("figure", {className: "labeled-number"}, 
            this.props.num, 
            React.createElement("figcaption", null, this.props.name)
        )
    },
});

module.exports = LabeledNumber


},{}],8:[function(require,module,exports){
/** @jsx React.DOM */

var LabeledNumber = require('./labeled-number.jsx')
var PT = React.PropTypes
var cx = classnames

var MissionPage = React.createClass({displayName: "MissionPage",
    propTypes: {
        numPlayers: PT.number.isRequired,
        passes: PT.number.isRequired,
        fails:  PT.number.isRequired,
        history: PT.array.isRequired,
        revealed:  PT.bool.isRequired,
        onVote:  PT.func.isRequired,
        onReset:  PT.func.isRequired,
        onReveal:  PT.func.isRequired,
    },

    render: function() {
        var missionNumbers = this.renderMissionNumbers()
        if (this.props.revealed) {
            var passLabel = this.props.passes === 1 ? "Pass" : "Passes"
            var failLabel = this.props.fails === 1 ? "Fail" : "Fails"

            return React.createElement("div", {className: "mission-page revealed"}, 
                missionNumbers, 
                React.createElement("div", {className: "vote-holder"}, 
                    React.createElement(LabeledNumber, {
                        name: passLabel, 
                        num: this.props.passes}), 
                    React.createElement(LabeledNumber, {
                        name: failLabel, 
                        num: this.props.fails})
                ), 
                React.createElement("button", {
                    className: "reset", 
                    onClick: this.props.onReset}, 
                    "Reset")
            )
        } else {
            var votes = this.props.passes + this.props.fails
            Math.random()
            var side = Math.random() > 0.5
            return React.createElement("div", {className: "mission-page"}, 
                missionNumbers, 
                React.createElement(LabeledNumber, {
                    name: "Votes", 
                    num: votes}), 
                this.renderVoteButton(side), 
                this.renderVoteButton(!side), 
                React.createElement("button", {
                    className: "reset", 
                    onClick: this.props.onReset}, 
                    "Reset"), 
                React.createElement("div", {className: "reveal-container"}, 
                    React.createElement("button", {className: "reveal", 
                        onClick: this.props.onReveal}, 
                        "Show Votes")
                )
            )
        }
    },

    renderMissionNumbers: function() {
        var playerCountsMapping = {
            5: ["2", "3", "2", "3", "3"],
            6: ["2", "3", "4", "3", "4"],
            7: ["2", "3", "3", "4*", "4"],
            8: ["3", "4", "4", "5*", "5"],
            9: ["3", "4", "4", "5*", "5"],
            10: ["3", "4", "4", "5*", "5"],
        }
        var playerCounts = playerCountsMapping[this.props.numPlayers]
        var history = this.props.history

        if (playerCounts === undefined) {
            return null
        }

        var digits = playerCounts.map(function(n, i) {
            var played = history.length > i
            var passed = history[i]==0 || (history[i]==1 && playerCounts[i].indexOf("*")!=-1)
            return React.createElement("span", {key: i, className: cx({
                'pass': played && passed,
                'fail': played && !passed,
                'current': history.length ===i,
                'num': true,
            })}, playerCounts[i])
        })

        return React.createElement("div", {className: "mission-numbers"}, 
            digits
        )
    },

    renderVoteButton: function(pass) {
        var label = pass ? "Pass" : "Fail"
        return React.createElement("div", {key: label, className: "vote-container"}, 
            React.createElement("button", {
                className: cx({
                    'pass': pass,
                    'fail': !pass,
                    'secret-focus': true,
                }), 
                "data-pass": pass, 
                onClick: this.onVote}, 
                label)
        )
    },

    onVote: function(e) {
        var pass = e.target.dataset.pass === "true"
        this.props.onVote(pass)
    },
});

module.exports = MissionPage


},{"./labeled-number.jsx":7}],9:[function(require,module,exports){
"use strict";
var Store = require('./store');
module.exports = MissionState;
function MissionState(dispatcher) {
  Store.mixin(this);
  this.passes = 0;
  this.fails = 0;
  this.history = [];
  dispatcher.onAction(function(payload) {
    var actions = MissionState.actions;
    if (_.isFunction(actions[payload.action])) {
      actions[payload.action].call(this, payload);
      this.save();
    }
  }.bind(this));
}
var PERSIST_KEYS = ['passes', 'fails', 'history'];
MissionState.prototype.save = function() {
  var $__0 = this;
  var persist = {};
  PERSIST_KEYS.forEach((function(key) {
    return persist[key] = $__0[key];
  }));
  store.set('store.missionstate', persist);
};
MissionState.prototype.load = function() {
  var $__0 = this;
  var persist = store.get('store.missionstate');
  if (persist !== undefined) {
    PERSIST_KEYS.forEach((function(key) {
      return $__0[key] = persist[key];
    }));
  }
};
MissionState.prototype.resetMission = function() {
  this.passes = 0;
  this.fails = 0;
  this.emitChange();
};
MissionState.prototype.resetMissionHistory = function() {
  this.history = [];
  this.resetMission();
};
MissionState.actions = {};
MissionState.actions.missionVote = function($__1) {
  var pass = $__1.pass;
  if (pass) {
    this.passes += 1;
  } else {
    this.fails += 1;
  }
  this.emitChange();
};
MissionState.actions.missionReset = function() {
  this.resetMission();
};
MissionState.actions.addPlayer = function($__1) {
  var name = $__1.name;
  this.resetMissionHistory();
};
MissionState.actions.deletePlayer = function($__1) {
  var name = $__1.name;
  this.resetMissionHistory();
};
MissionState.actions.changeSettings = function($__1) {
  var settings = $__1.settings;
  this.resetMissionHistory();
};
MissionState.actions.newRoles = function() {
  this.resetMissionHistory();
};
MissionState.actions.missionReveal = function() {
  this.history.push(this.fails);
};


//# sourceURL=/home/miles/code/reactance/scripts/mission-state.js
},{"./store":20}],10:[function(require,module,exports){
/** @jsx React.DOM */

var colorStyleForPlayer = require('./color.js')
var PT = React.PropTypes
var cx = classnames

var Namelet = React.createClass({displayName: "Namelet",
    propTypes: {
        name: PT.string.isRequired,
    },

    render: function() {
        var name = this.props.name
        var styles = {'namelet': true}
        if (this.props.name !== "") {
            styles[colorStyleForPlayer(name)] = true
        }
        return React.createElement("div", {className: cx(styles)}, name[0])
    },

});

module.exports = Namelet


},{"./color.js":3}],11:[function(require,module,exports){
/** @jsx React.DOM */

var Namelet = require('./namelet.jsx')
var PT = React.PropTypes

var NewName = React.createClass({displayName: "NewName",
    propTypes: {
        onAddName: PT.func,
    },

    getInitialState: function() {
        return {text: ''}
    },

    render: function() {
        return React.createElement("form", {className: "new-player", onSubmit: this.onSubmit}, 
            React.createElement(Namelet, {name: this.state.text}), 
            React.createElement("input", {type: "name", 
                className: "name", 
                value: this.state.text, 
                placeholder: "Another Player", 
                autoCapitalize: "on", 
                onChange: this.onChange
                }), 
            React.createElement("button", {className: "new-player"}, 
                "Add")
        )
    },

    onChange: function(e) {
        var name = e.target.value
        name = name.charAt(0).toUpperCase() + name.slice(1),
        this.setState({text: name})
    },

    onSubmit: function(e) {
        e.preventDefault()
        if (this.state.text != "") {
            this.props.onAddName(this.state.text)
            this.setState({text: ""})
        }
    }
});

module.exports = NewName


},{"./namelet.jsx":10}],12:[function(require,module,exports){
/** @jsx React.DOM */

var Namelet = require('./namelet.jsx')
var PT = React.PropTypes

var PlayerChip = React.createClass({displayName: "PlayerChip",
    propTypes: {
        name: PT.string.isRequired,
    },

    render: function() {
        return React.createElement("div", {className: "player-chip"}, 
            React.createElement(Namelet, {name: this.props.name}), 
            React.createElement("span", {className: "name"}, this.props.name)
        )
    },
});

module.exports = PlayerChip


},{"./namelet.jsx":10}],13:[function(require,module,exports){
/** @jsx React.DOM */

var PT = React.PropTypes

var RoleCard = React.createClass({displayName: "RoleCard",
    propTypes: {
        playerName: PT.string.isRequired,
        role: PT.object.isRequired,
    },

    render: function() {
        var role = this.props.role
        var contents = null

        var theSpies = role.spies || role.otherSpies || [];
        var spiesText = theSpies.join(', ')
        var spyNoun = theSpies.length == 1 ? "spy" : "spies"
        var spyVerb = theSpies.length == 1 ? "is" : "are"
        var other = role.spy? "other" : ""
        var oberonText = role.hasOberon? React.createElement("span", null, React.createElement("br", null), React.createElement("span", {className: "spy"}, "Oberon"), " is hidden from you.") : ''
        var spiesBlock = theSpies.length > 0
                ? React.createElement("p", null, "The ", other, " ", spyNoun, " ", spyVerb, " ", React.createElement("span", {className: "spy"}, spiesText), ". ", oberonText)
                : React.createElement("p", null, "You do not see any ", other, " spies.")
        var extraInfo = React.createElement("div", null)
        var description = React.createElement("p", null)

        var name = React.createElement("span", {className: "resistance"}, "resistance")

        if (role.spy && !role.oberon) {
            name = React.createElement("span", null, "a ", React.createElement("span", {className: "spy"}, "spy"));
            extraInfo = spiesBlock;
        }
        if (role.percival) {
            name = React.createElement("span", {className: "resistance"}, "Percival")
            var theMerlins = role.merlins;
            var merlinsText = theMerlins.join(', ');
            var merlinNoun = theMerlins.length == 1 ? 'Merlin' : 'Merlins';
            var merlinVerb = theMerlins.length == 1 ? 'is' : 'are';
            var merlinsBlock = React.createElement("p", null, "The ", merlinNoun, " ", merlinVerb, ": ", merlinsText)
            extraInfo = merlinsBlock;
            description = React.createElement("p", null, "You see ", React.createElement("span", {className: "resistance"}, "Merlin"), " and ", React.createElement("span", {className: "spy"}, "Morgana"), " both as Merlin.")
        }
        if (role.merlin) {
            name = React.createElement("span", {className: "resistance"}, "Merlin");
            extraInfo = spiesBlock;
            description = React.createElement("p", null, "If the spies discover your identity, resistance loses!")
        }
        if (role.mordred) {
            name = React.createElement("span", {className: "spy"}, "Mordred")
            description = React.createElement("p", null, "You are invisible to ", React.createElement("span", {className: "resistance"}, "Merlin"), ".")
        }
        if (role.morgana) {
            name = React.createElement("span", {className: "spy"}, "Morgana")
            description = React.createElement("p", null, "You appear as ", React.createElement("span", {className: "resistance"}, "Merlin"), " to ", React.createElement("span", {className: "resistance"}, "Percival"), ".")
        }
        if (role.oberon) {
            name = React.createElement("span", {className: "spy"}, "Oberon")
            description = React.createElement("p", null, "The other spies cannot see you, and you cannot see them.")
        }

        return React.createElement("div", {className: "role-card"}, 
            React.createElement("p", null, "You are ", name, "!"), 
            extraInfo, 
            description
        )

    },

});

var If = React.createClass({displayName: "If",
    propTypes: {
        cond: PT.bool.isRequired,
        a: PT.element.isRequired,
        b: PT.element.isRequired,
    },

    render: function() {
        if (this.props.cond) {
            return this.props.a
        } else {
            return this.props.b
        }
    },
})

module.exports = RoleCard


},{}],14:[function(require,module,exports){
/** @jsx React.DOM */

var PlayerChip = require('./player-chip.jsx')
var PT = React.PropTypes

var RolePlayerEntry = React.createClass({displayName: "RolePlayerEntry",
    propTypes: {
        name: PT.string.isRequired,
        confirmed: PT.bool.isRequired,
        selected: PT.bool.isRequired,
        content: PT.element,

        onClickShow: PT.func.isRequired,
        onClickConfirm: PT.func.isRequired,
        onClickBack: PT.func.isRequired,
    },

    render: function() {
        return React.createElement("li", {key: this.props.name}, 
            React.createElement(PlayerChip, {name: this.props.name}), 
            this.renderButton(), 
            this.props.content
        )
    },

    renderButton: function() {

        var clickHandler = function() {
            this.props.onClickShow(this.props.name)
        }.bind(this);
        var text = "Show role";

        if(this.props.confirmed) {
            clickHandler = function() {
                this.props.onClickBack()
            }.bind(this);
            text = "Hide";
        }
        else if (this.props.selected) {
            clickHandler = function() {
                this.props.onClickConfirm(this.props.name)
            }.bind(this);
            text = "Are you " + this.props.name + "?";
        }

        return React.createElement("button", {onClick: clickHandler}, text)
    }

});

module.exports = RolePlayerEntry


},{"./player-chip.jsx":12}],15:[function(require,module,exports){
/** @jsx React.DOM */

var RolePlayerEntry = require('./role-player-entry.jsx')
var RoleCard = require('./role-card.jsx')
var PT = React.PropTypes

var RolesPage = React.createClass({displayName: "RolesPage",
    propTypes: {
        disabledReason: PT.oneOf(['tooFew', 'tooMany']),
        playerNames: PT.array.isRequired,
        selectedPlayer: PT.string,
        selectedRole: PT.object,
        selectionConfirmed: PT.bool.isRequired,
        onClickShow: PT.func.isRequired,
        onClickConfirm: PT.func.isRequired,
        onClickCancel: PT.func.isRequired,
        onClickOk: PT.func.isRequired,
    },

    render: function() {
        if (this.props.disabledReason !== null) {
            var message = {
                tooFew: "Not enough players. :(",
                tooMany: "Too many players. :(",
            }[this.props.disabledReason]
            return React.createElement("p", null, message)
        }

        var elements = this.props.playerNames.map(function(name) {
            return this.renderEntry(
                name,
                this.props.selectedPlayer === name,
                this.props.selectionConfirmed)
        }.bind(this))

        return React.createElement("ul", {className: "player-list"}, 
            elements
        )
    },

    renderEntry: function(name, selected, confirmed) {

        var content = null;
        if (selected && confirmed) {
            content = React.createElement(RoleCard, {
                playerName: this.props.selectedPlayer, 
                role: this.props.selectedRole})
        }

        return React.createElement(RolePlayerEntry, {
            key: name, 
            name: name, 
            content: content, 
            selected: selected, 
            confirmed: selected && confirmed, 

            onClickShow: this.props.onClickShow, 
            onClickConfirm: this.props.onClickConfirm, 
            onClickBack: this.props.onClickCancel})

    },
});

module.exports = RolesPage


},{"./role-card.jsx":13,"./role-player-entry.jsx":14}],16:[function(require,module,exports){
/** @jsx React.DOM */

var PT = React.PropTypes
var cx = classnames

var Settings = React.createClass({displayName: "Settings",
    propTypes: {
        // Mapping of settings to their values.
        settings: PT.object.isRequired,
        onChangeSettings: PT.func.isRequired,
    },

    render: function() {
        var settingOrder = ['morgana', 'mordred', 'oberon', 'merlin', 'percival']
        var items = settingOrder.map(function(setting) {
            return React.createElement("li", {key: setting}, React.createElement(Toggle, {
                setting: setting, 
                value: this.props.settings[setting], 
                onChange: this.onChangeSetting}))
        }.bind(this))
        return React.createElement("div", {className: "settings"}, 
            React.createElement("h2", null, "Special Roles"), 
            React.createElement("ul", null, items)
        )
    },

    onChangeSetting: function(setting) {
        var changes = {}
        changes[setting] = !this.props.settings[setting]
        this.props.onChangeSettings(changes)
    },
});

var Toggle = React.createClass({displayName: "Toggle",
    propTypes: {
        setting: PT.string.isRequired,
        value: PT.bool.isRequired,
        onChange: PT.func.isRequired,
    },

    render: function() {
        return React.createElement("button", {
            className: cx({
                'toggle': true,
                'active': this.props.value,
            }), 
            onClick: this.onClick}, 
            capitalize(this.props.setting)
        )
    },

    onClick: function() {
        this.props.onChange(this.props.setting)
    },
});

function capitalize(string) {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

module.exports = Settings


},{}],17:[function(require,module,exports){
/** @jsx React.DOM */

var SetupPlayerList = require('./setup-player-list.jsx')
var Settings = require('./settings.jsx')
var PT = React.PropTypes

var SetupPage = React.createClass({displayName: "SetupPage",
    propTypes: {
        playerNames: PT.array.isRequired,
        // Mapping of settings to their values.
        settings: PT.object.isRequired,
        onAddName: PT.func.isRequired,
        onDeleteName: PT.func.isRequired,
        onChangeSettings: PT.func.isRequired,
        onNewRoles: PT.func.isRequired,
    },

    render: function() {
        return React.createElement("div", null, 
            React.createElement(SetupPlayerList, {
                playerNames: this.props.playerNames, 
                onAddName: this.props.onAddName, 
                onDeleteName: this.props.onDeleteName}), 
            React.createElement(Settings, {
                settings: this.props.settings, 
                onChangeSettings: this.props.onChangeSettings}), 
            React.createElement("button", {className: "new-game", 
                onClick: this.props.onNewRoles}, "New Game")
        )
    },
});

module.exports = SetupPage


},{"./settings.jsx":16,"./setup-player-list.jsx":18}],18:[function(require,module,exports){
/** @jsx React.DOM */

var NewName = require('./new-name.jsx')
var PlayerChip = require('./player-chip.jsx')
var PT = React.PropTypes

var SetupPlayerList = React.createClass({displayName: "SetupPlayerList",
    propTypes: {
        playerNames: PT.array.isRequired,
        onDeleteName: PT.func.isRequired,
        onAddName: PT.func.isRequired,
    },

    render: function() {
        var elements = this.props.playerNames.map(
            this.renderEntry)

        return React.createElement("div", null, React.createElement("h2", null, "Players"), 
            React.createElement("ul", {className: "player-list"}, 
                elements, 
                React.createElement("li", null, 
                    React.createElement(NewName, {onAddName: this.props.onAddName})
                )
            )
        )
    },

    renderEntry: function(name) {
        var onClick = function() {
            this.props.onDeleteName(name);
        }.bind(this);

        return React.createElement("li", {key: name}, 
            React.createElement(PlayerChip, {name: name}), 
            React.createElement("button", {className: "delete", 
                onClick: onClick}
            )
        )
    },
});

module.exports = SetupPlayerList


},{"./new-name.jsx":11,"./player-chip.jsx":12}],19:[function(require,module,exports){
"use strict";
module.exports = store_reset;
function store_reset(version) {
  var stored = store.get('STORE_DB_VERSION');
  if (stored === version) {
    return;
  } else {
    store.clear();
    store.set('STORE_DB_VERSION', version);
  }
}


//# sourceURL=/home/miles/code/reactance/scripts/store-reset.js
},{}],20:[function(require,module,exports){
"use strict";
var BackboneEvents = require("backbone-events-standalone");
module.exports = Store;
function Store() {
  this._eventer = BackboneEvents.mixin({});
  this._emitChangeBatcher = null;
}
Store.prototype.onChange = function(callback) {
  this._eventer.on('change', callback);
};
Store.prototype.offChange = function(callback) {
  this._eventer.off('change', callback);
};
Store.prototype.emitChange = function() {
  if (this._emitChangeBatcher === null) {
    this._emitChangeBatcher = setTimeout(function() {
      this._eventer.trigger('change');
      this._emitChangeBatcher = null;
    }.bind(this), 10);
  }
};
Store.mixin = function(obj) {
  var store = new Store();
  obj.onChange = store.onChange.bind(store);
  obj.offChange = store.offChange.bind(store);
  obj.emitChange = store.emitChange.bind(store);
};


//# sourceURL=/home/miles/code/reactance/scripts/store.js
},{"backbone-events-standalone":2}],21:[function(require,module,exports){
/** @jsx React.DOM */

var PT = React.PropTypes
var cx = classnames

var Tabs = React.createClass({displayName: "Tabs",
    propTypes: {
        activeTab: PT.string.isRequired,
        onChangeTab: PT.func.isRequired,
        tabs: PT.object.isRequired,
    },

    render: function() {
        return React.createElement("div", null, 
            React.createElement("nav", null, 
            this.renderButtons()
            ), 
            React.createElement("div", {className: "tab-contents"}, 
            this.props.tabs[this.props.activeTab].content
            )
        )
    },

    renderButtons: function() {
        return _.map(this.props.tabs, function(val, name) {
            var changeTab = function(e) {
                this.props.onChangeTab(name)
            }.bind(this)

            return React.createElement("a", {
                className: cx({
                    'active': this.props.activeTab === name,
                }), 
                key: name, 
                "data-name": name, 
                onClick: changeTab, 
                onTouchStart: changeTab}, 
                val.name)
        }.bind(this)) 
    },
});

module.exports = Tabs


},{}],22:[function(require,module,exports){
"use strict";
var Store = require('./store');
module.exports = UIState;
function UIState(dispatcher) {
  Store.mixin(this);
  this.tab = 'setup';
  this.selectedPlayer = null;
  this.selectionConfirmed = false;
  this.missionRevealed = false;
  dispatcher.onAction(function(payload) {
    var actions = UIState.actions;
    if (_.isFunction(actions[payload.action])) {
      actions[payload.action].call(this, payload);
      this.save();
    }
  }.bind(this));
}
var PERSIST_KEYS = ['tab', 'selectedPlayer', 'selectionConfirmed', 'missionRevealed'];
UIState.prototype.save = function() {
  var $__0 = this;
  var persist = {};
  PERSIST_KEYS.forEach((function(key) {
    return persist[key] = $__0[key];
  }));
  store.set('store.uistate', persist);
};
UIState.prototype.load = function() {
  var $__0 = this;
  var persist = store.get('store.uistate');
  if (persist !== undefined) {
    PERSIST_KEYS.forEach((function(key) {
      return $__0[key] = persist[key];
    }));
  }
};
UIState.actions = {};
UIState.actions.changeTab = function($__1) {
  var tab = $__1.tab;
  this.tab = tab;
  this.selectedPlayer = null;
  this.selectionConfirmed = false;
  this.emitChange();
};
UIState.actions.selectPlayer = function($__1) {
  var name = $__1.name;
  this.selectedPlayer = name;
  this.selectionConfirmed = false;
  this.emitChange();
};
UIState.actions.confirmPlayer = function($__1) {
  var name = $__1.name;
  this.selectedPlayer = name;
  this.selectionConfirmed = true;
  this.emitChange();
};
UIState.actions.deselectPlayer = function() {
  this.selectedPlayer = null;
  this.selectionConfirmed = false;
  this.emitChange();
};
UIState.actions.missionReveal = function() {
  this.missionRevealed = true;
  this.emitChange();
};
UIState.actions.missionReset = function() {
  this.missionRevealed = false;
  this.emitChange();
};
UIState.actions.newRoles = function() {
  this.tab = 'roles';
  this.selectedPlayer = null;
  this.selectionConfirmed = false;
  this.emitChange();
};


//# sourceURL=/home/miles/code/reactance/scripts/ui-state.js
},{"./store":20}]},{},[6])
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi9ob21lL21pbGVzL2NvZGUvcmVhY3RhbmNlL25vZGVfbW9kdWxlcy9icm93c2VyaWZ5L25vZGVfbW9kdWxlcy9icm93c2VyLXBhY2svX3ByZWx1ZGUuanMiLCIvaG9tZS9taWxlcy9jb2RlL3JlYWN0YW5jZS9ub2RlX21vZHVsZXMvYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmUvYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmUuanMiLCIvaG9tZS9taWxlcy9jb2RlL3JlYWN0YW5jZS9ub2RlX21vZHVsZXMvYmFja2JvbmUtZXZlbnRzLXN0YW5kYWxvbmUvaW5kZXguanMiLCIvaG9tZS9taWxlcy9jb2RlL3JlYWN0YW5jZS9zY3JpcHRzL2NvbG9yLmpzIiwiL2hvbWUvbWlsZXMvY29kZS9yZWFjdGFuY2Uvc2NyaXB0cy9kaXNwYXRjaGVyLmpzIiwiL2hvbWUvbWlsZXMvY29kZS9yZWFjdGFuY2Uvc2NyaXB0cy9nYW1lLXN0YXRlLmpzIiwiL2hvbWUvbWlsZXMvY29kZS9yZWFjdGFuY2Uvc2NyaXB0cy9pbmRleC5qcyIsIi9ob21lL21pbGVzL2NvZGUvcmVhY3RhbmNlL3NjcmlwdHMvbGFiZWxlZC1udW1iZXIuanN4IiwiL2hvbWUvbWlsZXMvY29kZS9yZWFjdGFuY2Uvc2NyaXB0cy9taXNzaW9uLXBhZ2UuanN4IiwiL2hvbWUvbWlsZXMvY29kZS9yZWFjdGFuY2Uvc2NyaXB0cy9taXNzaW9uLXN0YXRlLmpzIiwiL2hvbWUvbWlsZXMvY29kZS9yZWFjdGFuY2Uvc2NyaXB0cy9uYW1lbGV0LmpzeCIsIi9ob21lL21pbGVzL2NvZGUvcmVhY3RhbmNlL3NjcmlwdHMvbmV3LW5hbWUuanN4IiwiL2hvbWUvbWlsZXMvY29kZS9yZWFjdGFuY2Uvc2NyaXB0cy9wbGF5ZXItY2hpcC5qc3giLCIvaG9tZS9taWxlcy9jb2RlL3JlYWN0YW5jZS9zY3JpcHRzL3JvbGUtY2FyZC5qc3giLCIvaG9tZS9taWxlcy9jb2RlL3JlYWN0YW5jZS9zY3JpcHRzL3JvbGUtcGxheWVyLWVudHJ5LmpzeCIsIi9ob21lL21pbGVzL2NvZGUvcmVhY3RhbmNlL3NjcmlwdHMvcm9sZXMtcGFnZS5qc3giLCIvaG9tZS9taWxlcy9jb2RlL3JlYWN0YW5jZS9zY3JpcHRzL3NldHRpbmdzLmpzeCIsIi9ob21lL21pbGVzL2NvZGUvcmVhY3RhbmNlL3NjcmlwdHMvc2V0dXAtcGFnZS5qc3giLCIvaG9tZS9taWxlcy9jb2RlL3JlYWN0YW5jZS9zY3JpcHRzL3NldHVwLXBsYXllci1saXN0LmpzeCIsIi9ob21lL21pbGVzL2NvZGUvcmVhY3RhbmNlL3NjcmlwdHMvc3RvcmUtcmVzZXQuanMiLCIvaG9tZS9taWxlcy9jb2RlL3JlYWN0YW5jZS9zY3JpcHRzL3N0b3JlLmpzIiwiL2hvbWUvbWlsZXMvY29kZS9yZWFjdGFuY2Uvc2NyaXB0cy90YWJzLmpzeCIsIi9ob21lL21pbGVzL2NvZGUvcmVhY3RhbmNlL3NjcmlwdHMvdWktc3RhdGUuanMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7QUNBQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFD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QUFDOUIsS0FBRyxXQUFXLEFBQUMsRUFBQyxDQUFBO0FBQ3BCLENBQUE7QUFFaXBMIiwiZmlsZSI6ImdlbmVyYXRlZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzQ29udGVudCI6WyIoZnVuY3Rpb24gZSh0LG4scil7ZnVuY3Rpb24gcyhvLHUpe2lmKCFuW29dKXtpZighdFtvXSl7dmFyIGE9dHlwZW9mIHJlcXVpcmU9PVwiZnVuY3Rpb25cIiYmcmVxdWlyZTtpZighdSYmYSlyZXR1cm4gYShvLCEwKTtpZihpKXJldHVybiBpKG8sITApO3Rocm93IG5ldyBFcnJvcihcIkNhbm5vdCBmaW5kIG1vZHVsZSAnXCIrbytcIidcIil9dmFyIGY9bltvXT17ZXhwb3J0czp7fX07dFtvXVswXS5jYWxsKGYuZXhwb3J0cyxmdW5jdGlvbihlKXt2YXIgbj10W29dWzFdW2VdO3JldHVybiBzKG4/bjplKX0sZixmLmV4cG9ydHMsZSx0LG4scil9cmV0dXJuIG5bb10uZXhwb3J0c312YXIgaT10eXBlb2YgcmVxdWlyZT09XCJmdW5jdGlvblwiJiZyZXF1aXJlO2Zvcih2YXIgbz0wO288ci5sZW5ndGg7bysrKXMocltvXSk7cmV0dXJuIHN9KSIsIi8qKlxuICogU3RhbmRhbG9uZSBleHRyYWN0aW9uIG9mIEJhY2tib25lLkV2ZW50cywgbm8gZXh0ZXJuYWwgZGVwZW5kZW5jeSByZXF1aXJlZC5cbiAqIERlZ3JhZGVzIG5pY2VseSB3aGVuIEJhY2tvbmUvdW5kZXJzY29yZSBhcmUgYWxyZWFkeSBhdmFpbGFibGUgaW4gdGhlIGN1cnJlbnRcbiAqIGdsb2JhbCBjb250ZXh0LlxuICpcbiAqIE5vdGUgdGhhdCBkb2NzIHN1Z2dlc3QgdG8gdXNlIHVuZGVyc2NvcmUncyBgXy5leHRlbmQoKWAgbWV0aG9kIHRvIGFkZCBFdmVudHNcbiAqIHN1cHBvcnQgdG8gc29tZSBnaXZlbiBvYmplY3QuIEEgYG1peGluKClgIG1ldGhvZCBoYXMgYmVlbiBhZGRlZCB0byB0aGUgRXZlbnRzXG4gKiBwcm90b3R5cGUgdG8gYXZvaWQgdXNpbmcgdW5kZXJzY29yZSBmb3IgdGhhdCBzb2xlIHB1cnBvc2U6XG4gKlxuICogICAgIHZhciBteUV2ZW50RW1pdHRlciA9IEJhY2tib25lRXZlbnRzLm1peGluKHt9KTtcbiAqXG4gKiBPciBmb3IgYSBmdW5jdGlvbiBjb25zdHJ1Y3RvcjpcbiAqXG4gKiAgICAgZnVuY3Rpb24gTXlDb25zdHJ1Y3Rvcigpe31cbiAqICAgICBNeUNvbnN0cnVjdG9yLnByb3RvdHlwZS5mb28gPSBmdW5jdGlvbigpe31cbiAqICAgICBCYWNrYm9uZUV2ZW50cy5taXhpbihNeUNvbnN0cnVjdG9yLnByb3RvdHlwZSk7XG4gKlxuICogKGMpIDIwMDktMjAxMyBKZXJlbXkgQXNoa2VuYXMsIERvY3VtZW50Q2xvdWQgSW5jLlxuICogKGMpIDIwMTMgTmljb2xhcyBQZXJyaWF1bHRcbiAqL1xuLyogZ2xvYmFsIGV4cG9ydHM6dHJ1ZSwgZGVmaW5lLCBtb2R1bGUgKi9cbihmdW5jdGlvbigpIHtcbiAgdmFyIHJvb3QgPSB0aGlzLFxuICAgICAgbmF0aXZlRm9yRWFjaCA9IEFycmF5LnByb3RvdHlwZS5mb3JFYWNoLFxuICAgICAgaGFzT3duUHJvcGVydHkgPSBPYmplY3QucHJvdG90eXBlLmhhc093blByb3BlcnR5LFxuICAgICAgc2xpY2UgPSBBcnJheS5wcm90b3R5cGUuc2xpY2UsXG4gICAgICBpZENvdW50ZXIgPSAwO1xuXG4gIC8vIFJldHVybnMgYSBwYXJ0aWFsIGltcGxlbWVudGF0aW9uIG1hdGNoaW5nIHRoZSBtaW5pbWFsIEFQSSBzdWJzZXQgcmVxdWlyZWRcbiAgLy8gYnkgQmFja2JvbmUuRXZlbnRzXG4gIGZ1bmN0aW9uIG1pbmlzY29yZSgpIHtcbiAgICByZXR1cm4ge1xuICAgICAga2V5czogT2JqZWN0LmtleXMgfHwgZnVuY3Rpb24gKG9iaikge1xuICAgICAgICBpZiAodHlwZW9mIG9iaiAhPT0gXCJvYmplY3RcIiAmJiB0eXBlb2Ygb2JqICE9PSBcImZ1bmN0aW9uXCIgfHwgb2JqID09PSBudWxsKSB7XG4gICAgICAgICAgdGhyb3cgbmV3IFR5cGVFcnJvcihcImtleXMoKSBjYWxsZWQgb24gYSBub24tb2JqZWN0XCIpO1xuICAgICAgICB9XG4gICAgICAgIHZhciBrZXksIGtleXMgPSBbXTtcbiAgICAgICAgZm9yIChrZXkgaW4gb2JqKSB7XG4gICAgICAgICAgaWYgKG9iai5oYXNPd25Qcm9wZXJ0eShrZXkpKSB7XG4gICAgICAgICAgICBrZXlzW2tleXMubGVuZ3RoXSA9IGtleTtcbiAgICAgICAgICB9XG4gICAgICAgIH1cbiAgICAgICAgcmV0dXJuIGtleXM7XG4gICAgICB9LFxuXG4gICAgICB1bmlxdWVJZDogZnVuY3Rpb24ocHJlZml4KSB7XG4gICAgICAgIHZhciBpZCA9ICsraWRDb3VudGVyICsgJyc7XG4gICAgICAgIHJldHVybiBwcmVmaXggPyBwcmVmaXggKyBpZCA6IGlkO1xuICAgICAgfSxcblxuICAgICAgaGFzOiBmdW5jdGlvbihvYmosIGtleSkge1xuICAgICAgICByZXR1cm4gaGFzT3duUHJvcGVydHkuY2FsbChvYmosIGtleSk7XG4gICAgICB9LFxuXG4gICAgICBlYWNoOiBmdW5jdGlvbihvYmosIGl0ZXJhdG9yLCBjb250ZXh0KSB7XG4gICAgICAgIGlmIChvYmogPT0gbnVsbCkgcmV0dXJuO1xuICAgICAgICBpZiAobmF0aXZlRm9yRWFjaCAmJiBvYmouZm9yRWFjaCA9PT0gbmF0aXZlRm9yRWFjaCkge1xuICAgICAgICAgIG9iai5mb3JFYWNoKGl0ZXJhdG9yLCBjb250ZXh0KTtcbiAgICAgICAgfSBlbHNlIGlmIChvYmoubGVuZ3RoID09PSArb2JqLmxlbmd0aCkge1xuICAgICAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gb2JqLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpbaV0sIGksIG9iaik7XG4gICAgICAgICAgfVxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIGZvciAodmFyIGtleSBpbiBvYmopIHtcbiAgICAgICAgICAgIGlmICh0aGlzLmhhcyhvYmosIGtleSkpIHtcbiAgICAgICAgICAgICAgaXRlcmF0b3IuY2FsbChjb250ZXh0LCBvYmpba2V5XSwga2V5LCBvYmopO1xuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuICAgICAgfSxcblxuICAgICAgb25jZTogZnVuY3Rpb24oZnVuYykge1xuICAgICAgICB2YXIgcmFuID0gZmFsc2UsIG1lbW87XG4gICAgICAgIHJldHVybiBmdW5jdGlvbigpIHtcbiAgICAgICAgICBpZiAocmFuKSByZXR1cm4gbWVtbztcbiAgICAgICAgICByYW4gPSB0cnVlO1xuICAgICAgICAgIG1lbW8gPSBmdW5jLmFwcGx5KHRoaXMsIGFyZ3VtZW50cyk7XG4gICAgICAgICAgZnVuYyA9IG51bGw7XG4gICAgICAgICAgcmV0dXJuIG1lbW87XG4gICAgICAgIH07XG4gICAgICB9XG4gICAgfTtcbiAgfVxuXG4gIHZhciBfID0gbWluaXNjb3JlKCksIEV2ZW50cztcblxuICAvLyBCYWNrYm9uZS5FdmVudHNcbiAgLy8gLS0tLS0tLS0tLS0tLS0tXG5cbiAgLy8gQSBtb2R1bGUgdGhhdCBjYW4gYmUgbWl4ZWQgaW4gdG8gKmFueSBvYmplY3QqIGluIG9yZGVyIHRvIHByb3ZpZGUgaXQgd2l0aFxuICAvLyBjdXN0b20gZXZlbnRzLiBZb3UgbWF5IGJpbmQgd2l0aCBgb25gIG9yIHJlbW92ZSB3aXRoIGBvZmZgIGNhbGxiYWNrXG4gIC8vIGZ1bmN0aW9ucyB0byBhbiBldmVudDsgYHRyaWdnZXJgLWluZyBhbiBldmVudCBmaXJlcyBhbGwgY2FsbGJhY2tzIGluXG4gIC8vIHN1Y2Nlc3Npb24uXG4gIC8vXG4gIC8vICAgICB2YXIgb2JqZWN0ID0ge307XG4gIC8vICAgICBfLmV4dGVuZChvYmplY3QsIEJhY2tib25lLkV2ZW50cyk7XG4gIC8vICAgICBvYmplY3Qub24oJ2V4cGFuZCcsIGZ1bmN0aW9uKCl7IGFsZXJ0KCdleHBhbmRlZCcpOyB9KTtcbiAgLy8gICAgIG9iamVjdC50cmlnZ2VyKCdleHBhbmQnKTtcbiAgLy9cbiAgRXZlbnRzID0ge1xuXG4gICAgLy8gQmluZCBhbiBldmVudCB0byBhIGBjYWxsYmFja2AgZnVuY3Rpb24uIFBhc3NpbmcgYFwiYWxsXCJgIHdpbGwgYmluZFxuICAgIC8vIHRoZSBjYWxsYmFjayB0byBhbGwgZXZlbnRzIGZpcmVkLlxuICAgIG9uOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ29uJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkgfHwgIWNhbGxiYWNrKSByZXR1cm4gdGhpcztcbiAgICAgIHRoaXMuX2V2ZW50cyB8fCAodGhpcy5fZXZlbnRzID0ge30pO1xuICAgICAgdmFyIGV2ZW50cyA9IHRoaXMuX2V2ZW50c1tuYW1lXSB8fCAodGhpcy5fZXZlbnRzW25hbWVdID0gW10pO1xuICAgICAgZXZlbnRzLnB1c2goe2NhbGxiYWNrOiBjYWxsYmFjaywgY29udGV4dDogY29udGV4dCwgY3R4OiBjb250ZXh0IHx8IHRoaXN9KTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBCaW5kIGFuIGV2ZW50IHRvIG9ubHkgYmUgdHJpZ2dlcmVkIGEgc2luZ2xlIHRpbWUuIEFmdGVyIHRoZSBmaXJzdCB0aW1lXG4gICAgLy8gdGhlIGNhbGxiYWNrIGlzIGludm9rZWQsIGl0IHdpbGwgYmUgcmVtb3ZlZC5cbiAgICBvbmNlOiBmdW5jdGlvbihuYW1lLCBjYWxsYmFjaywgY29udGV4dCkge1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ29uY2UnLCBuYW1lLCBbY2FsbGJhY2ssIGNvbnRleHRdKSB8fCAhY2FsbGJhY2spIHJldHVybiB0aGlzO1xuICAgICAgdmFyIHNlbGYgPSB0aGlzO1xuICAgICAgdmFyIG9uY2UgPSBfLm9uY2UoZnVuY3Rpb24oKSB7XG4gICAgICAgIHNlbGYub2ZmKG5hbWUsIG9uY2UpO1xuICAgICAgICBjYWxsYmFjay5hcHBseSh0aGlzLCBhcmd1bWVudHMpO1xuICAgICAgfSk7XG4gICAgICBvbmNlLl9jYWxsYmFjayA9IGNhbGxiYWNrO1xuICAgICAgcmV0dXJuIHRoaXMub24obmFtZSwgb25jZSwgY29udGV4dCk7XG4gICAgfSxcblxuICAgIC8vIFJlbW92ZSBvbmUgb3IgbWFueSBjYWxsYmFja3MuIElmIGBjb250ZXh0YCBpcyBudWxsLCByZW1vdmVzIGFsbFxuICAgIC8vIGNhbGxiYWNrcyB3aXRoIHRoYXQgZnVuY3Rpb24uIElmIGBjYWxsYmFja2AgaXMgbnVsbCwgcmVtb3ZlcyBhbGxcbiAgICAvLyBjYWxsYmFja3MgZm9yIHRoZSBldmVudC4gSWYgYG5hbWVgIGlzIG51bGwsIHJlbW92ZXMgYWxsIGJvdW5kXG4gICAgLy8gY2FsbGJhY2tzIGZvciBhbGwgZXZlbnRzLlxuICAgIG9mZjogZnVuY3Rpb24obmFtZSwgY2FsbGJhY2ssIGNvbnRleHQpIHtcbiAgICAgIHZhciByZXRhaW4sIGV2LCBldmVudHMsIG5hbWVzLCBpLCBsLCBqLCBrO1xuICAgICAgaWYgKCF0aGlzLl9ldmVudHMgfHwgIWV2ZW50c0FwaSh0aGlzLCAnb2ZmJywgbmFtZSwgW2NhbGxiYWNrLCBjb250ZXh0XSkpIHJldHVybiB0aGlzO1xuICAgICAgaWYgKCFuYW1lICYmICFjYWxsYmFjayAmJiAhY29udGV4dCkge1xuICAgICAgICB0aGlzLl9ldmVudHMgPSB7fTtcbiAgICAgICAgcmV0dXJuIHRoaXM7XG4gICAgICB9XG5cbiAgICAgIG5hbWVzID0gbmFtZSA/IFtuYW1lXSA6IF8ua2V5cyh0aGlzLl9ldmVudHMpO1xuICAgICAgZm9yIChpID0gMCwgbCA9IG5hbWVzLmxlbmd0aDsgaSA8IGw7IGkrKykge1xuICAgICAgICBuYW1lID0gbmFtZXNbaV07XG4gICAgICAgIGlmIChldmVudHMgPSB0aGlzLl9ldmVudHNbbmFtZV0pIHtcbiAgICAgICAgICB0aGlzLl9ldmVudHNbbmFtZV0gPSByZXRhaW4gPSBbXTtcbiAgICAgICAgICBpZiAoY2FsbGJhY2sgfHwgY29udGV4dCkge1xuICAgICAgICAgICAgZm9yIChqID0gMCwgayA9IGV2ZW50cy5sZW5ndGg7IGogPCBrOyBqKyspIHtcbiAgICAgICAgICAgICAgZXYgPSBldmVudHNbal07XG4gICAgICAgICAgICAgIGlmICgoY2FsbGJhY2sgJiYgY2FsbGJhY2sgIT09IGV2LmNhbGxiYWNrICYmIGNhbGxiYWNrICE9PSBldi5jYWxsYmFjay5fY2FsbGJhY2spIHx8XG4gICAgICAgICAgICAgICAgICAoY29udGV4dCAmJiBjb250ZXh0ICE9PSBldi5jb250ZXh0KSkge1xuICAgICAgICAgICAgICAgIHJldGFpbi5wdXNoKGV2KTtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgICBpZiAoIXJldGFpbi5sZW5ndGgpIGRlbGV0ZSB0aGlzLl9ldmVudHNbbmFtZV07XG4gICAgICAgIH1cbiAgICAgIH1cblxuICAgICAgcmV0dXJuIHRoaXM7XG4gICAgfSxcblxuICAgIC8vIFRyaWdnZXIgb25lIG9yIG1hbnkgZXZlbnRzLCBmaXJpbmcgYWxsIGJvdW5kIGNhbGxiYWNrcy4gQ2FsbGJhY2tzIGFyZVxuICAgIC8vIHBhc3NlZCB0aGUgc2FtZSBhcmd1bWVudHMgYXMgYHRyaWdnZXJgIGlzLCBhcGFydCBmcm9tIHRoZSBldmVudCBuYW1lXG4gICAgLy8gKHVubGVzcyB5b3UncmUgbGlzdGVuaW5nIG9uIGBcImFsbFwiYCwgd2hpY2ggd2lsbCBjYXVzZSB5b3VyIGNhbGxiYWNrIHRvXG4gICAgLy8gcmVjZWl2ZSB0aGUgdHJ1ZSBuYW1lIG9mIHRoZSBldmVudCBhcyB0aGUgZmlyc3QgYXJndW1lbnQpLlxuICAgIHRyaWdnZXI6IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICAgIGlmICghdGhpcy5fZXZlbnRzKSByZXR1cm4gdGhpcztcbiAgICAgIHZhciBhcmdzID0gc2xpY2UuY2FsbChhcmd1bWVudHMsIDEpO1xuICAgICAgaWYgKCFldmVudHNBcGkodGhpcywgJ3RyaWdnZXInLCBuYW1lLCBhcmdzKSkgcmV0dXJuIHRoaXM7XG4gICAgICB2YXIgZXZlbnRzID0gdGhpcy5fZXZlbnRzW25hbWVdO1xuICAgICAgdmFyIGFsbEV2ZW50cyA9IHRoaXMuX2V2ZW50cy5hbGw7XG4gICAgICBpZiAoZXZlbnRzKSB0cmlnZ2VyRXZlbnRzKGV2ZW50cywgYXJncyk7XG4gICAgICBpZiAoYWxsRXZlbnRzKSB0cmlnZ2VyRXZlbnRzKGFsbEV2ZW50cywgYXJndW1lbnRzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH0sXG5cbiAgICAvLyBUZWxsIHRoaXMgb2JqZWN0IHRvIHN0b3AgbGlzdGVuaW5nIHRvIGVpdGhlciBzcGVjaWZpYyBldmVudHMgLi4uIG9yXG4gICAgLy8gdG8gZXZlcnkgb2JqZWN0IGl0J3MgY3VycmVudGx5IGxpc3RlbmluZyB0by5cbiAgICBzdG9wTGlzdGVuaW5nOiBmdW5jdGlvbihvYmosIG5hbWUsIGNhbGxiYWNrKSB7XG4gICAgICB2YXIgbGlzdGVuZXJzID0gdGhpcy5fbGlzdGVuZXJzO1xuICAgICAgaWYgKCFsaXN0ZW5lcnMpIHJldHVybiB0aGlzO1xuICAgICAgdmFyIGRlbGV0ZUxpc3RlbmVyID0gIW5hbWUgJiYgIWNhbGxiYWNrO1xuICAgICAgaWYgKHR5cGVvZiBuYW1lID09PSAnb2JqZWN0JykgY2FsbGJhY2sgPSB0aGlzO1xuICAgICAgaWYgKG9iaikgKGxpc3RlbmVycyA9IHt9KVtvYmouX2xpc3RlbmVySWRdID0gb2JqO1xuICAgICAgZm9yICh2YXIgaWQgaW4gbGlzdGVuZXJzKSB7XG4gICAgICAgIGxpc3RlbmVyc1tpZF0ub2ZmKG5hbWUsIGNhbGxiYWNrLCB0aGlzKTtcbiAgICAgICAgaWYgKGRlbGV0ZUxpc3RlbmVyKSBkZWxldGUgdGhpcy5fbGlzdGVuZXJzW2lkXTtcbiAgICAgIH1cbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH1cblxuICB9O1xuXG4gIC8vIFJlZ3VsYXIgZXhwcmVzc2lvbiB1c2VkIHRvIHNwbGl0IGV2ZW50IHN0cmluZ3MuXG4gIHZhciBldmVudFNwbGl0dGVyID0gL1xccysvO1xuXG4gIC8vIEltcGxlbWVudCBmYW5jeSBmZWF0dXJlcyBvZiB0aGUgRXZlbnRzIEFQSSBzdWNoIGFzIG11bHRpcGxlIGV2ZW50XG4gIC8vIG5hbWVzIGBcImNoYW5nZSBibHVyXCJgIGFuZCBqUXVlcnktc3R5bGUgZXZlbnQgbWFwcyBge2NoYW5nZTogYWN0aW9ufWBcbiAgLy8gaW4gdGVybXMgb2YgdGhlIGV4aXN0aW5nIEFQSS5cbiAgdmFyIGV2ZW50c0FwaSA9IGZ1bmN0aW9uKG9iaiwgYWN0aW9uLCBuYW1lLCByZXN0KSB7XG4gICAgaWYgKCFuYW1lKSByZXR1cm4gdHJ1ZTtcblxuICAgIC8vIEhhbmRsZSBldmVudCBtYXBzLlxuICAgIGlmICh0eXBlb2YgbmFtZSA9PT0gJ29iamVjdCcpIHtcbiAgICAgIGZvciAodmFyIGtleSBpbiBuYW1lKSB7XG4gICAgICAgIG9ialthY3Rpb25dLmFwcGx5KG9iaiwgW2tleSwgbmFtZVtrZXldXS5jb25jYXQocmVzdCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIC8vIEhhbmRsZSBzcGFjZSBzZXBhcmF0ZWQgZXZlbnQgbmFtZXMuXG4gICAgaWYgKGV2ZW50U3BsaXR0ZXIudGVzdChuYW1lKSkge1xuICAgICAgdmFyIG5hbWVzID0gbmFtZS5zcGxpdChldmVudFNwbGl0dGVyKTtcbiAgICAgIGZvciAodmFyIGkgPSAwLCBsID0gbmFtZXMubGVuZ3RoOyBpIDwgbDsgaSsrKSB7XG4gICAgICAgIG9ialthY3Rpb25dLmFwcGx5KG9iaiwgW25hbWVzW2ldXS5jb25jYXQocmVzdCkpO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGZhbHNlO1xuICAgIH1cblxuICAgIHJldHVybiB0cnVlO1xuICB9O1xuXG4gIC8vIEEgZGlmZmljdWx0LXRvLWJlbGlldmUsIGJ1dCBvcHRpbWl6ZWQgaW50ZXJuYWwgZGlzcGF0Y2ggZnVuY3Rpb24gZm9yXG4gIC8vIHRyaWdnZXJpbmcgZXZlbnRzLiBUcmllcyB0byBrZWVwIHRoZSB1c3VhbCBjYXNlcyBzcGVlZHkgKG1vc3QgaW50ZXJuYWxcbiAgLy8gQmFja2JvbmUgZXZlbnRzIGhhdmUgMyBhcmd1bWVudHMpLlxuICB2YXIgdHJpZ2dlckV2ZW50cyA9IGZ1bmN0aW9uKGV2ZW50cywgYXJncykge1xuICAgIHZhciBldiwgaSA9IC0xLCBsID0gZXZlbnRzLmxlbmd0aCwgYTEgPSBhcmdzWzBdLCBhMiA9IGFyZ3NbMV0sIGEzID0gYXJnc1syXTtcbiAgICBzd2l0Y2ggKGFyZ3MubGVuZ3RoKSB7XG4gICAgICBjYXNlIDA6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4KTsgcmV0dXJuO1xuICAgICAgY2FzZSAxOiB3aGlsZSAoKytpIDwgbCkgKGV2ID0gZXZlbnRzW2ldKS5jYWxsYmFjay5jYWxsKGV2LmN0eCwgYTEpOyByZXR1cm47XG4gICAgICBjYXNlIDI6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIpOyByZXR1cm47XG4gICAgICBjYXNlIDM6IHdoaWxlICgrK2kgPCBsKSAoZXYgPSBldmVudHNbaV0pLmNhbGxiYWNrLmNhbGwoZXYuY3R4LCBhMSwgYTIsIGEzKTsgcmV0dXJuO1xuICAgICAgZGVmYXVsdDogd2hpbGUgKCsraSA8IGwpIChldiA9IGV2ZW50c1tpXSkuY2FsbGJhY2suYXBwbHkoZXYuY3R4LCBhcmdzKTtcbiAgICB9XG4gIH07XG5cbiAgdmFyIGxpc3Rlbk1ldGhvZHMgPSB7bGlzdGVuVG86ICdvbicsIGxpc3RlblRvT25jZTogJ29uY2UnfTtcblxuICAvLyBJbnZlcnNpb24tb2YtY29udHJvbCB2ZXJzaW9ucyBvZiBgb25gIGFuZCBgb25jZWAuIFRlbGwgKnRoaXMqIG9iamVjdCB0b1xuICAvLyBsaXN0ZW4gdG8gYW4gZXZlbnQgaW4gYW5vdGhlciBvYmplY3QgLi4uIGtlZXBpbmcgdHJhY2sgb2Ygd2hhdCBpdCdzXG4gIC8vIGxpc3RlbmluZyB0by5cbiAgXy5lYWNoKGxpc3Rlbk1ldGhvZHMsIGZ1bmN0aW9uKGltcGxlbWVudGF0aW9uLCBtZXRob2QpIHtcbiAgICBFdmVudHNbbWV0aG9kXSA9IGZ1bmN0aW9uKG9iaiwgbmFtZSwgY2FsbGJhY2spIHtcbiAgICAgIHZhciBsaXN0ZW5lcnMgPSB0aGlzLl9saXN0ZW5lcnMgfHwgKHRoaXMuX2xpc3RlbmVycyA9IHt9KTtcbiAgICAgIHZhciBpZCA9IG9iai5fbGlzdGVuZXJJZCB8fCAob2JqLl9saXN0ZW5lcklkID0gXy51bmlxdWVJZCgnbCcpKTtcbiAgICAgIGxpc3RlbmVyc1tpZF0gPSBvYmo7XG4gICAgICBpZiAodHlwZW9mIG5hbWUgPT09ICdvYmplY3QnKSBjYWxsYmFjayA9IHRoaXM7XG4gICAgICBvYmpbaW1wbGVtZW50YXRpb25dKG5hbWUsIGNhbGxiYWNrLCB0aGlzKTtcbiAgICAgIHJldHVybiB0aGlzO1xuICAgIH07XG4gIH0pO1xuXG4gIC8vIEFsaWFzZXMgZm9yIGJhY2t3YXJkcyBjb21wYXRpYmlsaXR5LlxuICBFdmVudHMuYmluZCAgID0gRXZlbnRzLm9uO1xuICBFdmVudHMudW5iaW5kID0gRXZlbnRzLm9mZjtcblxuICAvLyBNaXhpbiB1dGlsaXR5XG4gIEV2ZW50cy5taXhpbiA9IGZ1bmN0aW9uKHByb3RvKSB7XG4gICAgdmFyIGV4cG9ydHMgPSBbJ29uJywgJ29uY2UnLCAnb2ZmJywgJ3RyaWdnZXInLCAnc3RvcExpc3RlbmluZycsICdsaXN0ZW5UbycsXG4gICAgICAgICAgICAgICAgICAgJ2xpc3RlblRvT25jZScsICdiaW5kJywgJ3VuYmluZCddO1xuICAgIF8uZWFjaChleHBvcnRzLCBmdW5jdGlvbihuYW1lKSB7XG4gICAgICBwcm90b1tuYW1lXSA9IHRoaXNbbmFtZV07XG4gICAgfSwgdGhpcyk7XG4gICAgcmV0dXJuIHByb3RvO1xuICB9O1xuXG4gIC8vIEV4cG9ydCBFdmVudHMgYXMgQmFja2JvbmVFdmVudHMgZGVwZW5kaW5nIG9uIGN1cnJlbnQgY29udGV4dFxuICBpZiAodHlwZW9mIGV4cG9ydHMgIT09ICd1bmRlZmluZWQnKSB7XG4gICAgaWYgKHR5cGVvZiBtb2R1bGUgIT09ICd1bmRlZmluZWQnICYmIG1vZHVsZS5leHBvcnRzKSB7XG4gICAgICBleHBvcnRzID0gbW9kdWxlLmV4cG9ydHMgPSBFdmVudHM7XG4gICAgfVxuICAgIGV4cG9ydHMuQmFja2JvbmVFdmVudHMgPSBFdmVudHM7XG4gIH1lbHNlIGlmICh0eXBlb2YgZGVmaW5lID09PSBcImZ1bmN0aW9uXCIpIHtcbiAgICBkZWZpbmUoZnVuY3Rpb24oKSB7XG4gICAgICByZXR1cm4gRXZlbnRzO1xuICAgIH0pO1xuICB9IGVsc2Uge1xuICAgIHJvb3QuQmFja2JvbmVFdmVudHMgPSBFdmVudHM7XG4gIH1cbn0pKHRoaXMpO1xuIiwibW9kdWxlLmV4cG9ydHMgPSByZXF1aXJlKCcuL2JhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lJyk7XG4iLCJtb2R1bGUuZXhwb3J0cyA9IGNvbG9yU3R5bGVGb3JQbGF5ZXI7XG5cbmZ1bmN0aW9uIGNvbG9yU3R5bGVGb3JQbGF5ZXIocGxheWVyKSB7XG4gICAgLy8gS2VlcCB0aGlzIGluIHN5bmMgd2l0aCBpbmRleC5sZXNzXG4gICAgdmFyIG51bUNvbG9ycyA9IDEwXG4gICAgdmFyIG9mZnNldCA9IDhcbiAgICB2YXIgbXVsdCA9IDNcbiAgICB2YXIgY29sb3JOdW0gPSBNYXRoLmFicyhoYXNoU3RyaW5nKHBsYXllcikgKiBtdWx0ICsgb2Zmc2V0KSAlIChudW1Db2xvcnMpICsgMVxuICAgIHJldHVybiBgbmFtZWxldC0ke2NvbG9yTnVtfWBcbn1cblxuZnVuY3Rpb24gZ2V0Q29sb3JGcm9tU3RyaW5nKHBsYXllcikge1xuICAgIC8vIGNvbG9ycyBmcm9tIGh0dHA6Ly9mbGF0dWljb2xvcnMuY29tL1xuICAgIHZhciBjb2xvcnMgPSBbXCIjYzAzOTJiXCIsIFwiIzI3YWU2MFwiLCBcIiMzNDk4ZGJcIiwgXCIjOWI1OWI2XCIsIFwiI2YxYzQwZlwiLCBcIiNlNjdlMjJcIiwgXCIjZTc0YzNjXCJdO1xuXG4gICAgcmV0dXJuIGNvbG9yc1toYXNoU3RyaW5nKHBsYXllcikgJSBjb2xvcnMubGVuZ3RoXTtcblxufVxuXG5mdW5jdGlvbiBoYXNoU3RyaW5nKHN0cikge1xuICAgIHZhciBoYXNoID0gMCwgaSwgY2hyLCBsZW47XG4gICAgaWYgKHN0ci5sZW5ndGggPT0gMCkgcmV0dXJuIGhhc2g7XG4gICAgZm9yIChpID0gMCwgbGVuID0gc3RyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG4gICAgICAgIGNociAgID0gc3RyLmNoYXJDb2RlQXQoaSk7XG4gICAgICAgIGhhc2ggID0gKChoYXNoIDw8IDUpIC0gaGFzaCkgKyBjaHI7XG4gICAgICAgIGhhc2ggfD0gMDtcbiAgICB9XG4gICAgcmV0dXJuIGhhc2g7XG59XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaUwyaHZiV1V2Yldsc1pYTXZZMjlrWlM5eVpXRmpkR0Z1WTJVdmMyTnlhWEIwY3k5amIyeHZjaTVxY3lJc0luTnZkWEpqWlhNaU9sc2lMMmh2YldVdmJXbHNaWE12WTI5a1pTOXlaV0ZqZEdGdVkyVXZjMk55YVhCMGN5OWpiMnh2Y2k1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaVFVRkJRU3hOUVVGTkxFTkJRVU1zVDBGQlR5eEhRVUZITEcxQ1FVRnRRaXhEUVVGRE96dEJRVVZ5UXl4VFFVRlRMRzFDUVVGdFFpeERRVUZETEUxQlFVMHNSVUZCUlRzN1NVRkZha01zU1VGQlNTeFRRVUZUTEVkQlFVY3NSVUZCUlR0SlFVTnNRaXhKUVVGSkxFMUJRVTBzUjBGQlJ5eERRVUZETzBsQlEyUXNTVUZCU1N4SlFVRkpMRWRCUVVjc1EwRkJRenRKUVVOYUxFbEJRVWtzVVVGQlVTeEhRVUZITEVsQlFVa3NRMEZCUXl4SFFVRkhMRU5CUVVNc1ZVRkJWU3hEUVVGRExFMUJRVTBzUTBGQlF5eEhRVUZITEVsQlFVa3NSMEZCUnl4TlFVRk5MRU5CUVVNc1NVRkJTU3hUUVVGVExFTkJRVU1zUjBGQlJ5eERRVUZETzBsQlF6ZEZMRTlCUVU4c1YwRkJWeXhSUVVGUkxFVkJRVVU3UVVGRGFFTXNRMEZCUXpzN1FVRkZSQ3hUUVVGVExHdENRVUZyUWl4RFFVRkRMRTFCUVUwc1JVRkJSVHM3UVVGRmNFTXNTVUZCU1N4SlFVRkpMRTFCUVUwc1IwRkJSeXhEUVVGRExGTkJRVk1zUlVGQlJTeFRRVUZUTEVWQlFVVXNVMEZCVXl4RlFVRkZMRk5CUVZNc1JVRkJSU3hUUVVGVExFVkJRVVVzVTBGQlV5eEZRVUZGTEZOQlFWTXNRMEZCUXl4RFFVRkRPenRCUVVVdlJpeEpRVUZKTEU5QlFVOHNUVUZCVFN4RFFVRkRMRlZCUVZVc1EwRkJReXhOUVVGTkxFTkJRVU1zUjBGQlJ5eE5RVUZOTEVOQlFVTXNUVUZCVFN4RFFVRkRMRU5CUVVNN08wRkJSWFJFTEVOQlFVTTdPMEZCUlVRc1UwRkJVeXhWUVVGVkxFTkJRVU1zUjBGQlJ5eEZRVUZGTzBsQlEzSkNMRWxCUVVrc1NVRkJTU3hIUVVGSExFTkJRVU1zUlVGQlJTeERRVUZETEVWQlFVVXNSMEZCUnl4RlFVRkZMRWRCUVVjc1EwRkJRenRKUVVNeFFpeEpRVUZKTEVkQlFVY3NRMEZCUXl4TlFVRk5MRWxCUVVrc1EwRkJReXhGUVVGRkxFOUJRVThzU1VGQlNTeERRVUZETzBsQlEycERMRXRCUVVzc1EwRkJReXhIUVVGSExFTkJRVU1zUlVGQlJTeEhRVUZITEVkQlFVY3NSMEZCUnl4RFFVRkRMRTFCUVUwc1JVRkJSU3hEUVVGRExFZEJRVWNzUjBGQlJ5eEZRVUZGTEVOQlFVTXNSVUZCUlN4RlFVRkZPMUZCUTNoRExFZEJRVWNzUzBGQlN5eEhRVUZITEVOQlFVTXNWVUZCVlN4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xRkJRekZDTEVsQlFVa3NTVUZCU1N4RFFVRkRMRU5CUVVNc1NVRkJTU3hKUVVGSkxFTkJRVU1zU1VGQlNTeEpRVUZKTEVsQlFVa3NSMEZCUnl4RFFVRkRPMUZCUTI1RExFbEJRVWtzU1VGQlNTeERRVUZETEVOQlFVTTdTMEZEWWp0SlFVTkVMRTlCUVU4c1NVRkJTU3hEUVVGRE8wTkJRMllpTENKemIzVnlZMlZ6UTI5dWRHVnVkQ0k2V3lKdGIyUjFiR1V1Wlhod2IzSjBjeUE5SUdOdmJHOXlVM1I1YkdWR2IzSlFiR0Y1WlhJN1hHNWNibVoxYm1OMGFXOXVJR052Ykc5eVUzUjViR1ZHYjNKUWJHRjVaWElvY0d4aGVXVnlLU0I3WEc0Z0lDQWdMeThnUzJWbGNDQjBhR2x6SUdsdUlITjVibU1nZDJsMGFDQnBibVJsZUM1c1pYTnpYRzRnSUNBZ2RtRnlJRzUxYlVOdmJHOXljeUE5SURFd1hHNGdJQ0FnZG1GeUlHOW1abk5sZENBOUlEaGNiaUFnSUNCMllYSWdiWFZzZENBOUlETmNiaUFnSUNCMllYSWdZMjlzYjNKT2RXMGdQU0JOWVhSb0xtRmljeWhvWVhOb1UzUnlhVzVuS0hCc1lYbGxjaWtnS2lCdGRXeDBJQ3NnYjJabWMyVjBLU0FsSUNodWRXMURiMnh2Y25NcElDc2dNVnh1SUNBZ0lISmxkSFZ5YmlCZ2JtRnRaV3hsZEMwa2UyTnZiRzl5VG5WdGZXQmNibjFjYmx4dVpuVnVZM1JwYjI0Z1oyVjBRMjlzYjNKR2NtOXRVM1J5YVc1bktIQnNZWGxsY2lrZ2UxeHVJQ0FnSUM4dklHTnZiRzl5Y3lCbWNtOXRJR2gwZEhBNkx5OW1iR0YwZFdsamIyeHZjbk11WTI5dEwxeHVJQ0FnSUhaaGNpQmpiMnh2Y25NZ1BTQmJYQ0lqWXpBek9USmlYQ0lzSUZ3aUl6STNZV1UyTUZ3aUxDQmNJaU16TkRrNFpHSmNJaXdnWENJak9XSTFPV0kyWENJc0lGd2lJMll4WXpRd1psd2lMQ0JjSWlObE5qZGxNakpjSWl3Z1hDSWpaVGMwWXpOalhDSmRPMXh1WEc0Z0lDQWdjbVYwZFhKdUlHTnZiRzl5YzF0b1lYTm9VM1J5YVc1bktIQnNZWGxsY2lrZ0pTQmpiMnh2Y25NdWJHVnVaM1JvWFR0Y2JseHVmVnh1WEc1bWRXNWpkR2x2YmlCb1lYTm9VM1J5YVc1bktITjBjaWtnZTF4dUlDQWdJSFpoY2lCb1lYTm9JRDBnTUN3Z2FTd2dZMmh5TENCc1pXNDdYRzRnSUNBZ2FXWWdLSE4wY2k1c1pXNW5kR2dnUFQwZ01Da2djbVYwZFhKdUlHaGhjMmc3WEc0Z0lDQWdabTl5SUNocElEMGdNQ3dnYkdWdUlEMGdjM1J5TG14bGJtZDBhRHNnYVNBOElHeGxianNnYVNzcktTQjdYRzRnSUNBZ0lDQWdJR05vY2lBZ0lEMGdjM1J5TG1Ob1lYSkRiMlJsUVhRb2FTazdYRzRnSUNBZ0lDQWdJR2hoYzJnZ0lEMGdLQ2hvWVhOb0lEdzhJRFVwSUMwZ2FHRnphQ2tnS3lCamFISTdYRzRnSUNBZ0lDQWdJR2hoYzJnZ2ZEMGdNRHRjYmlBZ0lDQjlYRzRnSUNBZ2NtVjBkWEp1SUdoaGMyZzdYRzU5WEc0aVhYMD0iLCIvKipcbiAqIEZsdXggRGlzcGF0Y2hlclxuICpcbiAqIERpc3BhdGNoZXMgYWN0aW9ucyB0byBsaXN0ZW5lcnMgcmVnaXN0ZXJlZCB1c2luZyBvbkFjdGlvbi5cbiAqIEFjdGlvbnMgYXJlIGRlbGl2ZXJkIGFzIHBheWxvYWRzIGxpa2VcbiAqICAge2FjdGlvbjogJ2NoYW5nZVNldHRpbmdzJywgY29sb3I6IGNvbG9yfVxuICogVGhlICdhY3Rpb24nIGtleSBpcyByZXF1aXJlZCwgYWxsIG90aGVyIGtleXMgYXJlIHVwIHRvIHRoZSBhcHBsaWNhdGlvbi5cbiAqL1xudmFyIEJhY2tib25lRXZlbnRzID0gcmVxdWlyZShcImJhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IERpc3BhdGNoZXJcblxuZnVuY3Rpb24gRGlzcGF0Y2hlcigpIHtcbiAgICB0aGlzLl9ldmVudGVyID0gQmFja2JvbmVFdmVudHMubWl4aW4oe30pXG59XG5cbi8qKlxuICogRGlzcGF0Y2ggYW4gYWN0aW9uLlxuICogVXNhZ2U6XG4gKiBkaXNwYXRjaGVyKCdmaWRnZXQnKVxuICogZGlzcGF0Y2hlcignZmlkZ2V0Jywge3dpdGg6ICdwZW5jaWwnfSlcbiAqIGRpc3BhdGNoZXIoe2FjdGlvbjogJ2ZpZGdldCcsIHdpdGg6ICdwZW5jaWwnfSlcbiAqL1xuRGlzcGF0Y2hlci5wcm90b3R5cGUuZGlzcGF0Y2ggPSBmdW5jdGlvbihhY3Rpb24sIHBheWxvYWQpIHtcbiAgICBpZiAoXy5pc1N0cmluZyhhY3Rpb24pKSB7XG4gICAgICAgIHBheWxvYWQgPSBfLmV4dGVuZCh7YWN0aW9uOiBhY3Rpb259LCBwYXlsb2FkKVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHBheWxvYWQgPSBhY3Rpb25cbiAgICB9XG4gICAgY29uc29sZS5sb2coYGRpc3BhdGNoOiAke3BheWxvYWQuYWN0aW9ufWApXG4gICAgdGhpcy5fZXZlbnRlci50cmlnZ2VyKCdhY3Rpb24nLCBwYXlsb2FkKVxufVxuXG4vKipcbiAqIFNob3J0aGFuZCB0byBwcmVwYXJlIGEgc2ltcGxlIGRpc3BhdGNoIGZ1bmN0aW9uLlxuICogRG9lcyBub3QgZmlyZSBhbiBldmVudCwgYnV0IHJldHVybnMgYSBmdW5jdGlvbiB0aGF0IGNhbi5cbiAqIFRoZXNlIGFyZSBlcXVpdmFsZW50OlxuICogZGlzcGF0Y2hlci5iYWtlKCdjaGFuZ2VTZXR0aW5nJywgJ2NvbG9yJylcbiAqIChjb2xvcikgPT4geyBkaXNwYXRjaGVyLmRpc3BhdGNoKCdjaGFuZ2VTZXR0aW5nJywge2NvbG9yOiBjb2xvcn0pIH1cbiAqL1xuRGlzcGF0Y2hlci5wcm90b3R5cGUuYmFrZSA9IGZ1bmN0aW9uKGFjdGlvbiwgZmllbGQpIHtcbiAgICByZXR1cm4gZnVuY3Rpb24oaW5wdXQpIHtcbiAgICAgICAgdmFyIHBheWxvYWQgPSB7YWN0aW9uOiBhY3Rpb259XG4gICAgICAgIGlmIChmaWVsZCAhPSB1bmRlZmluZWQpIHtcbiAgICAgICAgICAgIHBheWxvYWRbZmllbGRdID0gaW5wdXRcbiAgICAgICAgfVxuICAgICAgICB0aGlzLmRpc3BhdGNoKHBheWxvYWQpXG4gICAgfS5iaW5kKHRoaXMpXG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBjYWxsYmFjayB0byByZWNlaXZlIGFsbCBhY3Rpb25zLlxuICogRXhhbXBsZTpcbiAqIGRpc3BhdGNoZXIub25BY3Rpb24oKGFjdGlvbikgPT4ge1xuICogICBjb25zb2xlLmxvZyhgZ290IGFjdGlvbiBvZiB0eXBlICR7cGF5bG9hZC5hY3Rpb259YFxuICogfSlcbiAqL1xuRGlzcGF0Y2hlci5wcm90b3R5cGUub25BY3Rpb24gPSBmdW5jdGlvbihjYWxsYmFjaykge1xuICAgIHRoaXMuX2V2ZW50ZXIub24oJ2FjdGlvbicsIGNhbGxiYWNrKVxufVxuXG4vKipcbiAqIFVucmVnaXN0ZXIgYSBjYWxsYmFjayBwcmV2aW91c2x5IHJlZ2lzdGVyZWQgd2l0aCBvbkFjdGlvbi5cbiAqL1xuRGlzcGF0Y2hlci5wcm90b3R5cGUub2ZmQWN0aW9uID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB0aGlzLl9ldmVudGVyLm9mZignYWN0aW9uJywgY2FsbGJhY2spXG59XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaUwyaHZiV1V2Yldsc1pYTXZZMjlrWlM5eVpXRmpkR0Z1WTJVdmMyTnlhWEIwY3k5a2FYTndZWFJqYUdWeUxtcHpJaXdpYzI5MWNtTmxjeUk2V3lJdmFHOXRaUzl0YVd4bGN5OWpiMlJsTDNKbFlXTjBZVzVqWlM5elkzSnBjSFJ6TDJScGMzQmhkR05vWlhJdWFuTWlYU3dpYm1GdFpYTWlPbHRkTENKdFlYQndhVzVuY3lJNklrRkJRVUU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPenRIUVVWSE8wRkJRMGdzU1VGQlNTeGpRVUZqTEVkQlFVY3NUMEZCVHl4RFFVRkRMRFJDUVVFMFFpeERRVUZETEVOQlFVTTdPMEZCUlRORUxFMUJRVTBzUTBGQlF5eFBRVUZQTEVkQlFVY3NWVUZCVlRzN1FVRkZNMElzVTBGQlV5eFZRVUZWTEVkQlFVYzdTVUZEYkVJc1NVRkJTU3hEUVVGRExGRkJRVkVzUjBGQlJ5eGpRVUZqTEVOQlFVTXNTMEZCU3l4RFFVRkRMRVZCUVVVc1EwRkJRenRCUVVNMVF5eERRVUZET3p0QlFVVkVPMEZCUTBFN1FVRkRRVHRCUVVOQk8wRkJRMEU3TzBkQlJVYzdRVUZEU0N4VlFVRlZMRU5CUVVNc1UwRkJVeXhEUVVGRExGRkJRVkVzUjBGQlJ5eFRRVUZUTEUxQlFVMHNSVUZCUlN4UFFVRlBMRVZCUVVVN1NVRkRkRVFzU1VGQlNTeERRVUZETEVOQlFVTXNVVUZCVVN4RFFVRkRMRTFCUVUwc1EwRkJReXhGUVVGRk8xRkJRM0JDTEU5QlFVOHNSMEZCUnl4RFFVRkRMRU5CUVVNc1RVRkJUU3hEUVVGRExFTkJRVU1zVFVGQlRTeEZRVUZGTEUxQlFVMHNRMEZCUXl4RlFVRkZMRTlCUVU4c1EwRkJRenRMUVVOb1JDeE5RVUZOTzFGQlEwZ3NUMEZCVHl4SFFVRkhMRTFCUVUwN1MwRkRia0k3U1VGRFJDeFBRVUZQTEVOQlFVTXNSMEZCUnl4RFFVRkRMR0ZCUVdFc1QwRkJUeXhEUVVGRExFMUJRVTBzUlVGQlJTeERRVUZETzBsQlF6RkRMRWxCUVVrc1EwRkJReXhSUVVGUkxFTkJRVU1zVDBGQlR5eERRVUZETEZGQlFWRXNSVUZCUlN4UFFVRlBMRU5CUVVNN1FVRkROVU1zUTBGQlF6czdRVUZGUkR0QlFVTkJPMEZCUTBFN1FVRkRRVHRCUVVOQk96dEhRVVZITzBGQlEwZ3NWVUZCVlN4RFFVRkRMRk5CUVZNc1EwRkJReXhKUVVGSkxFZEJRVWNzVTBGQlV5eE5RVUZOTEVWQlFVVXNTMEZCU3l4RlFVRkZPMGxCUTJoRUxFOUJRVThzVTBGQlV5eExRVUZMTEVWQlFVVTdVVUZEYmtJc1NVRkJTU3hQUVVGUExFZEJRVWNzUTBGQlF5eE5RVUZOTEVWQlFVVXNUVUZCVFN4RFFVRkRPMUZCUXpsQ0xFbEJRVWtzUzBGQlN5eEpRVUZKTEZOQlFWTXNSVUZCUlR0WlFVTndRaXhQUVVGUExFTkJRVU1zUzBGQlN5eERRVUZETEVkQlFVY3NTMEZCU3p0VFFVTjZRanRSUVVORUxFbEJRVWtzUTBGQlF5eFJRVUZSTEVOQlFVTXNUMEZCVHl4RFFVRkRPMHRCUTNwQ0xFTkJRVU1zU1VGQlNTeERRVUZETEVsQlFVa3NRMEZCUXp0QlFVTm9RaXhEUVVGRE96dEJRVVZFTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN08wZEJSVWM3UVVGRFNDeFZRVUZWTEVOQlFVTXNVMEZCVXl4RFFVRkRMRkZCUVZFc1IwRkJSeXhUUVVGVExGRkJRVkVzUlVGQlJUdEpRVU12UXl4SlFVRkpMRU5CUVVNc1VVRkJVU3hEUVVGRExFVkJRVVVzUTBGQlF5eFJRVUZSTEVWQlFVVXNVVUZCVVN4RFFVRkRPMEZCUTNoRExFTkJRVU03TzBGQlJVUTdPMGRCUlVjN1FVRkRTQ3hWUVVGVkxFTkJRVU1zVTBGQlV5eERRVUZETEZOQlFWTXNSMEZCUnl4VFFVRlRMRkZCUVZFc1JVRkJSVHRKUVVOb1JDeEpRVUZKTEVOQlFVTXNVVUZCVVN4RFFVRkRMRWRCUVVjc1EwRkJReXhSUVVGUkxFVkJRVVVzVVVGQlVTeERRVUZETzBOQlEzaERJaXdpYzI5MWNtTmxjME52Ym5SbGJuUWlPbHNpTHlvcVhHNGdLaUJHYkhWNElFUnBjM0JoZEdOb1pYSmNiaUFxWEc0Z0tpQkVhWE53WVhSamFHVnpJR0ZqZEdsdmJuTWdkRzhnYkdsemRHVnVaWEp6SUhKbFoybHpkR1Z5WldRZ2RYTnBibWNnYjI1QlkzUnBiMjR1WEc0Z0tpQkJZM1JwYjI1eklHRnlaU0JrWld4cGRtVnlaQ0JoY3lCd1lYbHNiMkZrY3lCc2FXdGxYRzRnS2lBZ0lIdGhZM1JwYjI0NklDZGphR0Z1WjJWVFpYUjBhVzVuY3ljc0lHTnZiRzl5T2lCamIyeHZjbjFjYmlBcUlGUm9aU0FuWVdOMGFXOXVKeUJyWlhrZ2FYTWdjbVZ4ZFdseVpXUXNJR0ZzYkNCdmRHaGxjaUJyWlhseklHRnlaU0IxY0NCMGJ5QjBhR1VnWVhCd2JHbGpZWFJwYjI0dVhHNGdLaTljYm5aaGNpQkNZV05yWW05dVpVVjJaVzUwY3lBOUlISmxjWFZwY21Vb1hDSmlZV05yWW05dVpTMWxkbVZ1ZEhNdGMzUmhibVJoYkc5dVpWd2lLVHRjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCRWFYTndZWFJqYUdWeVhHNWNibVoxYm1OMGFXOXVJRVJwYzNCaGRHTm9aWElvS1NCN1hHNGdJQ0FnZEdocGN5NWZaWFpsYm5SbGNpQTlJRUpoWTJ0aWIyNWxSWFpsYm5SekxtMXBlR2x1S0h0OUtWeHVmVnh1WEc0dktpcGNiaUFxSUVScGMzQmhkR05vSUdGdUlHRmpkR2x2Ymk1Y2JpQXFJRlZ6WVdkbE9seHVJQ29nWkdsemNHRjBZMmhsY2lnblptbGtaMlYwSnlsY2JpQXFJR1JwYzNCaGRHTm9aWElvSjJacFpHZGxkQ2NzSUh0M2FYUm9PaUFuY0dWdVkybHNKMzBwWEc0Z0tpQmthWE53WVhSamFHVnlLSHRoWTNScGIyNDZJQ2RtYVdSblpYUW5MQ0IzYVhSb09pQW5jR1Z1WTJsc0ozMHBYRzRnS2k5Y2JrUnBjM0JoZEdOb1pYSXVjSEp2ZEc5MGVYQmxMbVJwYzNCaGRHTm9JRDBnWm5WdVkzUnBiMjRvWVdOMGFXOXVMQ0J3WVhsc2IyRmtLU0I3WEc0Z0lDQWdhV1lnS0Y4dWFYTlRkSEpwYm1jb1lXTjBhVzl1S1NrZ2UxeHVJQ0FnSUNBZ0lDQndZWGxzYjJGa0lEMGdYeTVsZUhSbGJtUW9lMkZqZEdsdmJqb2dZV04wYVc5dWZTd2djR0Y1Ykc5aFpDbGNiaUFnSUNCOUlHVnNjMlVnZTF4dUlDQWdJQ0FnSUNCd1lYbHNiMkZrSUQwZ1lXTjBhVzl1WEc0Z0lDQWdmVnh1SUNBZ0lHTnZibk52YkdVdWJHOW5LR0JrYVhOd1lYUmphRG9nSkh0d1lYbHNiMkZrTG1GamRHbHZibjFnS1Z4dUlDQWdJSFJvYVhNdVgyVjJaVzUwWlhJdWRISnBaMmRsY2lnbllXTjBhVzl1Snl3Z2NHRjViRzloWkNsY2JuMWNibHh1THlvcVhHNGdLaUJUYUc5eWRHaGhibVFnZEc4Z2NISmxjR0Z5WlNCaElITnBiWEJzWlNCa2FYTndZWFJqYUNCbWRXNWpkR2x2Ymk1Y2JpQXFJRVJ2WlhNZ2JtOTBJR1pwY21VZ1lXNGdaWFpsYm5Rc0lHSjFkQ0J5WlhSMWNtNXpJR0VnWm5WdVkzUnBiMjRnZEdoaGRDQmpZVzR1WEc0Z0tpQlVhR1Z6WlNCaGNtVWdaWEYxYVhaaGJHVnVkRHBjYmlBcUlHUnBjM0JoZEdOb1pYSXVZbUZyWlNnblkyaGhibWRsVTJWMGRHbHVaeWNzSUNkamIyeHZjaWNwWEc0Z0tpQW9ZMjlzYjNJcElEMCtJSHNnWkdsemNHRjBZMmhsY2k1a2FYTndZWFJqYUNnblkyaGhibWRsVTJWMGRHbHVaeWNzSUh0amIyeHZjam9nWTI5c2IzSjlLU0I5WEc0Z0tpOWNia1JwYzNCaGRHTm9aWEl1Y0hKdmRHOTBlWEJsTG1KaGEyVWdQU0JtZFc1amRHbHZiaWhoWTNScGIyNHNJR1pwWld4a0tTQjdYRzRnSUNBZ2NtVjBkWEp1SUdaMWJtTjBhVzl1S0dsdWNIVjBLU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQndZWGxzYjJGa0lEMGdlMkZqZEdsdmJqb2dZV04wYVc5dWZWeHVJQ0FnSUNBZ0lDQnBaaUFvWm1sbGJHUWdJVDBnZFc1a1pXWnBibVZrS1NCN1hHNGdJQ0FnSUNBZ0lDQWdJQ0J3WVhsc2IyRmtXMlpwWld4a1hTQTlJR2x1Y0hWMFhHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNBZ0lDQWdkR2hwY3k1a2FYTndZWFJqYUNod1lYbHNiMkZrS1Z4dUlDQWdJSDB1WW1sdVpDaDBhR2x6S1Z4dWZWeHVYRzR2S2lwY2JpQXFJRkpsWjJsemRHVnlJR0VnWTJGc2JHSmhZMnNnZEc4Z2NtVmpaV2wyWlNCaGJHd2dZV04wYVc5dWN5NWNiaUFxSUVWNFlXMXdiR1U2WEc0Z0tpQmthWE53WVhSamFHVnlMbTl1UVdOMGFXOXVLQ2hoWTNScGIyNHBJRDArSUh0Y2JpQXFJQ0FnWTI5dWMyOXNaUzVzYjJjb1lHZHZkQ0JoWTNScGIyNGdiMllnZEhsd1pTQWtlM0JoZVd4dllXUXVZV04wYVc5dWZXQmNiaUFxSUgwcFhHNGdLaTljYmtScGMzQmhkR05vWlhJdWNISnZkRzkwZVhCbExtOXVRV04wYVc5dUlEMGdablZ1WTNScGIyNG9ZMkZzYkdKaFkyc3BJSHRjYmlBZ0lDQjBhR2x6TGw5bGRtVnVkR1Z5TG05dUtDZGhZM1JwYjI0bkxDQmpZV3hzWW1GamF5bGNibjFjYmx4dUx5b3FYRzRnS2lCVmJuSmxaMmx6ZEdWeUlHRWdZMkZzYkdKaFkyc2djSEpsZG1sdmRYTnNlU0J5WldkcGMzUmxjbVZrSUhkcGRHZ2diMjVCWTNScGIyNHVYRzRnS2k5Y2JrUnBjM0JoZEdOb1pYSXVjSEp2ZEc5MGVYQmxMbTltWmtGamRHbHZiaUE5SUdaMWJtTjBhVzl1S0dOaGJHeGlZV05yS1NCN1hHNGdJQ0FnZEdocGN5NWZaWFpsYm5SbGNpNXZabVlvSjJGamRHbHZiaWNzSUdOaGJHeGlZV05yS1Z4dWZWeHVJbDE5IiwidmFyIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG5cbm1vZHVsZS5leHBvcnRzID0gR2FtZVN0YXRlXG5cbmZ1bmN0aW9uIEdhbWVTdGF0ZShkaXNwYXRjaGVyKSB7XG4gICAgU3RvcmUubWl4aW4odGhpcylcblxuICAgIHRoaXMucGxheWVyTmFtZXMgPSBbJ01pbGVzJywgJ0plc3MnLCAnQnJhbmRvbicsICdDaWFyYScsICdDaHJpcyddXG4gICAgdGhpcy5zZXR0aW5ncyA9IHtcbiAgICAgICAgbWVybGluOiB0cnVlLFxuICAgICAgICBtb3JkcmVkOiBmYWxzZSxcbiAgICAgICAgcGVyY2l2YWw6IGZhbHNlLFxuICAgICAgICBtb3JnYW5hOiBmYWxzZSxcbiAgICAgICAgb2Jlcm9uOiBmYWxzZVxuICAgIH1cbiAgICB0aGlzLnJvbGVzID0gbnVsbFxuICAgIC8vIFJlYXNvbiB0aGF0IHJvbGVzIGNhbm5vdCBiZSBhc3NpZ25lZC5cbiAgICAvLyBPbmUgb2Y6IHRvb01hbnksIHRvb0Zld1xuICAgIHRoaXMuZGlzYWJsZWRSZWFzb24gPSBudWxsXG5cbiAgICB0aGlzLnVwZGF0ZVJvbGVzKClcblxuICAgIGRpc3BhdGNoZXIub25BY3Rpb24oZnVuY3Rpb24ocGF5bG9hZCkge1xuICAgICAgICB2YXIgYWN0aW9ucyA9IEdhbWVTdGF0ZS5hY3Rpb25zXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24oYWN0aW9uc1twYXlsb2FkLmFjdGlvbl0pKSB7XG4gICAgICAgICAgICBhY3Rpb25zW3BheWxvYWQuYWN0aW9uXS5jYWxsKHRoaXMsIHBheWxvYWQpXG4gICAgICAgICAgICB0aGlzLnNhdmUoKVxuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKVxufVxuXG52YXIgUEVSU0lTVF9LRVlTID0gWydwbGF5ZXJOYW1lcycsICdzZXR0aW5ncycsICdyb2xlcycsICdkaXNhYmxlZFJlYXNvbiddXG5cbkdhbWVTdGF0ZS5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBwZXJzaXN0ID0ge31cbiAgICBQRVJTSVNUX0tFWVMuZm9yRWFjaChrZXkgPT4gcGVyc2lzdFtrZXldID0gdGhpc1trZXldKVxuICAgIHN0b3JlLnNldCgnc3RvcmUuZ2FtZXN0YXRlJywgcGVyc2lzdClcbn1cblxuR2FtZVN0YXRlLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBlcnNpc3QgPSBzdG9yZS5nZXQoJ3N0b3JlLmdhbWVzdGF0ZScpXG4gICAgaWYgKHBlcnNpc3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBQRVJTSVNUX0tFWVMuZm9yRWFjaChrZXkgPT4gdGhpc1trZXldID0gcGVyc2lzdFtrZXldKVxuICAgIH1cbiAgICB0aGlzLnVwZGF0ZVJvbGVzKClcbn1cblxuLyoqXG4gKiBHZXQgYSByb2xlIGZvciBhIHVzZXIuXG4gKiBBZGRzIHNvbWUgZXh0cmEgdXNlZnVsIGluZm8gdG8gdGhlIHJldHVybmVkIHJvbGUuXG4gKi9cbkdhbWVTdGF0ZS5wcm90b3R5cGUuZ2V0Um9sZSA9IGZ1bmN0aW9uKG5hbWUpIHtcbiAgICBpZiAodGhpcy5yb2xlcyA9PT0gbnVsbCkgcmV0dXJuIG51bGxcbiAgICB2YXIgcm9sZSA9IF8uZXh0ZW5kKHt9LCB0aGlzLnJvbGVzW25hbWVdKVxuICAgIGlmIChyb2xlLnNweSkge1xuICAgICAgICByb2xlLm90aGVyU3BpZXMgPSBfLmZpbHRlcih0aGlzLmdldFNwaWVzKCksICh0aGVpck5hbWUpID0+XG4gICAgICAgICAgICAhdGhpcy5yb2xlc1t0aGVpck5hbWVdLm9iZXJvbiAmJiBuYW1lICE9IHRoZWlyTmFtZSk7XG5cbiAgICAgICAgaWYgKHRoaXMuc2V0dGluZ3Mub2Jlcm9uKSB7XG4gICAgICAgICAgICByb2xlLmhhc09iZXJvbiA9IHRydWU7XG4gICAgICAgIH1cbiAgICB9XG4gICAgaWYgKHJvbGUubWVybGluKSB7XG4gICAgICAgIHJvbGUuc3BpZXMgPSBfLmZpbHRlcih0aGlzLmdldFNwaWVzKCksIChuYW1lKSA9PlxuICAgICAgICAgICAgIXRoaXMucm9sZXNbbmFtZV0ubW9yZHJlZCk7XG4gICAgfVxuICAgIGlmIChyb2xlLnBlcmNpdmFsKSB7XG4gICAgICAgIHJvbGUubWVybGlucyA9IHRoaXMuZ2V0TWVybGlucygpXG4gICAgfVxuICAgIHJldHVybiByb2xlXG59XG5cbkdhbWVTdGF0ZS5wcm90b3R5cGUuZ2V0U3BpZXMgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIodGhpcy5wbGF5ZXJOYW1lcywgKG5hbWUpID0+XG4gICAgICAgIHRoaXMucm9sZXNbbmFtZV0uc3B5KVxufVxuXG5HYW1lU3RhdGUucHJvdG90eXBlLmdldE1lcmxpbnMgPSBmdW5jdGlvbigpIHtcbiAgICByZXR1cm4gXy5maWx0ZXIodGhpcy5wbGF5ZXJOYW1lcywgKG5hbWUpID0+XG4gICAgICAgIHRoaXMucm9sZXNbbmFtZV0ubW9yZ2FuYSB8fCB0aGlzLnJvbGVzW25hbWVdLm1lcmxpbik7XG59XG5cbi8qKlxuICogVHJ5IHRvIGFzc2lnbiByb2xlcy5cbiAqIFRoaXMgc2hvdWxkIG5vdCBiZSBjYWxsZWQgaWYgaXQncyBub3QgcG9zc2libGUuXG4gKi9cbkdhbWVTdGF0ZS5wcm90b3R5cGUuYXNzaWduUm9sZXMgPSBmdW5jdGlvbigpIHtcbiAgICAvLyBwbGF5ZXJzICAgIDUgNiA3IDggOSAxMFxuICAgIC8vIHJlc2lzdGFuY2UgMyA0IDQgNSA2IDZcbiAgICAvLyBzcHkgICAgICAgIDIgMiAzIDMgMyA0XG4gICAgLy8gdmFyIHJlc2lzdGFuY2UgPSB7NTogMywgNjogNCwgNzogNCwgODogNSwgOTogNiwgMTA6IDYsfVxuXG4gICAgdmFyIG51bVBsYXllcnMgPSB0aGlzLnBsYXllck5hbWVzLmxlbmd0aFxuICAgIHZhciBudW1TcGllcyA9IHs1OiAyLCA2OiAyLCA3OiAzLCA4OiAzLCA5OiAzLCAxMDogNCx9W251bVBsYXllcnNdXG4gICAgdmFyIHNodWZmbGVkTmFtZXMgPSBfLnNodWZmbGUodGhpcy5wbGF5ZXJOYW1lcylcblxuICAgIC8vIEFzc2lnbiBpbml0aWFsIHJvbGVzXG4gICAgdGhpcy5yb2xlcyA9IHt9XG4gICAgc2h1ZmZsZWROYW1lcy5mb3JFYWNoKChuYW1lLCBpKSA9PiB7XG4gICAgICAgIHRoaXMucm9sZXNbbmFtZV0gPSB7XG4gICAgICAgICAgICBzcHk6IGkgPCBudW1TcGllcyxcbiAgICAgICAgfVxuICAgIH0pXG5cbiAgICAvLyBLZWVwIHRyYWNrIG9mIHBsYXllcnMgd2hvIGhhdmVuJ3QgYmVlbiBhc3NpZ25lZCBzcGVjaWFsIHJvbGVzXG4gICAgdmFyIHVuYXNzaWduZWRTcGllcyA9IHNodWZmbGVkTmFtZXMuc2xpY2UoMCwgbnVtU3BpZXMpO1xuICAgIHZhciB1bmFzc2lnbmVkUmVzaXN0YW5jZSA9IHNodWZmbGVkTmFtZXMuc2xpY2UobnVtU3BpZXMpO1xuXG4gICAgaWYgKHRoaXMuc2V0dGluZ3MubWVybGluKSB7XG4gICAgICAgIHZhciBtZXJsaW5OYW1lID0gdW5hc3NpZ25lZFJlc2lzdGFuY2VbMF07XG4gICAgICAgIHVuYXNzaWduZWRSZXNpc3RhbmNlLnNwbGljZSgwLDEpO1xuICAgICAgICB0aGlzLnJvbGVzW21lcmxpbk5hbWVdLm1lcmxpbiA9IHRydWU7XG4gICAgfVxuICAgIGlmICh0aGlzLnNldHRpbmdzLm1vcmdhbmEpIHtcbiAgICAgICAgdmFyIG1vcmdhbmFOYW1lID0gdW5hc3NpZ25lZFNwaWVzWzBdO1xuICAgICAgICB1bmFzc2lnbmVkU3BpZXMuc3BsaWNlKDAsMSk7XG4gICAgICAgIHRoaXMucm9sZXNbbW9yZ2FuYU5hbWVdLm1vcmdhbmEgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5zZXR0aW5ncy5wZXJjaXZhbCkge1xuICAgICAgICB2YXIgcGVyY2l2YWxOYW1lID0gdW5hc3NpZ25lZFJlc2lzdGFuY2VbMF07XG4gICAgICAgIHVuYXNzaWduZWRSZXNpc3RhbmNlLnNwbGljZSgwLDEpO1xuICAgICAgICB0aGlzLnJvbGVzW3BlcmNpdmFsTmFtZV0ucGVyY2l2YWwgPSB0cnVlO1xuICAgIH1cbiAgICBpZiAodGhpcy5zZXR0aW5ncy5tb3JkcmVkKSB7XG4gICAgICAgIHZhciBtb3JkcmVkTmFtZSA9IHVuYXNzaWduZWRTcGllc1swXTtcbiAgICAgICAgdW5hc3NpZ25lZFNwaWVzLnNwbGljZSgwLDEpO1xuICAgICAgICB0aGlzLnJvbGVzW21vcmRyZWROYW1lXS5tb3JkcmVkID0gdHJ1ZTtcbiAgICB9XG4gICAgaWYgKHRoaXMuc2V0dGluZ3Mub2Jlcm9uKSB7XG4gICAgICAgIHZhciBvYmVyb25OYW1lID0gdW5hc3NpZ25lZFNwaWVzWzBdO1xuICAgICAgICB1bmFzc2lnbmVkU3BpZXMuc3BsaWNlKDAsMSk7XG4gICAgICAgIHRoaXMucm9sZXNbb2Jlcm9uTmFtZV0ub2Jlcm9uID0gdHJ1ZTtcbiAgICB9XG5cbiAgICB0aGlzLmVtaXRDaGFuZ2UoKVxufVxuXG4vKipcbiAqIE1ha2Ugc3VyZSB0aGF0IHJvbGVzIGV4aXN0IGlmIHRoZXkgY2FuLlxuICogY2xlYXIgLSB3aGV0aGVyIHRvIGNsZWFyIGV4aXN0aW5nIHJvbGVzXG4gKi9cbkdhbWVTdGF0ZS5wcm90b3R5cGUudXBkYXRlUm9sZXMgPSBmdW5jdGlvbihjbGVhcikge1xuICAgIGlmIChjbGVhcikge1xuICAgICAgICB0aGlzLnJvbGVzID0gbnVsbFxuICAgIH1cblxuICAgIC8vIFVzZSBleGlzdGluZyByb2xlcyBpZiB0aGV5IHN0aWxsIGV4aXN0LlxuICAgIGlmICh0aGlzLnJvbGVzICE9PSBudWxsKSByZXR1cm5cblxuICAgIGlmICh0aGlzLnBsYXllck5hbWVzLmxlbmd0aCA8IDUpIHtcbiAgICAgICAgdGhpcy5kaXNhYmxlZFJlYXNvbiA9ICd0b29GZXcnXG4gICAgfSBlbHNlIGlmICh0aGlzLnBsYXllck5hbWVzLmxlbmd0aCA+IDEwKSB7XG4gICAgICAgIHRoaXMuZGlzYWJsZWRSZWFzb24gPSAndG9vTWFueSdcbiAgICB9IGVsc2UgaWYgKHRoaXMucGxheWVyTmFtZXMubGVuZ3RoIDwgN1xuICAgICAgICAgICAgJiYgdGhpcy5zZXR0aW5ncy5tb3JkcmVkXG4gICAgICAgICAgICAmJiB0aGlzLnNldHRpbmdzLm1vcmdhbmFcbiAgICAgICAgICAgICYmIHRoaXMuc2V0dGluZ3Mub2Jlcm9uKSB7XG4gICAgICAgIHRoaXMuZGlzYWJsZWRSZWFzb24gPSAndG9vRmV3J1xuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZGlzYWJsZWRSZWFzb24gPSBudWxsXG4gICAgICAgIHRoaXMuYXNzaWduUm9sZXMoKVxuICAgIH1cbn1cblxuR2FtZVN0YXRlLmFjdGlvbnMgPSB7fVxuXG5HYW1lU3RhdGUuYWN0aW9ucy5hZGRQbGF5ZXIgPSBmdW5jdGlvbih7bmFtZX0pIHtcbiAgICBpZiAoIV8uY29udGFpbnModGhpcy5wbGF5ZXJOYW1lcywgbmFtZSkpIHtcbiAgICAgICAgdGhpcy5wbGF5ZXJOYW1lcy5wdXNoKG5hbWUpXG4gICAgICAgIHRoaXMudXBkYXRlUm9sZXModHJ1ZSlcbiAgICAgICAgdGhpcy5lbWl0Q2hhbmdlKClcbiAgICB9XG59XG5cbkdhbWVTdGF0ZS5hY3Rpb25zLmRlbGV0ZVBsYXllciA9IGZ1bmN0aW9uKHtuYW1lfSkge1xuICAgIHRoaXMucGxheWVyTmFtZXMgPSBfLndpdGhvdXQodGhpcy5wbGF5ZXJOYW1lcywgbmFtZSlcbiAgICB0aGlzLnVwZGF0ZVJvbGVzKHRydWUpXG4gICAgdGhpcy5lbWl0Q2hhbmdlKClcbn1cblxuR2FtZVN0YXRlLmFjdGlvbnMuY2hhbmdlU2V0dGluZ3MgPSBmdW5jdGlvbih7c2V0dGluZ3N9KSB7XG4gICAgXy5leHRlbmQodGhpcy5zZXR0aW5ncywgc2V0dGluZ3MpXG4gICAgdGhpcy51cGRhdGVSb2xlcyh0cnVlKVxuICAgIHRoaXMuZW1pdENoYW5nZSgpXG59XG5cbkdhbWVTdGF0ZS5hY3Rpb25zLm5ld1JvbGVzID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy51cGRhdGVSb2xlcyh0cnVlKVxufVxuXG4vLyMgc291cmNlTWFwcGluZ1VSTD1kYXRhOmFwcGxpY2F0aW9uL2pzb247YmFzZTY0LGV5SjJaWEp6YVc5dUlqb3pMQ0ptYVd4bElqb2lMMmh2YldVdmJXbHNaWE12WTI5a1pTOXlaV0ZqZEdGdVkyVXZjMk55YVhCMGN5OW5ZVzFsTFhOMFlYUmxMbXB6SWl3aWMyOTFjbU5sY3lJNld5SXZhRzl0WlM5dGFXeGxjeTlqYjJSbEwzSmxZV04wWVc1alpTOXpZM0pwY0hSekwyZGhiV1V0YzNSaGRHVXVhbk1pWFN3aWJtRnRaWE1pT2x0ZExDSnRZWEJ3YVc1bmN5STZJa0ZCUVVFc1NVRkJTU3hMUVVGTExFZEJRVWNzVDBGQlR5eERRVUZETEZOQlFWTXNRMEZCUXpzN1FVRkZPVUlzVFVGQlRTeERRVUZETEU5QlFVOHNSMEZCUnl4VFFVRlRPenRCUVVVeFFpeFRRVUZUTEZOQlFWTXNRMEZCUXl4VlFVRlZMRVZCUVVVN1FVRkRMMElzU1VGQlNTeExRVUZMTEVOQlFVTXNTMEZCU3l4RFFVRkRMRWxCUVVrc1EwRkJRenM3U1VGRmFrSXNTVUZCU1N4RFFVRkRMRmRCUVZjc1IwRkJSeXhEUVVGRExFOUJRVThzUlVGQlJTeE5RVUZOTEVWQlFVVXNVMEZCVXl4RlFVRkZMRTlCUVU4c1JVRkJSU3hQUVVGUExFTkJRVU03U1VGRGFrVXNTVUZCU1N4RFFVRkRMRkZCUVZFc1IwRkJSenRSUVVOYUxFMUJRVTBzUlVGQlJTeEpRVUZKTzFGQlExb3NUMEZCVHl4RlFVRkZMRXRCUVVzN1VVRkRaQ3hSUVVGUkxFVkJRVVVzUzBGQlN6dFJRVU5tTEU5QlFVOHNSVUZCUlN4TFFVRkxPMUZCUTJRc1RVRkJUU3hGUVVGRkxFdEJRVXM3UzBGRGFFSTdRVUZEVEN4SlFVRkpMRWxCUVVrc1EwRkJReXhMUVVGTExFZEJRVWNzU1VGQlNUdEJRVU55UWpzN1FVRkZRU3hKUVVGSkxFbEJRVWtzUTBGQlF5eGpRVUZqTEVkQlFVY3NTVUZCU1RzN1FVRkZPVUlzU1VGQlNTeEpRVUZKTEVOQlFVTXNWMEZCVnl4RlFVRkZPenRKUVVWc1FpeFZRVUZWTEVOQlFVTXNVVUZCVVN4RFFVRkRMRk5CUVZNc1QwRkJUeXhGUVVGRk8xRkJRMnhETEVsQlFVa3NUMEZCVHl4SFFVRkhMRk5CUVZNc1EwRkJReXhQUVVGUE8xRkJReTlDTEVsQlFVa3NRMEZCUXl4RFFVRkRMRlZCUVZVc1EwRkJReXhQUVVGUExFTkJRVU1zVDBGQlR5eERRVUZETEUxQlFVMHNRMEZCUXl4RFFVRkRMRVZCUVVVN1dVRkRka01zVDBGQlR5eERRVUZETEU5QlFVOHNRMEZCUXl4TlFVRk5MRU5CUVVNc1EwRkJReXhKUVVGSkxFTkJRVU1zU1VGQlNTeEZRVUZGTEU5QlFVOHNRMEZCUXp0WlFVTXpReXhKUVVGSkxFTkJRVU1zU1VGQlNTeEZRVUZGTzFOQlEyUTdTMEZEU2l4RFFVRkRMRWxCUVVrc1EwRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF6dEJRVU5xUWl4RFFVRkRPenRCUVVWRUxFbEJRVWtzV1VGQldTeEhRVUZITEVOQlFVTXNZVUZCWVN4RlFVRkZMRlZCUVZVc1JVRkJSU3hQUVVGUExFVkJRVVVzWjBKQlFXZENMRU5CUVVNN08wRkJSWHBGTEZOQlFWTXNRMEZCUXl4VFFVRlRMRU5CUVVNc1NVRkJTU3hIUVVGSExGZEJRVmM3U1VGRGJFTXNTVUZCU1N4UFFVRlBMRWRCUVVjc1JVRkJSVHRKUVVOb1FpeFpRVUZaTEVOQlFVTXNUMEZCVHl4RFFVRkRMRWRCUVVjc1NVRkJTU3hQUVVGUExFTkJRVU1zUjBGQlJ5eERRVUZETEVkQlFVY3NTVUZCU1N4RFFVRkRMRWRCUVVjc1EwRkJReXhEUVVGRE8wbEJRM0pFTEV0QlFVc3NRMEZCUXl4SFFVRkhMRU5CUVVNc2FVSkJRV2xDTEVWQlFVVXNUMEZCVHl4RFFVRkRPMEZCUTNwRExFTkJRVU03TzBGQlJVUXNVMEZCVXl4RFFVRkRMRk5CUVZNc1EwRkJReXhKUVVGSkxFZEJRVWNzVjBGQlZ6dEpRVU5zUXl4SlFVRkpMRTlCUVU4c1IwRkJSeXhMUVVGTExFTkJRVU1zUjBGQlJ5eERRVUZETEdsQ1FVRnBRaXhEUVVGRE8wbEJRekZETEVsQlFVa3NUMEZCVHl4TFFVRkxMRk5CUVZNc1JVRkJSVHRSUVVOMlFpeFpRVUZaTEVOQlFVTXNUMEZCVHl4RFFVRkRMRWRCUVVjc1NVRkJTU3hKUVVGSkxFTkJRVU1zUjBGQlJ5eERRVUZETEVkQlFVY3NUMEZCVHl4RFFVRkRMRWRCUVVjc1EwRkJReXhEUVVGRE8wdEJRM2hFTzBsQlEwUXNTVUZCU1N4RFFVRkRMRmRCUVZjc1JVRkJSVHRCUVVOMFFpeERRVUZET3p0QlFVVkVPMEZCUTBFN08wZEJSVWM3UVVGRFNDeFRRVUZUTEVOQlFVTXNVMEZCVXl4RFFVRkRMRTlCUVU4c1IwRkJSeXhUUVVGVExFbEJRVWtzUlVGQlJUdEpRVU42UXl4SlFVRkpMRWxCUVVrc1EwRkJReXhMUVVGTExFdEJRVXNzU1VGQlNTeEZRVUZGTEU5QlFVOHNTVUZCU1R0SlFVTndReXhKUVVGSkxFbEJRVWtzUjBGQlJ5eERRVUZETEVOQlFVTXNUVUZCVFN4RFFVRkRMRVZCUVVVc1JVRkJSU3hKUVVGSkxFTkJRVU1zUzBGQlN5eERRVUZETEVsQlFVa3NRMEZCUXl4RFFVRkRPMGxCUTNwRExFbEJRVWtzU1VGQlNTeERRVUZETEVkQlFVY3NSVUZCUlR0UlFVTldMRWxCUVVrc1EwRkJReXhWUVVGVkxFZEJRVWNzUTBGQlF5eERRVUZETEUxQlFVMHNRMEZCUXl4SlFVRkpMRU5CUVVNc1VVRkJVU3hGUVVGRkxFVkJRVVVzUTBGQlF5eFRRVUZUTzBGQlF6bEVMRmxCUVZrc1EwRkJReXhKUVVGSkxFTkJRVU1zUzBGQlN5eERRVUZETEZOQlFWTXNRMEZCUXl4RFFVRkRMRTFCUVUwc1NVRkJTU3hKUVVGSkxFbEJRVWtzVTBGQlV5eERRVUZETEVOQlFVTTdPMUZCUlhoRUxFbEJRVWtzU1VGQlNTeERRVUZETEZGQlFWRXNRMEZCUXl4TlFVRk5MRVZCUVVVN1dVRkRkRUlzU1VGQlNTeERRVUZETEZOQlFWTXNSMEZCUnl4SlFVRkpMRU5CUVVNN1UwRkRla0k3UzBGRFNqdEpRVU5FTEVsQlFVa3NTVUZCU1N4RFFVRkRMRTFCUVUwc1JVRkJSVHRSUVVOaUxFbEJRVWtzUTBGQlF5eExRVUZMTEVkQlFVY3NRMEZCUXl4RFFVRkRMRTFCUVUwc1EwRkJReXhKUVVGSkxFTkJRVU1zVVVGQlVTeEZRVUZGTEVWQlFVVXNRMEZCUXl4SlFVRkpPMWxCUTNoRExFTkJRVU1zU1VGQlNTeERRVUZETEV0QlFVc3NRMEZCUXl4SlFVRkpMRU5CUVVNc1EwRkJReXhQUVVGUExFTkJRVU1zUTBGQlF6dExRVU5zUXp0SlFVTkVMRWxCUVVrc1NVRkJTU3hEUVVGRExGRkJRVkVzUlVGQlJUdFJRVU5tTEVsQlFVa3NRMEZCUXl4UFFVRlBMRWRCUVVjc1NVRkJTU3hEUVVGRExGVkJRVlVzUlVGQlJUdExRVU51UXp0SlFVTkVMRTlCUVU4c1NVRkJTVHRCUVVObUxFTkJRVU03TzBGQlJVUXNVMEZCVXl4RFFVRkRMRk5CUVZNc1EwRkJReXhSUVVGUkxFZEJRVWNzVjBGQlZ6dEpRVU4wUXl4UFFVRlBMRU5CUVVNc1EwRkJReXhOUVVGTkxFTkJRVU1zU1VGQlNTeERRVUZETEZkQlFWY3NSVUZCUlN4RFFVRkRMRWxCUVVrN1VVRkRia01zU1VGQlNTeERRVUZETEV0QlFVc3NRMEZCUXl4SlFVRkpMRU5CUVVNc1EwRkJReXhIUVVGSExFTkJRVU03UVVGRE4wSXNRMEZCUXpzN1FVRkZSQ3hUUVVGVExFTkJRVU1zVTBGQlV5eERRVUZETEZWQlFWVXNSMEZCUnl4WFFVRlhPMGxCUTNoRExFOUJRVThzUTBGQlF5eERRVUZETEUxQlFVMHNRMEZCUXl4SlFVRkpMRU5CUVVNc1YwRkJWeXhGUVVGRkxFTkJRVU1zU1VGQlNUdFJRVU51UXl4SlFVRkpMRU5CUVVNc1MwRkJTeXhEUVVGRExFbEJRVWtzUTBGQlF5eERRVUZETEU5QlFVOHNTVUZCU1N4SlFVRkpMRU5CUVVNc1MwRkJTeXhEUVVGRExFbEJRVWtzUTBGQlF5eERRVUZETEUxQlFVMHNRMEZCUXl4RFFVRkRPMEZCUXpkRUxFTkJRVU03TzBGQlJVUTdRVUZEUVRzN1IwRkZSenRCUVVOSUxGTkJRVk1zUTBGQlF5eFRRVUZUTEVOQlFVTXNWMEZCVnl4SFFVRkhMRmRCUVZjN1FVRkROME03UVVGRFFUdEJRVU5CTzBGQlEwRTdPMGxCUlVrc1NVRkJTU3hWUVVGVkxFZEJRVWNzU1VGQlNTeERRVUZETEZkQlFWY3NRMEZCUXl4TlFVRk5PMGxCUTNoRExFbEJRVWtzVVVGQlVTeEhRVUZITEVOQlFVTXNRMEZCUXl4RlFVRkZMRU5CUVVNc1JVRkJSU3hEUVVGRExFVkJRVVVzUTBGQlF5eEZRVUZGTEVOQlFVTXNSVUZCUlN4RFFVRkRMRVZCUVVVc1EwRkJReXhGUVVGRkxFTkJRVU1zUlVGQlJTeERRVUZETEVWQlFVVXNRMEZCUXl4RlFVRkZMRVZCUVVVc1JVRkJSU3hEUVVGRExFVkJRVVVzUTBGQlF5eFZRVUZWTEVOQlFVTTdRVUZEY2tVc1NVRkJTU3hKUVVGSkxHRkJRV0VzUjBGQlJ5eERRVUZETEVOQlFVTXNUMEZCVHl4RFFVRkRMRWxCUVVrc1EwRkJReXhYUVVGWExFTkJRVU03UVVGRGJrUTdPMGxCUlVrc1NVRkJTU3hEUVVGRExFdEJRVXNzUjBGQlJ5eEZRVUZGTzBsQlEyWXNZVUZCWVN4RFFVRkRMRTlCUVU4c1EwRkJReXhEUVVGRExFbEJRVWtzUlVGQlJTeERRVUZETEV0QlFVczdVVUZETDBJc1NVRkJTU3hEUVVGRExFdEJRVXNzUTBGQlF5eEpRVUZKTEVOQlFVTXNSMEZCUnp0WlFVTm1MRWRCUVVjc1JVRkJSU3hEUVVGRExFZEJRVWNzVVVGQlVUdFRRVU53UWp0QlFVTlVMRXRCUVVzc1EwRkJRenRCUVVOT096dEpRVVZKTEVsQlFVa3NaVUZCWlN4SFFVRkhMR0ZCUVdFc1EwRkJReXhMUVVGTExFTkJRVU1zUTBGQlF5eEZRVUZGTEZGQlFWRXNRMEZCUXl4RFFVRkRPMEZCUXpORUxFbEJRVWtzU1VGQlNTeHZRa0ZCYjBJc1IwRkJSeXhoUVVGaExFTkJRVU1zUzBGQlN5eERRVUZETEZGQlFWRXNRMEZCUXl4RFFVRkRPenRKUVVWNlJDeEpRVUZKTEVsQlFVa3NRMEZCUXl4UlFVRlJMRU5CUVVNc1RVRkJUU3hGUVVGRk8xRkJRM1JDTEVsQlFVa3NWVUZCVlN4SFFVRkhMRzlDUVVGdlFpeERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPMUZCUTNwRExHOUNRVUZ2UWl4RFFVRkRMRTFCUVUwc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdVVUZEYWtNc1NVRkJTU3hEUVVGRExFdEJRVXNzUTBGQlF5eFZRVUZWTEVOQlFVTXNRMEZCUXl4TlFVRk5MRWRCUVVjc1NVRkJTU3hEUVVGRE8wdEJRM2hETzBsQlEwUXNTVUZCU1N4SlFVRkpMRU5CUVVNc1VVRkJVU3hEUVVGRExFOUJRVThzUlVGQlJUdFJRVU4yUWl4SlFVRkpMRmRCUVZjc1IwRkJSeXhsUVVGbExFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTTdVVUZEY2tNc1pVRkJaU3hEUVVGRExFMUJRVTBzUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNN1VVRkROVUlzU1VGQlNTeERRVUZETEV0QlFVc3NRMEZCUXl4WFFVRlhMRU5CUVVNc1EwRkJReXhQUVVGUExFZEJRVWNzU1VGQlNTeERRVUZETzB0QlF6RkRPMGxCUTBRc1NVRkJTU3hKUVVGSkxFTkJRVU1zVVVGQlVTeERRVUZETEZGQlFWRXNSVUZCUlR0UlFVTjRRaXhKUVVGSkxGbEJRVmtzUjBGQlJ5eHZRa0ZCYjBJc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF6dFJRVU16UXl4dlFrRkJiMElzUTBGQlF5eE5RVUZOTEVOQlFVTXNRMEZCUXl4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xRkJRMnBETEVsQlFVa3NRMEZCUXl4TFFVRkxMRU5CUVVNc1dVRkJXU3hEUVVGRExFTkJRVU1zVVVGQlVTeEhRVUZITEVsQlFVa3NRMEZCUXp0TFFVTTFRenRKUVVORUxFbEJRVWtzU1VGQlNTeERRVUZETEZGQlFWRXNRMEZCUXl4UFFVRlBMRVZCUVVVN1VVRkRka0lzU1VGQlNTeFhRVUZYTEVkQlFVY3NaVUZCWlN4RFFVRkRMRU5CUVVNc1EwRkJReXhEUVVGRE8xRkJRM0pETEdWQlFXVXNRMEZCUXl4TlFVRk5MRU5CUVVNc1EwRkJReXhEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETzFGQlF6VkNMRWxCUVVrc1EwRkJReXhMUVVGTExFTkJRVU1zVjBGQlZ5eERRVUZETEVOQlFVTXNUMEZCVHl4SFFVRkhMRWxCUVVrc1EwRkJRenRMUVVNeFF6dEpRVU5FTEVsQlFVa3NTVUZCU1N4RFFVRkRMRkZCUVZFc1EwRkJReXhOUVVGTkxFVkJRVVU3VVVGRGRFSXNTVUZCU1N4VlFVRlZMRWRCUVVjc1pVRkJaU3hEUVVGRExFTkJRVU1zUTBGQlF5eERRVUZETzFGQlEzQkRMR1ZCUVdVc1EwRkJReXhOUVVGTkxFTkJRVU1zUTBGQlF5eERRVUZETEVOQlFVTXNRMEZCUXl4RFFVRkRPMUZCUXpWQ0xFbEJRVWtzUTBGQlF5eExRVUZMTEVOQlFVTXNWVUZCVlN4RFFVRkRMRU5CUVVNc1RVRkJUU3hIUVVGSExFbEJRVWtzUTBGQlF6dEJRVU0zUXl4TFFVRkxPenRKUVVWRUxFbEJRVWtzUTBGQlF5eFZRVUZWTEVWQlFVVTdRVUZEY2tJc1EwRkJRenM3UVVGRlJEdEJRVU5CT3p0SFFVVkhPMEZCUTBnc1UwRkJVeXhEUVVGRExGTkJRVk1zUTBGQlF5eFhRVUZYTEVkQlFVY3NVMEZCVXl4TFFVRkxMRVZCUVVVN1NVRkRPVU1zU1VGQlNTeExRVUZMTEVWQlFVVTdVVUZEVUN4SlFVRkpMRU5CUVVNc1MwRkJTeXhIUVVGSExFbEJRVWs3UVVGRGVrSXNTMEZCU3p0QlFVTk1PenRCUVVWQkxFbEJRVWtzU1VGQlNTeEpRVUZKTEVOQlFVTXNTMEZCU3l4TFFVRkxMRWxCUVVrc1JVRkJSU3hOUVVGTk96dEpRVVV2UWl4SlFVRkpMRWxCUVVrc1EwRkJReXhYUVVGWExFTkJRVU1zVFVGQlRTeEhRVUZITEVOQlFVTXNSVUZCUlR0UlFVTTNRaXhKUVVGSkxFTkJRVU1zWTBGQll5eEhRVUZITEZGQlFWRTdTMEZEYWtNc1RVRkJUU3hKUVVGSkxFbEJRVWtzUTBGQlF5eFhRVUZYTEVOQlFVTXNUVUZCVFN4SFFVRkhMRVZCUVVVc1JVRkJSVHRSUVVOeVF5eEpRVUZKTEVOQlFVTXNZMEZCWXl4SFFVRkhMRk5CUVZNN1MwRkRiRU1zVFVGQlRTeEpRVUZKTEVsQlFVa3NRMEZCUXl4WFFVRlhMRU5CUVVNc1RVRkJUU3hIUVVGSExFTkJRVU03WlVGRE0wSXNTVUZCU1N4RFFVRkRMRkZCUVZFc1EwRkJReXhQUVVGUE8yVkJRM0pDTEVsQlFVa3NRMEZCUXl4UlFVRlJMRU5CUVVNc1QwRkJUenRsUVVOeVFpeEpRVUZKTEVOQlFVTXNVVUZCVVN4RFFVRkRMRTFCUVUwc1JVRkJSVHRSUVVNM1FpeEpRVUZKTEVOQlFVTXNZMEZCWXl4SFFVRkhMRkZCUVZFN1MwRkRha01zVFVGQlRUdFJRVU5JTEVsQlFVa3NRMEZCUXl4alFVRmpMRWRCUVVjc1NVRkJTVHRSUVVNeFFpeEpRVUZKTEVOQlFVTXNWMEZCVnl4RlFVRkZPMHRCUTNKQ08wRkJRMHdzUTBGQlF6czdRVUZGUkN4VFFVRlRMRU5CUVVNc1QwRkJUeXhIUVVGSExFVkJRVVU3TzBGQlJYUkNMRk5CUVZNc1EwRkJReXhQUVVGUExFTkJRVU1zVTBGQlV5eEhRVUZITEZOQlFWTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1JVRkJSVHRKUVVNelF5eEpRVUZKTEVOQlFVTXNRMEZCUXl4RFFVRkRMRkZCUVZFc1EwRkJReXhKUVVGSkxFTkJRVU1zVjBGQlZ5eEZRVUZGTEVsQlFVa3NRMEZCUXl4RlFVRkZPMUZCUTNKRExFbEJRVWtzUTBGQlF5eFhRVUZYTEVOQlFVTXNTVUZCU1N4RFFVRkRMRWxCUVVrc1EwRkJRenRSUVVNelFpeEpRVUZKTEVOQlFVTXNWMEZCVnl4RFFVRkRMRWxCUVVrc1EwRkJRenRSUVVOMFFpeEpRVUZKTEVOQlFVTXNWVUZCVlN4RlFVRkZPMHRCUTNCQ08wRkJRMHdzUTBGQlF6czdRVUZGUkN4VFFVRlRMRU5CUVVNc1QwRkJUeXhEUVVGRExGbEJRVmtzUjBGQlJ5eFRRVUZUTEVOQlFVTXNTVUZCU1N4RFFVRkRMRVZCUVVVN1NVRkRPVU1zU1VGQlNTeERRVUZETEZkQlFWY3NSMEZCUnl4RFFVRkRMRU5CUVVNc1QwRkJUeXhEUVVGRExFbEJRVWtzUTBGQlF5eFhRVUZYTEVWQlFVVXNTVUZCU1N4RFFVRkRPMGxCUTNCRUxFbEJRVWtzUTBGQlF5eFhRVUZYTEVOQlFVTXNTVUZCU1N4RFFVRkRPMGxCUTNSQ0xFbEJRVWtzUTBGQlF5eFZRVUZWTEVWQlFVVTdRVUZEY2tJc1EwRkJRenM3UVVGRlJDeFRRVUZUTEVOQlFVTXNUMEZCVHl4RFFVRkRMR05CUVdNc1IwRkJSeXhUUVVGVExFTkJRVU1zVVVGQlVTeERRVUZETEVWQlFVVTdTVUZEY0VRc1EwRkJReXhEUVVGRExFMUJRVTBzUTBGQlF5eEpRVUZKTEVOQlFVTXNVVUZCVVN4RlFVRkZMRkZCUVZFc1EwRkJRenRKUVVOcVF5eEpRVUZKTEVOQlFVTXNWMEZCVnl4RFFVRkRMRWxCUVVrc1EwRkJRenRKUVVOMFFpeEpRVUZKTEVOQlFVTXNWVUZCVlN4RlFVRkZPMEZCUTNKQ0xFTkJRVU03TzBGQlJVUXNVMEZCVXl4RFFVRkRMRTlCUVU4c1EwRkJReXhSUVVGUkxFZEJRVWNzVjBGQlZ6dEpRVU53UXl4SlFVRkpMRU5CUVVNc1YwRkJWeXhEUVVGRExFbEJRVWtzUTBGQlF6dERRVU42UWlJc0luTnZkWEpqWlhORGIyNTBaVzUwSWpwYkluWmhjaUJUZEc5eVpTQTlJSEpsY1hWcGNtVW9KeTR2YzNSdmNtVW5LVnh1WEc1dGIyUjFiR1V1Wlhod2IzSjBjeUE5SUVkaGJXVlRkR0YwWlZ4dVhHNW1kVzVqZEdsdmJpQkhZVzFsVTNSaGRHVW9aR2x6Y0dGMFkyaGxjaWtnZTF4dUlDQWdJRk4wYjNKbExtMXBlR2x1S0hSb2FYTXBYRzVjYmlBZ0lDQjBhR2x6TG5Cc1lYbGxjazVoYldWeklEMGdXeWROYVd4bGN5Y3NJQ2RLWlhOekp5d2dKMEp5WVc1a2IyNG5MQ0FuUTJsaGNtRW5MQ0FuUTJoeWFYTW5YVnh1SUNBZ0lIUm9hWE11YzJWMGRHbHVaM01nUFNCN1hHNGdJQ0FnSUNBZ0lHMWxjbXhwYmpvZ2RISjFaU3hjYmlBZ0lDQWdJQ0FnYlc5eVpISmxaRG9nWm1Gc2MyVXNYRzRnSUNBZ0lDQWdJSEJsY21OcGRtRnNPaUJtWVd4elpTeGNiaUFnSUNBZ0lDQWdiVzl5WjJGdVlUb2dabUZzYzJVc1hHNGdJQ0FnSUNBZ0lHOWlaWEp2YmpvZ1ptRnNjMlZjYmlBZ0lDQjlYRzRnSUNBZ2RHaHBjeTV5YjJ4bGN5QTlJRzUxYkd4Y2JpQWdJQ0F2THlCU1pXRnpiMjRnZEdoaGRDQnliMnhsY3lCallXNXViM1FnWW1VZ1lYTnphV2R1WldRdVhHNGdJQ0FnTHk4Z1QyNWxJRzltT2lCMGIyOU5ZVzU1TENCMGIyOUdaWGRjYmlBZ0lDQjBhR2x6TG1ScGMyRmliR1ZrVW1WaGMyOXVJRDBnYm5Wc2JGeHVYRzRnSUNBZ2RHaHBjeTUxY0dSaGRHVlNiMnhsY3lncFhHNWNiaUFnSUNCa2FYTndZWFJqYUdWeUxtOXVRV04wYVc5dUtHWjFibU4wYVc5dUtIQmhlV3h2WVdRcElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUdGamRHbHZibk1nUFNCSFlXMWxVM1JoZEdVdVlXTjBhVzl1YzF4dUlDQWdJQ0FnSUNCcFppQW9YeTVwYzBaMWJtTjBhVzl1S0dGamRHbHZibk5iY0dGNWJHOWhaQzVoWTNScGIyNWRLU2tnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdZV04wYVc5dWMxdHdZWGxzYjJGa0xtRmpkR2x2YmwwdVkyRnNiQ2gwYUdsekxDQndZWGxzYjJGa0tWeHVJQ0FnSUNBZ0lDQWdJQ0FnZEdocGN5NXpZWFpsS0NsY2JpQWdJQ0FnSUNBZ2ZWeHVJQ0FnSUgwdVltbHVaQ2gwYUdsektTbGNibjFjYmx4dWRtRnlJRkJGVWxOSlUxUmZTMFZaVXlBOUlGc25jR3hoZVdWeVRtRnRaWE1uTENBbmMyVjBkR2x1WjNNbkxDQW5jbTlzWlhNbkxDQW5aR2x6WVdKc1pXUlNaV0Z6YjI0blhWeHVYRzVIWVcxbFUzUmhkR1V1Y0hKdmRHOTBlWEJsTG5OaGRtVWdQU0JtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ0IyWVhJZ2NHVnljMmx6ZENBOUlIdDlYRzRnSUNBZ1VFVlNVMGxUVkY5TFJWbFRMbVp2Y2tWaFkyZ29hMlY1SUQwK0lIQmxjbk5wYzNSYmEyVjVYU0E5SUhSb2FYTmJhMlY1WFNsY2JpQWdJQ0J6ZEc5eVpTNXpaWFFvSjNOMGIzSmxMbWRoYldWemRHRjBaU2NzSUhCbGNuTnBjM1FwWEc1OVhHNWNia2RoYldWVGRHRjBaUzV3Y205MGIzUjVjR1V1Ykc5aFpDQTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJSFpoY2lCd1pYSnphWE4wSUQwZ2MzUnZjbVV1WjJWMEtDZHpkRzl5WlM1bllXMWxjM1JoZEdVbktWeHVJQ0FnSUdsbUlDaHdaWEp6YVhOMElDRTlQU0IxYm1SbFptbHVaV1FwSUh0Y2JpQWdJQ0FnSUNBZ1VFVlNVMGxUVkY5TFJWbFRMbVp2Y2tWaFkyZ29hMlY1SUQwK0lIUm9hWE5iYTJWNVhTQTlJSEJsY25OcGMzUmJhMlY1WFNsY2JpQWdJQ0I5WEc0Z0lDQWdkR2hwY3k1MWNHUmhkR1ZTYjJ4bGN5Z3BYRzU5WEc1Y2JpOHFLbHh1SUNvZ1IyVjBJR0VnY205c1pTQm1iM0lnWVNCMWMyVnlMbHh1SUNvZ1FXUmtjeUJ6YjIxbElHVjRkSEpoSUhWelpXWjFiQ0JwYm1adklIUnZJSFJvWlNCeVpYUjFjbTVsWkNCeWIyeGxMbHh1SUNvdlhHNUhZVzFsVTNSaGRHVXVjSEp2ZEc5MGVYQmxMbWRsZEZKdmJHVWdQU0JtZFc1amRHbHZiaWh1WVcxbEtTQjdYRzRnSUNBZ2FXWWdLSFJvYVhNdWNtOXNaWE1nUFQwOUlHNTFiR3dwSUhKbGRIVnliaUJ1ZFd4c1hHNGdJQ0FnZG1GeUlISnZiR1VnUFNCZkxtVjRkR1Z1WkNoN2ZTd2dkR2hwY3k1eWIyeGxjMXR1WVcxbFhTbGNiaUFnSUNCcFppQW9jbTlzWlM1emNIa3BJSHRjYmlBZ0lDQWdJQ0FnY205c1pTNXZkR2hsY2xOd2FXVnpJRDBnWHk1bWFXeDBaWElvZEdocGN5NW5aWFJUY0dsbGN5Z3BMQ0FvZEdobGFYSk9ZVzFsS1NBOVBseHVJQ0FnSUNBZ0lDQWdJQ0FnSVhSb2FYTXVjbTlzWlhOYmRHaGxhWEpPWVcxbFhTNXZZbVZ5YjI0Z0ppWWdibUZ0WlNBaFBTQjBhR1ZwY2s1aGJXVXBPMXh1WEc0Z0lDQWdJQ0FnSUdsbUlDaDBhR2x6TG5ObGRIUnBibWR6TG05aVpYSnZiaWtnZTF4dUlDQWdJQ0FnSUNBZ0lDQWdjbTlzWlM1b1lYTlBZbVZ5YjI0Z1BTQjBjblZsTzF4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnZlZ4dUlDQWdJR2xtSUNoeWIyeGxMbTFsY214cGJpa2dlMXh1SUNBZ0lDQWdJQ0J5YjJ4bExuTndhV1Z6SUQwZ1h5NW1hV3gwWlhJb2RHaHBjeTVuWlhSVGNHbGxjeWdwTENBb2JtRnRaU2tnUFQ1Y2JpQWdJQ0FnSUNBZ0lDQWdJQ0YwYUdsekxuSnZiR1Z6VzI1aGJXVmRMbTF2Y21SeVpXUXBPMXh1SUNBZ0lIMWNiaUFnSUNCcFppQW9jbTlzWlM1d1pYSmphWFpoYkNrZ2UxeHVJQ0FnSUNBZ0lDQnliMnhsTG0xbGNteHBibk1nUFNCMGFHbHpMbWRsZEUxbGNteHBibk1vS1Z4dUlDQWdJSDFjYmlBZ0lDQnlaWFIxY200Z2NtOXNaVnh1ZlZ4dVhHNUhZVzFsVTNSaGRHVXVjSEp2ZEc5MGVYQmxMbWRsZEZOd2FXVnpJRDBnWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnY21WMGRYSnVJRjh1Wm1sc2RHVnlLSFJvYVhNdWNHeGhlV1Z5VG1GdFpYTXNJQ2h1WVcxbEtTQTlQbHh1SUNBZ0lDQWdJQ0IwYUdsekxuSnZiR1Z6VzI1aGJXVmRMbk53ZVNsY2JuMWNibHh1UjJGdFpWTjBZWFJsTG5CeWIzUnZkSGx3WlM1blpYUk5aWEpzYVc1eklEMGdablZ1WTNScGIyNG9LU0I3WEc0Z0lDQWdjbVYwZFhKdUlGOHVabWxzZEdWeUtIUm9hWE11Y0d4aGVXVnlUbUZ0WlhNc0lDaHVZVzFsS1NBOVBseHVJQ0FnSUNBZ0lDQjBhR2x6TG5KdmJHVnpXMjVoYldWZExtMXZjbWRoYm1FZ2ZId2dkR2hwY3k1eWIyeGxjMXR1WVcxbFhTNXRaWEpzYVc0cE8xeHVmVnh1WEc0dktpcGNiaUFxSUZSeWVTQjBieUJoYzNOcFoyNGdjbTlzWlhNdVhHNGdLaUJVYUdseklITm9iM1ZzWkNCdWIzUWdZbVVnWTJGc2JHVmtJR2xtSUdsMEozTWdibTkwSUhCdmMzTnBZbXhsTGx4dUlDb3ZYRzVIWVcxbFUzUmhkR1V1Y0hKdmRHOTBlWEJsTG1GemMybG5ibEp2YkdWeklEMGdablZ1WTNScGIyNG9LU0I3WEc0Z0lDQWdMeThnY0d4aGVXVnljeUFnSUNBMUlEWWdOeUE0SURrZ01UQmNiaUFnSUNBdkx5QnlaWE5wYzNSaGJtTmxJRE1nTkNBMElEVWdOaUEyWEc0Z0lDQWdMeThnYzNCNUlDQWdJQ0FnSUNBeUlESWdNeUF6SURNZ05GeHVJQ0FnSUM4dklIWmhjaUJ5WlhOcGMzUmhibU5sSUQwZ2V6VTZJRE1zSURZNklEUXNJRGM2SURRc0lEZzZJRFVzSURrNklEWXNJREV3T2lBMkxIMWNibHh1SUNBZ0lIWmhjaUJ1ZFcxUWJHRjVaWEp6SUQwZ2RHaHBjeTV3YkdGNVpYSk9ZVzFsY3k1c1pXNW5kR2hjYmlBZ0lDQjJZWElnYm5WdFUzQnBaWE1nUFNCN05Ub2dNaXdnTmpvZ01pd2dOem9nTXl3Z09Eb2dNeXdnT1RvZ015d2dNVEE2SURRc2ZWdHVkVzFRYkdGNVpYSnpYVnh1SUNBZ0lIWmhjaUJ6YUhWbVpteGxaRTVoYldWeklEMGdYeTV6YUhWbVpteGxLSFJvYVhNdWNHeGhlV1Z5VG1GdFpYTXBYRzVjYmlBZ0lDQXZMeUJCYzNOcFoyNGdhVzVwZEdsaGJDQnliMnhsYzF4dUlDQWdJSFJvYVhNdWNtOXNaWE1nUFNCN2ZWeHVJQ0FnSUhOb2RXWm1iR1ZrVG1GdFpYTXVabTl5UldGamFDZ29ibUZ0WlN3Z2FTa2dQVDRnZTF4dUlDQWdJQ0FnSUNCMGFHbHpMbkp2YkdWelcyNWhiV1ZkSUQwZ2UxeHVJQ0FnSUNBZ0lDQWdJQ0FnYzNCNU9pQnBJRHdnYm5WdFUzQnBaWE1zWEc0Z0lDQWdJQ0FnSUgxY2JpQWdJQ0I5S1Z4dVhHNGdJQ0FnTHk4Z1MyVmxjQ0IwY21GamF5QnZaaUJ3YkdGNVpYSnpJSGRvYnlCb1lYWmxiaWQwSUdKbFpXNGdZWE56YVdkdVpXUWdjM0JsWTJsaGJDQnliMnhsYzF4dUlDQWdJSFpoY2lCMWJtRnpjMmxuYm1Wa1UzQnBaWE1nUFNCemFIVm1abXhsWkU1aGJXVnpMbk5zYVdObEtEQXNJRzUxYlZOd2FXVnpLVHRjYmlBZ0lDQjJZWElnZFc1aGMzTnBaMjVsWkZKbGMybHpkR0Z1WTJVZ1BTQnphSFZtWm14bFpFNWhiV1Z6TG5Oc2FXTmxLRzUxYlZOd2FXVnpLVHRjYmx4dUlDQWdJR2xtSUNoMGFHbHpMbk5sZEhScGJtZHpMbTFsY214cGJpa2dlMXh1SUNBZ0lDQWdJQ0IyWVhJZ2JXVnliR2x1VG1GdFpTQTlJSFZ1WVhOemFXZHVaV1JTWlhOcGMzUmhibU5sV3pCZE8xeHVJQ0FnSUNBZ0lDQjFibUZ6YzJsbmJtVmtVbVZ6YVhOMFlXNWpaUzV6Y0d4cFkyVW9NQ3d4S1R0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTV5YjJ4bGMxdHRaWEpzYVc1T1lXMWxYUzV0WlhKc2FXNGdQU0IwY25WbE8xeHVJQ0FnSUgxY2JpQWdJQ0JwWmlBb2RHaHBjeTV6WlhSMGFXNW5jeTV0YjNKbllXNWhLU0I3WEc0Z0lDQWdJQ0FnSUhaaGNpQnRiM0puWVc1aFRtRnRaU0E5SUhWdVlYTnphV2R1WldSVGNHbGxjMXN3WFR0Y2JpQWdJQ0FnSUNBZ2RXNWhjM05wWjI1bFpGTndhV1Z6TG5Od2JHbGpaU2d3TERFcE8xeHVJQ0FnSUNBZ0lDQjBhR2x6TG5KdmJHVnpXMjF2Y21kaGJtRk9ZVzFsWFM1dGIzSm5ZVzVoSUQwZ2RISjFaVHRjYmlBZ0lDQjlYRzRnSUNBZ2FXWWdLSFJvYVhNdWMyVjBkR2x1WjNNdWNHVnlZMmwyWVd3cElIdGNiaUFnSUNBZ0lDQWdkbUZ5SUhCbGNtTnBkbUZzVG1GdFpTQTlJSFZ1WVhOemFXZHVaV1JTWlhOcGMzUmhibU5sV3pCZE8xeHVJQ0FnSUNBZ0lDQjFibUZ6YzJsbmJtVmtVbVZ6YVhOMFlXNWpaUzV6Y0d4cFkyVW9NQ3d4S1R0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTV5YjJ4bGMxdHdaWEpqYVhaaGJFNWhiV1ZkTG5CbGNtTnBkbUZzSUQwZ2RISjFaVHRjYmlBZ0lDQjlYRzRnSUNBZ2FXWWdLSFJvYVhNdWMyVjBkR2x1WjNNdWJXOXlaSEpsWkNrZ2UxeHVJQ0FnSUNBZ0lDQjJZWElnYlc5eVpISmxaRTVoYldVZ1BTQjFibUZ6YzJsbmJtVmtVM0JwWlhOYk1GMDdYRzRnSUNBZ0lDQWdJSFZ1WVhOemFXZHVaV1JUY0dsbGN5NXpjR3hwWTJVb01Dd3hLVHRjYmlBZ0lDQWdJQ0FnZEdocGN5NXliMnhsYzF0dGIzSmtjbVZrVG1GdFpWMHViVzl5WkhKbFpDQTlJSFJ5ZFdVN1hHNGdJQ0FnZlZ4dUlDQWdJR2xtSUNoMGFHbHpMbk5sZEhScGJtZHpMbTlpWlhKdmJpa2dlMXh1SUNBZ0lDQWdJQ0IyWVhJZ2IySmxjbTl1VG1GdFpTQTlJSFZ1WVhOemFXZHVaV1JUY0dsbGMxc3dYVHRjYmlBZ0lDQWdJQ0FnZFc1aGMzTnBaMjVsWkZOd2FXVnpMbk53YkdsalpTZ3dMREVwTzF4dUlDQWdJQ0FnSUNCMGFHbHpMbkp2YkdWelcyOWlaWEp2Yms1aGJXVmRMbTlpWlhKdmJpQTlJSFJ5ZFdVN1hHNGdJQ0FnZlZ4dVhHNGdJQ0FnZEdocGN5NWxiV2wwUTJoaGJtZGxLQ2xjYm4xY2JseHVMeW9xWEc0Z0tpQk5ZV3RsSUhOMWNtVWdkR2hoZENCeWIyeGxjeUJsZUdsemRDQnBaaUIwYUdWNUlHTmhiaTVjYmlBcUlHTnNaV0Z5SUMwZ2QyaGxkR2hsY2lCMGJ5QmpiR1ZoY2lCbGVHbHpkR2x1WnlCeWIyeGxjMXh1SUNvdlhHNUhZVzFsVTNSaGRHVXVjSEp2ZEc5MGVYQmxMblZ3WkdGMFpWSnZiR1Z6SUQwZ1puVnVZM1JwYjI0b1kyeGxZWElwSUh0Y2JpQWdJQ0JwWmlBb1kyeGxZWElwSUh0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTV5YjJ4bGN5QTlJRzUxYkd4Y2JpQWdJQ0I5WEc1Y2JpQWdJQ0F2THlCVmMyVWdaWGhwYzNScGJtY2djbTlzWlhNZ2FXWWdkR2hsZVNCemRHbHNiQ0JsZUdsemRDNWNiaUFnSUNCcFppQW9kR2hwY3k1eWIyeGxjeUFoUFQwZ2JuVnNiQ2tnY21WMGRYSnVYRzVjYmlBZ0lDQnBaaUFvZEdocGN5NXdiR0Y1WlhKT1lXMWxjeTVzWlc1bmRHZ2dQQ0ExS1NCN1hHNGdJQ0FnSUNBZ0lIUm9hWE11WkdsellXSnNaV1JTWldGemIyNGdQU0FuZEc5dlJtVjNKMXh1SUNBZ0lIMGdaV3h6WlNCcFppQW9kR2hwY3k1d2JHRjVaWEpPWVcxbGN5NXNaVzVuZEdnZ1BpQXhNQ2tnZTF4dUlDQWdJQ0FnSUNCMGFHbHpMbVJwYzJGaWJHVmtVbVZoYzI5dUlEMGdKM1J2YjAxaGJua25YRzRnSUNBZ2ZTQmxiSE5sSUdsbUlDaDBhR2x6TG5Cc1lYbGxjazVoYldWekxteGxibWQwYUNBOElEZGNiaUFnSUNBZ0lDQWdJQ0FnSUNZbUlIUm9hWE11YzJWMGRHbHVaM011Ylc5eVpISmxaRnh1SUNBZ0lDQWdJQ0FnSUNBZ0ppWWdkR2hwY3k1elpYUjBhVzVuY3k1dGIzSm5ZVzVoWEc0Z0lDQWdJQ0FnSUNBZ0lDQW1KaUIwYUdsekxuTmxkSFJwYm1kekxtOWlaWEp2YmlrZ2UxeHVJQ0FnSUNBZ0lDQjBhR2x6TG1ScGMyRmliR1ZrVW1WaGMyOXVJRDBnSjNSdmIwWmxkeWRjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQjBhR2x6TG1ScGMyRmliR1ZrVW1WaGMyOXVJRDBnYm5Wc2JGeHVJQ0FnSUNBZ0lDQjBhR2x6TG1GemMybG5ibEp2YkdWektDbGNiaUFnSUNCOVhHNTlYRzVjYmtkaGJXVlRkR0YwWlM1aFkzUnBiMjV6SUQwZ2UzMWNibHh1UjJGdFpWTjBZWFJsTG1GamRHbHZibk11WVdSa1VHeGhlV1Z5SUQwZ1puVnVZM1JwYjI0b2UyNWhiV1Y5S1NCN1hHNGdJQ0FnYVdZZ0tDRmZMbU52Ym5SaGFXNXpLSFJvYVhNdWNHeGhlV1Z5VG1GdFpYTXNJRzVoYldVcEtTQjdYRzRnSUNBZ0lDQWdJSFJvYVhNdWNHeGhlV1Z5VG1GdFpYTXVjSFZ6YUNodVlXMWxLVnh1SUNBZ0lDQWdJQ0IwYUdsekxuVndaR0YwWlZKdmJHVnpLSFJ5ZFdVcFhHNGdJQ0FnSUNBZ0lIUm9hWE11WlcxcGRFTm9ZVzVuWlNncFhHNGdJQ0FnZlZ4dWZWeHVYRzVIWVcxbFUzUmhkR1V1WVdOMGFXOXVjeTVrWld4bGRHVlFiR0Y1WlhJZ1BTQm1kVzVqZEdsdmJpaDdibUZ0WlgwcElIdGNiaUFnSUNCMGFHbHpMbkJzWVhsbGNrNWhiV1Z6SUQwZ1h5NTNhWFJvYjNWMEtIUm9hWE11Y0d4aGVXVnlUbUZ0WlhNc0lHNWhiV1VwWEc0Z0lDQWdkR2hwY3k1MWNHUmhkR1ZTYjJ4bGN5aDBjblZsS1Z4dUlDQWdJSFJvYVhNdVpXMXBkRU5vWVc1blpTZ3BYRzU5WEc1Y2JrZGhiV1ZUZEdGMFpTNWhZM1JwYjI1ekxtTm9ZVzVuWlZObGRIUnBibWR6SUQwZ1puVnVZM1JwYjI0b2UzTmxkSFJwYm1kemZTa2dlMXh1SUNBZ0lGOHVaWGgwWlc1a0tIUm9hWE11YzJWMGRHbHVaM01zSUhObGRIUnBibWR6S1Z4dUlDQWdJSFJvYVhNdWRYQmtZWFJsVW05c1pYTW9kSEoxWlNsY2JpQWdJQ0IwYUdsekxtVnRhWFJEYUdGdVoyVW9LVnh1ZlZ4dVhHNUhZVzFsVTNSaGRHVXVZV04wYVc5dWN5NXVaWGRTYjJ4bGN5QTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJSFJvYVhNdWRYQmtZWFJsVW05c1pYTW9kSEoxWlNsY2JuMWNiaUpkZlE9PSIsInZhciBUYWJzICAgICAgICAgPSBSZWFjdC5jcmVhdGVGYWN0b3J5KHJlcXVpcmUoJy4vdGFicy5qc3gnKSlcbnZhciBTZXR1cFBhZ2UgICAgPSBSZWFjdC5jcmVhdGVGYWN0b3J5KHJlcXVpcmUoJy4vc2V0dXAtcGFnZS5qc3gnKSlcbnZhciBSb2xlc1BhZ2UgICAgPSBSZWFjdC5jcmVhdGVGYWN0b3J5KHJlcXVpcmUoJy4vcm9sZXMtcGFnZS5qc3gnKSlcbnZhciBNaXNzaW9uUGFnZSAgPSBSZWFjdC5jcmVhdGVGYWN0b3J5KHJlcXVpcmUoJy4vbWlzc2lvbi1wYWdlLmpzeCcpKVxudmFyIERpc3BhdGNoZXIgICA9IHJlcXVpcmUoJy4vZGlzcGF0Y2hlcicpXG52YXIgVUlTdGF0ZSAgICAgID0gcmVxdWlyZSgnLi91aS1zdGF0ZScpXG52YXIgR2FtZVN0YXRlICAgID0gcmVxdWlyZSgnLi9nYW1lLXN0YXRlJylcbnZhciBNaXNzaW9uU3RhdGUgPSByZXF1aXJlKCcuL21pc3Npb24tc3RhdGUnKVxudmFyIHN0b3JlX3Jlc2V0ICA9IHJlcXVpcmUoJy4vc3RvcmUtcmVzZXQnKVxuXG52YXIgZGlzcGF0Y2hlciAgID0gbmV3IERpc3BhdGNoZXIoKVxudmFyIGRpc3BhdGNoICAgICA9IGRpc3BhdGNoZXIuZGlzcGF0Y2guYmluZChkaXNwYXRjaGVyKVxudmFyIHVpc3RhdGUgICAgICA9IG5ldyBVSVN0YXRlKGRpc3BhdGNoZXIpXG52YXIgZ2FtZXN0YXRlICAgID0gbmV3IEdhbWVTdGF0ZShkaXNwYXRjaGVyKVxudmFyIG1pc3Npb25zdGF0ZSA9IG5ldyBNaXNzaW9uU3RhdGUoZGlzcGF0Y2hlcilcblxuLy8gSW5jcmVhc2UgdGhpcyBudW1iZXIgYWZ0ZXIgZXZlcnkgZGF0YXN0b3JlIHNjaGVtYSBicmVha2luZyBjaGFuZ2UuXG5zdG9yZV9yZXNldCgzKVxudWlzdGF0ZS5sb2FkKClcbmdhbWVzdGF0ZS5sb2FkKClcbm1pc3Npb25zdGF0ZS5sb2FkKClcblxudmFyIHJlbmRlckFwcCA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBzZXR1cFBhZ2UgPSBTZXR1cFBhZ2Uoe1xuICAgICAgICBwbGF5ZXJOYW1lczogZ2FtZXN0YXRlLnBsYXllck5hbWVzLCBzZXR0aW5nczogZ2FtZXN0YXRlLnNldHRpbmdzLFxuICAgICAgICBvbkFkZE5hbWU6IGRpc3BhdGNoZXIuYmFrZSgnYWRkUGxheWVyJywgJ25hbWUnKSxcbiAgICAgICAgb25EZWxldGVOYW1lOiBkaXNwYXRjaGVyLmJha2UoJ2RlbGV0ZVBsYXllcicsICduYW1lJyksXG4gICAgICAgIG9uQ2hhbmdlU2V0dGluZ3M6IGRpc3BhdGNoZXIuYmFrZSgnY2hhbmdlU2V0dGluZ3MnLCAnc2V0dGluZ3MnKSxcbiAgICAgICAgb25OZXdSb2xlczogZGlzcGF0Y2hlci5iYWtlKCduZXdSb2xlcycpLFxuICAgIH0pXG5cbiAgICB2YXIgcm9sZXNQYWdlID0gUm9sZXNQYWdlKHtcbiAgICAgICAgZGlzYWJsZWRSZWFzb246IGdhbWVzdGF0ZS5kaXNhYmxlZFJlYXNvbixcbiAgICAgICAgcGxheWVyTmFtZXM6IGdhbWVzdGF0ZS5wbGF5ZXJOYW1lcyxcbiAgICAgICAgc2VsZWN0ZWRQbGF5ZXI6IHVpc3RhdGUuc2VsZWN0ZWRQbGF5ZXIsXG4gICAgICAgIHNlbGVjdGVkUm9sZTogICBnYW1lc3RhdGUuZ2V0Um9sZSh1aXN0YXRlLnNlbGVjdGVkUGxheWVyKSxcbiAgICAgICAgc2VsZWN0aW9uQ29uZmlybWVkOiB1aXN0YXRlLnNlbGVjdGlvbkNvbmZpcm1lZCxcbiAgICAgICAgb25DbGlja1Nob3c6ICAgIGRpc3BhdGNoZXIuYmFrZSgnc2VsZWN0UGxheWVyJywgJ25hbWUnKSxcbiAgICAgICAgb25DbGlja0NvbmZpcm06IGRpc3BhdGNoZXIuYmFrZSgnY29uZmlybVBsYXllcicsICduYW1lJyksXG4gICAgICAgIG9uQ2xpY2tDYW5jZWw6ICBkaXNwYXRjaGVyLmJha2UoJ2Rlc2VsZWN0UGxheWVyJyksXG4gICAgICAgIG9uQ2xpY2tPazogICAgICBkaXNwYXRjaGVyLmJha2UoJ2Rlc2VsZWN0UGxheWVyJywgJ25hbWUnKSxcbiAgICB9KVxuXG4gICAgdmFyIG1pc3Npb25QYWdlID0gTWlzc2lvblBhZ2Uoe1xuICAgICAgICBudW1QbGF5ZXJzOiBnYW1lc3RhdGUucGxheWVyTmFtZXMubGVuZ3RoLFxuICAgICAgICBwYXNzZXM6IG1pc3Npb25zdGF0ZS5wYXNzZXMsXG4gICAgICAgIGZhaWxzOiBtaXNzaW9uc3RhdGUuZmFpbHMsXG4gICAgICAgIGhpc3Rvcnk6IG1pc3Npb25zdGF0ZS5oaXN0b3J5LFxuICAgICAgICByZXZlYWxlZDogdWlzdGF0ZS5taXNzaW9uUmV2ZWFsZWQsXG4gICAgICAgIG9uVm90ZTogZGlzcGF0Y2hlci5iYWtlKCdtaXNzaW9uVm90ZScsICdwYXNzJyksXG4gICAgICAgIG9uUmV2ZWFsOiBkaXNwYXRjaGVyLmJha2UoJ21pc3Npb25SZXZlYWwnKSxcbiAgICAgICAgb25SZXNldDogZGlzcGF0Y2hlci5iYWtlKCdtaXNzaW9uUmVzZXQnKSxcbiAgICB9KVxuXG4gICAgUmVhY3QucmVuZGVyKFxuICAgICAgICBUYWJzKHtcbiAgICAgICAgICAgIGFjdGl2ZVRhYjogdWlzdGF0ZS50YWIsXG4gICAgICAgICAgICBvbkNoYW5nZVRhYjogZGlzcGF0Y2hlci5iYWtlKCdjaGFuZ2VUYWInLCAndGFiJyksXG4gICAgICAgICAgICB0YWJzOiB7XG4gICAgICAgICAgICAgICAgc2V0dXA6IHtuYW1lOiAnU2V0dXAnLCBjb250ZW50OiBzZXR1cFBhZ2V9LFxuICAgICAgICAgICAgICAgIHJvbGVzOiB7bmFtZTogJ1JvbGVzJywgY29udGVudDogcm9sZXNQYWdlfSxcbiAgICAgICAgICAgICAgICBtaXNzaW9uOiB7bmFtZTogJ01pc3Npb24nLCBjb250ZW50OiBtaXNzaW9uUGFnZX0sXG4gICAgICAgICAgICB9XG4gICAgICAgIH0pLFxuICAgICAgICBkb2N1bWVudC5nZXRFbGVtZW50QnlJZCgnYXBwJylcbiAgICApXG59XG5cblJlYWN0LmluaXRpYWxpemVUb3VjaEV2ZW50cyh0cnVlKVxucmVuZGVyQXBwKClcbnVpc3RhdGUub25DaGFuZ2UocmVuZGVyQXBwKVxuZ2FtZXN0YXRlLm9uQ2hhbmdlKHJlbmRlckFwcClcbm1pc3Npb25zdGF0ZS5vbkNoYW5nZShyZW5kZXJBcHApXG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaUwyaHZiV1V2Yldsc1pYTXZZMjlrWlM5eVpXRmpkR0Z1WTJVdmMyTnlhWEIwY3k5cGJtUmxlQzVxY3lJc0luTnZkWEpqWlhNaU9sc2lMMmh2YldVdmJXbHNaWE12WTI5a1pTOXlaV0ZqZEdGdVkyVXZjMk55YVhCMGN5OXBibVJsZUM1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaVFVRkJRU3hKUVVGSkxFbEJRVWtzVjBGQlZ5eExRVUZMTEVOQlFVTXNZVUZCWVN4RFFVRkRMRTlCUVU4c1EwRkJReXhaUVVGWkxFTkJRVU1zUTBGQlF6dEJRVU0zUkN4SlFVRkpMRk5CUVZNc1RVRkJUU3hMUVVGTExFTkJRVU1zWVVGQllTeERRVUZETEU5QlFVOHNRMEZCUXl4clFrRkJhMElzUTBGQlF5eERRVUZETzBGQlEyNUZMRWxCUVVrc1UwRkJVeXhOUVVGTkxFdEJRVXNzUTBGQlF5eGhRVUZoTEVOQlFVTXNUMEZCVHl4RFFVRkRMR3RDUVVGclFpeERRVUZETEVOQlFVTTdRVUZEYmtVc1NVRkJTU3hYUVVGWExFbEJRVWtzUzBGQlN5eERRVUZETEdGQlFXRXNRMEZCUXl4UFFVRlBMRU5CUVVNc2IwSkJRVzlDTEVOQlFVTXNRMEZCUXp0QlFVTnlSU3hKUVVGSkxGVkJRVlVzUzBGQlN5eFBRVUZQTEVOQlFVTXNZMEZCWXl4RFFVRkRPMEZCUXpGRExFbEJRVWtzVDBGQlR5eFJRVUZSTEU5QlFVOHNRMEZCUXl4WlFVRlpMRU5CUVVNN1FVRkRlRU1zU1VGQlNTeFRRVUZUTEUxQlFVMHNUMEZCVHl4RFFVRkRMR05CUVdNc1EwRkJRenRCUVVNeFF5eEpRVUZKTEZsQlFWa3NSMEZCUnl4UFFVRlBMRU5CUVVNc2FVSkJRV2xDTEVOQlFVTTdRVUZETjBNc1NVRkJTU3hYUVVGWExFbEJRVWtzVDBGQlR5eERRVUZETEdWQlFXVXNRMEZCUXpzN1FVRkZNME1zU1VGQlNTeFZRVUZWTEV0QlFVc3NTVUZCU1N4VlFVRlZMRVZCUVVVN1FVRkRia01zU1VGQlNTeFJRVUZSTEU5QlFVOHNWVUZCVlN4RFFVRkRMRkZCUVZFc1EwRkJReXhKUVVGSkxFTkJRVU1zVlVGQlZTeERRVUZETzBGQlEzWkVMRWxCUVVrc1QwRkJUeXhSUVVGUkxFbEJRVWtzVDBGQlR5eERRVUZETEZWQlFWVXNRMEZCUXp0QlFVTXhReXhKUVVGSkxGTkJRVk1zVFVGQlRTeEpRVUZKTEZOQlFWTXNRMEZCUXl4VlFVRlZMRU5CUVVNN1FVRkROVU1zU1VGQlNTeFpRVUZaTEVkQlFVY3NTVUZCU1N4WlFVRlpMRU5CUVVNc1ZVRkJWU3hEUVVGRE96dEJRVVV2UXl4eFJVRkJjVVU3UVVGRGNrVXNWMEZCVnl4RFFVRkRMRU5CUVVNc1EwRkJRenRCUVVOa0xFOUJRVThzUTBGQlF5eEpRVUZKTEVWQlFVVTdRVUZEWkN4VFFVRlRMRU5CUVVNc1NVRkJTU3hGUVVGRk8wRkJRMmhDTEZsQlFWa3NRMEZCUXl4SlFVRkpMRVZCUVVVN08wRkJSVzVDTEVsQlFVa3NVMEZCVXl4SFFVRkhMRmRCUVZjN1NVRkRka0lzU1VGQlNTeFRRVUZUTEVkQlFVY3NVMEZCVXl4RFFVRkRPMUZCUTNSQ0xGZEJRVmNzUlVGQlJTeFRRVUZUTEVOQlFVTXNWMEZCVnl4RlFVRkZMRkZCUVZFc1JVRkJSU3hUUVVGVExFTkJRVU1zVVVGQlVUdFJRVU5vUlN4VFFVRlRMRVZCUVVVc1ZVRkJWU3hEUVVGRExFbEJRVWtzUTBGQlF5eFhRVUZYTEVWQlFVVXNUVUZCVFN4RFFVRkRPMUZCUXk5RExGbEJRVmtzUlVGQlJTeFZRVUZWTEVOQlFVTXNTVUZCU1N4RFFVRkRMR05CUVdNc1JVRkJSU3hOUVVGTkxFTkJRVU03VVVGRGNrUXNaMEpCUVdkQ0xFVkJRVVVzVlVGQlZTeERRVUZETEVsQlFVa3NRMEZCUXl4blFrRkJaMElzUlVGQlJTeFZRVUZWTEVOQlFVTTdVVUZETDBRc1ZVRkJWU3hGUVVGRkxGVkJRVlVzUTBGQlF5eEpRVUZKTEVOQlFVTXNWVUZCVlN4RFFVRkRPMEZCUXk5RExFdEJRVXNzUTBGQlF6czdTVUZGUml4SlFVRkpMRk5CUVZNc1IwRkJSeXhUUVVGVExFTkJRVU03VVVGRGRFSXNZMEZCWXl4RlFVRkZMRk5CUVZNc1EwRkJReXhqUVVGak8xRkJRM2hETEZkQlFWY3NSVUZCUlN4VFFVRlRMRU5CUVVNc1YwRkJWenRSUVVOc1F5eGpRVUZqTEVWQlFVVXNUMEZCVHl4RFFVRkRMR05CUVdNN1VVRkRkRU1zV1VGQldTeEpRVUZKTEZOQlFWTXNRMEZCUXl4UFFVRlBMRU5CUVVNc1QwRkJUeXhEUVVGRExHTkJRV01zUTBGQlF6dFJRVU42UkN4clFrRkJhMElzUlVGQlJTeFBRVUZQTEVOQlFVTXNhMEpCUVd0Q08xRkJRemxETEZkQlFWY3NTMEZCU3l4VlFVRlZMRU5CUVVNc1NVRkJTU3hEUVVGRExHTkJRV01zUlVGQlJTeE5RVUZOTEVOQlFVTTdVVUZEZGtRc1kwRkJZeXhGUVVGRkxGVkJRVlVzUTBGQlF5eEpRVUZKTEVOQlFVTXNaVUZCWlN4RlFVRkZMRTFCUVUwc1EwRkJRenRSUVVONFJDeGhRVUZoTEVkQlFVY3NWVUZCVlN4RFFVRkRMRWxCUVVrc1EwRkJReXhuUWtGQlowSXNRMEZCUXp0UlFVTnFSQ3hUUVVGVExFOUJRVThzVlVGQlZTeERRVUZETEVsQlFVa3NRMEZCUXl4blFrRkJaMElzUlVGQlJTeE5RVUZOTEVOQlFVTTdRVUZEYWtVc1MwRkJTeXhEUVVGRE96dEpRVVZHTEVsQlFVa3NWMEZCVnl4SFFVRkhMRmRCUVZjc1EwRkJRenRSUVVNeFFpeFZRVUZWTEVWQlFVVXNVMEZCVXl4RFFVRkRMRmRCUVZjc1EwRkJReXhOUVVGTk8xRkJRM2hETEUxQlFVMHNSVUZCUlN4WlFVRlpMRU5CUVVNc1RVRkJUVHRSUVVNelFpeExRVUZMTEVWQlFVVXNXVUZCV1N4RFFVRkRMRXRCUVVzN1VVRkRla0lzVDBGQlR5eEZRVUZGTEZsQlFWa3NRMEZCUXl4UFFVRlBPMUZCUXpkQ0xGRkJRVkVzUlVGQlJTeFBRVUZQTEVOQlFVTXNaVUZCWlR0UlFVTnFReXhOUVVGTkxFVkJRVVVzVlVGQlZTeERRVUZETEVsQlFVa3NRMEZCUXl4aFFVRmhMRVZCUVVVc1RVRkJUU3hEUVVGRE8xRkJRemxETEZGQlFWRXNSVUZCUlN4VlFVRlZMRU5CUVVNc1NVRkJTU3hEUVVGRExHVkJRV1VzUTBGQlF6dFJRVU14UXl4UFFVRlBMRVZCUVVVc1ZVRkJWU3hEUVVGRExFbEJRVWtzUTBGQlF5eGpRVUZqTEVOQlFVTTdRVUZEYUVRc1MwRkJTeXhEUVVGRE96dEpRVVZHTEV0QlFVc3NRMEZCUXl4TlFVRk5PMUZCUTFJc1NVRkJTU3hEUVVGRE8xbEJRMFFzVTBGQlV5eEZRVUZGTEU5QlFVOHNRMEZCUXl4SFFVRkhPMWxCUTNSQ0xGZEJRVmNzUlVGQlJTeFZRVUZWTEVOQlFVTXNTVUZCU1N4RFFVRkRMRmRCUVZjc1JVRkJSU3hMUVVGTExFTkJRVU03V1VGRGFFUXNTVUZCU1N4RlFVRkZPMmRDUVVOR0xFdEJRVXNzUlVGQlJTeERRVUZETEVsQlFVa3NSVUZCUlN4UFFVRlBMRVZCUVVVc1QwRkJUeXhGUVVGRkxGTkJRVk1zUTBGQlF6dG5Ra0ZETVVNc1MwRkJTeXhGUVVGRkxFTkJRVU1zU1VGQlNTeEZRVUZGTEU5QlFVOHNSVUZCUlN4UFFVRlBMRVZCUVVVc1UwRkJVeXhEUVVGRE8yZENRVU14UXl4UFFVRlBMRVZCUVVVc1EwRkJReXhKUVVGSkxFVkJRVVVzVTBGQlV5eEZRVUZGTEU5QlFVOHNSVUZCUlN4WFFVRlhMRU5CUVVNN1lVRkRia1E3VTBGRFNpeERRVUZETzFGQlEwWXNVVUZCVVN4RFFVRkRMR05CUVdNc1EwRkJReXhMUVVGTExFTkJRVU03UzBGRGFrTTdRVUZEVEN4RFFVRkRPenRCUVVWRUxFdEJRVXNzUTBGQlF5eHhRa0ZCY1VJc1EwRkJReXhKUVVGSkxFTkJRVU03UVVGRGFrTXNVMEZCVXl4RlFVRkZPMEZCUTFnc1QwRkJUeXhEUVVGRExGRkJRVkVzUTBGQlF5eFRRVUZUTEVOQlFVTTdRVUZETTBJc1UwRkJVeXhEUVVGRExGRkJRVkVzUTBGQlF5eFRRVUZUTEVOQlFVTTdRVUZETjBJc1dVRkJXU3hEUVVGRExGRkJRVkVzUTBGQlF5eFRRVUZUTEVOQlFVTWlMQ0p6YjNWeVkyVnpRMjl1ZEdWdWRDSTZXeUoyWVhJZ1ZHRmljeUFnSUNBZ0lDQWdJRDBnVW1WaFkzUXVZM0psWVhSbFJtRmpkRzl5ZVNoeVpYRjFhWEpsS0NjdUwzUmhZbk11YW5ONEp5a3BYRzUyWVhJZ1UyVjBkWEJRWVdkbElDQWdJRDBnVW1WaFkzUXVZM0psWVhSbFJtRmpkRzl5ZVNoeVpYRjFhWEpsS0NjdUwzTmxkSFZ3TFhCaFoyVXVhbk40SnlrcFhHNTJZWElnVW05c1pYTlFZV2RsSUNBZ0lEMGdVbVZoWTNRdVkzSmxZWFJsUm1GamRHOXllU2h5WlhGMWFYSmxLQ2N1TDNKdmJHVnpMWEJoWjJVdWFuTjRKeWtwWEc1MllYSWdUV2x6YzJsdmJsQmhaMlVnSUQwZ1VtVmhZM1F1WTNKbFlYUmxSbUZqZEc5eWVTaHlaWEYxYVhKbEtDY3VMMjFwYzNOcGIyNHRjR0ZuWlM1cWMzZ25LU2xjYm5aaGNpQkVhWE53WVhSamFHVnlJQ0FnUFNCeVpYRjFhWEpsS0NjdUwyUnBjM0JoZEdOb1pYSW5LVnh1ZG1GeUlGVkpVM1JoZEdVZ0lDQWdJQ0E5SUhKbGNYVnBjbVVvSnk0dmRXa3RjM1JoZEdVbktWeHVkbUZ5SUVkaGJXVlRkR0YwWlNBZ0lDQTlJSEpsY1hWcGNtVW9KeTR2WjJGdFpTMXpkR0YwWlNjcFhHNTJZWElnVFdsemMybHZibE4wWVhSbElEMGdjbVZ4ZFdseVpTZ25MaTl0YVhOemFXOXVMWE4wWVhSbEp5bGNiblpoY2lCemRHOXlaVjl5WlhObGRDQWdQU0J5WlhGMWFYSmxLQ2N1TDNOMGIzSmxMWEpsYzJWMEp5bGNibHh1ZG1GeUlHUnBjM0JoZEdOb1pYSWdJQ0E5SUc1bGR5QkVhWE53WVhSamFHVnlLQ2xjYm5aaGNpQmthWE53WVhSamFDQWdJQ0FnUFNCa2FYTndZWFJqYUdWeUxtUnBjM0JoZEdOb0xtSnBibVFvWkdsemNHRjBZMmhsY2lsY2JuWmhjaUIxYVhOMFlYUmxJQ0FnSUNBZ1BTQnVaWGNnVlVsVGRHRjBaU2hrYVhOd1lYUmphR1Z5S1Z4dWRtRnlJR2RoYldWemRHRjBaU0FnSUNBOUlHNWxkeUJIWVcxbFUzUmhkR1VvWkdsemNHRjBZMmhsY2lsY2JuWmhjaUJ0YVhOemFXOXVjM1JoZEdVZ1BTQnVaWGNnVFdsemMybHZibE4wWVhSbEtHUnBjM0JoZEdOb1pYSXBYRzVjYmk4dklFbHVZM0psWVhObElIUm9hWE1nYm5WdFltVnlJR0ZtZEdWeUlHVjJaWEo1SUdSaGRHRnpkRzl5WlNCelkyaGxiV0VnWW5KbFlXdHBibWNnWTJoaGJtZGxMbHh1YzNSdmNtVmZjbVZ6WlhRb015bGNiblZwYzNSaGRHVXViRzloWkNncFhHNW5ZVzFsYzNSaGRHVXViRzloWkNncFhHNXRhWE56YVc5dWMzUmhkR1V1Ykc5aFpDZ3BYRzVjYm5aaGNpQnlaVzVrWlhKQmNIQWdQU0JtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ0IyWVhJZ2MyVjBkWEJRWVdkbElEMGdVMlYwZFhCUVlXZGxLSHRjYmlBZ0lDQWdJQ0FnY0d4aGVXVnlUbUZ0WlhNNklHZGhiV1Z6ZEdGMFpTNXdiR0Y1WlhKT1lXMWxjeXdnYzJWMGRHbHVaM002SUdkaGJXVnpkR0YwWlM1elpYUjBhVzVuY3l4Y2JpQWdJQ0FnSUNBZ2IyNUJaR1JPWVcxbE9pQmthWE53WVhSamFHVnlMbUpoYTJVb0oyRmtaRkJzWVhsbGNpY3NJQ2R1WVcxbEp5a3NYRzRnSUNBZ0lDQWdJRzl1UkdWc1pYUmxUbUZ0WlRvZ1pHbHpjR0YwWTJobGNpNWlZV3RsS0Nka1pXeGxkR1ZRYkdGNVpYSW5MQ0FuYm1GdFpTY3BMRnh1SUNBZ0lDQWdJQ0J2YmtOb1lXNW5aVk5sZEhScGJtZHpPaUJrYVhOd1lYUmphR1Z5TG1KaGEyVW9KMk5vWVc1blpWTmxkSFJwYm1kekp5d2dKM05sZEhScGJtZHpKeWtzWEc0Z0lDQWdJQ0FnSUc5dVRtVjNVbTlzWlhNNklHUnBjM0JoZEdOb1pYSXVZbUZyWlNnbmJtVjNVbTlzWlhNbktTeGNiaUFnSUNCOUtWeHVYRzRnSUNBZ2RtRnlJSEp2YkdWelVHRm5aU0E5SUZKdmJHVnpVR0ZuWlNoN1hHNGdJQ0FnSUNBZ0lHUnBjMkZpYkdWa1VtVmhjMjl1T2lCbllXMWxjM1JoZEdVdVpHbHpZV0pzWldSU1pXRnpiMjRzWEc0Z0lDQWdJQ0FnSUhCc1lYbGxjazVoYldWek9pQm5ZVzFsYzNSaGRHVXVjR3hoZVdWeVRtRnRaWE1zWEc0Z0lDQWdJQ0FnSUhObGJHVmpkR1ZrVUd4aGVXVnlPaUIxYVhOMFlYUmxMbk5sYkdWamRHVmtVR3hoZVdWeUxGeHVJQ0FnSUNBZ0lDQnpaV3hsWTNSbFpGSnZiR1U2SUNBZ1oyRnRaWE4wWVhSbExtZGxkRkp2YkdVb2RXbHpkR0YwWlM1elpXeGxZM1JsWkZCc1lYbGxjaWtzWEc0Z0lDQWdJQ0FnSUhObGJHVmpkR2x2YmtOdmJtWnBjbTFsWkRvZ2RXbHpkR0YwWlM1elpXeGxZM1JwYjI1RGIyNW1hWEp0WldRc1hHNGdJQ0FnSUNBZ0lHOXVRMnhwWTJ0VGFHOTNPaUFnSUNCa2FYTndZWFJqYUdWeUxtSmhhMlVvSjNObGJHVmpkRkJzWVhsbGNpY3NJQ2R1WVcxbEp5a3NYRzRnSUNBZ0lDQWdJRzl1UTJ4cFkydERiMjVtYVhKdE9pQmthWE53WVhSamFHVnlMbUpoYTJVb0oyTnZibVpwY20xUWJHRjVaWEluTENBbmJtRnRaU2NwTEZ4dUlDQWdJQ0FnSUNCdmJrTnNhV05yUTJGdVkyVnNPaUFnWkdsemNHRjBZMmhsY2k1aVlXdGxLQ2RrWlhObGJHVmpkRkJzWVhsbGNpY3BMRnh1SUNBZ0lDQWdJQ0J2YmtOc2FXTnJUMnM2SUNBZ0lDQWdaR2x6Y0dGMFkyaGxjaTVpWVd0bEtDZGtaWE5sYkdWamRGQnNZWGxsY2ljc0lDZHVZVzFsSnlrc1hHNGdJQ0FnZlNsY2JseHVJQ0FnSUhaaGNpQnRhWE56YVc5dVVHRm5aU0E5SUUxcGMzTnBiMjVRWVdkbEtIdGNiaUFnSUNBZ0lDQWdiblZ0VUd4aGVXVnljem9nWjJGdFpYTjBZWFJsTG5Cc1lYbGxjazVoYldWekxteGxibWQwYUN4Y2JpQWdJQ0FnSUNBZ2NHRnpjMlZ6T2lCdGFYTnphVzl1YzNSaGRHVXVjR0Z6YzJWekxGeHVJQ0FnSUNBZ0lDQm1ZV2xzY3pvZ2JXbHpjMmx2Ym5OMFlYUmxMbVpoYVd4ekxGeHVJQ0FnSUNBZ0lDQm9hWE4wYjNKNU9pQnRhWE56YVc5dWMzUmhkR1V1YUdsemRHOXllU3hjYmlBZ0lDQWdJQ0FnY21WMlpXRnNaV1E2SUhWcGMzUmhkR1V1YldsemMybHZibEpsZG1WaGJHVmtMRnh1SUNBZ0lDQWdJQ0J2YmxadmRHVTZJR1JwYzNCaGRHTm9aWEl1WW1GclpTZ25iV2x6YzJsdmJsWnZkR1VuTENBbmNHRnpjeWNwTEZ4dUlDQWdJQ0FnSUNCdmJsSmxkbVZoYkRvZ1pHbHpjR0YwWTJobGNpNWlZV3RsS0NkdGFYTnphVzl1VW1WMlpXRnNKeWtzWEc0Z0lDQWdJQ0FnSUc5dVVtVnpaWFE2SUdScGMzQmhkR05vWlhJdVltRnJaU2duYldsemMybHZibEpsYzJWMEp5a3NYRzRnSUNBZ2ZTbGNibHh1SUNBZ0lGSmxZV04wTG5KbGJtUmxjaWhjYmlBZ0lDQWdJQ0FnVkdGaWN5aDdYRzRnSUNBZ0lDQWdJQ0FnSUNCaFkzUnBkbVZVWVdJNklIVnBjM1JoZEdVdWRHRmlMRnh1SUNBZ0lDQWdJQ0FnSUNBZ2IyNURhR0Z1WjJWVVlXSTZJR1JwYzNCaGRHTm9aWEl1WW1GclpTZ25ZMmhoYm1kbFZHRmlKeXdnSjNSaFlpY3BMRnh1SUNBZ0lDQWdJQ0FnSUNBZ2RHRmljem9nZTF4dUlDQWdJQ0FnSUNBZ0lDQWdJQ0FnSUhObGRIVndPaUI3Ym1GdFpUb2dKMU5sZEhWd0p5d2dZMjl1ZEdWdWREb2djMlYwZFhCUVlXZGxmU3hjYmlBZ0lDQWdJQ0FnSUNBZ0lDQWdJQ0J5YjJ4bGN6b2dlMjVoYldVNklDZFNiMnhsY3ljc0lHTnZiblJsYm5RNklISnZiR1Z6VUdGblpYMHNYRzRnSUNBZ0lDQWdJQ0FnSUNBZ0lDQWdiV2x6YzJsdmJqb2dlMjVoYldVNklDZE5hWE56YVc5dUp5d2dZMjl1ZEdWdWREb2diV2x6YzJsdmJsQmhaMlY5TEZ4dUlDQWdJQ0FnSUNBZ0lDQWdmVnh1SUNBZ0lDQWdJQ0I5S1N4Y2JpQWdJQ0FnSUNBZ1pHOWpkVzFsYm5RdVoyVjBSV3hsYldWdWRFSjVTV1FvSjJGd2NDY3BYRzRnSUNBZ0tWeHVmVnh1WEc1U1pXRmpkQzVwYm1sMGFXRnNhWHBsVkc5MVkyaEZkbVZ1ZEhNb2RISjFaU2xjYm5KbGJtUmxja0Z3Y0NncFhHNTFhWE4wWVhSbExtOXVRMmhoYm1kbEtISmxibVJsY2tGd2NDbGNibWRoYldWemRHRjBaUzV2YmtOb1lXNW5aU2h5Wlc1a1pYSkJjSEFwWEc1dGFYTnphVzl1YzNSaGRHVXViMjVEYUdGdVoyVW9jbVZ1WkdWeVFYQndLVnh1SWwxOSIsIi8qKiBAanN4IFJlYWN0LkRPTSAqL1xuXG52YXIgUFQgPSBSZWFjdC5Qcm9wVHlwZXNcblxudmFyIExhYmVsZWROdW1iZXIgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcHJvcFR5cGVzOiB7XG4gICAgICAgIG51bTogUFQubnVtYmVyLmlzUmVxdWlyZWQsXG4gICAgICAgIG5hbWU6IFBULnN0cmluZy5pc1JlcXVpcmVkLFxuICAgIH0sXG5cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gPGZpZ3VyZSBjbGFzc05hbWU9XCJsYWJlbGVkLW51bWJlclwiPlxuICAgICAgICAgICAge3RoaXMucHJvcHMubnVtfVxuICAgICAgICAgICAgPGZpZ2NhcHRpb24+e3RoaXMucHJvcHMubmFtZX08L2ZpZ2NhcHRpb24+XG4gICAgICAgIDwvZmlndXJlPlxuICAgIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBMYWJlbGVkTnVtYmVyXG4iLCIvKiogQGpzeCBSZWFjdC5ET00gKi9cblxudmFyIExhYmVsZWROdW1iZXIgPSByZXF1aXJlKCcuL2xhYmVsZWQtbnVtYmVyLmpzeCcpXG52YXIgUFQgPSBSZWFjdC5Qcm9wVHlwZXNcbnZhciBjeCA9IGNsYXNzbmFtZXNcblxudmFyIE1pc3Npb25QYWdlID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHByb3BUeXBlczoge1xuICAgICAgICBudW1QbGF5ZXJzOiBQVC5udW1iZXIuaXNSZXF1aXJlZCxcbiAgICAgICAgcGFzc2VzOiBQVC5udW1iZXIuaXNSZXF1aXJlZCxcbiAgICAgICAgZmFpbHM6ICBQVC5udW1iZXIuaXNSZXF1aXJlZCxcbiAgICAgICAgaGlzdG9yeTogUFQuYXJyYXkuaXNSZXF1aXJlZCxcbiAgICAgICAgcmV2ZWFsZWQ6ICBQVC5ib29sLmlzUmVxdWlyZWQsXG4gICAgICAgIG9uVm90ZTogIFBULmZ1bmMuaXNSZXF1aXJlZCxcbiAgICAgICAgb25SZXNldDogIFBULmZ1bmMuaXNSZXF1aXJlZCxcbiAgICAgICAgb25SZXZlYWw6ICBQVC5mdW5jLmlzUmVxdWlyZWQsXG4gICAgfSxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciBtaXNzaW9uTnVtYmVycyA9IHRoaXMucmVuZGVyTWlzc2lvbk51bWJlcnMoKVxuICAgICAgICBpZiAodGhpcy5wcm9wcy5yZXZlYWxlZCkge1xuICAgICAgICAgICAgdmFyIHBhc3NMYWJlbCA9IHRoaXMucHJvcHMucGFzc2VzID09PSAxID8gXCJQYXNzXCIgOiBcIlBhc3Nlc1wiXG4gICAgICAgICAgICB2YXIgZmFpbExhYmVsID0gdGhpcy5wcm9wcy5mYWlscyA9PT0gMSA/IFwiRmFpbFwiIDogXCJGYWlsc1wiXG5cbiAgICAgICAgICAgIHJldHVybiA8ZGl2IGNsYXNzTmFtZT1cIm1pc3Npb24tcGFnZSByZXZlYWxlZFwiPlxuICAgICAgICAgICAgICAgIHttaXNzaW9uTnVtYmVyc31cbiAgICAgICAgICAgICAgICA8ZGl2IGNsYXNzTmFtZT1cInZvdGUtaG9sZGVyXCI+XG4gICAgICAgICAgICAgICAgICAgIDxMYWJlbGVkTnVtYmVyXG4gICAgICAgICAgICAgICAgICAgICAgICBuYW1lPXtwYXNzTGFiZWx9XG4gICAgICAgICAgICAgICAgICAgICAgICBudW09e3RoaXMucHJvcHMucGFzc2VzfSAvPlxuICAgICAgICAgICAgICAgICAgICA8TGFiZWxlZE51bWJlclxuICAgICAgICAgICAgICAgICAgICAgICAgbmFtZT17ZmFpbExhYmVsfVxuICAgICAgICAgICAgICAgICAgICAgICAgbnVtPXt0aGlzLnByb3BzLmZhaWxzfSAvPlxuICAgICAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICAgICAgICAgIDxidXR0b25cbiAgICAgICAgICAgICAgICAgICAgY2xhc3NOYW1lPVwicmVzZXRcIlxuICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXt0aGlzLnByb3BzLm9uUmVzZXR9ID5cbiAgICAgICAgICAgICAgICAgICAgUmVzZXQ8L2J1dHRvbj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgdmFyIHZvdGVzID0gdGhpcy5wcm9wcy5wYXNzZXMgKyB0aGlzLnByb3BzLmZhaWxzXG4gICAgICAgICAgICBNYXRoLnJhbmRvbSgpXG4gICAgICAgICAgICB2YXIgc2lkZSA9IE1hdGgucmFuZG9tKCkgPiAwLjVcbiAgICAgICAgICAgIHJldHVybiA8ZGl2IGNsYXNzTmFtZT1cIm1pc3Npb24tcGFnZVwiPlxuICAgICAgICAgICAgICAgIHttaXNzaW9uTnVtYmVyc31cbiAgICAgICAgICAgICAgICA8TGFiZWxlZE51bWJlclxuICAgICAgICAgICAgICAgICAgICBuYW1lPVwiVm90ZXNcIlxuICAgICAgICAgICAgICAgICAgICBudW09e3ZvdGVzfSAvPlxuICAgICAgICAgICAgICAgIHt0aGlzLnJlbmRlclZvdGVCdXR0b24oc2lkZSl9XG4gICAgICAgICAgICAgICAge3RoaXMucmVuZGVyVm90ZUJ1dHRvbighc2lkZSl9XG4gICAgICAgICAgICAgICAgPGJ1dHRvblxuICAgICAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJyZXNldFwiXG4gICAgICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3RoaXMucHJvcHMub25SZXNldH0gPlxuICAgICAgICAgICAgICAgICAgICBSZXNldDwvYnV0dG9uPlxuICAgICAgICAgICAgICAgIDxkaXYgY2xhc3NOYW1lPVwicmV2ZWFsLWNvbnRhaW5lclwiPlxuICAgICAgICAgICAgICAgICAgICA8YnV0dG9uIGNsYXNzTmFtZT1cInJldmVhbFwiXG4gICAgICAgICAgICAgICAgICAgICAgICBvbkNsaWNrPXt0aGlzLnByb3BzLm9uUmV2ZWFsfT5cbiAgICAgICAgICAgICAgICAgICAgICAgIFNob3cgVm90ZXM8L2J1dHRvbj5cbiAgICAgICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgICAgIDwvZGl2PlxuICAgICAgICB9XG4gICAgfSxcblxuICAgIHJlbmRlck1pc3Npb25OdW1iZXJzOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIHBsYXllckNvdW50c01hcHBpbmcgPSB7XG4gICAgICAgICAgICA1OiBbXCIyXCIsIFwiM1wiLCBcIjJcIiwgXCIzXCIsIFwiM1wiXSxcbiAgICAgICAgICAgIDY6IFtcIjJcIiwgXCIzXCIsIFwiNFwiLCBcIjNcIiwgXCI0XCJdLFxuICAgICAgICAgICAgNzogW1wiMlwiLCBcIjNcIiwgXCIzXCIsIFwiNCpcIiwgXCI0XCJdLFxuICAgICAgICAgICAgODogW1wiM1wiLCBcIjRcIiwgXCI0XCIsIFwiNSpcIiwgXCI1XCJdLFxuICAgICAgICAgICAgOTogW1wiM1wiLCBcIjRcIiwgXCI0XCIsIFwiNSpcIiwgXCI1XCJdLFxuICAgICAgICAgICAgMTA6IFtcIjNcIiwgXCI0XCIsIFwiNFwiLCBcIjUqXCIsIFwiNVwiXSxcbiAgICAgICAgfVxuICAgICAgICB2YXIgcGxheWVyQ291bnRzID0gcGxheWVyQ291bnRzTWFwcGluZ1t0aGlzLnByb3BzLm51bVBsYXllcnNdXG4gICAgICAgIHZhciBoaXN0b3J5ID0gdGhpcy5wcm9wcy5oaXN0b3J5XG5cbiAgICAgICAgaWYgKHBsYXllckNvdW50cyA9PT0gdW5kZWZpbmVkKSB7XG4gICAgICAgICAgICByZXR1cm4gbnVsbFxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGRpZ2l0cyA9IHBsYXllckNvdW50cy5tYXAoZnVuY3Rpb24obiwgaSkge1xuICAgICAgICAgICAgdmFyIHBsYXllZCA9IGhpc3RvcnkubGVuZ3RoID4gaVxuICAgICAgICAgICAgdmFyIHBhc3NlZCA9IGhpc3RvcnlbaV09PTAgfHwgKGhpc3RvcnlbaV09PTEgJiYgcGxheWVyQ291bnRzW2ldLmluZGV4T2YoXCIqXCIpIT0tMSlcbiAgICAgICAgICAgIHJldHVybiA8c3BhbiBrZXk9e2l9IGNsYXNzTmFtZT17Y3goe1xuICAgICAgICAgICAgICAgICdwYXNzJzogcGxheWVkICYmIHBhc3NlZCxcbiAgICAgICAgICAgICAgICAnZmFpbCc6IHBsYXllZCAmJiAhcGFzc2VkLFxuICAgICAgICAgICAgICAgICdjdXJyZW50JzogaGlzdG9yeS5sZW5ndGggPT09aSxcbiAgICAgICAgICAgICAgICAnbnVtJzogdHJ1ZSxcbiAgICAgICAgICAgIH0pfT57cGxheWVyQ291bnRzW2ldfTwvc3Bhbj5cbiAgICAgICAgfSlcblxuICAgICAgICByZXR1cm4gPGRpdiBjbGFzc05hbWU9XCJtaXNzaW9uLW51bWJlcnNcIj5cbiAgICAgICAgICAgIHtkaWdpdHN9XG4gICAgICAgIDwvZGl2PlxuICAgIH0sXG5cbiAgICByZW5kZXJWb3RlQnV0dG9uOiBmdW5jdGlvbihwYXNzKSB7XG4gICAgICAgIHZhciBsYWJlbCA9IHBhc3MgPyBcIlBhc3NcIiA6IFwiRmFpbFwiXG4gICAgICAgIHJldHVybiA8ZGl2IGtleT17bGFiZWx9IGNsYXNzTmFtZT1cInZvdGUtY29udGFpbmVyXCI+XG4gICAgICAgICAgICA8YnV0dG9uXG4gICAgICAgICAgICAgICAgY2xhc3NOYW1lPXtjeCh7XG4gICAgICAgICAgICAgICAgICAgICdwYXNzJzogcGFzcyxcbiAgICAgICAgICAgICAgICAgICAgJ2ZhaWwnOiAhcGFzcyxcbiAgICAgICAgICAgICAgICAgICAgJ3NlY3JldC1mb2N1cyc6IHRydWUsXG4gICAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICAgICAgZGF0YS1wYXNzPXtwYXNzfVxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3RoaXMub25Wb3RlfSA+XG4gICAgICAgICAgICAgICAge2xhYmVsfTwvYnV0dG9uPlxuICAgICAgICA8L2Rpdj5cbiAgICB9LFxuXG4gICAgb25Wb3RlOiBmdW5jdGlvbihlKSB7XG4gICAgICAgIHZhciBwYXNzID0gZS50YXJnZXQuZGF0YXNldC5wYXNzID09PSBcInRydWVcIlxuICAgICAgICB0aGlzLnByb3BzLm9uVm90ZShwYXNzKVxuICAgIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBNaXNzaW9uUGFnZVxuIiwidmFyIFN0b3JlID0gcmVxdWlyZSgnLi9zdG9yZScpXG5cbm1vZHVsZS5leHBvcnRzID0gTWlzc2lvblN0YXRlXG5cbmZ1bmN0aW9uIE1pc3Npb25TdGF0ZShkaXNwYXRjaGVyKSB7XG4gICAgU3RvcmUubWl4aW4odGhpcylcblxuICAgIHRoaXMucGFzc2VzID0gMFxuICAgIHRoaXMuZmFpbHMgPSAwXG4gICAgdGhpcy5oaXN0b3J5ID0gW11cblxuICAgIGRpc3BhdGNoZXIub25BY3Rpb24oZnVuY3Rpb24ocGF5bG9hZCkge1xuICAgICAgICB2YXIgYWN0aW9ucyA9IE1pc3Npb25TdGF0ZS5hY3Rpb25zXG4gICAgICAgIGlmIChfLmlzRnVuY3Rpb24oYWN0aW9uc1twYXlsb2FkLmFjdGlvbl0pKSB7XG4gICAgICAgICAgICBhY3Rpb25zW3BheWxvYWQuYWN0aW9uXS5jYWxsKHRoaXMsIHBheWxvYWQpXG4gICAgICAgICAgICB0aGlzLnNhdmUoKVxuICAgICAgICB9XG4gICAgfS5iaW5kKHRoaXMpKVxufVxuXG52YXIgUEVSU0lTVF9LRVlTID0gWydwYXNzZXMnLCAnZmFpbHMnLCAnaGlzdG9yeSddXG5cbk1pc3Npb25TdGF0ZS5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBwZXJzaXN0ID0ge31cbiAgICBQRVJTSVNUX0tFWVMuZm9yRWFjaChrZXkgPT4gcGVyc2lzdFtrZXldID0gdGhpc1trZXldKVxuICAgIHN0b3JlLnNldCgnc3RvcmUubWlzc2lvbnN0YXRlJywgcGVyc2lzdClcbn1cblxuTWlzc2lvblN0YXRlLnByb3RvdHlwZS5sb2FkID0gZnVuY3Rpb24oKSB7XG4gICAgdmFyIHBlcnNpc3QgPSBzdG9yZS5nZXQoJ3N0b3JlLm1pc3Npb25zdGF0ZScpXG4gICAgaWYgKHBlcnNpc3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBQRVJTSVNUX0tFWVMuZm9yRWFjaChrZXkgPT4gdGhpc1trZXldID0gcGVyc2lzdFtrZXldKVxuICAgIH1cbn1cblxuTWlzc2lvblN0YXRlLnByb3RvdHlwZS5yZXNldE1pc3Npb24gPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnBhc3NlcyA9IDBcbiAgICB0aGlzLmZhaWxzID0gMFxuICAgIHRoaXMuZW1pdENoYW5nZSgpXG59XG5cbk1pc3Npb25TdGF0ZS5wcm90b3R5cGUucmVzZXRNaXNzaW9uSGlzdG9yeSA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaGlzdG9yeSA9IFtdXG4gICAgdGhpcy5yZXNldE1pc3Npb24oKVxufVxuXG5NaXNzaW9uU3RhdGUuYWN0aW9ucyA9IHt9XG5cbk1pc3Npb25TdGF0ZS5hY3Rpb25zLm1pc3Npb25Wb3RlID0gZnVuY3Rpb24oe3Bhc3N9KSB7XG4gICAgaWYgKHBhc3MpIHtcbiAgICAgICAgdGhpcy5wYXNzZXMgKz0gMVxuICAgIH0gZWxzZSB7XG4gICAgICAgIHRoaXMuZmFpbHMgKz0gMVxuICAgIH1cbiAgICB0aGlzLmVtaXRDaGFuZ2UoKVxufVxuXG5NaXNzaW9uU3RhdGUuYWN0aW9ucy5taXNzaW9uUmVzZXQgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLnJlc2V0TWlzc2lvbigpXG59XG5cbk1pc3Npb25TdGF0ZS5hY3Rpb25zLmFkZFBsYXllciA9IGZ1bmN0aW9uKHtuYW1lfSkge1xuICAgIHRoaXMucmVzZXRNaXNzaW9uSGlzdG9yeSgpXG59XG5cbk1pc3Npb25TdGF0ZS5hY3Rpb25zLmRlbGV0ZVBsYXllciA9IGZ1bmN0aW9uKHtuYW1lfSkge1xuICAgIHRoaXMucmVzZXRNaXNzaW9uSGlzdG9yeSgpXG59XG5cbk1pc3Npb25TdGF0ZS5hY3Rpb25zLmNoYW5nZVNldHRpbmdzID0gZnVuY3Rpb24oe3NldHRpbmdzfSkge1xuICAgIHRoaXMucmVzZXRNaXNzaW9uSGlzdG9yeSgpXG59XG5cbk1pc3Npb25TdGF0ZS5hY3Rpb25zLm5ld1JvbGVzID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5yZXNldE1pc3Npb25IaXN0b3J5KClcbn1cblxuTWlzc2lvblN0YXRlLmFjdGlvbnMubWlzc2lvblJldmVhbCA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMuaGlzdG9yeS5wdXNoKHRoaXMuZmFpbHMpXG59XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaUwyaHZiV1V2Yldsc1pYTXZZMjlrWlM5eVpXRmpkR0Z1WTJVdmMyTnlhWEIwY3k5dGFYTnphVzl1TFhOMFlYUmxMbXB6SWl3aWMyOTFjbU5sY3lJNld5SXZhRzl0WlM5dGFXeGxjeTlqYjJSbEwzSmxZV04wWVc1alpTOXpZM0pwY0hSekwyMXBjM05wYjI0dGMzUmhkR1V1YW5NaVhTd2libUZ0WlhNaU9sdGRMQ0p0WVhCd2FXNW5jeUk2SWtGQlFVRXNTVUZCU1N4TFFVRkxMRWRCUVVjc1QwRkJUeXhEUVVGRExGTkJRVk1zUTBGQlF6czdRVUZGT1VJc1RVRkJUU3hEUVVGRExFOUJRVThzUjBGQlJ5eFpRVUZaT3p0QlFVVTNRaXhUUVVGVExGbEJRVmtzUTBGQlF5eFZRVUZWTEVWQlFVVTdRVUZEYkVNc1NVRkJTU3hMUVVGTExFTkJRVU1zUzBGQlN5eERRVUZETEVsQlFVa3NRMEZCUXpzN1NVRkZha0lzU1VGQlNTeERRVUZETEUxQlFVMHNSMEZCUnl4RFFVRkRPMGxCUTJZc1NVRkJTU3hEUVVGRExFdEJRVXNzUjBGQlJ5eERRVUZETzBGQlEyeENMRWxCUVVrc1NVRkJTU3hEUVVGRExFOUJRVThzUjBGQlJ5eEZRVUZGT3p0SlFVVnFRaXhWUVVGVkxFTkJRVU1zVVVGQlVTeERRVUZETEZOQlFWTXNUMEZCVHl4RlFVRkZPMUZCUTJ4RExFbEJRVWtzVDBGQlR5eEhRVUZITEZsQlFWa3NRMEZCUXl4UFFVRlBPMUZCUTJ4RExFbEJRVWtzUTBGQlF5eERRVUZETEZWQlFWVXNRMEZCUXl4UFFVRlBMRU5CUVVNc1QwRkJUeXhEUVVGRExFMUJRVTBzUTBGQlF5eERRVUZETEVWQlFVVTdXVUZEZGtNc1QwRkJUeXhEUVVGRExFOUJRVThzUTBGQlF5eE5RVUZOTEVOQlFVTXNRMEZCUXl4SlFVRkpMRU5CUVVNc1NVRkJTU3hGUVVGRkxFOUJRVThzUTBGQlF6dFpRVU16UXl4SlFVRkpMRU5CUVVNc1NVRkJTU3hGUVVGRk8xTkJRMlE3UzBGRFNpeERRVUZETEVsQlFVa3NRMEZCUXl4SlFVRkpMRU5CUVVNc1EwRkJRenRCUVVOcVFpeERRVUZET3p0QlFVVkVMRWxCUVVrc1dVRkJXU3hIUVVGSExFTkJRVU1zVVVGQlVTeEZRVUZGTEU5QlFVOHNSVUZCUlN4VFFVRlRMRU5CUVVNN08wRkJSV3BFTEZsQlFWa3NRMEZCUXl4VFFVRlRMRU5CUVVNc1NVRkJTU3hIUVVGSExGZEJRVmM3U1VGRGNrTXNTVUZCU1N4UFFVRlBMRWRCUVVjc1JVRkJSVHRKUVVOb1FpeFpRVUZaTEVOQlFVTXNUMEZCVHl4RFFVRkRMRWRCUVVjc1NVRkJTU3hQUVVGUExFTkJRVU1zUjBGQlJ5eERRVUZETEVkQlFVY3NTVUZCU1N4RFFVRkRMRWRCUVVjc1EwRkJReXhEUVVGRE8wbEJRM0pFTEV0QlFVc3NRMEZCUXl4SFFVRkhMRU5CUVVNc2IwSkJRVzlDTEVWQlFVVXNUMEZCVHl4RFFVRkRPMEZCUXpWRExFTkJRVU03TzBGQlJVUXNXVUZCV1N4RFFVRkRMRk5CUVZNc1EwRkJReXhKUVVGSkxFZEJRVWNzVjBGQlZ6dEpRVU55UXl4SlFVRkpMRTlCUVU4c1IwRkJSeXhMUVVGTExFTkJRVU1zUjBGQlJ5eERRVUZETEc5Q1FVRnZRaXhEUVVGRE8wbEJRemRETEVsQlFVa3NUMEZCVHl4TFFVRkxMRk5CUVZNc1JVRkJSVHRSUVVOMlFpeFpRVUZaTEVOQlFVTXNUMEZCVHl4RFFVRkRMRWRCUVVjc1NVRkJTU3hKUVVGSkxFTkJRVU1zUjBGQlJ5eERRVUZETEVkQlFVY3NUMEZCVHl4RFFVRkRMRWRCUVVjc1EwRkJReXhEUVVGRE8wdEJRM2hFTzBGQlEwd3NRMEZCUXpzN1FVRkZSQ3haUVVGWkxFTkJRVU1zVTBGQlV5eERRVUZETEZsQlFWa3NSMEZCUnl4WFFVRlhPMGxCUXpkRExFbEJRVWtzUTBGQlF5eE5RVUZOTEVkQlFVY3NRMEZCUXp0SlFVTm1MRWxCUVVrc1EwRkJReXhMUVVGTExFZEJRVWNzUTBGQlF6dEpRVU5rTEVsQlFVa3NRMEZCUXl4VlFVRlZMRVZCUVVVN1FVRkRja0lzUTBGQlF6czdRVUZGUkN4WlFVRlpMRU5CUVVNc1UwRkJVeXhEUVVGRExHMUNRVUZ0UWl4SFFVRkhMRmRCUVZjN1NVRkRjRVFzU1VGQlNTeERRVUZETEU5QlFVOHNSMEZCUnl4RlFVRkZPMGxCUTJwQ0xFbEJRVWtzUTBGQlF5eFpRVUZaTEVWQlFVVTdRVUZEZGtJc1EwRkJRenM3UVVGRlJDeFpRVUZaTEVOQlFVTXNUMEZCVHl4SFFVRkhMRVZCUVVVN08wRkJSWHBDTEZsQlFWa3NRMEZCUXl4UFFVRlBMRU5CUVVNc1YwRkJWeXhIUVVGSExGTkJRVk1zUTBGQlF5eEpRVUZKTEVOQlFVTXNSVUZCUlR0SlFVTm9SQ3hKUVVGSkxFbEJRVWtzUlVGQlJUdFJRVU5PTEVsQlFVa3NRMEZCUXl4TlFVRk5MRWxCUVVrc1EwRkJRenRMUVVOdVFpeE5RVUZOTzFGQlEwZ3NTVUZCU1N4RFFVRkRMRXRCUVVzc1NVRkJTU3hEUVVGRE8wdEJRMnhDTzBsQlEwUXNTVUZCU1N4RFFVRkRMRlZCUVZVc1JVRkJSVHRCUVVOeVFpeERRVUZET3p0QlFVVkVMRmxCUVZrc1EwRkJReXhQUVVGUExFTkJRVU1zV1VGQldTeEhRVUZITEZkQlFWYzdTVUZETTBNc1NVRkJTU3hEUVVGRExGbEJRVmtzUlVGQlJUdEJRVU4yUWl4RFFVRkRPenRCUVVWRUxGbEJRVmtzUTBGQlF5eFBRVUZQTEVOQlFVTXNVMEZCVXl4SFFVRkhMRk5CUVZNc1EwRkJReXhKUVVGSkxFTkJRVU1zUlVGQlJUdEpRVU01UXl4SlFVRkpMRU5CUVVNc2JVSkJRVzFDTEVWQlFVVTdRVUZET1VJc1EwRkJRenM3UVVGRlJDeFpRVUZaTEVOQlFVTXNUMEZCVHl4RFFVRkRMRmxCUVZrc1IwRkJSeXhUUVVGVExFTkJRVU1zU1VGQlNTeERRVUZETEVWQlFVVTdTVUZEYWtRc1NVRkJTU3hEUVVGRExHMUNRVUZ0UWl4RlFVRkZPMEZCUXpsQ0xFTkJRVU03TzBGQlJVUXNXVUZCV1N4RFFVRkRMRTlCUVU4c1EwRkJReXhqUVVGakxFZEJRVWNzVTBGQlV5eERRVUZETEZGQlFWRXNRMEZCUXl4RlFVRkZPMGxCUTNaRUxFbEJRVWtzUTBGQlF5eHRRa0ZCYlVJc1JVRkJSVHRCUVVNNVFpeERRVUZET3p0QlFVVkVMRmxCUVZrc1EwRkJReXhQUVVGUExFTkJRVU1zVVVGQlVTeEhRVUZITEZkQlFWYzdTVUZEZGtNc1NVRkJTU3hEUVVGRExHMUNRVUZ0UWl4RlFVRkZPMEZCUXpsQ0xFTkJRVU03TzBGQlJVUXNXVUZCV1N4RFFVRkRMRTlCUVU4c1EwRkJReXhoUVVGaExFZEJRVWNzVjBGQlZ6dEpRVU0xUXl4SlFVRkpMRU5CUVVNc1QwRkJUeXhEUVVGRExFbEJRVWtzUTBGQlF5eEpRVUZKTEVOQlFVTXNTMEZCU3l4RFFVRkRPME5CUTJoRElpd2ljMjkxY21ObGMwTnZiblJsYm5RaU9sc2lkbUZ5SUZOMGIzSmxJRDBnY21WeGRXbHlaU2duTGk5emRHOXlaU2NwWEc1Y2JtMXZaSFZzWlM1bGVIQnZjblJ6SUQwZ1RXbHpjMmx2YmxOMFlYUmxYRzVjYm1aMWJtTjBhVzl1SUUxcGMzTnBiMjVUZEdGMFpTaGthWE53WVhSamFHVnlLU0I3WEc0Z0lDQWdVM1J2Y21VdWJXbDRhVzRvZEdocGN5bGNibHh1SUNBZ0lIUm9hWE11Y0dGemMyVnpJRDBnTUZ4dUlDQWdJSFJvYVhNdVptRnBiSE1nUFNBd1hHNGdJQ0FnZEdocGN5NW9hWE4wYjNKNUlEMGdXMTFjYmx4dUlDQWdJR1JwYzNCaGRHTm9aWEl1YjI1QlkzUnBiMjRvWm5WdVkzUnBiMjRvY0dGNWJHOWhaQ2tnZTF4dUlDQWdJQ0FnSUNCMllYSWdZV04wYVc5dWN5QTlJRTFwYzNOcGIyNVRkR0YwWlM1aFkzUnBiMjV6WEc0Z0lDQWdJQ0FnSUdsbUlDaGZMbWx6Um5WdVkzUnBiMjRvWVdOMGFXOXVjMXR3WVhsc2IyRmtMbUZqZEdsdmJsMHBLU0I3WEc0Z0lDQWdJQ0FnSUNBZ0lDQmhZM1JwYjI1elczQmhlV3h2WVdRdVlXTjBhVzl1WFM1allXeHNLSFJvYVhNc0lIQmhlV3h2WVdRcFhHNGdJQ0FnSUNBZ0lDQWdJQ0IwYUdsekxuTmhkbVVvS1Z4dUlDQWdJQ0FnSUNCOVhHNGdJQ0FnZlM1aWFXNWtLSFJvYVhNcEtWeHVmVnh1WEc1MllYSWdVRVZTVTBsVFZGOUxSVmxUSUQwZ1d5ZHdZWE56WlhNbkxDQW5abUZwYkhNbkxDQW5hR2x6ZEc5eWVTZGRYRzVjYmsxcGMzTnBiMjVUZEdGMFpTNXdjbTkwYjNSNWNHVXVjMkYyWlNBOUlHWjFibU4wYVc5dUtDa2dlMXh1SUNBZ0lIWmhjaUJ3WlhKemFYTjBJRDBnZTMxY2JpQWdJQ0JRUlZKVFNWTlVYMHRGV1ZNdVptOXlSV0ZqYUNoclpYa2dQVDRnY0dWeWMybHpkRnRyWlhsZElEMGdkR2hwYzF0clpYbGRLVnh1SUNBZ0lITjBiM0psTG5ObGRDZ25jM1J2Y21VdWJXbHpjMmx2Ym5OMFlYUmxKeXdnY0dWeWMybHpkQ2xjYm4xY2JseHVUV2x6YzJsdmJsTjBZWFJsTG5CeWIzUnZkSGx3WlM1c2IyRmtJRDBnWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnZG1GeUlIQmxjbk5wYzNRZ1BTQnpkRzl5WlM1blpYUW9KM04wYjNKbExtMXBjM05wYjI1emRHRjBaU2NwWEc0Z0lDQWdhV1lnS0hCbGNuTnBjM1FnSVQwOUlIVnVaR1ZtYVc1bFpDa2dlMXh1SUNBZ0lDQWdJQ0JRUlZKVFNWTlVYMHRGV1ZNdVptOXlSV0ZqYUNoclpYa2dQVDRnZEdocGMxdHJaWGxkSUQwZ2NHVnljMmx6ZEZ0clpYbGRLVnh1SUNBZ0lIMWNibjFjYmx4dVRXbHpjMmx2YmxOMFlYUmxMbkJ5YjNSdmRIbHdaUzV5WlhObGRFMXBjM05wYjI0Z1BTQm1kVzVqZEdsdmJpZ3BJSHRjYmlBZ0lDQjBhR2x6TG5CaGMzTmxjeUE5SURCY2JpQWdJQ0IwYUdsekxtWmhhV3h6SUQwZ01GeHVJQ0FnSUhSb2FYTXVaVzFwZEVOb1lXNW5aU2dwWEc1OVhHNWNiazFwYzNOcGIyNVRkR0YwWlM1d2NtOTBiM1I1Y0dVdWNtVnpaWFJOYVhOemFXOXVTR2x6ZEc5eWVTQTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJSFJvYVhNdWFHbHpkRzl5ZVNBOUlGdGRYRzRnSUNBZ2RHaHBjeTV5WlhObGRFMXBjM05wYjI0b0tWeHVmVnh1WEc1TmFYTnphVzl1VTNSaGRHVXVZV04wYVc5dWN5QTlJSHQ5WEc1Y2JrMXBjM05wYjI1VGRHRjBaUzVoWTNScGIyNXpMbTFwYzNOcGIyNVdiM1JsSUQwZ1puVnVZM1JwYjI0b2UzQmhjM045S1NCN1hHNGdJQ0FnYVdZZ0tIQmhjM01wSUh0Y2JpQWdJQ0FnSUNBZ2RHaHBjeTV3WVhOelpYTWdLejBnTVZ4dUlDQWdJSDBnWld4elpTQjdYRzRnSUNBZ0lDQWdJSFJvYVhNdVptRnBiSE1nS3owZ01WeHVJQ0FnSUgxY2JpQWdJQ0IwYUdsekxtVnRhWFJEYUdGdVoyVW9LVnh1ZlZ4dVhHNU5hWE56YVc5dVUzUmhkR1V1WVdOMGFXOXVjeTV0YVhOemFXOXVVbVZ6WlhRZ1BTQm1kVzVqZEdsdmJpZ3BJSHRjYmlBZ0lDQjBhR2x6TG5KbGMyVjBUV2x6YzJsdmJpZ3BYRzU5WEc1Y2JrMXBjM05wYjI1VGRHRjBaUzVoWTNScGIyNXpMbUZrWkZCc1lYbGxjaUE5SUdaMWJtTjBhVzl1S0h0dVlXMWxmU2tnZTF4dUlDQWdJSFJvYVhNdWNtVnpaWFJOYVhOemFXOXVTR2x6ZEc5eWVTZ3BYRzU5WEc1Y2JrMXBjM05wYjI1VGRHRjBaUzVoWTNScGIyNXpMbVJsYkdWMFpWQnNZWGxsY2lBOUlHWjFibU4wYVc5dUtIdHVZVzFsZlNrZ2UxeHVJQ0FnSUhSb2FYTXVjbVZ6WlhSTmFYTnphVzl1U0dsemRHOXllU2dwWEc1OVhHNWNiazFwYzNOcGIyNVRkR0YwWlM1aFkzUnBiMjV6TG1Ob1lXNW5aVk5sZEhScGJtZHpJRDBnWm5WdVkzUnBiMjRvZTNObGRIUnBibWR6ZlNrZ2UxeHVJQ0FnSUhSb2FYTXVjbVZ6WlhSTmFYTnphVzl1U0dsemRHOXllU2dwWEc1OVhHNWNiazFwYzNOcGIyNVRkR0YwWlM1aFkzUnBiMjV6TG01bGQxSnZiR1Z6SUQwZ1puVnVZM1JwYjI0b0tTQjdYRzRnSUNBZ2RHaHBjeTV5WlhObGRFMXBjM05wYjI1SWFYTjBiM0o1S0NsY2JuMWNibHh1VFdsemMybHZibE4wWVhSbExtRmpkR2x2Ym5NdWJXbHpjMmx2YmxKbGRtVmhiQ0E5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUhSb2FYTXVhR2x6ZEc5eWVTNXdkWE5vS0hSb2FYTXVabUZwYkhNcFhHNTlYRzRpWFgwPSIsIi8qKiBAanN4IFJlYWN0LkRPTSAqL1xuXG52YXIgY29sb3JTdHlsZUZvclBsYXllciA9IHJlcXVpcmUoJy4vY29sb3IuanMnKVxudmFyIFBUID0gUmVhY3QuUHJvcFR5cGVzXG52YXIgY3ggPSBjbGFzc25hbWVzXG5cbnZhciBOYW1lbGV0ID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHByb3BUeXBlczoge1xuICAgICAgICBuYW1lOiBQVC5zdHJpbmcuaXNSZXF1aXJlZCxcbiAgICB9LFxuXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIG5hbWUgPSB0aGlzLnByb3BzLm5hbWVcbiAgICAgICAgdmFyIHN0eWxlcyA9IHsnbmFtZWxldCc6IHRydWV9XG4gICAgICAgIGlmICh0aGlzLnByb3BzLm5hbWUgIT09IFwiXCIpIHtcbiAgICAgICAgICAgIHN0eWxlc1tjb2xvclN0eWxlRm9yUGxheWVyKG5hbWUpXSA9IHRydWVcbiAgICAgICAgfVxuICAgICAgICByZXR1cm4gPGRpdiBjbGFzc05hbWU9e2N4KHN0eWxlcyl9PntuYW1lWzBdfTwvZGl2PlxuICAgIH0sXG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE5hbWVsZXRcbiIsIi8qKiBAanN4IFJlYWN0LkRPTSAqL1xuXG52YXIgTmFtZWxldCA9IHJlcXVpcmUoJy4vbmFtZWxldC5qc3gnKVxudmFyIFBUID0gUmVhY3QuUHJvcFR5cGVzXG5cbnZhciBOZXdOYW1lID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHByb3BUeXBlczoge1xuICAgICAgICBvbkFkZE5hbWU6IFBULmZ1bmMsXG4gICAgfSxcblxuICAgIGdldEluaXRpYWxTdGF0ZTogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiB7dGV4dDogJyd9XG4gICAgfSxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiA8Zm9ybSBjbGFzc05hbWU9XCJuZXctcGxheWVyXCIgb25TdWJtaXQ9e3RoaXMub25TdWJtaXR9PlxuICAgICAgICAgICAgPE5hbWVsZXQgbmFtZT17dGhpcy5zdGF0ZS50ZXh0fSAvPlxuICAgICAgICAgICAgPGlucHV0IHR5cGU9XCJuYW1lXCJcbiAgICAgICAgICAgICAgICBjbGFzc05hbWU9XCJuYW1lXCJcbiAgICAgICAgICAgICAgICB2YWx1ZT17dGhpcy5zdGF0ZS50ZXh0fVxuICAgICAgICAgICAgICAgIHBsYWNlaG9sZGVyPVwiQW5vdGhlciBQbGF5ZXJcIlxuICAgICAgICAgICAgICAgIGF1dG9DYXBpdGFsaXplPVwib25cIlxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXt0aGlzLm9uQ2hhbmdlfVxuICAgICAgICAgICAgICAgID48L2lucHV0PlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9XCJuZXctcGxheWVyXCI+XG4gICAgICAgICAgICAgICAgQWRkPC9idXR0b24+XG4gICAgICAgIDwvZm9ybT5cbiAgICB9LFxuXG4gICAgb25DaGFuZ2U6IGZ1bmN0aW9uKGUpIHtcbiAgICAgICAgdmFyIG5hbWUgPSBlLnRhcmdldC52YWx1ZVxuICAgICAgICBuYW1lID0gbmFtZS5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIG5hbWUuc2xpY2UoMSksXG4gICAgICAgIHRoaXMuc2V0U3RhdGUoe3RleHQ6IG5hbWV9KVxuICAgIH0sXG5cbiAgICBvblN1Ym1pdDogZnVuY3Rpb24oZSkge1xuICAgICAgICBlLnByZXZlbnREZWZhdWx0KClcbiAgICAgICAgaWYgKHRoaXMuc3RhdGUudGV4dCAhPSBcIlwiKSB7XG4gICAgICAgICAgICB0aGlzLnByb3BzLm9uQWRkTmFtZSh0aGlzLnN0YXRlLnRleHQpXG4gICAgICAgICAgICB0aGlzLnNldFN0YXRlKHt0ZXh0OiBcIlwifSlcbiAgICAgICAgfVxuICAgIH1cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IE5ld05hbWVcbiIsIi8qKiBAanN4IFJlYWN0LkRPTSAqL1xuXG52YXIgTmFtZWxldCA9IHJlcXVpcmUoJy4vbmFtZWxldC5qc3gnKVxudmFyIFBUID0gUmVhY3QuUHJvcFR5cGVzXG5cbnZhciBQbGF5ZXJDaGlwID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHByb3BUeXBlczoge1xuICAgICAgICBuYW1lOiBQVC5zdHJpbmcuaXNSZXF1aXJlZCxcbiAgICB9LFxuXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIDxkaXYgY2xhc3NOYW1lPVwicGxheWVyLWNoaXBcIj5cbiAgICAgICAgICAgIDxOYW1lbGV0IG5hbWU9e3RoaXMucHJvcHMubmFtZX0gLz5cbiAgICAgICAgICAgIDxzcGFuIGNsYXNzTmFtZT1cIm5hbWVcIj57dGhpcy5wcm9wcy5uYW1lfTwvc3Bhbj5cbiAgICAgICAgPC9kaXY+XG4gICAgfSxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFBsYXllckNoaXBcbiIsIi8qKiBAanN4IFJlYWN0LkRPTSAqL1xuXG52YXIgUFQgPSBSZWFjdC5Qcm9wVHlwZXNcblxudmFyIFJvbGVDYXJkID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHByb3BUeXBlczoge1xuICAgICAgICBwbGF5ZXJOYW1lOiBQVC5zdHJpbmcuaXNSZXF1aXJlZCxcbiAgICAgICAgcm9sZTogUFQub2JqZWN0LmlzUmVxdWlyZWQsXG4gICAgfSxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHZhciByb2xlID0gdGhpcy5wcm9wcy5yb2xlXG4gICAgICAgIHZhciBjb250ZW50cyA9IG51bGxcblxuICAgICAgICB2YXIgdGhlU3BpZXMgPSByb2xlLnNwaWVzIHx8IHJvbGUub3RoZXJTcGllcyB8fCBbXTtcbiAgICAgICAgdmFyIHNwaWVzVGV4dCA9IHRoZVNwaWVzLmpvaW4oJywgJylcbiAgICAgICAgdmFyIHNweU5vdW4gPSB0aGVTcGllcy5sZW5ndGggPT0gMSA/IFwic3B5XCIgOiBcInNwaWVzXCJcbiAgICAgICAgdmFyIHNweVZlcmIgPSB0aGVTcGllcy5sZW5ndGggPT0gMSA/IFwiaXNcIiA6IFwiYXJlXCJcbiAgICAgICAgdmFyIG90aGVyID0gcm9sZS5zcHk/IFwib3RoZXJcIiA6IFwiXCJcbiAgICAgICAgdmFyIG9iZXJvblRleHQgPSByb2xlLmhhc09iZXJvbj8gPHNwYW4+PGJyIC8+PHNwYW4gY2xhc3NOYW1lPSdzcHknPk9iZXJvbjwvc3Bhbj4gaXMgaGlkZGVuIGZyb20geW91Ljwvc3Bhbj4gOiAnJ1xuICAgICAgICB2YXIgc3BpZXNCbG9jayA9IHRoZVNwaWVzLmxlbmd0aCA+IDBcbiAgICAgICAgICAgICAgICA/IDxwPlRoZSB7b3RoZXJ9IHtzcHlOb3VufSB7c3B5VmVyYn0gPHNwYW4gY2xhc3NOYW1lPSdzcHknPntzcGllc1RleHR9PC9zcGFuPi4ge29iZXJvblRleHR9PC9wPlxuICAgICAgICAgICAgICAgIDogPHA+WW91IGRvIG5vdCBzZWUgYW55IHtvdGhlcn0gc3BpZXMuPC9wPlxuICAgICAgICB2YXIgZXh0cmFJbmZvID0gPGRpdj48L2Rpdj5cbiAgICAgICAgdmFyIGRlc2NyaXB0aW9uID0gPHA+PC9wPlxuXG4gICAgICAgIHZhciBuYW1lID0gPHNwYW4gY2xhc3NOYW1lPSdyZXNpc3RhbmNlJz5yZXNpc3RhbmNlPC9zcGFuPlxuXG4gICAgICAgIGlmIChyb2xlLnNweSAmJiAhcm9sZS5vYmVyb24pIHtcbiAgICAgICAgICAgIG5hbWUgPSA8c3Bhbj5hIDxzcGFuIGNsYXNzTmFtZT0nc3B5Jz5zcHk8L3NwYW4+PC9zcGFuPjtcbiAgICAgICAgICAgIGV4dHJhSW5mbyA9IHNwaWVzQmxvY2s7XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJvbGUucGVyY2l2YWwpIHtcbiAgICAgICAgICAgIG5hbWUgPSA8c3BhbiBjbGFzc05hbWU9J3Jlc2lzdGFuY2UnPlBlcmNpdmFsPC9zcGFuPlxuICAgICAgICAgICAgdmFyIHRoZU1lcmxpbnMgPSByb2xlLm1lcmxpbnM7XG4gICAgICAgICAgICB2YXIgbWVybGluc1RleHQgPSB0aGVNZXJsaW5zLmpvaW4oJywgJyk7XG4gICAgICAgICAgICB2YXIgbWVybGluTm91biA9IHRoZU1lcmxpbnMubGVuZ3RoID09IDEgPyAnTWVybGluJyA6ICdNZXJsaW5zJztcbiAgICAgICAgICAgIHZhciBtZXJsaW5WZXJiID0gdGhlTWVybGlucy5sZW5ndGggPT0gMSA/ICdpcycgOiAnYXJlJztcbiAgICAgICAgICAgIHZhciBtZXJsaW5zQmxvY2sgPSA8cD5UaGUge21lcmxpbk5vdW59IHttZXJsaW5WZXJifToge21lcmxpbnNUZXh0fTwvcD5cbiAgICAgICAgICAgIGV4dHJhSW5mbyA9IG1lcmxpbnNCbG9jaztcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uID0gPHA+WW91IHNlZSA8c3BhbiBjbGFzc05hbWU9J3Jlc2lzdGFuY2UnPk1lcmxpbjwvc3Bhbj4gYW5kIDxzcGFuIGNsYXNzTmFtZT0nc3B5Jz5Nb3JnYW5hPC9zcGFuPiBib3RoIGFzIE1lcmxpbi48L3A+XG4gICAgICAgIH1cbiAgICAgICAgaWYgKHJvbGUubWVybGluKSB7XG4gICAgICAgICAgICBuYW1lID0gPHNwYW4gY2xhc3NOYW1lPSdyZXNpc3RhbmNlJz5NZXJsaW48L3NwYW4+O1xuICAgICAgICAgICAgZXh0cmFJbmZvID0gc3BpZXNCbG9jaztcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uID0gPHA+SWYgdGhlIHNwaWVzIGRpc2NvdmVyIHlvdXIgaWRlbnRpdHksIHJlc2lzdGFuY2UgbG9zZXMhPC9wPlxuICAgICAgICB9XG4gICAgICAgIGlmIChyb2xlLm1vcmRyZWQpIHtcbiAgICAgICAgICAgIG5hbWUgPSA8c3BhbiBjbGFzc05hbWU9J3NweSc+TW9yZHJlZDwvc3Bhbj5cbiAgICAgICAgICAgIGRlc2NyaXB0aW9uID0gPHA+WW91IGFyZSBpbnZpc2libGUgdG8gPHNwYW4gY2xhc3NOYW1lPSdyZXNpc3RhbmNlJz5NZXJsaW48L3NwYW4+LjwvcD5cbiAgICAgICAgfVxuICAgICAgICBpZiAocm9sZS5tb3JnYW5hKSB7XG4gICAgICAgICAgICBuYW1lID0gPHNwYW4gY2xhc3NOYW1lPSdzcHknPk1vcmdhbmE8L3NwYW4+XG4gICAgICAgICAgICBkZXNjcmlwdGlvbiA9IDxwPllvdSBhcHBlYXIgYXMgPHNwYW4gY2xhc3NOYW1lPSdyZXNpc3RhbmNlJz5NZXJsaW48L3NwYW4+IHRvIDxzcGFuIGNsYXNzTmFtZT0ncmVzaXN0YW5jZSc+UGVyY2l2YWw8L3NwYW4+LjwvcD5cbiAgICAgICAgfVxuICAgICAgICBpZiAocm9sZS5vYmVyb24pIHtcbiAgICAgICAgICAgIG5hbWUgPSA8c3BhbiBjbGFzc05hbWU9J3NweSc+T2Jlcm9uPC9zcGFuPlxuICAgICAgICAgICAgZGVzY3JpcHRpb24gPSA8cD5UaGUgb3RoZXIgc3BpZXMgY2Fubm90IHNlZSB5b3UsIGFuZCB5b3UgY2Fubm90IHNlZSB0aGVtLjwvcD5cbiAgICAgICAgfVxuXG4gICAgICAgIHJldHVybiA8ZGl2IGNsYXNzTmFtZT1cInJvbGUtY2FyZFwiPlxuICAgICAgICAgICAgPHA+WW91IGFyZSB7bmFtZX0hPC9wPlxuICAgICAgICAgICAge2V4dHJhSW5mb31cbiAgICAgICAgICAgIHtkZXNjcmlwdGlvbn1cbiAgICAgICAgPC9kaXY+XG5cbiAgICB9LFxuXG59KTtcblxudmFyIElmID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHByb3BUeXBlczoge1xuICAgICAgICBjb25kOiBQVC5ib29sLmlzUmVxdWlyZWQsXG4gICAgICAgIGE6IFBULmVsZW1lbnQuaXNSZXF1aXJlZCxcbiAgICAgICAgYjogUFQuZWxlbWVudC5pc1JlcXVpcmVkLFxuICAgIH0sXG5cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5wcm9wcy5jb25kKSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9wcy5hXG4gICAgICAgIH0gZWxzZSB7XG4gICAgICAgICAgICByZXR1cm4gdGhpcy5wcm9wcy5iXG4gICAgICAgIH1cbiAgICB9LFxufSlcblxubW9kdWxlLmV4cG9ydHMgPSBSb2xlQ2FyZFxuIiwiLyoqIEBqc3ggUmVhY3QuRE9NICovXG5cbnZhciBQbGF5ZXJDaGlwID0gcmVxdWlyZSgnLi9wbGF5ZXItY2hpcC5qc3gnKVxudmFyIFBUID0gUmVhY3QuUHJvcFR5cGVzXG5cbnZhciBSb2xlUGxheWVyRW50cnkgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcHJvcFR5cGVzOiB7XG4gICAgICAgIG5hbWU6IFBULnN0cmluZy5pc1JlcXVpcmVkLFxuICAgICAgICBjb25maXJtZWQ6IFBULmJvb2wuaXNSZXF1aXJlZCxcbiAgICAgICAgc2VsZWN0ZWQ6IFBULmJvb2wuaXNSZXF1aXJlZCxcbiAgICAgICAgY29udGVudDogUFQuZWxlbWVudCxcblxuICAgICAgICBvbkNsaWNrU2hvdzogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgICAgICBvbkNsaWNrQ29uZmlybTogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgICAgICBvbkNsaWNrQmFjazogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgIH0sXG5cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gPGxpIGtleT17dGhpcy5wcm9wcy5uYW1lfT5cbiAgICAgICAgICAgIDxQbGF5ZXJDaGlwIG5hbWU9e3RoaXMucHJvcHMubmFtZX0gLz5cbiAgICAgICAgICAgIHt0aGlzLnJlbmRlckJ1dHRvbigpfVxuICAgICAgICAgICAge3RoaXMucHJvcHMuY29udGVudH1cbiAgICAgICAgPC9saT5cbiAgICB9LFxuXG4gICAgcmVuZGVyQnV0dG9uOiBmdW5jdGlvbigpIHtcblxuICAgICAgICB2YXIgY2xpY2tIYW5kbGVyID0gZnVuY3Rpb24oKSB7XG4gICAgICAgICAgICB0aGlzLnByb3BzLm9uQ2xpY2tTaG93KHRoaXMucHJvcHMubmFtZSlcbiAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICB2YXIgdGV4dCA9IFwiU2hvdyByb2xlXCI7XG5cbiAgICAgICAgaWYodGhpcy5wcm9wcy5jb25maXJtZWQpIHtcbiAgICAgICAgICAgIGNsaWNrSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMub25DbGlja0JhY2soKVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgdGV4dCA9IFwiSGlkZVwiO1xuICAgICAgICB9XG4gICAgICAgIGVsc2UgaWYgKHRoaXMucHJvcHMuc2VsZWN0ZWQpIHtcbiAgICAgICAgICAgIGNsaWNrSGFuZGxlciA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMub25DbGlja0NvbmZpcm0odGhpcy5wcm9wcy5uYW1lKVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpO1xuICAgICAgICAgICAgdGV4dCA9IFwiQXJlIHlvdSBcIiArIHRoaXMucHJvcHMubmFtZSArIFwiP1wiO1xuICAgICAgICB9XG5cbiAgICAgICAgcmV0dXJuIDxidXR0b24gb25DbGljaz17Y2xpY2tIYW5kbGVyfT57dGV4dH08L2J1dHRvbj5cbiAgICB9XG5cbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFJvbGVQbGF5ZXJFbnRyeVxuIiwiLyoqIEBqc3ggUmVhY3QuRE9NICovXG5cbnZhciBSb2xlUGxheWVyRW50cnkgPSByZXF1aXJlKCcuL3JvbGUtcGxheWVyLWVudHJ5LmpzeCcpXG52YXIgUm9sZUNhcmQgPSByZXF1aXJlKCcuL3JvbGUtY2FyZC5qc3gnKVxudmFyIFBUID0gUmVhY3QuUHJvcFR5cGVzXG5cbnZhciBSb2xlc1BhZ2UgPSBSZWFjdC5jcmVhdGVDbGFzcyh7XG4gICAgcHJvcFR5cGVzOiB7XG4gICAgICAgIGRpc2FibGVkUmVhc29uOiBQVC5vbmVPZihbJ3Rvb0ZldycsICd0b29NYW55J10pLFxuICAgICAgICBwbGF5ZXJOYW1lczogUFQuYXJyYXkuaXNSZXF1aXJlZCxcbiAgICAgICAgc2VsZWN0ZWRQbGF5ZXI6IFBULnN0cmluZyxcbiAgICAgICAgc2VsZWN0ZWRSb2xlOiBQVC5vYmplY3QsXG4gICAgICAgIHNlbGVjdGlvbkNvbmZpcm1lZDogUFQuYm9vbC5pc1JlcXVpcmVkLFxuICAgICAgICBvbkNsaWNrU2hvdzogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgICAgICBvbkNsaWNrQ29uZmlybTogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgICAgICBvbkNsaWNrQ2FuY2VsOiBQVC5mdW5jLmlzUmVxdWlyZWQsXG4gICAgICAgIG9uQ2xpY2tPazogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgIH0sXG5cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICBpZiAodGhpcy5wcm9wcy5kaXNhYmxlZFJlYXNvbiAhPT0gbnVsbCkge1xuICAgICAgICAgICAgdmFyIG1lc3NhZ2UgPSB7XG4gICAgICAgICAgICAgICAgdG9vRmV3OiBcIk5vdCBlbm91Z2ggcGxheWVycy4gOihcIixcbiAgICAgICAgICAgICAgICB0b29NYW55OiBcIlRvbyBtYW55IHBsYXllcnMuIDooXCIsXG4gICAgICAgICAgICB9W3RoaXMucHJvcHMuZGlzYWJsZWRSZWFzb25dXG4gICAgICAgICAgICByZXR1cm4gPHA+e21lc3NhZ2V9PC9wPlxuICAgICAgICB9XG5cbiAgICAgICAgdmFyIGVsZW1lbnRzID0gdGhpcy5wcm9wcy5wbGF5ZXJOYW1lcy5tYXAoZnVuY3Rpb24obmFtZSkge1xuICAgICAgICAgICAgcmV0dXJuIHRoaXMucmVuZGVyRW50cnkoXG4gICAgICAgICAgICAgICAgbmFtZSxcbiAgICAgICAgICAgICAgICB0aGlzLnByb3BzLnNlbGVjdGVkUGxheWVyID09PSBuYW1lLFxuICAgICAgICAgICAgICAgIHRoaXMucHJvcHMuc2VsZWN0aW9uQ29uZmlybWVkKVxuICAgICAgICB9LmJpbmQodGhpcykpXG5cbiAgICAgICAgcmV0dXJuIDx1bCBjbGFzc05hbWU9XCJwbGF5ZXItbGlzdFwiPlxuICAgICAgICAgICAge2VsZW1lbnRzfVxuICAgICAgICA8L3VsPlxuICAgIH0sXG5cbiAgICByZW5kZXJFbnRyeTogZnVuY3Rpb24obmFtZSwgc2VsZWN0ZWQsIGNvbmZpcm1lZCkge1xuXG4gICAgICAgIHZhciBjb250ZW50ID0gbnVsbDtcbiAgICAgICAgaWYgKHNlbGVjdGVkICYmIGNvbmZpcm1lZCkge1xuICAgICAgICAgICAgY29udGVudCA9IDxSb2xlQ2FyZFxuICAgICAgICAgICAgICAgIHBsYXllck5hbWU9e3RoaXMucHJvcHMuc2VsZWN0ZWRQbGF5ZXJ9XG4gICAgICAgICAgICAgICAgcm9sZT17dGhpcy5wcm9wcy5zZWxlY3RlZFJvbGV9IC8+XG4gICAgICAgIH1cblxuICAgICAgICByZXR1cm4gPFJvbGVQbGF5ZXJFbnRyeVxuICAgICAgICAgICAga2V5PXtuYW1lfVxuICAgICAgICAgICAgbmFtZT17bmFtZX1cbiAgICAgICAgICAgIGNvbnRlbnQ9e2NvbnRlbnR9XG4gICAgICAgICAgICBzZWxlY3RlZD17c2VsZWN0ZWR9XG4gICAgICAgICAgICBjb25maXJtZWQ9e3NlbGVjdGVkICYmIGNvbmZpcm1lZH1cblxuICAgICAgICAgICAgb25DbGlja1Nob3c9e3RoaXMucHJvcHMub25DbGlja1Nob3d9XG4gICAgICAgICAgICBvbkNsaWNrQ29uZmlybT17dGhpcy5wcm9wcy5vbkNsaWNrQ29uZmlybX1cbiAgICAgICAgICAgIG9uQ2xpY2tCYWNrPXt0aGlzLnByb3BzLm9uQ2xpY2tDYW5jZWx9IC8+XG5cbiAgICB9LFxufSk7XG5cbm1vZHVsZS5leHBvcnRzID0gUm9sZXNQYWdlXG4iLCIvKiogQGpzeCBSZWFjdC5ET00gKi9cblxudmFyIFBUID0gUmVhY3QuUHJvcFR5cGVzXG52YXIgY3ggPSBjbGFzc25hbWVzXG5cbnZhciBTZXR0aW5ncyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBwcm9wVHlwZXM6IHtcbiAgICAgICAgLy8gTWFwcGluZyBvZiBzZXR0aW5ncyB0byB0aGVpciB2YWx1ZXMuXG4gICAgICAgIHNldHRpbmdzOiBQVC5vYmplY3QuaXNSZXF1aXJlZCxcbiAgICAgICAgb25DaGFuZ2VTZXR0aW5nczogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgIH0sXG5cbiAgICByZW5kZXI6IGZ1bmN0aW9uKCkge1xuICAgICAgICB2YXIgc2V0dGluZ09yZGVyID0gWydtb3JnYW5hJywgJ21vcmRyZWQnLCAnb2Jlcm9uJywgJ21lcmxpbicsICdwZXJjaXZhbCddXG4gICAgICAgIHZhciBpdGVtcyA9IHNldHRpbmdPcmRlci5tYXAoZnVuY3Rpb24oc2V0dGluZykge1xuICAgICAgICAgICAgcmV0dXJuIDxsaSBrZXk9e3NldHRpbmd9PjxUb2dnbGVcbiAgICAgICAgICAgICAgICBzZXR0aW5nPXtzZXR0aW5nfVxuICAgICAgICAgICAgICAgIHZhbHVlPXt0aGlzLnByb3BzLnNldHRpbmdzW3NldHRpbmddfVxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlPXt0aGlzLm9uQ2hhbmdlU2V0dGluZ30gLz48L2xpPlxuICAgICAgICB9LmJpbmQodGhpcykpXG4gICAgICAgIHJldHVybiA8ZGl2IGNsYXNzTmFtZT1cInNldHRpbmdzXCI+XG4gICAgICAgICAgICA8aDI+U3BlY2lhbCBSb2xlczwvaDI+XG4gICAgICAgICAgICA8dWw+e2l0ZW1zfTwvdWw+XG4gICAgICAgIDwvZGl2PlxuICAgIH0sXG5cbiAgICBvbkNoYW5nZVNldHRpbmc6IGZ1bmN0aW9uKHNldHRpbmcpIHtcbiAgICAgICAgdmFyIGNoYW5nZXMgPSB7fVxuICAgICAgICBjaGFuZ2VzW3NldHRpbmddID0gIXRoaXMucHJvcHMuc2V0dGluZ3Nbc2V0dGluZ11cbiAgICAgICAgdGhpcy5wcm9wcy5vbkNoYW5nZVNldHRpbmdzKGNoYW5nZXMpXG4gICAgfSxcbn0pO1xuXG52YXIgVG9nZ2xlID0gUmVhY3QuY3JlYXRlQ2xhc3Moe1xuICAgIHByb3BUeXBlczoge1xuICAgICAgICBzZXR0aW5nOiBQVC5zdHJpbmcuaXNSZXF1aXJlZCxcbiAgICAgICAgdmFsdWU6IFBULmJvb2wuaXNSZXF1aXJlZCxcbiAgICAgICAgb25DaGFuZ2U6IFBULmZ1bmMuaXNSZXF1aXJlZCxcbiAgICB9LFxuXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgcmV0dXJuIDxidXR0b25cbiAgICAgICAgICAgIGNsYXNzTmFtZT17Y3goe1xuICAgICAgICAgICAgICAgICd0b2dnbGUnOiB0cnVlLFxuICAgICAgICAgICAgICAgICdhY3RpdmUnOiB0aGlzLnByb3BzLnZhbHVlLFxuICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICBvbkNsaWNrPXt0aGlzLm9uQ2xpY2t9PlxuICAgICAgICAgICAge2NhcGl0YWxpemUodGhpcy5wcm9wcy5zZXR0aW5nKX1cbiAgICAgICAgPC9idXR0b24+XG4gICAgfSxcblxuICAgIG9uQ2xpY2s6IGZ1bmN0aW9uKCkge1xuICAgICAgICB0aGlzLnByb3BzLm9uQ2hhbmdlKHRoaXMucHJvcHMuc2V0dGluZylcbiAgICB9LFxufSk7XG5cbmZ1bmN0aW9uIGNhcGl0YWxpemUoc3RyaW5nKSB7XG4gICAgcmV0dXJuIHN0cmluZy5jaGFyQXQoMCkudG9VcHBlckNhc2UoKSArIHN0cmluZy5zbGljZSgxKTtcbn1cblxubW9kdWxlLmV4cG9ydHMgPSBTZXR0aW5nc1xuIiwiLyoqIEBqc3ggUmVhY3QuRE9NICovXG5cbnZhciBTZXR1cFBsYXllckxpc3QgPSByZXF1aXJlKCcuL3NldHVwLXBsYXllci1saXN0LmpzeCcpXG52YXIgU2V0dGluZ3MgPSByZXF1aXJlKCcuL3NldHRpbmdzLmpzeCcpXG52YXIgUFQgPSBSZWFjdC5Qcm9wVHlwZXNcblxudmFyIFNldHVwUGFnZSA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBwcm9wVHlwZXM6IHtcbiAgICAgICAgcGxheWVyTmFtZXM6IFBULmFycmF5LmlzUmVxdWlyZWQsXG4gICAgICAgIC8vIE1hcHBpbmcgb2Ygc2V0dGluZ3MgdG8gdGhlaXIgdmFsdWVzLlxuICAgICAgICBzZXR0aW5nczogUFQub2JqZWN0LmlzUmVxdWlyZWQsXG4gICAgICAgIG9uQWRkTmFtZTogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgICAgICBvbkRlbGV0ZU5hbWU6IFBULmZ1bmMuaXNSZXF1aXJlZCxcbiAgICAgICAgb25DaGFuZ2VTZXR0aW5nczogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgICAgICBvbk5ld1JvbGVzOiBQVC5mdW5jLmlzUmVxdWlyZWQsXG4gICAgfSxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiA8ZGl2PlxuICAgICAgICAgICAgPFNldHVwUGxheWVyTGlzdFxuICAgICAgICAgICAgICAgIHBsYXllck5hbWVzPXt0aGlzLnByb3BzLnBsYXllck5hbWVzfVxuICAgICAgICAgICAgICAgIG9uQWRkTmFtZT17dGhpcy5wcm9wcy5vbkFkZE5hbWV9XG4gICAgICAgICAgICAgICAgb25EZWxldGVOYW1lPXt0aGlzLnByb3BzLm9uRGVsZXRlTmFtZX0gLz5cbiAgICAgICAgICAgIDxTZXR0aW5nc1xuICAgICAgICAgICAgICAgIHNldHRpbmdzPXt0aGlzLnByb3BzLnNldHRpbmdzfVxuICAgICAgICAgICAgICAgIG9uQ2hhbmdlU2V0dGluZ3M9e3RoaXMucHJvcHMub25DaGFuZ2VTZXR0aW5nc30gLz5cbiAgICAgICAgICAgIDxidXR0b24gY2xhc3NOYW1lPVwibmV3LWdhbWVcIlxuICAgICAgICAgICAgICAgIG9uQ2xpY2s9e3RoaXMucHJvcHMub25OZXdSb2xlc30+TmV3IEdhbWU8L2J1dHRvbj5cbiAgICAgICAgPC9kaXY+XG4gICAgfSxcbn0pO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFNldHVwUGFnZVxuIiwiLyoqIEBqc3ggUmVhY3QuRE9NICovXG5cbnZhciBOZXdOYW1lID0gcmVxdWlyZSgnLi9uZXctbmFtZS5qc3gnKVxudmFyIFBsYXllckNoaXAgPSByZXF1aXJlKCcuL3BsYXllci1jaGlwLmpzeCcpXG52YXIgUFQgPSBSZWFjdC5Qcm9wVHlwZXNcblxudmFyIFNldHVwUGxheWVyTGlzdCA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBwcm9wVHlwZXM6IHtcbiAgICAgICAgcGxheWVyTmFtZXM6IFBULmFycmF5LmlzUmVxdWlyZWQsXG4gICAgICAgIG9uRGVsZXRlTmFtZTogUFQuZnVuYy5pc1JlcXVpcmVkLFxuICAgICAgICBvbkFkZE5hbWU6IFBULmZ1bmMuaXNSZXF1aXJlZCxcbiAgICB9LFxuXG4gICAgcmVuZGVyOiBmdW5jdGlvbigpIHtcbiAgICAgICAgdmFyIGVsZW1lbnRzID0gdGhpcy5wcm9wcy5wbGF5ZXJOYW1lcy5tYXAoXG4gICAgICAgICAgICB0aGlzLnJlbmRlckVudHJ5KVxuXG4gICAgICAgIHJldHVybiA8ZGl2PjxoMj5QbGF5ZXJzPC9oMj5cbiAgICAgICAgICAgIDx1bCBjbGFzc05hbWU9XCJwbGF5ZXItbGlzdFwiPlxuICAgICAgICAgICAgICAgIHtlbGVtZW50c31cbiAgICAgICAgICAgICAgICA8bGk+XG4gICAgICAgICAgICAgICAgICAgIDxOZXdOYW1lIG9uQWRkTmFtZT17dGhpcy5wcm9wcy5vbkFkZE5hbWV9IC8+XG4gICAgICAgICAgICAgICAgPC9saT5cbiAgICAgICAgICAgIDwvdWw+XG4gICAgICAgIDwvZGl2PlxuICAgIH0sXG5cbiAgICByZW5kZXJFbnRyeTogZnVuY3Rpb24obmFtZSkge1xuICAgICAgICB2YXIgb25DbGljayA9IGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5wcm9wcy5vbkRlbGV0ZU5hbWUobmFtZSk7XG4gICAgICAgIH0uYmluZCh0aGlzKTtcblxuICAgICAgICByZXR1cm4gPGxpIGtleT17bmFtZX0+XG4gICAgICAgICAgICA8UGxheWVyQ2hpcCBuYW1lPXtuYW1lfSAvPlxuICAgICAgICAgICAgPGJ1dHRvbiBjbGFzc05hbWU9J2RlbGV0ZSdcbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtvbkNsaWNrfT5cbiAgICAgICAgICAgIDwvYnV0dG9uPlxuICAgICAgICA8L2xpPlxuICAgIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBTZXR1cFBsYXllckxpc3RcbiIsIm1vZHVsZS5leHBvcnRzID0gc3RvcmVfcmVzZXRcblxuZnVuY3Rpb24gc3RvcmVfcmVzZXQodmVyc2lvbikge1xuICAgIHZhciBzdG9yZWQgPSBzdG9yZS5nZXQoJ1NUT1JFX0RCX1ZFUlNJT04nKVxuICAgIGlmIChzdG9yZWQgPT09IHZlcnNpb24pIHtcbiAgICAgICAgcmV0dXJuXG4gICAgfSBlbHNlIHtcbiAgICAgICAgc3RvcmUuY2xlYXIoKVxuICAgICAgICBzdG9yZS5zZXQoJ1NUT1JFX0RCX1ZFUlNJT04nLCB2ZXJzaW9uKVxuICAgIH1cbn1cblxuLy8jIHNvdXJjZU1hcHBpbmdVUkw9ZGF0YTphcHBsaWNhdGlvbi9qc29uO2Jhc2U2NCxleUoyWlhKemFXOXVJam96TENKbWFXeGxJam9pTDJodmJXVXZiV2xzWlhNdlkyOWtaUzl5WldGamRHRnVZMlV2YzJOeWFYQjBjeTl6ZEc5eVpTMXlaWE5sZEM1cWN5SXNJbk52ZFhKalpYTWlPbHNpTDJodmJXVXZiV2xzWlhNdlkyOWtaUzl5WldGamRHRnVZMlV2YzJOeWFYQjBjeTl6ZEc5eVpTMXlaWE5sZEM1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaVFVRkJRU3hOUVVGTkxFTkJRVU1zVDBGQlR5eEhRVUZITEZkQlFWYzdPMEZCUlRWQ0xGTkJRVk1zVjBGQlZ5eERRVUZETEU5QlFVOHNSVUZCUlR0SlFVTXhRaXhKUVVGSkxFMUJRVTBzUjBGQlJ5eExRVUZMTEVOQlFVTXNSMEZCUnl4RFFVRkRMR3RDUVVGclFpeERRVUZETzBsQlF6RkRMRWxCUVVrc1RVRkJUU3hMUVVGTExFOUJRVThzUlVGQlJUdFJRVU53UWl4TlFVRk5PMHRCUTFRc1RVRkJUVHRSUVVOSUxFdEJRVXNzUTBGQlF5eExRVUZMTEVWQlFVVTdVVUZEWWl4TFFVRkxMRU5CUVVNc1IwRkJSeXhEUVVGRExHdENRVUZyUWl4RlFVRkZMRTlCUVU4c1EwRkJRenRMUVVONlF6dERRVU5LSWl3aWMyOTFjbU5sYzBOdmJuUmxiblFpT2xzaWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCemRHOXlaVjl5WlhObGRGeHVYRzVtZFc1amRHbHZiaUJ6ZEc5eVpWOXlaWE5sZENoMlpYSnphVzl1S1NCN1hHNGdJQ0FnZG1GeUlITjBiM0psWkNBOUlITjBiM0psTG1kbGRDZ25VMVJQVWtWZlJFSmZWa1ZTVTBsUFRpY3BYRzRnSUNBZ2FXWWdLSE4wYjNKbFpDQTlQVDBnZG1WeWMybHZiaWtnZTF4dUlDQWdJQ0FnSUNCeVpYUjFjbTVjYmlBZ0lDQjlJR1ZzYzJVZ2UxeHVJQ0FnSUNBZ0lDQnpkRzl5WlM1amJHVmhjaWdwWEc0Z0lDQWdJQ0FnSUhOMGIzSmxMbk5sZENnblUxUlBVa1ZmUkVKZlZrVlNVMGxQVGljc0lIWmxjbk5wYjI0cFhHNGdJQ0FnZlZ4dWZWeHVJbDE5IiwidmFyIEJhY2tib25lRXZlbnRzID0gcmVxdWlyZShcImJhY2tib25lLWV2ZW50cy1zdGFuZGFsb25lXCIpO1xuXG5tb2R1bGUuZXhwb3J0cyA9IFN0b3JlXG5cbmZ1bmN0aW9uIFN0b3JlKCkge1xuICAgIHRoaXMuX2V2ZW50ZXIgPSBCYWNrYm9uZUV2ZW50cy5taXhpbih7fSlcbiAgICB0aGlzLl9lbWl0Q2hhbmdlQmF0Y2hlciA9IG51bGxcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhIGNhbGxiYWNrIHRvIGZpcmUgb24gY2hhbmdlIGV2ZW50cy5cbiAqL1xuU3RvcmUucHJvdG90eXBlLm9uQ2hhbmdlID0gZnVuY3Rpb24oY2FsbGJhY2spIHtcbiAgICB0aGlzLl9ldmVudGVyLm9uKCdjaGFuZ2UnLCBjYWxsYmFjaylcbn1cblxuLyoqXG4gKiBVbnJlZ2lzdGVyIGEgY2FsbGJhY2sgcHJldmlvdXNseSByZWdpc3RlcmQgd2l0aCBvbkNoYW5nZS5cbiAqL1xuU3RvcmUucHJvdG90eXBlLm9mZkNoYW5nZSA9IGZ1bmN0aW9uKGNhbGxiYWNrKSB7XG4gICAgdGhpcy5fZXZlbnRlci5vZmYoJ2NoYW5nZScsIGNhbGxiYWNrKVxufVxuXG4vKipcbiAqIEZpcmUgYSBjaGFuZ2UgZXZlbnQgZm9yIHRoaXMgc3RvcmVcbiAqIFRoaXMgc2hvdWxkIHByb2JhYmx5IG9ubHkgYmUgY2FsbGVkIGJ5IHRoZSBzdG9yZSBpdHNlbGZcbiAqIGFmdGVyIGl0IG11dGF0ZXMgc3RhdGUuXG4gKlxuICogVGhlc2UgYXJlIGJhdGNoZWQgdXNpbmcgc2V0VGltZW91dC5cbiAqIEkgZG9uJ3QgYWN0dWFsbHkga25vdyBlbm91Z2ggdG8ga25vdyB3aGV0aGVyIHRoaXMgaXMgYSBnb29kIGlkZWEuXG4gKiBCdXQgaXQncyBmdW4gdG8gdGhpbmsgYWJvdXQuXG4gKiBUaGlzIGlzIE5PVCBkb25lIGZvciBwZXJmb3JtYW5jZSwgYnV0IHRvIG9ubHkgZW1pdCBjaGFuZ2VzXG4gKiB3aGVuIHRoZSBzdG9yZSBoYXMgc2V0dGxlZCBpbnRvIGEgY29uc2lzdGVudCBzdGF0ZS5cbiAqL1xuU3RvcmUucHJvdG90eXBlLmVtaXRDaGFuZ2UgPSBmdW5jdGlvbigpIHtcbiAgICBpZiAodGhpcy5fZW1pdENoYW5nZUJhdGNoZXIgPT09IG51bGwpIHtcbiAgICAgICAgdGhpcy5fZW1pdENoYW5nZUJhdGNoZXIgPSBzZXRUaW1lb3V0KGZ1bmN0aW9uKCkge1xuICAgICAgICAgICAgdGhpcy5fZXZlbnRlci50cmlnZ2VyKCdjaGFuZ2UnKVxuICAgICAgICAgICAgdGhpcy5fZW1pdENoYW5nZUJhdGNoZXIgPSBudWxsXG4gICAgICAgIH0uYmluZCh0aGlzKSwgMTApXG4gICAgfVxufVxuXG4vKipcbiAqIE1peCBpbnRvIGFuIG9iamVjdCB0byBtYWtlIGl0IGEgc3RvcmUuXG4gKiBFeGFtcGxlOlxuICogZnVuY3Rpb24gQXdlc29tZVN0b3JlKCkge1xuICogICBTdG9yZS5taXhpbih0aGlzKVxuICogfVxuICovXG5TdG9yZS5taXhpbiA9IGZ1bmN0aW9uKG9iaikge1xuICAgIHZhciBzdG9yZSA9IG5ldyBTdG9yZSgpXG4gICAgb2JqLm9uQ2hhbmdlID0gc3RvcmUub25DaGFuZ2UuYmluZChzdG9yZSlcbiAgICBvYmoub2ZmQ2hhbmdlID0gc3RvcmUub2ZmQ2hhbmdlLmJpbmQoc3RvcmUpXG4gICAgb2JqLmVtaXRDaGFuZ2UgPSBzdG9yZS5lbWl0Q2hhbmdlLmJpbmQoc3RvcmUpXG59XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaUwyaHZiV1V2Yldsc1pYTXZZMjlrWlM5eVpXRmpkR0Z1WTJVdmMyTnlhWEIwY3k5emRHOXlaUzVxY3lJc0luTnZkWEpqWlhNaU9sc2lMMmh2YldVdmJXbHNaWE12WTI5a1pTOXlaV0ZqZEdGdVkyVXZjMk55YVhCMGN5OXpkRzl5WlM1cWN5SmRMQ0p1WVcxbGN5STZXMTBzSW0xaGNIQnBibWR6SWpvaVFVRkJRU3hKUVVGSkxHTkJRV01zUjBGQlJ5eFBRVUZQTEVOQlFVTXNORUpCUVRSQ0xFTkJRVU1zUTBGQlF6czdRVUZGTTBRc1RVRkJUU3hEUVVGRExFOUJRVThzUjBGQlJ5eExRVUZMT3p0QlFVVjBRaXhUUVVGVExFdEJRVXNzUjBGQlJ6dEpRVU5pTEVsQlFVa3NRMEZCUXl4UlFVRlJMRWRCUVVjc1kwRkJZeXhEUVVGRExFdEJRVXNzUTBGQlF5eEZRVUZGTEVOQlFVTTdTVUZEZUVNc1NVRkJTU3hEUVVGRExHdENRVUZyUWl4SFFVRkhMRWxCUVVrN1FVRkRiRU1zUTBGQlF6czdRVUZGUkRzN1IwRkZSenRCUVVOSUxFdEJRVXNzUTBGQlF5eFRRVUZUTEVOQlFVTXNVVUZCVVN4SFFVRkhMRk5CUVZNc1VVRkJVU3hGUVVGRk8wbEJRekZETEVsQlFVa3NRMEZCUXl4UlFVRlJMRU5CUVVNc1JVRkJSU3hEUVVGRExGRkJRVkVzUlVGQlJTeFJRVUZSTEVOQlFVTTdRVUZEZUVNc1EwRkJRenM3UVVGRlJEczdSMEZGUnp0QlFVTklMRXRCUVVzc1EwRkJReXhUUVVGVExFTkJRVU1zVTBGQlV5eEhRVUZITEZOQlFWTXNVVUZCVVN4RlFVRkZPMGxCUXpORExFbEJRVWtzUTBGQlF5eFJRVUZSTEVOQlFVTXNSMEZCUnl4RFFVRkRMRkZCUVZFc1JVRkJSU3hSUVVGUkxFTkJRVU03UVVGRGVrTXNRMEZCUXpzN1FVRkZSRHRCUVVOQk8wRkJRMEU3UVVGRFFUdEJRVU5CTzBGQlEwRTdRVUZEUVR0QlFVTkJPMEZCUTBFN08wZEJSVWM3UVVGRFNDeExRVUZMTEVOQlFVTXNVMEZCVXl4RFFVRkRMRlZCUVZVc1IwRkJSeXhYUVVGWE8wbEJRM0JETEVsQlFVa3NTVUZCU1N4RFFVRkRMR3RDUVVGclFpeExRVUZMTEVsQlFVa3NSVUZCUlR0UlFVTnNReXhKUVVGSkxFTkJRVU1zYTBKQlFXdENMRWRCUVVjc1ZVRkJWU3hEUVVGRExGZEJRVmM3V1VGRE5VTXNTVUZCU1N4RFFVRkRMRkZCUVZFc1EwRkJReXhQUVVGUExFTkJRVU1zVVVGQlVTeERRVUZETzFsQlF5OUNMRWxCUVVrc1EwRkJReXhyUWtGQmEwSXNSMEZCUnl4SlFVRkpPMU5CUTJwRExFTkJRVU1zU1VGQlNTeERRVUZETEVsQlFVa3NRMEZCUXl4RlFVRkZMRVZCUVVVc1EwRkJRenRMUVVOd1FqdEJRVU5NTEVOQlFVTTdPMEZCUlVRN1FVRkRRVHRCUVVOQk8wRkJRMEU3UVVGRFFUczdSMEZGUnp0QlFVTklMRXRCUVVzc1EwRkJReXhMUVVGTExFZEJRVWNzVTBGQlV5eEhRVUZITEVWQlFVVTdTVUZEZUVJc1NVRkJTU3hMUVVGTExFZEJRVWNzU1VGQlNTeExRVUZMTEVWQlFVVTdTVUZEZGtJc1IwRkJSeXhEUVVGRExGRkJRVkVzUjBGQlJ5eExRVUZMTEVOQlFVTXNVVUZCVVN4RFFVRkRMRWxCUVVrc1EwRkJReXhMUVVGTExFTkJRVU03U1VGRGVrTXNSMEZCUnl4RFFVRkRMRk5CUVZNc1IwRkJSeXhMUVVGTExFTkJRVU1zVTBGQlV5eERRVUZETEVsQlFVa3NRMEZCUXl4TFFVRkxMRU5CUVVNN1NVRkRNME1zUjBGQlJ5eERRVUZETEZWQlFWVXNSMEZCUnl4TFFVRkxMRU5CUVVNc1ZVRkJWU3hEUVVGRExFbEJRVWtzUTBGQlF5eExRVUZMTEVOQlFVTTdRMEZEYUVRaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SjJZWElnUW1GamEySnZibVZGZG1WdWRITWdQU0J5WlhGMWFYSmxLRndpWW1GamEySnZibVV0WlhabGJuUnpMWE4wWVc1a1lXeHZibVZjSWlrN1hHNWNibTF2WkhWc1pTNWxlSEJ2Y25SeklEMGdVM1J2Y21WY2JseHVablZ1WTNScGIyNGdVM1J2Y21Vb0tTQjdYRzRnSUNBZ2RHaHBjeTVmWlhabGJuUmxjaUE5SUVKaFkydGliMjVsUlhabGJuUnpMbTFwZUdsdUtIdDlLVnh1SUNBZ0lIUm9hWE11WDJWdGFYUkRhR0Z1WjJWQ1lYUmphR1Z5SUQwZ2JuVnNiRnh1ZlZ4dVhHNHZLaXBjYmlBcUlGSmxaMmx6ZEdWeUlHRWdZMkZzYkdKaFkyc2dkRzhnWm1seVpTQnZiaUJqYUdGdVoyVWdaWFpsYm5SekxseHVJQ292WEc1VGRHOXlaUzV3Y205MGIzUjVjR1V1YjI1RGFHRnVaMlVnUFNCbWRXNWpkR2x2YmloallXeHNZbUZqYXlrZ2UxeHVJQ0FnSUhSb2FYTXVYMlYyWlc1MFpYSXViMjRvSjJOb1lXNW5aU2NzSUdOaGJHeGlZV05yS1Z4dWZWeHVYRzR2S2lwY2JpQXFJRlZ1Y21WbmFYTjBaWElnWVNCallXeHNZbUZqYXlCd2NtVjJhVzkxYzJ4NUlISmxaMmx6ZEdWeVpDQjNhWFJvSUc5dVEyaGhibWRsTGx4dUlDb3ZYRzVUZEc5eVpTNXdjbTkwYjNSNWNHVXViMlptUTJoaGJtZGxJRDBnWm5WdVkzUnBiMjRvWTJGc2JHSmhZMnNwSUh0Y2JpQWdJQ0IwYUdsekxsOWxkbVZ1ZEdWeUxtOW1aaWduWTJoaGJtZGxKeXdnWTJGc2JHSmhZMnNwWEc1OVhHNWNiaThxS2x4dUlDb2dSbWx5WlNCaElHTm9ZVzVuWlNCbGRtVnVkQ0JtYjNJZ2RHaHBjeUJ6ZEc5eVpWeHVJQ29nVkdocGN5QnphRzkxYkdRZ2NISnZZbUZpYkhrZ2IyNXNlU0JpWlNCallXeHNaV1FnWW5rZ2RHaGxJSE4wYjNKbElHbDBjMlZzWmx4dUlDb2dZV1owWlhJZ2FYUWdiWFYwWVhSbGN5QnpkR0YwWlM1Y2JpQXFYRzRnS2lCVWFHVnpaU0JoY21VZ1ltRjBZMmhsWkNCMWMybHVaeUJ6WlhSVWFXMWxiM1YwTGx4dUlDb2dTU0JrYjI0bmRDQmhZM1IxWVd4c2VTQnJibTkzSUdWdWIzVm5hQ0IwYnlCcmJtOTNJSGRvWlhSb1pYSWdkR2hwY3lCcGN5QmhJR2R2YjJRZ2FXUmxZUzVjYmlBcUlFSjFkQ0JwZENkeklHWjFiaUIwYnlCMGFHbHVheUJoWW05MWRDNWNiaUFxSUZSb2FYTWdhWE1nVGs5VUlHUnZibVVnWm05eUlIQmxjbVp2Y20xaGJtTmxMQ0JpZFhRZ2RHOGdiMjVzZVNCbGJXbDBJR05vWVc1blpYTmNiaUFxSUhkb1pXNGdkR2hsSUhOMGIzSmxJR2hoY3lCelpYUjBiR1ZrSUdsdWRHOGdZU0JqYjI1emFYTjBaVzUwSUhOMFlYUmxMbHh1SUNvdlhHNVRkRzl5WlM1d2NtOTBiM1I1Y0dVdVpXMXBkRU5vWVc1blpTQTlJR1oxYm1OMGFXOXVLQ2tnZTF4dUlDQWdJR2xtSUNoMGFHbHpMbDlsYldsMFEyaGhibWRsUW1GMFkyaGxjaUE5UFQwZ2JuVnNiQ2tnZTF4dUlDQWdJQ0FnSUNCMGFHbHpMbDlsYldsMFEyaGhibWRsUW1GMFkyaGxjaUE5SUhObGRGUnBiV1Z2ZFhRb1puVnVZM1JwYjI0b0tTQjdYRzRnSUNBZ0lDQWdJQ0FnSUNCMGFHbHpMbDlsZG1WdWRHVnlMblJ5YVdkblpYSW9KMk5vWVc1blpTY3BYRzRnSUNBZ0lDQWdJQ0FnSUNCMGFHbHpMbDlsYldsMFEyaGhibWRsUW1GMFkyaGxjaUE5SUc1MWJHeGNiaUFnSUNBZ0lDQWdmUzVpYVc1a0tIUm9hWE1wTENBeE1DbGNiaUFnSUNCOVhHNTlYRzVjYmk4cUtseHVJQ29nVFdsNElHbHVkRzhnWVc0Z2IySnFaV04wSUhSdklHMWhhMlVnYVhRZ1lTQnpkRzl5WlM1Y2JpQXFJRVY0WVcxd2JHVTZYRzRnS2lCbWRXNWpkR2x2YmlCQmQyVnpiMjFsVTNSdmNtVW9LU0I3WEc0Z0tpQWdJRk4wYjNKbExtMXBlR2x1S0hSb2FYTXBYRzRnS2lCOVhHNGdLaTljYmxOMGIzSmxMbTFwZUdsdUlEMGdablZ1WTNScGIyNG9iMkpxS1NCN1hHNGdJQ0FnZG1GeUlITjBiM0psSUQwZ2JtVjNJRk4wYjNKbEtDbGNiaUFnSUNCdlltb3ViMjVEYUdGdVoyVWdQU0J6ZEc5eVpTNXZia05vWVc1blpTNWlhVzVrS0hOMGIzSmxLVnh1SUNBZ0lHOWlhaTV2Wm1aRGFHRnVaMlVnUFNCemRHOXlaUzV2Wm1aRGFHRnVaMlV1WW1sdVpDaHpkRzl5WlNsY2JpQWdJQ0J2WW1vdVpXMXBkRU5vWVc1blpTQTlJSE4wYjNKbExtVnRhWFJEYUdGdVoyVXVZbWx1WkNoemRHOXlaU2xjYm4xY2JpSmRmUT09IiwiLyoqIEBqc3ggUmVhY3QuRE9NICovXG5cbnZhciBQVCA9IFJlYWN0LlByb3BUeXBlc1xudmFyIGN4ID0gY2xhc3NuYW1lc1xuXG52YXIgVGFicyA9IFJlYWN0LmNyZWF0ZUNsYXNzKHtcbiAgICBwcm9wVHlwZXM6IHtcbiAgICAgICAgYWN0aXZlVGFiOiBQVC5zdHJpbmcuaXNSZXF1aXJlZCxcbiAgICAgICAgb25DaGFuZ2VUYWI6IFBULmZ1bmMuaXNSZXF1aXJlZCxcbiAgICAgICAgdGFiczogUFQub2JqZWN0LmlzUmVxdWlyZWQsXG4gICAgfSxcblxuICAgIHJlbmRlcjogZnVuY3Rpb24oKSB7XG4gICAgICAgIHJldHVybiA8ZGl2PlxuICAgICAgICAgICAgPG5hdj5cbiAgICAgICAgICAgIHt0aGlzLnJlbmRlckJ1dHRvbnMoKX1cbiAgICAgICAgICAgIDwvbmF2PlxuICAgICAgICAgICAgPGRpdiBjbGFzc05hbWU9XCJ0YWItY29udGVudHNcIj5cbiAgICAgICAgICAgIHt0aGlzLnByb3BzLnRhYnNbdGhpcy5wcm9wcy5hY3RpdmVUYWJdLmNvbnRlbnR9XG4gICAgICAgICAgICA8L2Rpdj5cbiAgICAgICAgPC9kaXY+XG4gICAgfSxcblxuICAgIHJlbmRlckJ1dHRvbnM6IGZ1bmN0aW9uKCkge1xuICAgICAgICByZXR1cm4gXy5tYXAodGhpcy5wcm9wcy50YWJzLCBmdW5jdGlvbih2YWwsIG5hbWUpIHtcbiAgICAgICAgICAgIHZhciBjaGFuZ2VUYWIgPSBmdW5jdGlvbihlKSB7XG4gICAgICAgICAgICAgICAgdGhpcy5wcm9wcy5vbkNoYW5nZVRhYihuYW1lKVxuICAgICAgICAgICAgfS5iaW5kKHRoaXMpXG5cbiAgICAgICAgICAgIHJldHVybiA8YVxuICAgICAgICAgICAgICAgIGNsYXNzTmFtZT17Y3goe1xuICAgICAgICAgICAgICAgICAgICAnYWN0aXZlJzogdGhpcy5wcm9wcy5hY3RpdmVUYWIgPT09IG5hbWUsXG4gICAgICAgICAgICAgICAgfSl9XG4gICAgICAgICAgICAgICAga2V5PXtuYW1lfVxuICAgICAgICAgICAgICAgIGRhdGEtbmFtZT17bmFtZX1cbiAgICAgICAgICAgICAgICBvbkNsaWNrPXtjaGFuZ2VUYWJ9XG4gICAgICAgICAgICAgICAgb25Ub3VjaFN0YXJ0PXtjaGFuZ2VUYWJ9ID5cbiAgICAgICAgICAgICAgICB7dmFsLm5hbWV9PC9hPlxuICAgICAgICB9LmJpbmQodGhpcykpIFxuICAgIH0sXG59KTtcblxubW9kdWxlLmV4cG9ydHMgPSBUYWJzXG4iLCJ2YXIgU3RvcmUgPSByZXF1aXJlKCcuL3N0b3JlJylcblxubW9kdWxlLmV4cG9ydHMgPSBVSVN0YXRlXG5cbmZ1bmN0aW9uIFVJU3RhdGUoZGlzcGF0Y2hlcikge1xuICAgIFN0b3JlLm1peGluKHRoaXMpXG5cbiAgICB0aGlzLnRhYiA9ICdzZXR1cCdcbiAgICB0aGlzLnNlbGVjdGVkUGxheWVyID0gbnVsbFxuICAgIHRoaXMuc2VsZWN0aW9uQ29uZmlybWVkID0gZmFsc2VcbiAgICB0aGlzLm1pc3Npb25SZXZlYWxlZCA9IGZhbHNlXG5cbiAgICBkaXNwYXRjaGVyLm9uQWN0aW9uKGZ1bmN0aW9uKHBheWxvYWQpIHtcbiAgICAgICAgdmFyIGFjdGlvbnMgPSBVSVN0YXRlLmFjdGlvbnNcbiAgICAgICAgaWYgKF8uaXNGdW5jdGlvbihhY3Rpb25zW3BheWxvYWQuYWN0aW9uXSkpIHtcbiAgICAgICAgICAgIGFjdGlvbnNbcGF5bG9hZC5hY3Rpb25dLmNhbGwodGhpcywgcGF5bG9hZClcbiAgICAgICAgICAgIHRoaXMuc2F2ZSgpXG4gICAgICAgIH1cbiAgICB9LmJpbmQodGhpcykpXG59XG5cbnZhciBQRVJTSVNUX0tFWVMgPSBbJ3RhYicsICdzZWxlY3RlZFBsYXllcicsICdzZWxlY3Rpb25Db25maXJtZWQnLCAnbWlzc2lvblJldmVhbGVkJ11cblxuVUlTdGF0ZS5wcm90b3R5cGUuc2F2ZSA9IGZ1bmN0aW9uKCkge1xuICAgIHZhciBwZXJzaXN0ID0ge31cbiAgICBQRVJTSVNUX0tFWVMuZm9yRWFjaChrZXkgPT4gcGVyc2lzdFtrZXldID0gdGhpc1trZXldKVxuICAgIHN0b3JlLnNldCgnc3RvcmUudWlzdGF0ZScsIHBlcnNpc3QpXG59XG5cblVJU3RhdGUucHJvdG90eXBlLmxvYWQgPSBmdW5jdGlvbigpIHtcbiAgICB2YXIgcGVyc2lzdCA9IHN0b3JlLmdldCgnc3RvcmUudWlzdGF0ZScpXG4gICAgaWYgKHBlcnNpc3QgIT09IHVuZGVmaW5lZCkge1xuICAgICAgICBQRVJTSVNUX0tFWVMuZm9yRWFjaChrZXkgPT4gdGhpc1trZXldID0gcGVyc2lzdFtrZXldKVxuICAgIH1cbn1cblxuXG5VSVN0YXRlLmFjdGlvbnMgPSB7fVxuXG5VSVN0YXRlLmFjdGlvbnMuY2hhbmdlVGFiID0gZnVuY3Rpb24oe3RhYn0pIHtcbiAgICB0aGlzLnRhYiA9IHRhYlxuICAgIHRoaXMuc2VsZWN0ZWRQbGF5ZXIgPSBudWxsXG4gICAgdGhpcy5zZWxlY3Rpb25Db25maXJtZWQgPSBmYWxzZVxuICAgIHRoaXMuZW1pdENoYW5nZSgpXG59XG5cblVJU3RhdGUuYWN0aW9ucy5zZWxlY3RQbGF5ZXIgPSBmdW5jdGlvbih7bmFtZX0pIHtcbiAgICB0aGlzLnNlbGVjdGVkUGxheWVyID0gbmFtZVxuICAgIHRoaXMuc2VsZWN0aW9uQ29uZmlybWVkID0gZmFsc2VcbiAgICB0aGlzLmVtaXRDaGFuZ2UoKVxufVxuXG5VSVN0YXRlLmFjdGlvbnMuY29uZmlybVBsYXllciA9IGZ1bmN0aW9uKHtuYW1lfSkge1xuICAgIHRoaXMuc2VsZWN0ZWRQbGF5ZXIgPSBuYW1lXG4gICAgdGhpcy5zZWxlY3Rpb25Db25maXJtZWQgPSB0cnVlXG4gICAgdGhpcy5lbWl0Q2hhbmdlKClcbn1cblxuVUlTdGF0ZS5hY3Rpb25zLmRlc2VsZWN0UGxheWVyID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5zZWxlY3RlZFBsYXllciA9IG51bGxcbiAgICB0aGlzLnNlbGVjdGlvbkNvbmZpcm1lZCA9IGZhbHNlXG4gICAgdGhpcy5lbWl0Q2hhbmdlKClcbn1cblxuVUlTdGF0ZS5hY3Rpb25zLm1pc3Npb25SZXZlYWwgPSBmdW5jdGlvbigpIHtcbiAgICB0aGlzLm1pc3Npb25SZXZlYWxlZCA9IHRydWVcbiAgICB0aGlzLmVtaXRDaGFuZ2UoKVxufVxuXG5VSVN0YXRlLmFjdGlvbnMubWlzc2lvblJlc2V0ID0gZnVuY3Rpb24oKSB7XG4gICAgdGhpcy5taXNzaW9uUmV2ZWFsZWQgPSBmYWxzZVxuICAgIHRoaXMuZW1pdENoYW5nZSgpXG59XG5cblVJU3RhdGUuYWN0aW9ucy5uZXdSb2xlcyA9IGZ1bmN0aW9uKCkge1xuICAgIHRoaXMudGFiID0gJ3JvbGVzJ1xuICAgIHRoaXMuc2VsZWN0ZWRQbGF5ZXIgPSBudWxsXG4gICAgdGhpcy5zZWxlY3Rpb25Db25maXJtZWQgPSBmYWxzZVxuICAgIHRoaXMuZW1pdENoYW5nZSgpXG59XG5cbi8vIyBzb3VyY2VNYXBwaW5nVVJMPWRhdGE6YXBwbGljYXRpb24vanNvbjtiYXNlNjQsZXlKMlpYSnphVzl1SWpvekxDSm1hV3hsSWpvaUwyaHZiV1V2Yldsc1pYTXZZMjlrWlM5eVpXRmpkR0Z1WTJVdmMyTnlhWEIwY3k5MWFTMXpkR0YwWlM1cWN5SXNJbk52ZFhKalpYTWlPbHNpTDJodmJXVXZiV2xzWlhNdlkyOWtaUzl5WldGamRHRnVZMlV2YzJOeWFYQjBjeTkxYVMxemRHRjBaUzVxY3lKZExDSnVZVzFsY3lJNlcxMHNJbTFoY0hCcGJtZHpJam9pUVVGQlFTeEpRVUZKTEV0QlFVc3NSMEZCUnl4UFFVRlBMRU5CUVVNc1UwRkJVeXhEUVVGRE96dEJRVVU1UWl4TlFVRk5MRU5CUVVNc1QwRkJUeXhIUVVGSExFOUJRVTg3TzBGQlJYaENMRk5CUVZNc1QwRkJUeXhEUVVGRExGVkJRVlVzUlVGQlJUdEJRVU0zUWl4SlFVRkpMRXRCUVVzc1EwRkJReXhMUVVGTExFTkJRVU1zU1VGQlNTeERRVUZET3p0SlFVVnFRaXhKUVVGSkxFTkJRVU1zUjBGQlJ5eEhRVUZITEU5QlFVODdTVUZEYkVJc1NVRkJTU3hEUVVGRExHTkJRV01zUjBGQlJ5eEpRVUZKTzBsQlF6RkNMRWxCUVVrc1EwRkJReXhyUWtGQmEwSXNSMEZCUnl4TFFVRkxPMEZCUTI1RExFbEJRVWtzU1VGQlNTeERRVUZETEdWQlFXVXNSMEZCUnl4TFFVRkxPenRKUVVVMVFpeFZRVUZWTEVOQlFVTXNVVUZCVVN4RFFVRkRMRk5CUVZNc1QwRkJUeXhGUVVGRk8xRkJRMnhETEVsQlFVa3NUMEZCVHl4SFFVRkhMRTlCUVU4c1EwRkJReXhQUVVGUE8xRkJRemRDTEVsQlFVa3NRMEZCUXl4RFFVRkRMRlZCUVZVc1EwRkJReXhQUVVGUExFTkJRVU1zVDBGQlR5eERRVUZETEUxQlFVMHNRMEZCUXl4RFFVRkRMRVZCUVVVN1dVRkRka01zVDBGQlR5eERRVUZETEU5QlFVOHNRMEZCUXl4TlFVRk5MRU5CUVVNc1EwRkJReXhKUVVGSkxFTkJRVU1zU1VGQlNTeEZRVUZGTEU5QlFVOHNRMEZCUXp0WlFVTXpReXhKUVVGSkxFTkJRVU1zU1VGQlNTeEZRVUZGTzFOQlEyUTdTMEZEU2l4RFFVRkRMRWxCUVVrc1EwRkJReXhKUVVGSkxFTkJRVU1zUTBGQlF6dEJRVU5xUWl4RFFVRkRPenRCUVVWRUxFbEJRVWtzV1VGQldTeEhRVUZITEVOQlFVTXNTMEZCU3l4RlFVRkZMR2RDUVVGblFpeEZRVUZGTEc5Q1FVRnZRaXhGUVVGRkxHbENRVUZwUWl4RFFVRkRPenRCUVVWeVJpeFBRVUZQTEVOQlFVTXNVMEZCVXl4RFFVRkRMRWxCUVVrc1IwRkJSeXhYUVVGWE8wbEJRMmhETEVsQlFVa3NUMEZCVHl4SFFVRkhMRVZCUVVVN1NVRkRhRUlzV1VGQldTeERRVUZETEU5QlFVOHNRMEZCUXl4SFFVRkhMRWxCUVVrc1QwRkJUeXhEUVVGRExFZEJRVWNzUTBGQlF5eEhRVUZITEVsQlFVa3NRMEZCUXl4SFFVRkhMRU5CUVVNc1EwRkJRenRKUVVOeVJDeExRVUZMTEVOQlFVTXNSMEZCUnl4RFFVRkRMR1ZCUVdVc1JVRkJSU3hQUVVGUExFTkJRVU03UVVGRGRrTXNRMEZCUXpzN1FVRkZSQ3hQUVVGUExFTkJRVU1zVTBGQlV5eERRVUZETEVsQlFVa3NSMEZCUnl4WFFVRlhPMGxCUTJoRExFbEJRVWtzVDBGQlR5eEhRVUZITEV0QlFVc3NRMEZCUXl4SFFVRkhMRU5CUVVNc1pVRkJaU3hEUVVGRE8wbEJRM2hETEVsQlFVa3NUMEZCVHl4TFFVRkxMRk5CUVZNc1JVRkJSVHRSUVVOMlFpeFpRVUZaTEVOQlFVTXNUMEZCVHl4RFFVRkRMRWRCUVVjc1NVRkJTU3hKUVVGSkxFTkJRVU1zUjBGQlJ5eERRVUZETEVkQlFVY3NUMEZCVHl4RFFVRkRMRWRCUVVjc1EwRkJReXhEUVVGRE8wdEJRM2hFTzBGQlEwd3NRMEZCUXp0QlFVTkVPenRCUVVWQkxFOUJRVThzUTBGQlF5eFBRVUZQTEVkQlFVY3NSVUZCUlRzN1FVRkZjRUlzVDBGQlR5eERRVUZETEU5QlFVOHNRMEZCUXl4VFFVRlRMRWRCUVVjc1UwRkJVeXhEUVVGRExFZEJRVWNzUTBGQlF5eEZRVUZGTzBsQlEzaERMRWxCUVVrc1EwRkJReXhIUVVGSExFZEJRVWNzUjBGQlJ6dEpRVU5rTEVsQlFVa3NRMEZCUXl4alFVRmpMRWRCUVVjc1NVRkJTVHRKUVVNeFFpeEpRVUZKTEVOQlFVTXNhMEpCUVd0Q0xFZEJRVWNzUzBGQlN6dEpRVU12UWl4SlFVRkpMRU5CUVVNc1ZVRkJWU3hGUVVGRk8wRkJRM0pDTEVOQlFVTTdPMEZCUlVRc1QwRkJUeXhEUVVGRExFOUJRVThzUTBGQlF5eFpRVUZaTEVkQlFVY3NVMEZCVXl4RFFVRkRMRWxCUVVrc1EwRkJReXhGUVVGRk8wbEJRelZETEVsQlFVa3NRMEZCUXl4alFVRmpMRWRCUVVjc1NVRkJTVHRKUVVNeFFpeEpRVUZKTEVOQlFVTXNhMEpCUVd0Q0xFZEJRVWNzUzBGQlN6dEpRVU12UWl4SlFVRkpMRU5CUVVNc1ZVRkJWU3hGUVVGRk8wRkJRM0pDTEVOQlFVTTdPMEZCUlVRc1QwRkJUeXhEUVVGRExFOUJRVThzUTBGQlF5eGhRVUZoTEVkQlFVY3NVMEZCVXl4RFFVRkRMRWxCUVVrc1EwRkJReXhGUVVGRk8wbEJRemRETEVsQlFVa3NRMEZCUXl4alFVRmpMRWRCUVVjc1NVRkJTVHRKUVVNeFFpeEpRVUZKTEVOQlFVTXNhMEpCUVd0Q0xFZEJRVWNzU1VGQlNUdEpRVU01UWl4SlFVRkpMRU5CUVVNc1ZVRkJWU3hGUVVGRk8wRkJRM0pDTEVOQlFVTTdPMEZCUlVRc1QwRkJUeXhEUVVGRExFOUJRVThzUTBGQlF5eGpRVUZqTEVkQlFVY3NWMEZCVnp0SlFVTjRReXhKUVVGSkxFTkJRVU1zWTBGQll5eEhRVUZITEVsQlFVazdTVUZETVVJc1NVRkJTU3hEUVVGRExHdENRVUZyUWl4SFFVRkhMRXRCUVVzN1NVRkRMMElzU1VGQlNTeERRVUZETEZWQlFWVXNSVUZCUlR0QlFVTnlRaXhEUVVGRE96dEJRVVZFTEU5QlFVOHNRMEZCUXl4UFFVRlBMRU5CUVVNc1lVRkJZU3hIUVVGSExGZEJRVmM3U1VGRGRrTXNTVUZCU1N4RFFVRkRMR1ZCUVdVc1IwRkJSeXhKUVVGSk8wbEJRek5DTEVsQlFVa3NRMEZCUXl4VlFVRlZMRVZCUVVVN1FVRkRja0lzUTBGQlF6czdRVUZGUkN4UFFVRlBMRU5CUVVNc1QwRkJUeXhEUVVGRExGbEJRVmtzUjBGQlJ5eFhRVUZYTzBsQlEzUkRMRWxCUVVrc1EwRkJReXhsUVVGbExFZEJRVWNzUzBGQlN6dEpRVU0xUWl4SlFVRkpMRU5CUVVNc1ZVRkJWU3hGUVVGRk8wRkJRM0pDTEVOQlFVTTdPMEZCUlVRc1QwRkJUeXhEUVVGRExFOUJRVThzUTBGQlF5eFJRVUZSTEVkQlFVY3NWMEZCVnp0SlFVTnNReXhKUVVGSkxFTkJRVU1zUjBGQlJ5eEhRVUZITEU5QlFVODdTVUZEYkVJc1NVRkJTU3hEUVVGRExHTkJRV01zUjBGQlJ5eEpRVUZKTzBsQlF6RkNMRWxCUVVrc1EwRkJReXhyUWtGQmEwSXNSMEZCUnl4TFFVRkxPMGxCUXk5Q0xFbEJRVWtzUTBGQlF5eFZRVUZWTEVWQlFVVTdRMEZEY0VJaUxDSnpiM1Z5WTJWelEyOXVkR1Z1ZENJNld5SjJZWElnVTNSdmNtVWdQU0J5WlhGMWFYSmxLQ2N1TDNOMGIzSmxKeWxjYmx4dWJXOWtkV3hsTG1WNGNHOXlkSE1nUFNCVlNWTjBZWFJsWEc1Y2JtWjFibU4wYVc5dUlGVkpVM1JoZEdVb1pHbHpjR0YwWTJobGNpa2dlMXh1SUNBZ0lGTjBiM0psTG0xcGVHbHVLSFJvYVhNcFhHNWNiaUFnSUNCMGFHbHpMblJoWWlBOUlDZHpaWFIxY0NkY2JpQWdJQ0IwYUdsekxuTmxiR1ZqZEdWa1VHeGhlV1Z5SUQwZ2JuVnNiRnh1SUNBZ0lIUm9hWE11YzJWc1pXTjBhVzl1UTI5dVptbHliV1ZrSUQwZ1ptRnNjMlZjYmlBZ0lDQjBhR2x6TG0xcGMzTnBiMjVTWlhabFlXeGxaQ0E5SUdaaGJITmxYRzVjYmlBZ0lDQmthWE53WVhSamFHVnlMbTl1UVdOMGFXOXVLR1oxYm1OMGFXOXVLSEJoZVd4dllXUXBJSHRjYmlBZ0lDQWdJQ0FnZG1GeUlHRmpkR2x2Ym5NZ1BTQlZTVk4wWVhSbExtRmpkR2x2Ym5OY2JpQWdJQ0FnSUNBZ2FXWWdLRjh1YVhOR2RXNWpkR2x2YmloaFkzUnBiMjV6VzNCaGVXeHZZV1F1WVdOMGFXOXVYU2twSUh0Y2JpQWdJQ0FnSUNBZ0lDQWdJR0ZqZEdsdmJuTmJjR0Y1Ykc5aFpDNWhZM1JwYjI1ZExtTmhiR3dvZEdocGN5d2djR0Y1Ykc5aFpDbGNiaUFnSUNBZ0lDQWdJQ0FnSUhSb2FYTXVjMkYyWlNncFhHNGdJQ0FnSUNBZ0lIMWNiaUFnSUNCOUxtSnBibVFvZEdocGN5a3BYRzU5WEc1Y2JuWmhjaUJRUlZKVFNWTlVYMHRGV1ZNZ1BTQmJKM1JoWWljc0lDZHpaV3hsWTNSbFpGQnNZWGxsY2ljc0lDZHpaV3hsWTNScGIyNURiMjVtYVhKdFpXUW5MQ0FuYldsemMybHZibEpsZG1WaGJHVmtKMTFjYmx4dVZVbFRkR0YwWlM1d2NtOTBiM1I1Y0dVdWMyRjJaU0E5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUhaaGNpQndaWEp6YVhOMElEMGdlMzFjYmlBZ0lDQlFSVkpUU1ZOVVgwdEZXVk11Wm05eVJXRmphQ2hyWlhrZ1BUNGdjR1Z5YzJsemRGdHJaWGxkSUQwZ2RHaHBjMXRyWlhsZEtWeHVJQ0FnSUhOMGIzSmxMbk5sZENnbmMzUnZjbVV1ZFdsemRHRjBaU2NzSUhCbGNuTnBjM1FwWEc1OVhHNWNibFZKVTNSaGRHVXVjSEp2ZEc5MGVYQmxMbXh2WVdRZ1BTQm1kVzVqZEdsdmJpZ3BJSHRjYmlBZ0lDQjJZWElnY0dWeWMybHpkQ0E5SUhOMGIzSmxMbWRsZENnbmMzUnZjbVV1ZFdsemRHRjBaU2NwWEc0Z0lDQWdhV1lnS0hCbGNuTnBjM1FnSVQwOUlIVnVaR1ZtYVc1bFpDa2dlMXh1SUNBZ0lDQWdJQ0JRUlZKVFNWTlVYMHRGV1ZNdVptOXlSV0ZqYUNoclpYa2dQVDRnZEdocGMxdHJaWGxkSUQwZ2NHVnljMmx6ZEZ0clpYbGRLVnh1SUNBZ0lIMWNibjFjYmx4dVhHNVZTVk4wWVhSbExtRmpkR2x2Ym5NZ1BTQjdmVnh1WEc1VlNWTjBZWFJsTG1GamRHbHZibk11WTJoaGJtZGxWR0ZpSUQwZ1puVnVZM1JwYjI0b2UzUmhZbjBwSUh0Y2JpQWdJQ0IwYUdsekxuUmhZaUE5SUhSaFlseHVJQ0FnSUhSb2FYTXVjMlZzWldOMFpXUlFiR0Y1WlhJZ1BTQnVkV3hzWEc0Z0lDQWdkR2hwY3k1elpXeGxZM1JwYjI1RGIyNW1hWEp0WldRZ1BTQm1ZV3h6WlZ4dUlDQWdJSFJvYVhNdVpXMXBkRU5vWVc1blpTZ3BYRzU5WEc1Y2JsVkpVM1JoZEdVdVlXTjBhVzl1Y3k1elpXeGxZM1JRYkdGNVpYSWdQU0JtZFc1amRHbHZiaWg3Ym1GdFpYMHBJSHRjYmlBZ0lDQjBhR2x6TG5ObGJHVmpkR1ZrVUd4aGVXVnlJRDBnYm1GdFpWeHVJQ0FnSUhSb2FYTXVjMlZzWldOMGFXOXVRMjl1Wm1seWJXVmtJRDBnWm1Gc2MyVmNiaUFnSUNCMGFHbHpMbVZ0YVhSRGFHRnVaMlVvS1Z4dWZWeHVYRzVWU1ZOMFlYUmxMbUZqZEdsdmJuTXVZMjl1Wm1seWJWQnNZWGxsY2lBOUlHWjFibU4wYVc5dUtIdHVZVzFsZlNrZ2UxeHVJQ0FnSUhSb2FYTXVjMlZzWldOMFpXUlFiR0Y1WlhJZ1BTQnVZVzFsWEc0Z0lDQWdkR2hwY3k1elpXeGxZM1JwYjI1RGIyNW1hWEp0WldRZ1BTQjBjblZsWEc0Z0lDQWdkR2hwY3k1bGJXbDBRMmhoYm1kbEtDbGNibjFjYmx4dVZVbFRkR0YwWlM1aFkzUnBiMjV6TG1SbGMyVnNaV04wVUd4aGVXVnlJRDBnWm5WdVkzUnBiMjRvS1NCN1hHNGdJQ0FnZEdocGN5NXpaV3hsWTNSbFpGQnNZWGxsY2lBOUlHNTFiR3hjYmlBZ0lDQjBhR2x6TG5ObGJHVmpkR2x2YmtOdmJtWnBjbTFsWkNBOUlHWmhiSE5sWEc0Z0lDQWdkR2hwY3k1bGJXbDBRMmhoYm1kbEtDbGNibjFjYmx4dVZVbFRkR0YwWlM1aFkzUnBiMjV6TG0xcGMzTnBiMjVTWlhabFlXd2dQU0JtZFc1amRHbHZiaWdwSUh0Y2JpQWdJQ0IwYUdsekxtMXBjM05wYjI1U1pYWmxZV3hsWkNBOUlIUnlkV1ZjYmlBZ0lDQjBhR2x6TG1WdGFYUkRhR0Z1WjJVb0tWeHVmVnh1WEc1VlNWTjBZWFJsTG1GamRHbHZibk11YldsemMybHZibEpsYzJWMElEMGdablZ1WTNScGIyNG9LU0I3WEc0Z0lDQWdkR2hwY3k1dGFYTnphVzl1VW1WMlpXRnNaV1FnUFNCbVlXeHpaVnh1SUNBZ0lIUm9hWE11WlcxcGRFTm9ZVzVuWlNncFhHNTlYRzVjYmxWSlUzUmhkR1V1WVdOMGFXOXVjeTV1WlhkU2IyeGxjeUE5SUdaMWJtTjBhVzl1S0NrZ2UxeHVJQ0FnSUhSb2FYTXVkR0ZpSUQwZ0ozSnZiR1Z6SjF4dUlDQWdJSFJvYVhNdWMyVnNaV04wWldSUWJHRjVaWElnUFNCdWRXeHNYRzRnSUNBZ2RHaHBjeTV6Wld4bFkzUnBiMjVEYjI1bWFYSnRaV1FnUFNCbVlXeHpaVnh1SUNBZ0lIUm9hWE11WlcxcGRFTm9ZVzVuWlNncFhHNTlYRzRpWFgwPSJdfQ==
