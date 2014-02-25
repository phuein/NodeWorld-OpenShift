/*
 *  Constructors define objects and messages in the server and in the world.
 */

// Holds all data, and gets exported directly.
var constructors = {

//*** SERVER MESSAGES ***//
  'welcome': {
    'type': 'info',
    
    'message': function (name) {
      return  '<b>Welcome to Test Game!</b><br />' + 
              'Use <span class=\"command\">' + cmdChar +
              'help</span> to list all available commands.<br />' +
              'You are now known as <span class=\"player\">' + name + '</span>.';
    }
  },
  
  // Used by the help command.
  'descriptions': {
    'god': {
      'set PROPERTY VALUE':
          'Sets the value of any world configuration property. ' + 
          'Displays the configuration object, if sent without arguments. ' + 
          'The \'reset\' argument will reset to default values.'
    },
    
    'builder': {
      'create NAME':
          'Create a new target, where you stand.',
      'destroy (ID).(INSTANCE)':
          'Removes a target from current room, last one in targets by default, ' + 
          'or instance, last one by default.'
    },
    
    'master': {
      'modify room/ID(.INSTANCE) FIELD(.FIELD) VALUE':
          'Modify a property of the room, or of a specific target, ' + 
          'or toggle an object property or array item. ' + 
          'Instance -1 modifies future copies of the target.'
    },
    
    'player': {
      'email':
          'Display your registered email address.',
      'logout':
          'Logout from your current account, and resume a random name.',
      'wear TARGET':
          'Wear a visible item, or an item you hold.',
      'remove TARGET':
          'Remove a worn item, and hold it, if possible.',
      'hold TARGET (HAND)':
          'Hold a visible item in an empty hand of your choosing.',
      'drop TARGET':
          'Drop a held or worn item.',
      'offer TARGET ITEM (ITEM) ...':
          'Offer to give an item or items that you hold, to another player or target',
      'cancel OFFER':
          'Cancel an existing offer.',
      'accept TARGET (OFFER)':
          'Accept an existing offer.',
      'attack TARGET':
          'Not available, yet!'
    },
    
    'user': {
      'chat MESSAGE':
          'Speak to everyone in the world/server.',
      'say MESSAGE':
          'Speak to those in your proximity.',
      'tell USERNAME MESSAGE':
          'Speak to another player, anywhere in the world.',
      'move DIRECTION':
          'Move in any one direction: N, S, E, W; NE, NW, SE, SW; U, D.',
      'emote ACTION (TARGET)':
          'Act out an emotion, or gesture, generally, or to yourself, or towards another player, ' + 
          'or target. Displays the available emotes, if sent without arguments.',
      'examine (PLAYER)':
          'Examine the properties of a registered player. ' + 
          'Displays your own player properties, if sent without arguments.',
      'look (TARGET)':
          'Displays the properties of a target.' + 
          'Displays the current room data, if sent without arguments.',
      'rename NAME':
          'Changes your name, for unregistered users, and only changes the player name, ' + 
          'for registered users, without affecting your username.',
      'login USERNAME PASSWORD':
          'Log into your existing account.',
      'register PASSWORD EMAIL':
          'Register your current username, and receive your details by email.',
      'help':
          'Display all available commands, according to your account access level.'
    }
  },
  
  'format': {
    'newline': '<br />',
    
    'bold': function (text) {
      return '<span class=\"b\">' + text + '</span>';
    },
    
    'italic': function (text) {
      return '<span class=\"i\">' + text + '</span>';
    },
    
    'strike': function (text) {
      return '<span class=\"s\">' + text + '</span>';
    },
    
    'underline': function (text) {
      return '<span class=\"u\">' + text + '</span>';
    },
    
    'object': function (text) {
      return '<span class=\"object\">' + text + '</span>';
    },
    
    'link': function (text) {
      return '<span class=\"a\">' + text + '</span>';
    },
    
    'player': function (text) {
      return '<span class=\"player\">' + text + '</span>';
    },
    
    'target': function (text) {
      return '<span class=\"target\">' + text + '</span>';
    }
  },
// *** //

//*** SERVER OBJECTS ***//
  // Set (or empty) the world object properties.
  'world': function () {
    // World configurations and properties. Loaded from DB on server start.
    world.config    = {};
    
    // All the active maps, named by their id value, holding all their rooms,
    // holding their targets and players.
    world.maps      = {};
    
    // All connected users refered by the user.account.username,
    // and referring to their user object.
    world.users     = {};
    // And count them.
    world.userCount = 0;
    
    // All the unique instances of targets, named by their '_id' value and instance value.
    world.targets   = {};
    
    // Referring to all objects that have been changed,
    // and queued for saving into the DB.
    world.changed   = {};
    // Including:
    world.changed.users   = [];
    world.changed.targets = [];
    world.changed.rooms   = [];
    world.changed.maps    = [];
    
    world.changed.config  = false;    // Toggles saving the entire config object.
    
    // Follow which players are in which rooms and maps.
    world.watch     = {};
  },
// *** //

//*** WORLD OBJECTS ***//
  'room': function (map, pos) {
    return {
      'map'         : map,
      'position'    : pos,          // { 'x': X, 'y': Y, 'z': Z }
                                    // The DB collection is indexed with this field.
      'targets'     : [],
      'title'       : '',
      'description' : '',
      'commands'    : [],
      'exits'       : []
    };
  },
  
  'map': function () {
    return {
      // A unique '_id' is assigned in createMap().
      'name'          :   '',
      'description'   :   '',
      'rooms'         :   {}
    };
  },
  
  'target': function (name, pos) {
    return {
      'name'          :   name,
      'pre'           :   '',                             // Comes before the name.
      'post'          :   '',                             // Comes after the name.
      'description'   :   '',
      'position'      :   pos,
      'commands'      :   [],
      'size'          :   world.config.size[2],           // See configureWorld().
      'weight'        :   world.config.weight[2],         // ...
      'worn'          :   {},                             // See 'registration' for a full scheme.
      'trade'         :   {
        'offers'          :   [],                         // To a specific player or target.
        'requests'        :   []                          // Open request for anyone.
      }
    };
  },
  
  // Registered users.
  'player': function (username, password, email, name, map, room) {
    return {
      'account': {
        'username': username,                     // *** = Required property.
        'password': password,
        'email': email,
        'registered': new Date(),
        'lastonline': new Date(),
        'access': 'builder'                       // ***
      },
      
      'player': {
        'name'        :   name,                   // ***
        'map'         :   map,                    // ***
        'room'        :   room,                   // *** { 'x': X, 'y': Y, 'z': Z }
        'description' :   'A commoner.',
        'pre'         :   'Kind',                 // Comes before the name.
        'post'        :   'the Commoner',         // Comes after the name.
        'worn'        :   {
          'head'             :     {},
          'face'             :     {},
          'neck'             :     {},
          'shoulders'        :     {},
          'arms'             :     {},
          'hands'            :     {
            'left'              :     {},
            'right'             :     {}
          },
          'fingers'          :     {},
          'torso'            :     {},
          'back'             :     {},
          'waist'            :     {},
          'loins'            :     {},
          'legs'             :     {},
          'shins'            :     {},
          'feet'             :     {}
        },
        'offers'      :   []               // Offers I made to others.
      }
    };
  },
  
  // Unregistered users.
  'user': function (name, socket) {
    return {
      'account': {
        'username': name,
        'access': 'user'          // Default access level, for unregistered users.
      },
      
      'player': {
        'name': name,
        'room': { 'x': 0, 'y': 0, 'z': 0 },
        'map': 0
      },
      
      'room': undefined,          // Use property room to refer to the current loaded room.
      
      'socket': socket,           // User can access its' own socket.
      
      'name': name                // Becomes pre + name + post for registered players!
    };
  },
  
  'emotes': {
    
    'lick': {
      'room'      : {
        'me'        : 'You dangle your tongue out for all to see.',
        'others'    : 'USER dangles his tongue out for all to see.'
      },
      'self'      : {
        'me'        : 'You lick yourself.',
        'others'    : 'USER licks himself.'
      },
      'player'    : {
        'me'        : 'You lick USER2.',
        'player'    : 'USER1 licks you.',
        'others'    : 'USER1 licks USER2.'
      },
      'target'    : {
        'me'        : 'You lick TARGET.',
        'others'    : 'USER licks TARGET.'
      }
    },
    
    'greet': {
      'room'      : {
        'me'        : 'You greet all those present.',
        'others'    : 'USER greets all who are present.'
      },
      'self'      : {
        'me'        : 'You greet yourself.',
        'others'    : 'USER greets himself.'
      },
      'player'    : {
        'me'        : 'You greet USER2.',
        'player'    : 'USER1 greets you.',
        'others'    : 'USER1 greets USER2.'
      },
      'target'    : {
        'me'        : 'You greet TARGET.',
        'others'    : 'USER greets TARGET.'
      }
    },
    
    'bow': {
      'room'      : {
        'me'        : 'You bow to all those present.',
        'others'    : 'USER bows to all who are present.'
      },
      'self'      : {
        'me'        : 'You bow to yourself.',
        'others'    : 'USER bows to himself.'
      },
      'player'    : {
        'me'        : 'You bow to USER2.',
        'player'    : 'USER1 bows to you.',
        'others'    : 'USER1 bows to USER2.'
      },
      'target'    : {
        'me'        : 'You bow to TARGET.',
        'others'    : 'USER bows to TARGET.'
      }
    },
    
    'kiss': {
      'room'      : {
        'me'        : 'You quickly kiss every person present.',
        'others'    : 'USER quickly kisses every person present.'
      },
      'self'      : {
        'me'        : 'You kiss yourself.',
        'others'    : 'USER kisses himself.'
      },
      'player'    : {
        'me'        : 'You kiss USER2.',
        'player'    : 'USER1 kisses you.',
        'others'    : 'USER1 kisses USER2.'
      },
      'target'    : {
        'me'        : 'You kiss TARGET.',
        'others'    : 'USER kisses TARGET.'
      }
    },
    
    'curse': {
      'room'      : {
        'me'        : 'You curse loudly at no one in particular.',
        'others'    : 'USER curses loudly at no one in particular.'
      },
      'self'      : {
        'me'        : 'You curse yourself loudly, for all to hear.',
        'others'    : 'USER curses himself loudly, for all to hear.'
      },
      'player'    : {
        'me'        : 'You curse USER2 loudly, for all to hear.',
        'player'    : 'USER1 curses you loudly, for all to hear.',
        'others'    : 'USER1 curses USER2 loudly, for all to hear.'
      },
      'target'    : {
        'me'        : 'You curse TARGET loudly, for all to hear.',
        'others'    : 'USER curses TARGET loudly, for all to hear.'
      }
    },
    
    'threat': {
      'room'      : {
        'me'        : 'You present a threating air about yourself, for all to feel.',
        'others'    : 'USER presents a threating air about himself, for all to feel.'
      },
      'self'      : {
        'me'        : 'You threaten yourself loudly.',
        'others'    : 'USER makes a threat against himself loudly.'
      },
      'player'    : {
        'me'        : 'You become threatening towards USER2.',
        'player'    : 'USER1 appears to be threatening you.',
        'others'    : 'USER1 appears to be threatening USER2.'
      },
      'target'    : {
        'me'        : 'You become threatening towards TARGET.',
        'others'    : 'USER appears to be threatening TARGET.'
      }
    }
  },
  // Multiply about 10 times per step, with 'big' equaling an adult human male.
  'size': ['tiny', 'small', 'large', 'big', 'huge', 'enormous'],
  // Multiply about 10 times per step, with 'heavy' equaling an adult human male.
  'weight': ['insignificant', 'very light', 'light', 'heavy', 'very heavy', 'massive']
                                                      // Last item must not end with a comma!
// *** //
};

module.exports = constructors;    // WARNING: Global variable from server.js is named 'constructor'!