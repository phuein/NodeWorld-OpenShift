/*
 *  Functions that either relate specifically to the world object,
 *  or to the construction of the fundamental world parts.
 */
 
 // Setup all the defaults in-world configurations,
// such as global physics and global command options.
function configureWorld() {
  var saveID = world.config['_id'];
  
  world.config = {}; // Reset object!
  
  if (saveID) {
    world.config['_id'] = saveID;
  }
  
  world.config.size = constructor.size;
  
  world.config.weight = constructor.weight;
  
  world.config.emotes = constructor.emotes;
  
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
    var mapObj = {};
    mapObj['rooms.' + strCoord] = room; // Have a keyed room name field.
    
    mapsdb.update({ '_id': room.map }, { $set: mapObj }, function (err) {
      if (err) {
        console.log('ERROR IN saveWorld() DB UPDATE FOR rooms!');
        console.log(err);
      }
    });
  }

  function saveMap(map) {
    mapsdb.save(map, function (err) {
      if (err) {
        console.log('ERROR IN saveWorld() DB UPDATE FOR maps!');
        console.log(err);
      }
    });
  }

  function saveConfig() {
    worlddb.save(world.config, function(err) {
      if (err) {
        console.log('ERROR IN saveWorld() DB UPDATE FOR config!');
        console.log(err);
      }
      
      world.changed.config = false; // Cleanup, even if requested without saveWorld(),
                                    // because it saves all anyway.
    });
  }
// *** //

// Called by loadRoom.
function processRoom(user, state) {
  // A shortened name for the same user position object.
  var curPos = user.player.room;
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
      socketHandler(world.watch[lastRoomStr][i], 'info', fullNameID(user) +
                                                        ' has moved away.');
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
    socketHandler(world.watch[strCoord][i], 'info', 'Player ' + user.player.name + ' has appeared.');
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

// Load current room data.
function loadRoom(user) {
  // A shortened name for the same user position object.
  var curPos = user.player.room;
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
  var roomObj = constructor.room(user.player.map, roomPos);
  
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
      socketHandler(user, 'info', 'The first room in the world has been created successfully!');
    } else if (x == 0 && y == 0 && z == 0) {
      socketHandler(user, 'info', 'The first room in the map has been created successfully.');
    } else {
      socketHandler(user, 'info', 'Room at ' + strPos + ' has been created successfully.');
    }
    
    processRoom(user, 'new'); // Apply room data.
  });
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

// Creates a new map. Automatic ID by increments from DB. Loads to world object.
// Puts user in map and creates first room at 0x0y0z.
function createMap(user) {
  // map object. '_id' value set further on, here.
  var mapObj = constructor.map();
  
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
      socketHandler(user, 'info', 'The first map of this world has been created successfully!');
    } else {
      socketHandler(user, 'info', 'Map #' + mapObj['_id'] + ' has been created successfully.');
    }
  });
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
      user.player.room = { 'x': 0, 'y': 0, 'z': 0 }; // If player tried moving to any other coord.
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

/*
 *  Commands may extend to handle different complex situations,
 *  using their own functions that recognize each other.
 */

// After a target has moved in relation to a user,
// update the DB with the user object & current room.
function targetMoved(user) {
  world.changed.users.push(user);
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
      socketHandler(user, 'warning', '<i>Creation [' + idInstance + '] could not be found.</i>');
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
  exports.configureWorld  =   configureWorld;
  exports.saveWorld       =   saveWorld;
  exports.saveUser        =   saveUser;
  exports.saveTarget      =   saveTarget;
  exports.deleteTarget    =   deleteTarget;
  exports.saveRoom        =   saveRoom;
  exports.saveMap         =   saveMap;
  exports.saveConfig      =   saveConfig;
  exports.processRoom     =   processRoom;
  exports.loadRoom        =   loadRoom;
  exports.createRoom      =   createRoom;
  exports.loadMap         =   loadMap;
  exports.createMap       =   createMap;
  exports.loadMapWorld    =   loadMapWorld;
  exports.loadMapDB       =   loadMapDB;
  exports.targetMoved     =   targetMoved;
  exports.loadTarget      =   loadTarget;
// *** //