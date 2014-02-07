/*  
 *  Commands are called from the server only,
 *  to process data requests from the client,
 *  change the world object & send the results by socket.
 */

//*** MODULE DEPENDENCIES ***//
  var nodemailer = require('nodemailer');

  // Clear operations cache on module reload.
  if (require.cache[require.resolve('./operations.js')]) {
    delete require.cache[require.resolve('./operations.js')]; // Remove module from cache.
  }

  var operations = require('./operations.js');
  
  // Have a local variable referring to each operation.
  for (var opName in operations) {
    eval('var ' + opName + ' = ' + operations[opName] + ';');
  }
  
  var creationFunctions = require('./adminFunctions.js');
  
  // Have a local variable referring to each function.
  for (var functionName in creationFunctions) {
    eval('var ' + functionName + ' = ' + creationFunctions[functionName] + ';');
  }
  
  var playerFunctions = require('./playerFunctions.js');
  
  // Have a local variable referring to each function.
  for (var functionName in playerFunctions) {
    eval('var ' + functionName + ' = ' + playerFunctions[functionName] + ';');
  }
// *** //

//*** WORLD HANDLING OPERATIONS ***//
  // Setup all the defaults in-world configurations,
  // such as global physics and global command options.
  function configureWorld() {
    var saveID = world.config['_id'];
    
    world.config = {}; // Reset object!
    
    if (saveID) {
      world.config['_id'] = saveID;
    }
    
    world.config.size = ['tiny', 'small', 'large', 
                         'big', 'huge', 'enormous'];       // Multiply about 10 times per step.
                                                           // With 'big' equaling an adult human male.
    
    world.config.weight = ['insignificant', 'very light', 'light', 
                           'heavy', 'very heavy', 'massive']; // Multiply about 10 times per step.
                                                              // With 'heavy' equaling an adult human male.
    
    world.config.emotes = {
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
    }
    
    // Create the config object in the DB.
    worlddb.save(world.config, function(err) {
      if (err) {
        console.log(err);
        return;
      }
      
      console.log(Timestamp() + 'Default world configuration saved.');
    }); 
  }

  // Saves any new or modified data to the DB
  // (replacing existing or creating unexisting documents!),
  // by intervals. Default should be every 1 minute.
  function saveWorld() {
    if (serverClosed) {
      console.log('Saving is disabled, because server is closed!');
      return;
    }
    
    var notify = false;
    
    // If there's anything to even update.
    if ( world.changed.users.length    > 0 ||
         world.changed.targets.length  > 0 ||
         world.changed.rooms.length    > 0 ||
         world.changed.maps.length     > 0 ||
         world.changed.config == true ) {
      notify = true;
    } else {
      return;
    }
    
    // USERS
    for (var i=0; i < world.changed.users.length; i++) {
      var curUser = world.changed.users[i];
      saveUser(curUser);
    }
    world.changed.users = []; // Cleanup.
    
    // TARGETS
    var toRemove = [];
    for (var i=0; i < world.changed.targets.length; i++) {
      var curTarget = world.changed.targets[i];
      
      // Skip targets for removal, and remove in removal loop.
      if (curTarget.remove == true) {
        toRemove.push(curTarget);
        continue;
      }
      
      saveTarget(curTarget);
    }
    world.changed.targets = []; // Cleanup.
    // ...
    // TARGETS - Instance removal.  
    for (var i=0; i < toRemove.length; i++) {
      var curTarget = toRemove[i];
      deleteTarget(curTarget);
    }  
    
    // ROOMS
    for (var i=0; i < world.changed.rooms.length; i++) {
      var curRoom = world.changed.rooms[i];
      saveRoom(curRoom);
    }
    world.changed.rooms = []; // Cleanup.
    
    // MAPS
    for (var i=0; i < world.changed.maps.length; i++) {
      var curMap = world.changed.maps[i];
      saveMap(curMap);
    }
    world.changed.maps = []; // Cleanup.
    
    // CONFIG
    if (world.changed.config == true) {
      saveConfig();
    }
    world.changed.config = false; // Cleanup.
    
    // Only notify of saving, if anything was actually saved.
    if (notify) {
      console.log(Timestamp() + 'World changes saved.');
    }
  }
  
  //*** DB SAVING & REMOVAL FUNCTIONS - IMMEDIATE ***//
    function saveUser(user) {
      user.account.lastonline = new Date(); // Update 'lastonline'.
      
      // Save only relevant properties.
      var userObject = {};
      userObject.account = user.account;
      userObject.player = user.player;
      userObject['_id'] = user['_id'];
      
      usersdb.save(userObject, function (err) {
        if (err) {
          console.log('ERROR IN saveWorld() DB UPDATE FOR users!')
          console.log(err);
        }
      });
    }

    function saveTarget(target) {
        // Save target instance, specifically.
        var instObj = {};
        instObj[target.instance] = target;
        
        targetsdb.update({ '_id': target['_id'] }, { '$set': instObj }, { 'upsert': true }, function (err) {
          if (err) {
            console.log('ERROR IN saveWorld() DB UPDATE FOR targets IN instance!')
            console.log(err);
          }
        });
    }
    
    function deleteTarget(target) {
      var fieldObj = {};
      fieldObj[target['_id'] + '.' + target.instance] = '';
      var instObj = {};
      instObj = {
        '$unset': fieldObj
      };
      
      targetsdb.update({ '_id': target['_id'] }, instObj, function (err) {
        if (err) {
          console.log('ERROR IN saveWorld() DB UPDATE FOR targets IN removal!')
          console.log(err);
        }
      });
    }

    function saveRoom(room) {
      var strCoord = strPos(room.position);
      var mapObj = {}
      mapObj['rooms.' + strCoord] = room; // Have a keyed room name field.
      
      mapsdb.update({ '_id': room.map }, { $set: mapObj }, function (err) {
        if (err) {
          console.log('ERROR IN saveWorld() DB UPDATE FOR rooms!')
          console.log(err);
        }
      });
    }

    function saveMap(map) {
      mapsdb.save(map, function (err) {
        if (err) {
          console.log('ERROR IN saveWorld() DB UPDATE FOR maps!')
          console.log(err);
        }
      });
    }

    function saveConfig() {
      worlddb.save(world.config, function(err) {
        if (err) {
          console.log('ERROR IN saveWorld() DB UPDATE FOR config!')
          console.log(err);
        }
        
        world.changed.config = false; // Cleanup, even if requested without saveWorld(),
                                      // because it saves all anyway.
      });
    }
  // *** //
  
  // Creates a new map. Automatic ID by increments from DB. Loads to world object.
  // Puts user in map and creates first room at 0x0y0z.
  function createMap(user) {
    // map object. '_id' value set further on, here.
    var mapObj = {
      'name'          :   '',
      'description'   :   '',
      'rooms'         :   {}
    };

    // Get the map with the highest id value.
    mapsdb.findOne({}, { 'fields': { '_id': 1 }, 'limit': 1, 'sort': { '_id': -1 } }, function (err, doc) {
      if (err) {
        console.log(err);
        return;
      }
      
      // id is 0 for first item, or last id + 1 for new id value.
      mapObj['_id'] = (!doc ? 0 : doc['_id'] + 1);
      
      // Refer map into the world.maps object.
      world.maps[mapObj['_id']] = mapObj;
      
      // Update user object.
      user.player.map = mapObj['_id'];
      
      // Create first room at 0x0y0z.
      createRoom(0, 0, 0, user);
      
      // Update DB immediately.
      saveMap(mapObj);
      
      // Inform the user about the map's ID.
      if (mapObj['_id'] == 0) {
        user.socket.emit('message', '<i><b>The first map of this world' +
                                    ' has been created successfully!</b></i>');
      } else {
        user.socket.emit('message', '<i><b>Map #' + mapObj['_id'] +
                                    ' has been created successfully.</b></i>');
      }
    });
  }

  // Create room at given position.
  function createRoom(x, y, z, user) {
    // Return 0 by defualt, if any coord is passed without value.
    ( x ? parseInt(x) : 0 );
    ( y ? parseInt(y) : 0 );
    ( z ? parseInt(z) : 0 );

    // Make sure they all parsed well. NaN means Not a Number.
    if (isNaN(x) || isNaN(y) || isNaN(z)) {
      console.log('Position did not pass parsing to int: ' + x + ', ' + y + ', ' + z + '.');
      return;
    }

    // Just for shorthand.
    var strPos = x + ', ' + y + ', ' + z;
    var strCoord = x + 'x' + y + 'y' + z + 'z'; // This is how room names (as objects) look like.
    var roomPos = { 'x': x, 'y': y, 'z': z } // Mimic how the DB object looks.
    
    // Create room object for insert.
    var roomObj = {
          'map'         : user.player.map,
          'position'    : roomPos,          // The DB collection is indexed with this field.
          'targets'     : [],
          'title'       : '',
          'description' : '',
          'commands'    : [],
          'exits'       : []
    };
    
    var strObj = {};
    strObj[strCoord] = { '$exists': true }; // DB query for existing field.

    // Make sure the room does not already exist.
    // I prefer checking here than having the DB handle duplicates.
    mapsdb.findOne(strObj, function (err, room) {
      if (room) {
        console.log('Room at ' + strPos + ' already exists!');         
        return;
      }
      
      // Otherwise, insert the new room normally.
      // Insert room to world.map object with property name '#x#y#z' from coords.
      world.maps[roomObj.map].rooms[strCoord] = roomObj;
      
      // Add to changed objects for next DB update.
      world.changed.rooms.push(roomObj);
      
      // Inform the user of success.
      if (x == 0 && y == 0 && z == 0 && user.player.map == 0) {
        user.socket.emit('message', '<i><b>The first room in this world' +
                                    ' has been created successfully!</b></i>');
      } else if (x == 0 && y == 0 && z == 0) {
        user.socket.emit('message', '<i><b>The first room in the map' +
                                    ' has been created successfully.</b></i>');
      } else {
        user.socket.emit('message', '<i><b>Room at ' + strPos +
                                    ' has been created successfully.</b></i>');
      }
      
      processRoom(user, 'new'); // Apply room data.
    });
  }
  
  // Load current room data.
  function loadRoom(user) {
    // A shortened name for the same user position object.
    var curPos = user.player.position;
    // This is how room names (as objects) look like.
    var strCoord = strPos(curPos);

    // If no map available where I stand,
    // then either it's a new map, a new world, or I just connected.
    if (!world.maps[user.player.map]) {
      // Try to load the map from DB.
      loadMapDB(user);
      // Returns to loadRoom, after loading from DB.
      return;
    }

    // If room not available in world object,
    // then find it in the DB, or create it.
    if(!world.maps[user.player.map].rooms[strCoord]) {
      // Search for an existing room in the DB.
      var strObj = {};
      strObj[strCoord] = { '$exists': true }; // DB query for existing field.
      
      mapsdb.findOne(strObj, function (err, room) {
        // If no room found for player position, then create empty room here.
        if (!room) {
          createRoom(curPos.x, curPos.y, curPos.z, user);
          // It ends with the processRoom function for a 'new' room.
          return;
        }

        // Otherwise, insert the room to world.maps, and process.
        world.maps[user.player.map].rooms[strCoord] = room;
        processRoom(user, 'existing'); // Apply room data.
      });
    } else {
      // Just load an existing room from world.
      processRoom(user, 'existing'); // Apply room data.
    }
  }

  // Called by loadRoom.
  function processRoom(user, state) {
    // A shortened name for the same user position object.
    var curPos = user.player.position;
    // This is how room names (as objects) look like.
    var strCoord = strPos(curPos);
    
    var lastRoom = user.room;  // Shorthand reference to the still not updated reference.
                                        // At this point my player.position is updated,
                                        // but my rooms.current is not!
                                        
    var curRoom = world.maps[user.player.map].rooms[strCoord]; // Get my current room from coordinates.

    // Login is the only situation in which my lastRoom equals my current position!
    if (lastRoom && JSON.stringify(lastRoom.position) == JSON.stringify(curPos)) {
      lastRoom = null; // Avoid the next if, of regular movement between rooms.
      
      // Remove my duplicate from the room's player array.
      world.watch[strCoord].splice(world.watch[strCoord].indexOf(user), 1);
    }
    
    // If I came from another room, then remove me from it,
    // and inform others there, about me leaving.
    // (This excludes 'on connection' & on first room in the world.)
    if (lastRoom) {
      var lastRoomStr = strPos(user.room.position);
                        
      // Remove myself from the room's player array.
      world.watch[lastRoomStr].splice(world.watch[lastRoomStr].indexOf(user), 1);
      
      // Inform others in the last room.
      for (var i=0; i < world.watch[lastRoomStr].length; i++) {
        world.watch[lastRoomStr][i].socket.emit('message', '<i>' + user.player.name +
                                                           ' has moved away.</i>');
      }
      
      // If new room map is different from old room map,
      // remove me from map watchers list of previous map.
      if (user.player.map != lastRoom['map']) {
        world.watch[lastRoom['map']].splice(world.watch[lastRoom['map']].indexOf(user), 1);
        
        // If the previous map has no watchers now,
        // then unload it from world.
        for (room in world.maps[lastRoom['map']].rooms) {
          for (target in room.targets) {
            delete world.targets[target['_id']];
          }
        }
        
        delete world.maps[lastRoom['map']];
      }
    }

    // This is a just now made empty 'new' room. //
    if (state == 'new') {
      // Update world.watch for new room.
      world.watch[strCoord] = [];
      world.watch[strCoord].push(user)

      // Update user object.
      user.room = world.maps[user.player.map].rooms[strCoord];
      
      // Look command.
      handleCommands(cmdChar + 'look', user);
    
      // The map holds the new room,
      // but the user needs to be updated about the maps' new outlook.
      loadMap(user);
      
      return;
    }
    
    // Otherwise, this is an 'existing' room. //
    if (!world.watch[strCoord]) {
      world.watch[strCoord] = [];
    }
    // Tell others I am here.
    for (var i=0; i < world.watch[strCoord].length; i++) {
      world.watch[strCoord][i].socket.emit('message', '<i>Player ' + user.player.name +
                                                      ' has appeared.</i>');
    }
    
    // Update current room players array.
    world.watch[strCoord].push(user);

    // Update user object.
    user.room = curRoom;
    
    // If new room is on a different map.
    if (user.player.map != curRoom['map']) {
      var lastMap = world.maps[user.player.map];
      
      // Remove me from previous map watchers.
      lastMap.splice(lastMap.indexOf(user), 1);
      
      // Load new map.
      user.player.map = curRoom['map'] // Update user data about new map.
      loadMap(user);
    }
    
    // Look command.
    handleCommands(cmdChar + 'look', user);
  }

  // Load current map (uses loadMapWorld and loadMapDB.)
  // and store it in world.maps object.
  function loadMap(user) {
    var result;
    
    result = loadMapWorld(user);
    
    if (result) {
      return;
    }
    
    loadMapDB(user);
    return;
  }

  // Load the map specifically from the world object.
  function loadMapWorld(user) {
    // Look for the map in the world.maps object.
    if (world.maps[user.player.map]) {    
      // Add me to watchers list.
      if (!world.watch[user.player.map]) {
        world.watch[user.player.map] = [];
      }
      world.watch[user.player.map].push(user);
      
      return true;
    }
    
    return false;
  }

  // Always after trying the world object,
  // load the map specifically from the DB.
  function loadMapDB(user) {
    // Load map from DB.
    mapsdb.findOne({ '_id': user.player.map }, function (err, map) {
      if (err) {
        console.log(err);
        return;
      }
      
      // Create map if it just does not exist.
      if (!map) {
        user.player.position = { 'x': 0, 'y': 0, 'z': 0 }; // If player tried moving to any other coord.
        createMap(user); // Map creation creates map 0 and room 0x0y0z automatically.
        return;
      }
      
      // Load into world object.
      world.maps[user.player.map] = map;
      
      // Add me to watchers list.
      if (!world.watch[user.player.map]) {
        world.watch[user.player.map] = [];
      }
      world.watch[user.player.map].push(user);
      
      // Refer world.targets to all targets in map, from each room.
      for (room in world.maps[user.player.map].rooms) {
        var curRoom = world.maps[user.player.map].rooms[room];
        
        for (var i=0; i < curRoom.targets.length; i++) {
          var curTarget = curRoom.targets[i];
          
          if (!world.targets[curTarget['_id']]) {
            world.targets[curTarget['_id']] = {};
            world.targets[curTarget['_id']]['_id'] = curTarget['_id'];
          }
          
          world.targets[curTarget['_id']][curTarget.instance] = curTarget;
        }
      }
      
      // If map just loaded, then I cannot have a room yet,
      // so return to loadRoom to get the room, now.
      // (loadRoom uses loadMapDB in its' map check, before loading any room.)
      loadRoom(user);
    });
  }
// *** //

/*
 *  Commands are requested by the client.
 */

var commands = {}; // WARNING: Global variable from server.js is named 'command'!

// Server control.
commands.god = {
  // set OBJECT.PROPERTY VALUE
  'set': function (user, cmdArray, cmdStr) {
    // List world.config if only 'set' is sent.
    if (!cmdArray[1]) {
      user.socket.emit('message', '<pre><b>World configuration properties:</b><small>' + 
                      JSON.stringify(world.config, null, 2).replace(/\[|\]|{|}|,/gm, '')
                      .replace(/^\s*\n/gm, '') + '</small></pre>To reset to default, do: ' +
                      cmdChar + '<b>set reset</b>');
      return;
    }
    
    // Some fields may not be changed!
    if (cmdArray[1] == '_id') {
      user.socket.emit('message', '<i>Cannot change this field!</i>');
      return;
    }
    
    // 'reset' to run configureWorld() again.
    if (cmdArray[1] == 'reset') {
      configureWorld();
      user.socket.emit('message', '<i>World configuration has been reset to default!</i>');
      return;
    }
    
    // MongoDB doesn't allow $ in fields.
    if (cmdArray[1].indexOf('$') >= 0) {
      user.socket.emit('message', '<i>Property names cannot include the dollar sign!</i>');
      return;
    }
    
    // Default value is empty string.
    if (!cmdArray[2]) {
      cmdArray[2] = '';
    }
    
    // Convert dotted notation string into a real object.
    var value = cmdStr.substring(cmdStr.indexOf(" ") + 1); // Remove OBJECT.PROERTY part.
    var madeObject = objDotted(cmdArray[1], value);
    
    if (!madeObject) {
      user.socket.emit('message', '<i>Failed to set the configuration (parsing)!</i>');
      return;
    }
    
    // Upsert (update existing and create non-existing properties) the data.
    updateObj(world.config, madeObject, true);

    world.changed.config = true;
    user.socket.emit('message', '<i>World configuration changed successfully.</i>');
  },
  /*  Sets a value into any world.config property, or 'reset' to default.
   */
  
  // resetworld
  'resetworld': function (user) {
    resetWorld(user);
  },
  /*  Kicks all users from server, resets world object data,
   *  reset DB data, and make server available again.
   */
  
  // reloadcommands
  'reloadcommands': function (user) {
    reloadCommands(user);
  }
  /*  Reloads the commands.js code.
   */
};

// World creation.
commands.builder = {
  // create NAME
  'create': function (user, cmdArray, cmdStr) {
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'create NAME</i>');
      return;
    }
    
    // Target name can only be English letters and spaces.
    var name = parseName(cmdStr); // True or false.
    if (!name) {
      user.socket.emit('message', '<i>Creation names must be composed only of letters and spaces!</i>');
      return;
    }
    
    var curRoom = user.room;
    
    // Create the target object.
    var targetObj = {
      'name'          :   name,
      'pre'           :   '',                             // Comes before the name.
      'post'          :   '',                             // Comes after the name.
      'description'   :   '',
      'position'      :   user.player.position,
      'commands'      :   [],
      'size'          :   world.config.size[2],           // See configureWorld().
      'weight'        :   world.config.weight[2],         // ...
      'worn'          :   {},                             // See 'registration' for a full scheme.
      'trade'         :   {
        'offers'          :   [],                                 // To a specific player or target.
        'requests'        :   []                                  // Open request for anyone.
      }
    };
    
    // Get the target with the highest id value.
    targetsdb.findOne({}, { fields: { '_id': 1 }, 'limit': 1 , 'sort': { '_id': -1 } },
                      function (err, doc) {
      if (err) {
        console.log(err);
        user.socket.emit('message', '<i><b>Creation (counter) failed.</b></i>');
        return;
      }
      
      // id is 0 for first item, or last id + 1 for new id value.
      targetObj['_id'] = (!doc ? 0 : doc['_id'] + 1);
      // Instance 0 for first instance of a target in the world.
      targetObj.instance = 0;
      
      // Add the the target by '_id' to world targets.
      world.targets[targetObj['_id']] = {};
      world.targets[targetObj['_id']]['_id'] = targetObj['_id'];
      
      // Add first instance as instance '-1', for future duplication.
      var originalObj = copyObj(targetObj);
      originalObj.instance = '-1';
      world.targets[originalObj['_id']]['-1'] = originalObj;
      
      // Add the new target instance to the world.
      world.targets[targetObj['_id']]['0'] = targetObj;
      
      // Add the new target to the current room.
      curRoom.targets.push(targetObj);
      
      // Update DB immediately.
      saveTarget(originalObj);
      saveTarget(targetObj);
      saveRoom(curRoom);
      
      var fullID = strTarget(targetObj);
      
      var strCoord = strPos(curRoom.position);
      
      // Inform all (including me) in the room about the new target.
      for (var i=0; i < world.watch[strCoord].length; i++) {
        world.watch[strCoord][i].socket.emit('message',
                '<i><b>Creation #' + fullID + ' has been successful.' + '<br />' + 
                'Its\' template can be changed through instance \'-1\'.</b></i>');
      }
    })
  },
  /*  Creates a new target where the player stands.
   */
  
  // destroy (ID).(INSTANCE)
  'destroy': function (user, cmdArray) {
    var strCoord = strPos(user.player.position);
    
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'destroy ID.INSTANCE</i>');
      return;
    }
    
    // Parse target.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      user.socket.emit('message', '<i>Target must be a numeric value, for example: ' +
                                  cmdChar + 'destroy 0.1</i>');
      return;
    }
    
    var idInst = parsedTarget.split('.');
    
    // Remove last target from targets.
    if (!idInst[0]) {
      if (user.room.targets.length > 0) {
        var curTarget = user.room.targets[user.room.targets.length-1];
        var i = user.room.targets.length-1;
        
        // Save target's fullNameID for message.
        var targetName = fullNameID(curTarget);
        
        destroyTarget(user, curTarget, i); // Remove from room, world & DB.
        
        // Inform all (including me) in the room about the removed target.
        for (var i=0; i < world.watch[strCoord].length; i++) {
          world.watch[strCoord][i].socket.emit('message', '<i><b>Creation ' + targetName
                                                          + ' has been successfully destroyed.</b></i>');
        }
        
        return;
      }
      
      // Nothing to remove.
      user.socket.emit('message', '<i><b>No targets in the room.</b></i>');
      return;
    }
    
    // Make sure ID is a number.
    if (isNaN(idInst[0])) {
      user.socket.emit('message', '<i><b>Target ID must be a number!</b></i>');
      return;
    }
    
    // Remove last instance of target by ID.
    if (idInst[0] && !idInst[1]) {
      // Loop from last, and remove first found instance.
      for (var i = user.room.targets.length - 1; i >= 0; i--) {
        var curTarget = user.room.targets[i];
        
        if (curTarget['_id'] == idInst[0]) {
          // Save target's fullNameID for message.
          var targetName = fullNameID(curTarget);
          
          destroyTarget(user, curTarget, i); // Remove from room, world & DB.
          
          // Inform all (including me) in the room about the removed target.
          for (var i=0; i < world.watch[strCoord].length; i++) {
            world.watch[strCoord][i].socket.emit('message', '<i><b>Creation ' + targetName
                                                          + ' has been successfully destroyed.</b></i>');
          }
          
          return;
        }
      }
      
      // Target not found.
      user.socket.emit('message', '<i><b>Target #' + idInst[0] + '.' +
                                  idInst[1] + ' was not found.</b></i>');
      return;
    }
    
    // Make sure instance is a number.
    if (isNaN(idInst[1])) {
      user.socket.emit('message', '<i><b>Target instance must be a number!</b></i>');
      return;
    }
    
    // Or remove target by both ID and instance.
    for (var i=0; i < user.room.targets.length; i++) {
      var curTarget = user.room.targets[i];
      
      if (curTarget['_id'] == idInst[0] && 
          curTarget.instance == idInst[1]) {
        // Save target's fullNameID for message.
        var targetName = fullNameID(curTarget);
        
        destroyTarget(user, curTarget, i); // Remove from room, world & DB.
      
        // Inform all (including me) in the room about the removed target.
        for (var i=0; i < world.watch[strCoord].length; i++) {
          world.watch[strCoord][i].socket.emit('message', '<i><b>Creation ' + targetName
                                                          + ' has been successfully destroyed.</b></i>');
        }
        
        return;
      }
    }
    
    // Otherwise, target was not found.
    user.socket.emit('message', '<i><b>Target #' + idInst[0] + '.' + idInst[1] +
                                ' was not found.</b></i>');
  },
  /*  Removes a target from current room, last one in targets by default,
   *  or instance, last one by default.
   */
};

// World manipulation.
commands.master = {
  // modify room/ID(.INSTANCE) FIELD(.FIELD) VALUE
  'modify': function (user, cmdArray, cmdStr) {
    if (!cmdArray[1] || !cmdArray[2]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'modify room/ID FIELD VALUE</i>');
      return;
    }
    
    // Handle VALUE.
    if (!cmdArray[3]) {
      cmdArray[3] = '';
      cmdStr = '';
    } else {
      // Remove the here/ID and FIELD words from the string.
      for (var i=0; i < 2; i++) {
        cmdStr = cmdStr.substring(cmdStr.indexOf(" ") + 1); // VALUE, string of many words.
      }
    }
    
    var field = cmdArray[2].toLowerCase(); // Field is case-insensitive.

    // Do this for room and leave.
    if (cmdArray[1].toLowerCase() == 'room') {
      modifyRoom(user, field, cmdStr);
      return;
    }
    
    // Otherwise, this is a target.
    var idInstance = parseTarget(cmdArray[1]);
    
    if (!idInstance) {
      user.socket.emit('message', '<i>Target must be a number, such as \'0.0\'!</i>');
      return;
    }
    
    var idInstArray = idInstance.split('.');
    var id = idInstArray[0];
    var inst = idInstArray[1];
    
    // Original instance '-1' can be changed from anywhere.
    if (inst == '-1') {
      var curTarget = world.targets[id];
      
      // In case target is not loaded into world.targets object.
      if (!curTarget) {
        var fieldValueArray = [];
        fieldValueArray[0] = field;
        fieldValueArray[1] = cmdStr;
        
        loadTarget(user, idInstance, 'modify', fieldValueArray);
        return;
      }
      
      curTarget = curTarget['-1']; // Get original instance.
      
      modifyTarget(user, field, cmdStr, curTarget);
      return;
    }
    
    // Find the target ID and instance in this room.
    for (var i=0; i < user.room.targets.length; i++) {
      var curTarget = user.room.targets[i];
      
      if (curTarget['_id'] == id && curTarget['instance'] == inst) {
        var curTarget = user.room.targets[i];
        
        modifyTarget(user, field, cmdStr, curTarget);
        return;
      }
    }
    
    user.socket.emit('message', '<i>Could not find creation [' + idInstance + '] here.</i>');
  },
  /*  Modify an existing field in current room or target,
   *  or toggle an available object property (e.g. worn) or array item (e.g. commands).
   *  VALUE can be many words. Instance -1 is a special case, here.
   */
};

// Registered users, only.
commands.player = {
  // wear TARGET
  'wear': function (user, cmdArray) {
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'wear TARGET</i>');
      return;
    }
    
    // TARGET must be a number.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      user.socket.emit('message', '<i>Target must be a number, such as \'0.0\'!</i>');
      return;
    }
    
    var idInst = parsedTarget.split('.');
    
    // Load target data from DB, if not loaded, yet.
    // This should only be for items on players or targets.
    if (!world.targets[idInst[0]] || !world.targets[idInst[0]][idInst[1]]) {
      loadTarget(user, parsedTarget, 'wear');
    } else {
      // Try to hold existing target.
      wearTarget(user, world.targets[idInst[0]][idInst[1]]); // loadTarget makes this call, as well.
    }
  },
  /*  Wear an item from the room or hands.
   */
  
  // remove TARGET
  'remove': function (user, cmdArray) {
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'remove TARGET</i>');
      return;
    }
    
    // TARGET must be a number.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      user.socket.emit('message', '<i>Target must be a number, such as \'0.0\'!</i>');
      return;
    }
    
    var idInst = parsedTarget.split('.');
    
    // Load target data from DB, if not loaded, yet.
    // This should only be for items on players or targets.
    if (!world.targets[idInst[0]] || !world.targets[idInst[0]][idInst[1]]) {
      loadTarget(user, parsedTarget, 'remove');
    } else {
      // Try to remove existing target.
      removeTarget(user, world.targets[idInst[0]][idInst[1]]); // loadTarget makes this call, as well.
    }
  },
  /*  Remove a worn item and hold if possible, or drop to room.
   */
  
  // email
  'email': function (user) {
    // Try the socket user object for the data.
    if (user.account.email) {
      user.socket.emit('message', '<i>eMail for user ' + user.account.username + 
                        ' is: ' + user.account.email + '</i>');
      return;
    }
  },
  /*  Display email address.
   */
  
  // hold TARGET (HAND)
  'hold': function (user, cmdArray) {
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'hold TARGET (HAND)</i>');
      return;
    }
    
    // TARGET must be a number.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      user.socket.emit('message', '<i>Target must be a number, such as \'0.0\'!</i>');
      return;
    }
    
    var idInst = parsedTarget.split('.');
    
    // Parse hand.
    var hand = '';
    if (cmdArray[2]) hand = cmdArray[2].toLowerCase();
    
    // Load target data from DB, if not loaded, yet.
    // This should only be for items on players or targets.
    if (!world.targets[idInst[0]] || !world.targets[idInst[0]][idInst[1]]) {
      loadTarget(user, parsedTarget, 'hold', hand);
    } else {
      // Try to hold existing target.
      holdTarget(user, world.targets[idInst[0]][idInst[1]], hand); // loadTarget makes this call, as well.
    }
  },
  /*  Hold an item from the room in an empty hand, randomly or selected.
   */
  
  // drop TARGET
  'drop': function (user, cmdArray) {
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'drop TARGET</i>');
      return;
    }
    
    // TARGET must be a number.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      user.socket.emit('message', '<i>Target must be a number, such as \'0.0\'!</i>');
      return;
    }
    
    var idInst = parsedTarget.split('.');
    
    // Load target data from DB, if not loaded, yet.
    // This should only be for items on players or targets.
    if (!world.targets[idInst[0]] || !world.targets[idInst[0]][idInst[1]]) {
      loadTarget(user, parsedTarget, 'drop');
    } else {
      // Drop existing target.
      dropTarget(user, world.targets[idInst[0]][idInst[1]]); // loadTarget makes this call, as well.
    }
  },
  /*  Drop an item to the room, either from hands or worn.
   */
  
  // examine (PLAYER)
  'examine': function (user, cmdArray) {
    // By default examine myself.
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Examining yourself...</i><br /><pre>' + 
                        JSON.stringify(user.player, null, 2)
                        .replace(/[\[\]{}]/g, '') + '</pre>');
      return;
    }
    
    // Capitalize first letter and lower-case the rest.
    var fixedName = caseName(cmdArray[1]);
    
    // Locate the username in current room.
    for (var i=0; i < world.watch[strPos(user.player.position)].length; i++) {
      var curPlayer = world.watch[strPos(user.player.position)][i];
      
      if (curPlayer.account.name == fixedName) {
        user.socket.emit('message', '<i>Examining ' + fullNameID(curPlayer) + '...</i><br /><pre>' + 
                                          JSON.stringify(curPlayer.player.worn, null, 2)
                                          .replace(/[\[\]{}]/g, '') + '</pre>');
        return;
      }
    }
    
    // Otherwise, player was not found.
    user.socket.emit('message', '<i>Player ' + cmdArray[1] + ' was not found in this room.</i>');
  },
  /*  Examine the properties of players, or myself by default.
   */
  
  // offer TARGET ITEM (ITEM) ...
  'offer': function (user, cmdArray, cmdStr) {
    if (!cmdArray[1] || !cmdArray[2]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 
                        'offer TARGET/ANYONE ITEM(,AMOUNT) (ITEM)(,AMOUNT) ...</i>');
      return;
    }
    
    var items = cmdStr.substring(cmdStr.indexOf(" ") + 1);   // Remove TARGET from string.
    items = items.split(' ');    // An array of the items.
    
    // Parse items as targets.
    for (var i=0; i < items.length; i++) {
      var curItem = items[i];
      
      var parsedItem = parseTarget(curItem);
      
      // Item failed parsing as target.
      if (!parsedItem) {
        user.socket.emit('message', '<i>Items must be formatted as ID.INSTANCE, such as \'0.0\'.</i>');
        return;
      }
      
      // Replace item with its' parsed version.
      items[i] = parsedItem;
    }
    
    offerItems(user, cmdArray[1], items);
  },
  /*  Offer a target or another player an item or items by ID.INSTANCE
   *  that I have available in my hands.
   */
  
  // cancel OFFER
  'cancel': function (user, cmdArray) {
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'cancel OFFER</i>');
      return;
    }
    
    var offer = parseInt(cmdArray[1]);
    
    // OFFER must be an integer number.
    if (isNaN(offer)) {
      user.socket.emit('message', '<i>Offer must be a number!</i>');
      return;
    }
    
    cancelOffer(user, offer);
  },
  /*  Cancel an existing offer,
   *  by its' current index number.
   */
  
  // accept TARGET (OFFER)
  'accept': function (user, cmdArray) {
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'accept TARGET (OFFER)</i>');
      return;
    }
    
    // A specific offer has been requested.
    if (cmdArray[2]) {
      acceptItems(user, cmdArray[1], cmdArray[2]);
      return;
    }
    
    // Accept first available offer.
    acceptItems(user, cmdArray[1]);
  },
  /*  Accept an offer of items from a target or player,
   *  either by index, or the first (lowest index) available offer!
   */
  
  // attack TARGET
  'attack': function () {
    
  }
  /*  
   *  
   */
};

commands.user = {
  // say MESSAGE
  'say': function (user, cmdArray, cmdStr) {
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'say MESSAGE</i>');
      return;
    }
    
    // Speak to the room, only.
    for (var i=0; i < world.watch[strPos(user.player.position)].length; i++) {
      var curPlayer = world.watch[strPos(user.player.position)][i];
      
      if (curPlayer.account.username != user.account.username) {
        // Show my message to others.
        curPlayer.socket.emit('message', user.player.name + ' says: ' + cmdStr);
      } else {
        // Show me my message.
        user.socket.emit('message', 'You say: ' + cmdStr);
      }
    }
  },
  /*  Speak to the room.
  */
  
  // tell USERNAME MESSAGE
  'tell': function (user, cmdArray, cmdStr) {
    if (!cmdArray[1] || !cmdArray[2]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'tell USERNAME MESSAGE</i>');
      return;
    }
    
    // Cannot tell myself.
    if (cmdArray[1] == user.account.username) {
      user.socket.emit('message', '<i>You cannot tell yourself anything!</i>');
      return;
    }
    
    var username = caseName(cmdArray[1]); // Make it case-compatibale for usernames, for example 'Bob'.
    cmdStr = cmdStr.substring(cmdStr.indexOf(" ") + 1); // Remove TARGET part.
    
    // Find player by username in world.users.
    var targetUser = world.users[username];
    if (targetUser) {
      // Tell targret player.
      targetUser.socket.emit('message',
              user.player.name + 
              ( user.player.name !=  user.account.username ? '(' + user.account.username + ')' : '' ) + 
              ' tells you: ' + cmdStr);
      // Show me the message.
      user.socket.emit('message', 'You tell ' + fullNameID(targetUser) + ': ' + cmdStr);
    } else {
      // Not found.
      user.socket.emit('message', '<i>Username not found!</i>');
    }
  },
  /*  Speak to another player, anywhere in the world.
  */
  
  // move DIRECTION
  'move': function (user, cmdArray) {
    if (!cmdArray[1] || cmdArray[2]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'move DIRECTION</i>');
      return;
    }
    
    // Convert direction to coordinates.
    var curPos = user.player.position;
    var newPos = {};
    
    // Parse direction to new position. Returns false on failure.
    newPos = posDir(curPos, cmdArray[1].toLowerCase());

    /* ACTIVE ONLY FOR NON-BUILDERS
    var check = false; // Assume movement not possible.
    
    // Check that the exit exists in the current room.
    for (var i=0; i < user.room.exits.length; i++) {
      if (user.room.exits[i] == cmdArray[1]) {
        check = true;
      }
    }
    if (!check) {
      socket.emit('message', '<i>Exit not found!</i>');
      return;
    } */
    
    // Check that the exit is open.
    // N/A.
    
    // Move.
    if (newPos) {
      user.player.position = newPos;
      user.socket.emit('message', '<i>Moving to position ' + JSON.stringify(newPos) + '.</i>');
      loadRoom(user);
      return;
    }
    
    user.socket.emit('message', '<i>Exit not found!</i>');
  },
  /*  Asks to move to a new position in the same map.
  */
  
  // emote ACTION (TARGET)
  'emote': function (user, cmdArray) {
    if (!cmdArray[1]) {
      // Get a list of all available emotes.
      var emotes = '';
      for (emote in world.config.emotes) {
        emotes += emote + ', ';
      }
      emotes = emotes.slice(0, emotes.length-2);  // Remove last ', '
      
      user.socket.emit('message', 'The emotes available to you are:<br />' +
                                  '<i>' + emotes + '.</i>');
      return;
    }
    
    // Find emote.
    var curEmote = world.config.emotes[cmdArray[1]];
    if (!curEmote) {
      user.socket.emit('message', '<i>Emote ' + cmdArray[1] + ' not found!</i>');
      return;
    }
    
    // Options: curEmote.room.me/others
    //          curEmote.self.me/others
    //          curEmote.player.me/player/others
    //          curEmote.target.me/others
    
    // Emote to the room at-large.
    if (!cmdArray[2]) {
      // Show me the emote.
      user.socket.emit('message',  curEmote.room.me.replace('USER', user.player.name));
      
      // Show other players in the room.
      for (var i=0; i < world.watch[strPos(user.player.position)].length; i++) {
        var curUser = world.watch[strPos(user.player.position)][i];
        
        // Send with each user socket, except myself.
        if (curUser.account.username != user.account.username) {
          curUser.socket.emit('message', curEmote.room.others.replace('USER', user.player.name));
        }
      }
      
      return;
    }
    
    // Emote at a target or user.
    // In the special case of emoting to myself.
    if (caseName(cmdArray[2]) == user.account.username) {
      user.socket.emit('message', curEmote.self.me.replace('USER', user.player.name));
      
      // Show other players in the room.
      for (var i=0; i < world.watch[strPos(user.player.position)].length; i++) {
        var curUser = world.watch[strPos(user.player.position)][i];
        
        // Send with each user socket, except myself.
        if (curUser.account.username != user.account.username) {
          curUser.socket.emit('message', curEmote.self.others.replace('USER', user.player.name));
        }
      }
      
      return;
    }
    
    // Find the target or user in the room.
    var emoteTarget = false;
    // Try to find a user.
    for (var i=0; i < world.watch[strPos(user.player.position)].length; i++) {
      var curUser = world.watch[strPos(user.player.position)][i];
      
      if (curUser.account.username == caseName(cmdArray[2])) {
        emoteTarget = curUser.socket; // Refer to the socket.
        break;
      }
    }
    // If not found user, then try to find a target.
    if (!emoteTarget) {
      var arrTargets = world.maps[user.player.map].rooms[strPos(user.player.position)].targets;
      for (var i=0; i < arrTargets.length; i++) {
        var curTarget = arrTargets[i];
        
        var idInst = strTarget(curTarget);
        if (idInst == cmdArray[2]) {
          emoteTarget = curTarget;
          break;
        }
      }
    }
    // Otherwise, leave.
    if (!emoteTarget) {
      user.socket.emit('message', '<i>Could not find ' + cmdArray[2] + ' here!</i>');
      return;
    }
    
    // Player emote or target emote.
    if (!emoteTarget.instance) {
      // Show me the emote.
      user.socket.emit('message', curEmote.player.me.replace('USER2', caseName(cmdArray[2])));
      // Show the other player the emote.
      emoteTarget.emit('message', curEmote.player.player.replace('USER1', user.player.name));
      // Show others the emote.
      for (var i=0; i < world.watch[strPos(user.player.position)].length; i++) {
        var curUser = world.watch[strPos(user.player.position)][i];
        
        // Send with each user socket, except myself and emoteTarget player.
        if (curUser.account.username != user.account.username &&
            curUser.account.username != caseName(cmdArray[2])) {
          curUser.socket.emit('message', curEmote.player.others.replace('USER1', user.player.name)
                                                               .replace('USER2', caseName(cmdArray[2])));
        }
      }
    } else {
      // Show me the emote.
      user.socket.emit('message', curEmote.target.me.replace('TARGET', emoteTarget.name));
      
      // Show other players in the room.
      for (var i=0; i < world.watch[strPos(user.player.position)].length; i++) {
        var curUser = world.watch[strPos(user.player.position)][i];
        
        // Send with each user socket, except myself.
        if (curUser.account.username != user.account.username) {
          curUser.socket.emit('message', curEmote.target.others.replace('USER', user.player.name)
                                                               .replace('TARGET', emoteTarget.name));
        }
      }
    }
  },
  /*  Act an emotion or gesture generally or towards a target or player.
  */

  // look (TARGET)
  'look': function (user, cmdArray) {
    var curRoom = user.room;
    var strCoord = strPos(curRoom.position);
    
    // Just look at the current room.
    if (!cmdArray[1]) {
      // Defaults.
      var title = ( !curRoom.title || curRoom.title == '' ? 'Unknown Room' : curRoom.title );
      
      var players = '';
      for (var i=0; i < world.watch[strCoord].length; i++) {
        players += fullNameID(world.watch[strCoord][i]) + ', ';
      }
      players = players.slice(0, -2); // Remove last ', '.
      players += '.'; // Finish with a period.
      
      var targets = '';
      for (var i=0; i < curRoom.targets.length; i++) {
        targets += fullNameID(curRoom.targets[i]) + ', ';
      }
      targets = ( !targets ? 'Nothing.' : targets.slice(0, -2) ); // Remove last ', '.
      
      var description = 'None';
      if (curRoom.description && curRoom.description != '') {
        description = curRoom.description;
      }
      
      var commands = ( curRoom.commands.length == 0 ? 'None.' : curRoom.commands.join(', ') );
      var exits = ( curRoom.exits.length == 0 ? 'None.' : curRoom.exits.join(', ') );
      
      user.socket.emit('message', '<b>Title: ' + title + '</b><br />' + 
        'Map: ' + curRoom.map + '<br />' +
        'Players: ' + players + '<br />' +
        'Targets: ' + targets + '<br />' +
        'Description: ' + description + '<br />----------<br />' +
        'Commands: ' + commands + '<br />' +
        'Exits: ' + exits + '<br />');
      return;
    }
     
    // Find the target in the current room, by name (case insensitive),
    // by id/id.instance, or by partial string match (case insensitive) 
    // inside target name (e.g: 'stick' -> 'Lots of Funny Sticks').
    for (var i=0; i < curRoom.targets.length; i++) {
      if (cmdArray[1] == strTarget(curRoom.targets[i]) ||
          cmdArray[1] == curRoom.targets[i]['_id'] ||
          cmdArray[1].toLowerCase() == curRoom.targets[i].name.toLowerCase() ||
          curRoom.targets[i].name.toLowerCase().search(cmdArray[1].toLowerCase()) >= 0) {
        
        var curTarget = curRoom.targets[i];
        
        // Create the display text.
        var targetText = '';
        
        for (var propertyName in curTarget) {
          var curProperty = curTarget[propertyName];
          
          // Options: [object Array], [object String], [object Object]
          var propertyData = '';
          switch (toType(curProperty)) {
            case '[object String]':
              propertyData = '\"' + curProperty + '\"';
              break;
            
            case '[object Array]':
              propertyData = '[' + curProperty.join(', ') + ']';
              break;
            
            case '[object Object]':
              propertyData = '<pre style="font-size: 90%; display: inline;">' +
                              JSON.stringify(curProperty, null, 2) + '</pre>';
              break;
            
            default:
              propertyData = curProperty;
          }
          
          targetText += '<b>' + propertyName + ':</b> ' +  propertyData + '<br />';
        }
        
        // Display target data.
        user.socket.emit('message', targetText + '<br />');
        return;
      }
    }
    
    // Otherwise, target not found.
    user.socket.emit('message', '<i>Target #' + cmdArray[1] + ' not found.</i>');
  },
  /*  Only 'look' shows the current room data.
  */

  // rename USERNAME
  'rename': function (user, cmdArray) {
    // Make sure there is actually a name to change into.
    if (!cmdArray[1]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'rename USERNAME</i>');
      return;
    }
    
    // Exceptions to accepted usernames.
    var testName = cmdArray[1].toLowerCase().trim();
    var exceptions = ['you', 'me', 'it', 'we', 'us', 'he', 'she', 'them', 'they', 'those', 'these'];
    if (exceptions.indexOf[testName]) {
      user.socket.emit('message', '<i><b>' + caseName(cmdArray[1]) + 
                                  '</b> cannot be used as a username!</i>');
      return;
    }

    // Should return false to continue here.
    var tryParse = parseUsername(cmdArray[1]);
    if (tryParse) {
      user.socket.emit('message', tryParse); // Error.
      return;
    }

    // Returns a username with first letter uppercase and the rest lowercase.
    var fixedUsername = caseName(cmdArray[1]);
    
    // Save old name to alert everyone of this change.
    var oldName = user.player.name;

    // Check if username is already registered.
    usersdb.findOne({ 'account.username': fixedUsername }, function (e, acct) {
      if (acct) {
        user.socket.emit('message', '<i>Username ' + fixedUsername + ' is already registered!</i>');
        return;
      }
      
      var newUser = {}; newUser.account = {}; newUser.player = {}; // Create new user object.
      newUser.account.username = fixedUsername; // Assign new name...
      newUser.player.name = fixedUsername;      // ...
      
      updateUser(user, newUser); // Update!
      
      user.socket.emit('message', '<i>You have changed your name to ' + user.player.name + '.</i>');
      // And alert everyone about this...
      user.socket.broadcast.emit('message', '<i>' + oldName + ' is now known as ' + 
                                                          user.player.name + '.</i>');
    });
  },
  /*  Rename into a non-registered username, changing player name, as well.
  */

  // login USERNAME PASSWORD
  'login': function (user, cmdArray) {
    // Make sure there is both a username and a password.
    if (!cmdArray[1] || !cmdArray[2]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'login USERNAME PASSWORD</i>');
      return;
    }

    // Returns a username with first letter uppercase and the rest lowercase.
    var fixedUsername = caseName(cmdArray[1]);
    
    // Check that the username isn't already logged in world.
    if (world.users[fixedUsername]) {
      user.socket.emit('message', '<i>That username is already logged-in!</i>');
      return;
    }

    // Save old name to alert everyone of this change.
    var oldName = user.player.name;

    // Check if username is already registered.
    usersdb.findOne({ 'account.username': fixedUsername }, function (err, acct) {
      if (err) {
        console.log(err);
      }
      
      if (!acct) {
        user.socket.emit('message', '<i>Username ' + fixedUsername + ' is not registered, yet.</i>');
        return;
      }

      // Wrong password check.
      if (acct.account.password != cmdArray[2]) {
        user.socket.emit('message', '<i>Wrong password!</i>');
        return;
      }

      // Login
      updateUser(user, acct); // Update!
      
      // Update 'lastonline'.
      user.account.lastonline = new Date();
      
      user.socket.emit('message', '<i>You are now logged into the account of ' + 
                                           user.account.username + '.</i>');
      // And alert everyone about this...
      user.socket.broadcast.emit('message', '<i>' + oldName + ' is now known as ' + 
                                                    user.player.name + '.</i>');
      
      // Load updated position.
      loadRoom(user);
    });
  },
  /*  Log into a registered user, but fail if user is already logged-in.
  */

  // register PASSWORD EMAIL
  'register': function (user, cmdArray) {
    // Check for both password and email.
    if (!cmdArray[1] || !cmdArray[2]) {
      user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'register PASSWORD EMAIL</i>');
      return;
    }

    // Look for username in the DB. The rest is nested for proper order of events.
    usersdb.findOne({ 'account.username': user.account.username }, function (err, acct) {
      if (err) {
        console.log(err);
      }
      
      // Check if user is already registered.
      if (acct) {
        user.socket.emit('message', '<i>The username ' + user.account.username +
                                                  ' is already registered.</i>');
        return;
      }

      // Register new username.
      usersdb.insert({
        // Account
        'account': {
          'username': user.account.username,
          'password': cmdArray[1],
          'email': cmdArray[2],
          'registered': new Date(),
          'lastonline': new Date(),
          'access': 'god'
        },
        // Player
        'player': {
          'name'        :   user.player.name,
          'map'         :   user.player.map,
          'position'    :   user.player.position,
          'description' :   'A commoner.',
          'pre'         :   'Kind',                       // Comes before the name.
          'post'        :   'the Commoner',               // Comes after the name.
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
      }, function (err) {
        if (err) {
          console.log(err);
        }
        
        // Send message.
        user.socket.emit('message', '<i>You have now registered as ' + user.player.name + '.</i>');

        // Send email.
        nodemailer.mail({
          from: "Test Game <phuein@gmail.com>", // sender address
          to: cmdArray[2], // list of receivers
          subject: "Welcome to Test Game, " + user.account.username + ".", // Subject line
          // text: "Hello world ✔", // plaintext body
          html: "<b>✔ Registration is complete.</b><br /><br/>Your password for the username <i>" + 
                  user.account.username + "</i> is:  " + cmdArray[1] // html body
        });

        // Login.
        usersdb.findOne({ 'account.username': user.account.username }, function (err, acct) {
          if (err) {
            console.log(err);
          }
            
          if (acct) {
            updateUser(user, acct); // Login - Update user object.

            user.socket.emit('message', '<i>You are now logged into the account ' + 
                                                user.account.username + '.</i>');
          }
        });
      });
    });
  },
  /*  And login on success.
  */
  
  // help
  'help': function (user) {
    var commandsDisplay = '';
    
    // Show commands according to access level.
    switch (user.account.access) {
      case 'god':
        for (var category in commands) {
          var curCategory = commands[category].descriptions;
          
          for (var i=0; i < curCategory.length; i++) {
            commandsDisplay += cmdChar + curCategory[i] + '<br />';
          }
        }
        break;
      
      case 'builder':
        for (var category in commands) {
          // Skip god commands.
          if (category == 'god') {
            continue;
          }
          
          var curCategory = commands[category].descriptions;
          
          for (var i=0; i < curCategory.length; i++) {
            commandsDisplay += cmdChar + curCategory[i] + '<br />';
          }
        }
        break;
      
      case 'master':
        for (var category in commands) {
          // Skip god and builder commands.
          if (category == 'god' || category == 'builder') {
            continue;
          }
          
          var curCategory = commands[category].descriptions;
          
          for (var i=0; i < curCategory.length; i++) {
            commandsDisplay += cmdChar + curCategory[i] + '<br />';
          }
        }
        break;
      
      case 'player':
        for (var category in commands) {
          // Skip god, builder, and master commands.
          if (category == 'god' || category == 'builder' || category == 'master') {
            continue;
          }
          
          var curCategory = commands[category].descriptions;
          
          for (var i=0; i < curCategory.length; i++) {
            commandsDisplay += cmdChar + curCategory[i] + '<br />';
          }
        }
        break;
      
      case 'user':
        var curCategory = commands['user'].descriptions;
        
        for (var i=0; i < curCategory.length; i++) {
          commandsDisplay += cmdChar + curCategory[i] + '<br />';
        }
        break;
    }
    
    user.socket.emit('message', '<i>The following commands are available to you:</i>' + '<br />' + 
      commandsDisplay);
  }
  /*  Display command usage and list all available commands,
   *  by account access level.
   */
};

// List descriptions in arrays, under each category. //
  commands.god.descriptions = [
    '<b>set</b>' + 
          '<br />Sets a value into any world.config property.'
  ];

  commands.builder.descriptions = [
    '<b>create NAME</b>' + 
          '<br />Create a new target where you stand.',
    
    '<b>destroy ID.INSTANCE</b>' + 
          '<br />Removes a target from current room, ' +
          'last one in targets by default, or instance, last one by default.'
  ];

  commands.master.descriptions = [
    '<b>modify room/ID(.INSTANCE) FIELD(.FIELD) VALUE</b>' + 
        '<br />Modify an existing field of the current room, or in a target instance.'
  ];

  commands.player.descriptions = [
    '<b>wear TARGET</b>' + 
          '<br />Wear an item from the room or hands.',
    
    '<b>remove TARGET</b>' + 
          '<br />Remove a worn item and hold if possible, or drop to room.',
    
    '<b>email</b>' + 
          '<br />Display your registered account email.',
    
    '<b>hold TARGET (HAND)</b>' + 
          '<br />Hold an item from the room in an empty hand, randomly or selected.',
    
    '<b>drop TARGET</b>' + 
          '<br />Drop an item to the room, either from hands or worn.',
    
    '<b>examine (PLAYER)</b>' + 
        '<br />Examine the properties of players, or myself by default.',
    
    '<b>offer TARGET ITEM (ITEM)</b>' + 
        '<br />Offer to give an item, and optionally expect an item in return.',
    
    '<b>request ITEM (ITEM)</b>' + 
        '<br />Request an item, and optionally offer an item in return.',

    '<b>accept TARGET ITEM</b>' + 
        '<br />Accept an offer or request of an item.'
  ];

  commands.user.descriptions = [
    '<b>say MESSAGE</b>' + 
          '<br />Speak to the room.',
    
    '<b>tell USERNAME MESSAGE</b>' + 
          '<br />Speak to another player, anywhere in the world.',
    
    '<b>move DIRECTION</b>' + 
          '<br />Move in an available direction.',
    
    '<b>emote</b>' + 
          '<br />Act an emotion or gesture generally or towards a target.',
        
    '<b>look (TARGET)</b>' + 
          '<br />Look at the current room or at a target.',
    
    '<b>rename USERNAME</b>' + 
          '<br />Rename into an available username.',
    
    '<b>login USERNAME PASSWORD</b>' + 
          '<br />Log into your existing account.',
    
    '<b>register PASSWORD EMAIL</b>' + 
          '<br />Register your current username.'
  ];
// *** //

// Handle command requests from player, according to user.account.access level.
function handleCommands(message, user) {  
  // Ignore first character and split the message into words.
  var cmdArray = message.substring(1).split(" ", 10);
  
  // Get everything after the command word, as a string.
  var cmdStr = message.substring(1); // Remove cmdChar
  cmdStr = cmdStr.substring(cmdStr.indexOf(" ") + 1); // Remove first (command) word,
                                                      // or return the command word itself.
  
  // Execute help command, if only the command character is received.
  if (!cmdArray[0]) {
    handleCommands(cmdChar + 'help', user);
    return;
  }

  // Make sure the command exists, according to user access level, and is not 'descriptions'.
  var cmd = commandExists(cmdArray[0], user.account.access);
  
  if (!cmd || cmdArray[0] == 'descriptions') {
    user.socket.emit('message', '<i>Command not found!</i>');
    return;
  }
  
  cmd(user, cmdArray, cmdStr);
}

/*
 *  Commands may extend to handle different complex situations,
 *  using their own functions that recognize each other.
 */

// After a target has moved,
// update the DB with the user object & current room.
function targetMoved(user) {
  // Update DB with relevant properties.
  var userObj = {};
  userObj.account = user.account;
  userObj.player = user.player;
  userObj['_id'] = user['_id'];
  
  world.changed.users.push(userObj);
  world.changed.rooms.push(user.room);
}

// Loads the target's data into the world object, and continue command.
// This happens in case a target is requested by ID.INSTANCE,
// but is not available in the world object, for any reason.
function loadTarget(user, idInstance, command, extra) {
  var idInst = idInstance.split('.'); // Turn into array.
  
  var instanceObj = {};
  instanceObj['_id'] = parseInt(idInst[0]);
  instanceObj[idInst[1]] = { '$exists': true };
  
  targetsdb.findOne(instanceObj, function (err, target) {
    if (err) {
      console.log(err);
      return;
    }
    
    if (!target) {
      user.socket.emit('message', '<i>Creation [' + idInstance + '] could not be found.</i>');
      return;
    }
    
    // Refer only to the instance object iself.
    instance = target[idInst[1]];
    
    // Load target to world object.
    if (!world.targets[idInst[0]]) {
      world.targets[idInst[0]] = {};
      world.targets[idInst[0]]['_id'] = idInst[0];
    }
    
    world.targets[idInst[0]][idInst[1]] = instance;
    
    // Make sure extra is not undefined.
    if (extra == undefined) var extra = '';
    
    // Run the requested command.
    switch (command) {
      case 'hold':
        holdTarget(user, world.targets[idInst[0]][idInst[1]], extra);
        break;
      
      case 'drop':
        dropTarget(user, world.targets[idInst[0]][idInst[1]]);
        break;
      
      case 'wear':
        wearTarget(user, world.targets[idInst[0]][idInst[1]]);
        break;
       
      case 'remove':
        removeTarget(user, world.targets[idInst[0]][idInst[1]]);
        break;
      
      case 'modify':
        modifyTarget(user, extra[0], extra[1], world.targets[idInst[0]][idInst[1]]);
        break;
      
      default:
        console.log('loadTarget(' + user + ', ' + idInstance + ', ' + command +
                                          ', ' + extra + '): NO CASE MATCHED!');
    }
  });
}

//*** EXPORTS ***//
  exports.handleCommands  =   handleCommands;
  exports.loadRoom        =   loadRoom;
  exports.saveWorld       =   saveWorld;
  exports.saveUser        =   saveUser;
  exports.configureWorld  =   configureWorld;
  
  exports.fullNameID      =   fullNameID;
  exports.strPos          =   strPos;
// *** //