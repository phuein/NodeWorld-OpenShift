/*
 *  World editing and creation command functions.
 */

/*
 *  Master commands.
 */

// Creates a new instance of a target, in the room, by ID.
// Emits a socket message on failure or success.
function cloneTarget(user, id) {
  targetsdb.findOne({ '_id': id }, function (err, target) {
    if (err) {
      console.log(err);
      socketHandler(user, 'warning', 'Failed to load a new creation [' + id + '] instance!');
      return;
    }
    
    if (!target) {
      socketHandler(user, 'warning', 'Creation [' + id + '] could not be found!');
      return;
    }
    
    var strCoord = strPos(user.player.position);
    
    // Get highest instance number.
    var curInstance = 0;
    for (var instanceName in target) {
      var instance = target[instanceName];
      
      if (instance.instance >= curInstance) {
        curInstance = instance.instance + 1; // Always add one to highest instance value available.
      }
    }
    
    // In case target id is not loaded in world, then define 
    if (!world.targets[target['_id']]) {
      world.targets[target['_id']] = {};
      world.targets[target['_id']]['_id'] = id;
    }
    
    // Get the original instance.
    target = target['-1'];
    
    target.instance = curInstance; // Give it its' instance number.
    
    // Add instance to world targets.
    world.targets[target['_id']][curInstance] = target; // Referred by '_id' & instance number.
    
    // Insert the instance into the room.
    field.push(target);
    
    // Update DB immediately.
    saveTarget(target);
    saveRoom(curRoom);

    // Inform all (including me) in the room about the new target instance.
    for (var i=0; i < world.watch[strCoord].length; i++) {
      socketHandler(world.watch[strCoord][i], 'info', 'Creation ' + fullNameID(target) + 
                                                        ' has been added to the room.');
    }
  });
}

// Modify an existing field of the current room.
function modifyRoom(user, fieldName, value) {
  // Some fields cannot be modified.
  if (fieldName == 'players' || fieldName == '_id' || fieldName == 'map' || fieldName == 'position') {
    socketHandler(user, 'warning', 'This field cannot be modified!');
    return;
  }
  
  var curRoom = user.room;
  var field = curRoom[fieldName];
  
  // Check field type.
  switch(toType(field)) {
    case '[object Array]':
      // Arrays must get a value.
      if (!value || value.trim() == '') {
        socketHandler(user, 'warning', 'This field must recieve an actual value to be modified!');
        return;
      }
      
      // Either targets[], commands[], or exits[].
      
      if (fieldName == 'targets') {
        // Loads an instance of the target in the room, from DB.
        var id = parseInt(value); // Number or NaN.
        if (isNaN(id)) {
          socketHandler(user, 'warning', 'Targets must be identified by an ID number!');
          return;
        }
        
        cloneTarget(id);
        return;
      }
      
      if (fieldName == 'commands') {
        if (commandExists(value)) {
          // Remove an existing command.
          var i = field.indexOf(value); // -1 if not found.
          
          if (i >= 0) {
            field.splice(i, 1); // Remove from array.
            socketHandler(user, 'info', 'Command ' + value + ' has been removed.');
            break;
          }
          
          // Or add command to room.
          field.push(value);
          socketHandler(user, 'info', 'Command ' + value + ' has been added to the room!');
          break;
        }
        
        // Otherwise, no such command.
        socketHandler(user, 'warning', 'Command ' + value + ' does not exist!');
        return;
      }
      
      if (fieldName == 'exits') {
        var tryExit = posDir(user.player.position, value); // Returns a new position or false.
        
        if (tryExit) {
          // Remove an existing exit.
          var i = field.indexOf(cmdArray[3]); // -1 if not found.
          
          if (i >= 0) {
            field.splice(i, 1); // Remove from array.
            socketHandler(user, 'info', 'Exit ' + value + ' has been removed.');
            break;
          }
          
          // Or add the exit.
          field.push(value);
          socketHandler(user, 'info', 'Exit ' + value + ' has been added.');
          break;
        }
        
        // Otherwise, no such exit option.
        socketHandler(user, 'warning', 'Exit ' + value + ' does not exist!');
        return;
      }
      
      // Array of such field not defined in options above.
      socketHandler(user, 'warning', 'This field cannot be modified!');
      return;
    
    case '[object String]':
      // Room title can only be English letters and spaces.
      if (fieldName == 'title') {
        var parsed = parseName(value); // True or false.
        if (!parsed) {
          socketHandler(user, 'warning', 'Room titles must be composed only of letters and spaces!');
          return;
        }
      }
      
      curRoom[fieldName] = value; // Replace.
      socketHandler(user, 'info', 'Value of field ' + fieldName + ' was changed successfully.');
      break;
    
    case '[object Number]':
      value = parseFloat(value);
      // Check value parsed as number.
      if (isNaN(value)) {
        socketHandler(user, 'warning', 'This field must receive a numeric value!');
        return;
      }
      
      curRoom[fieldName] = value;
      socketHandler(user, 'info', 'Value of field ' + fieldName + ' has been changed successfully.');
      break;
      
    case '[object Undefined]':
      socketHandler(user, 'warning', 'Field ' + fieldName + ' cannot be found.');
      return;
    
    default:
      socketHandler(user, 'warning', 'This field cannot be modified!');
      return;
  }
  
  // Save room immediately to DB.
  saveRoom(curRoom);
}

// Modify an existing field of a target, in the current room.
function modifyTarget(user, fieldName, value, target) {
  var curRoom = user.room;
  
  // Some fields cannot be modified.
  if (fieldName == '_id' || fieldName == 'instance') {
    socketHandler(user, 'warning', 'This field cannot be modified!');
    return;
  }
  
  var field = hasProperty(target, fieldName); // Array with parent and name, or false.
  var fieldParent = field[0];
  var fieldName = field[1]; // The actual field name - not the dotted string.
  
  // Field doesn't exist.
  if (!field) {
    socketHandler(user, 'warning', 'Field ' + fieldName + ' not found!');
    return;
  }
  
  var fullID = strTarget(target); // 'ID.INSTANCE'
  
  // Options: position{}, commands[], size[], weight[], worn{}, offers[], requests[].
  switch(toType(fieldParent[fieldName])) {
    case '[object Object]':
      // Add or remove sub-fields.
      if (fieldName == 'worn' || fieldName == 'hands') {
        value = value.toLowerCase(); // Value is a property name.
        
        // Sub-field exists, then remove.
        if (fieldParent[fieldName][value]) {
          delete field[value];
          socketHandler(user, 'info', 'The field ' + value + ' has been successfully removed.');
          break;
        }
        
        // Otherwise, sub-field doesn't exist, so create.
        fieldParent[fieldName][value] = '';
        socketHandler(user, 'info', 'The field ' + value + ' has been successfully added.');
        break;
      }
      
      // Field not in the above options.
      socketHandler(user, 'warning', 'This field cannot be modified directly.');
      return;
    
    case '[object Array]':
      // Add or remove an existing command.
      if (fieldName == 'commands') {
        value = value.toLowerCase(); // Commands are lower-case.
        
        // Command must exist in commands, under access level.
        var cmd = commandExists(value, user.account.access);
        if (!cmd) {
          socketHandler(user, 'warning', 'The command ' + value + ' is not available.');
          return;
        }
        
        // Remove an existing command.
        for (var i=0; i < fieldParent[fieldName].length; i++) {
          if (fieldParent[fieldName][i] == value) {
            fieldParent[fieldName].splice(i, 1);
            socketHandler(user, 'info', 'The command ' + value + 
                          ' has been removed successfully from creation ' + fullID + '.');
            break;
          }
        }
        
        // Otherwise, command not found. Add it.
        fieldParent[fieldName].push(value);
        socketHandler(user, 'info', 'The command ' + value + 
                            ' has been added successfully to creation ' + fullID + '.');
        break;
      }
      
      // 
      if (fieldName == 'offers') {
        
      }
      
      if (fieldName == 'requests') {
        
      }
      
      // Field is not in the above options.
      socketHandler(user, 'warning', 'This field cannot be modified!');
      return;
    
    case '[object String]':
      // Size or weight must be an existing option in world.config .size[] or .weight[].
      if (fieldName == 'size' || fieldName == 'weight') {
        value = value.toLowerCase(); // Measures are lower-case.
        
        // Value must either be an existing index or item.
        var ind = world.config[fieldName].indexOf(value); // Find by requested value.
        var item = world.config[fieldName][value.parseInt()]; // Find by requested index.
        if (!item && ind == '-1') {
          socketHandler(user, 'warning', 'The ' + fieldName + ' value ' + value + ' is not available.');
          return;
        }
      }
      
      // Target name (name, pre, post) can only be English letters and spaces.
      if (fieldName == 'name' || fieldName == 'pre' || fieldName == 'post') {
        var parsed = parseName(value); // True or false.
        if (!parsed) {
          socketHandler(user, 'warning', 'Creation names must be composed only of letters and spaces!');
          return;
        }
      }
      
      // Make the change.
      fieldParent[fieldName] = value;
      socketHandler(user, 'info', 'Value of field ' + fieldName + ' has been changed successfully.');
      break;
    
    case '[object Number]':
      value = parseFloat(value);
      // Check value parsed as number.
      if (isNaN(value)) {
        socketHandler(user, 'warning', 'This field must receive a numeric value!');
        return;
      }
      
      fieldParent[fieldName] = value;
      socketHandler(user, 'info', 'Value of field ' + fieldName + ' has been changed successfully.');
      break;
    
    case '[object Undefined]':
      socketHandler(user, 'warning', 'Field ' + fieldName + ' cannot be found.');
      return;
    
    default:
      socketHandler(user, 'warning', 'This field cannot be modified directly.');
      return;
  }
  
  // Immediately save changes to DB.
  saveTarget(target);
  saveRoom(curRoom);
}

/*
 *  Builder commands.
 */

// Removes target instance from room, world & DB,
// but will not remove instance 0 from DB.
function destroyTarget(user, target, i) {
  // Save data before the removal, for message.
  var curID = target['_id'];
  var curInstance = target.instance;
  var curName = target.name;

  // Remove from world targets. Notice that instance is not an index!
  delete world.targets[target['_id']][target.instance];
  
  // Add to changed objects for next DB update.
  if (target.instance != '0') {
    // Original instance cannot be removed from DB here.
    user.room.targets[user.room.targets.length-1].remove = true; // Tells world saver to remove it.
    world.changed.targets.push(user.room.targets[user.room.targets.length-1]);
  }
  world.changed.rooms.push(user.room);
  
  user.room.targets.splice(i, 1); // Remove from room.
}

/*  
 *  God commands.
 */

// Temporarily disable the world, kick all users, 
// and clear all server & DB data.
function resetWorld(user) {
  // Disable new socket connections, and disable saveWorld();
  serverClosed = true;
  
  // Disconnect all sockets in world.users.
  for (userName in world.users) {
    var curSock = world.users[userName].socket;
    curSock.disconnect();
  }
  
  // Empty globals.
  setWorld();
  
  // Reload world configuration.
  configureWorld();
  
  // Empty DB - only removing all documents, without dropping collections.
  usersdb.remove(function (err) {
    if (err) {
      console.log('Error in resetWorld in USERSDB:' + nl + err);
      return;
    }
  });
  targetsdb.remove(function (err) {
    if (err) {
      console.log('Error in resetWorld in USERSDB:' + nl + err);
      return;
    }
  });
  mapsdb.remove(function (err) {
    if (err) {
      console.log('Error in resetWorld in USERSDB:' + nl + err);
      return;
    }
  });
  worlddb.remove(function (err) {
    if (err) {
      console.log('Error in resetWorld in USERSDB:' + nl + err);
      return;
    }
  });
  
  // Enable new socket connections, and enable saveWorld().
  serverClosed = false;
  
  console.log(Timestamp() + 'World has been reset!');
}

// Remove from cache and require again the code files:
// commands.js -> adminFunctions.js, playerFunctions.js
// constructors.js
function reloadCode(user) {
  // Remove modules from cache.
  delete require.cache[require.resolve('./commands.js')];
  delete require.cache[require.resolve('./constructors.js')];
  
  // require() them again.
  command = require('./commands.js');
  constructors = require('./constructors.js');
  
  console.log(Timestamp() + 'The code files have been reloaded successfully!');
  socketHandler(user, 'info', 'The code files have been reloaded successfully!');
}

//*** EXPORTS ***//
  exports.cloneTarget       =   cloneTarget;
  exports.modifyRoom        =   modifyRoom;
  exports.modifyTarget      =   modifyTarget;
  exports.destroyTarget     =   destroyTarget;
  exports.resetWorld        =   resetWorld;
  exports.reloadCode        =   reloadCode;
// *** //