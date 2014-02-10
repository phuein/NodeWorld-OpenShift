/*
 *  Constructors define objects and messages in the server and in the world.
 */

// Holds all data, and gets exported directly.
var constructors = {

//*** SERVER MESSAGES ***//
  'welcomeMessage':
    function (name) {
      return  '<b>Welcome to Test Game!</b><br />' + 
              'Please, use <b>' + cmdChar +
              'help</b> to list all available commands.<br />' +
              'You are now known as <b>' + name + '</b>.';
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