/*  
 *  Command functions are called from the server only,
 *  to process data requests from the client,
 *  and send the results by socket.
 */

//*** MODULE DEPENDENCIES ***//

  //***  eval() is used, because the code is split into files for readability, only!  ***//
  
  if (require.cache[require.resolve('nodemailer')]) {
    delete require.cache[require.resolve('nodemailer')];
  }
  
  var nodemailer = require('nodemailer');
  
  // Clear cache, for a new copy.
  if (require.cache[require.resolve('./operations.js')]) {
    delete require.cache[require.resolve('./operations.js')];
  }
  
  var operations = require('./operations.js');
  
  // Have a local variable referring to each operation.
  for (var opName in operations) {
    eval('var ' + opName + ' = ' + operations[opName] + ';');
  }
  
  // Clear cache, for a new copy.
  if (require.cache[require.resolve('./worldFunctions.js')]) {
    delete require.cache[require.resolve('./worldFunctions.js')];
  }
  
  var worldFunctions = require('./worldFunctions.js');
  
  // Have a local variable referring to each operation.
  for (var functionName in worldFunctions) {
    eval('var ' + functionName + ' = ' + worldFunctions[functionName] + ';');
  }
  
  // Clear cache, for a new copy.
  if (require.cache[require.resolve('./adminFunctions.js')]) {
    delete require.cache[require.resolve('./adminFunctions.js')];
  }
  
  var adminFunctions = require('./adminFunctions.js');
  
  // Have a local variable referring to each function.
  for (var functionName in adminFunctions) {
    eval('var ' + functionName + ' = ' + adminFunctions[functionName] + ';');
  }
  
  // Clear cache, for a new copy.
  if (require.cache[require.resolve('./playerFunctions.js')]) {
    delete require.cache[require.resolve('./playerFunctions.js')];
  }
  
  var playerFunctions = require('./playerFunctions.js');
  
  // Have a local variable referring to each function.
  for (var functionName in playerFunctions) {
    eval('var ' + functionName + ' = ' + playerFunctions[functionName] + ';');
  }
// *** //

/*
 *  Commands are requested by the client.
 */

var commands = {}; // WARNING: Global variable from server.js is named 'command'!

// Server control.
commands.god = {
  // set PROPERTY VALUE
  'set': function (user, cmdArray, cmdStr) {
    // List world.config if only 'set' is sent.
    if (!cmdArray[1]) {
      socketHandler(user, 'info', 
                'World configuration properties:' + 
                format.object(JSON.stringify(world.config, null, 2)) + 
                // .replace(/\[|\]|{|}|,/gm, '')
                // .replace(/^\s*\n/gm, ''))
                'To reset to defaults, use: ' +
                cmdChar + 'set reset');
      return;
    }
    
    // Some fields may not be changed!
    if (cmdArray[1] == '_id') {
      socketHandler(user, 'warning', 'Cannot change this field!');
      return;
    }
    
    // 'reset' to run configureWorld() again.
    if (cmdArray[1] == 'reset') {
      configureWorld();
      socketHandler(user, 'info', 'World configuration has been reset to default!');
      return;
    }
    
    // MongoDB doesn't allow $ in fields.
    if (cmdArray[1].indexOf('$') >= 0) {
      socketHandler(user, 'warning', 'Property names cannot include the dollar sign!');
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
      socketHandler(user, 'warning', 'Failed to set the configuration (parsing)!');
      return;
    }
    
    // Upsert (update existing and create non-existing properties) the data.
    updateObj(world.config, madeObject, true);

    world.changed.config = true;
    socketHandler(user, 'info', 'World configuration changed successfully.');
  },
  /*  Sets a value into any world.config property, or 'reset' to default.
   */
  
  // resetworld
  'resetworld': function (user) {
    if (user.account.username != 'Koss') {
      socketHandler(user, 'warning', 'This command is not available to you.');
      return;
    }
    
    resetWorld(user);
  },
  /*  Kicks all users from server, resets world object data,
   *  reset DB data, and make server available again.
   */
  
  // reloadcode
  'reloadcode': function (user) {
    if (user.account.username != 'Koss') {
      socketHandler(user, 'warning', 'This command is not available to you.');
      return;
    }
    
    reloadCode(user);
  },
  /*  Reloads the commands.js code.
   */
  
  // kick USERNAME (MESSAGE)
  'kick': function (user, cmdArray) {
    if (!cmdArray[1]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'kick USERNAME (MESSAGE)');
      return;
    }
    
    // Default message.
    var msg = 'You have been disconnected by ' + fullNameID(user) + '.';
    
    // Use custom message, instead.
    if (cmdArray[2] && cmdArray[2].trim()) {
      msg = cmdArray[2].trim();
    }
    
    var username = caseName(cmdArray[1]); // Make it case-compatibale for usernames, for example 'Bob'.
    
    // Find player by username in world.users.
    var targetUser = world.users[username];
    if (targetUser) {
      // Inform and kick target user.
      socketHandler(targetUser, 'warning', msg);
      socketHandler(targetUser, null, null, 'disconnect');
      // Inform me of success.
      socketHandler(user, 'info', username + ' has been successfully disconnected.');
    } else {
      // Not found.
      socketHandler(user, 'warning', 'Username not found!');
    }
  }
  /*  Force a user to disconnect from server.
   *  MESSAGE defaults to 'You have been disconnected by fullNameID().'
   */
};

// World creation.
commands.builder = {
  // create NAME
  'create': function (user, cmdArray, cmdStr) {
    if (!cmdArray[1]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'create NAME');
      return;
    }
    
    // Target name can only be English letters and spaces.
    var name = parseName(cmdStr); // True or false.
    if (!name) {
      socketHandler(user, 'warning', 'Creation names must be composed only of letters and spaces!');
      return;
    }
    
    var curRoom = user.room;
    
    // Create the target object.
    var targetObj = constructor.target(name, user.player.room);
    
    // Get the target with the highest id value.
    targetsdb.findOne({}, { fields: { '_id': 1 }, 'limit': 1 , 'sort': { '_id': -1 } },
                      function (err, doc) {
      if (err) {
        console.log(err);
        socketHandler(user, 'warning', 'Creation (counter) failed.');
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
        socketHandler(world.watch[strCoord][i], 'info',
                'Creation #' + fullID + ' has been successful.' + format.newline + 
                'Its\' template can be changed through instance \'-1\'.');
      }
    });
  },
  /*  Creates a new target where the player stands.
   */
  
  // destroy (ID).(INSTANCE)
  'destroy': function (user, cmdArray) {
    var strCoord = strPos(user.player.room);
    
    if (!cmdArray[1]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'destroy ID.INSTANCE');
      return;
    }
    
    // Parse target.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      socketHandler(user, 'warning', 'Target must be a numeric value, for example: ' +
                                                              cmdChar + 'destroy 0.1');
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
          socketHandler(world.watch[strCoord][i], 'info', 'Creation ' + targetName + 
                                                ' has been successfully destroyed.');
        }
        
        return;
      }
      
      // Nothing to remove.
      socketHandler(user, 'warning', 'No targets in the room.');
      return;
    }
    
    // Make sure ID is a number.
    if (isNaN(idInst[0])) {
      socketHandler(user, 'warning', 'Target ID must be a number!');
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
            socketHandler(world.watch[strCoord][i], 'info', 'Creation ' + targetName + 
                                                  ' has been successfully destroyed.');
          }
          
          return;
        }
      }
      
      // Target not found.
      socketHandler(user, 'warning', 'Target #' + idInst[0] + '.' +
                                    idInst[1] + ' was not found.');
      return;
    }
    
    // Make sure instance is a number.
    if (isNaN(idInst[1])) {
      socketHandler(user, 'warning', 'Target instance must be a number!');
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
          socketHandler(world.watch[strCoord][i], 'info', 'Creation ' + targetName + 
                                                ' has been successfully destroyed.');
        }
        
        return;
      }
    }
    
    // Otherwise, target was not found.
    socketHandler(user, 'warning', 'Target #' + idInst[0] + '.' + idInst[1] +
                                                          ' was not found.');
  }
  /*  Removes a target from current room, last one in targets by default,
   *  or instance, last one by default.
   */
};

// World manipulation.
commands.master = {
  // modify room/ID(.INSTANCE) FIELD(.FIELD) VALUE
  'modify': function (user, cmdArray, cmdStr) {
    if (!cmdArray[1] || !cmdArray[2]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'modify room/ID FIELD VALUE');
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
      socketHandler(user, 'warning', '<i>Target must be a number, such as \'0.0\'!</i>');
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
    
    socketHandler(user, 'warning', '<i>Could not find creation [' + idInstance + '] here.</i>');
  },
  /*  Modify an existing field in current room or target,
   *  or toggle an available object property (e.g. worn) or array item (e.g. commands).
   *  VALUE can be many words. Instance -1 is a special case, here.
   */
};

// Registered users, only.
commands.player = {
  // email
  'email': function (user) {
    // Try the socket user object for the data.
    if (user.account.email) {
      socketHandler(user, 'info', 'eMail for user ' + user.account.username + 
                                                ' is: ' + user.account.email);
      return;
    }
  },
  /*  Display email address.
   */
  
  // logout
  'logout': function (user) {
    // Remove reference to user from changed queue.
    world.changed.users.splice(world.changed.users.indexOf(user), 1);
    
    // Update 'lastonline'.
    user.account.lastonline = new Date();
    
    // Copy relevant user data, for saving queue.
    var userCopy = {};
    userCopy.account = copyObj(user.account);
    userCopy.player = copyObj(user.player);
    if (user['_id']) userCopy['_id'] = user['_id'];     // If a none logged-in user, somehow, reached here.
    
    // Add to saving queue.
    world.changed.users.push(userCopy);
    
    // Continue into logging out...
    var oldName = user.player.name;
    
    var newUser = {};
    newUser.account = {};
    newUser.player = {};
    
    newUser.account.username = randomName();
    newUser.player.name = newUser.account.username;
    
    // Copy player position.
    newUser.player.map = user.player.map;
    newUser.player.room = copyObj(user.player.room);    // { 'x': X, 'y': Y, 'z': Z }
    
    newUser.account.access = 'user';            // Reset access level.
    
    updateUser(user, newUser);
    
    delete user['_id'];                         // Irrelevant for unregistered users.
    
    socketHandler(user, 'info', 'You have logged out, and changed your name to ' + 
                                                          user.player.name + '.');
    // And alert everyone about this...
    socketHandler(user, 'info', oldName + ' is now known as ' + user.player.name + '.', 'broadcast');
  },
  /*  Logout from current logged-in user account,
   *  and replace account.username & player.name with a randomName(), updating user.name.
   */
  
  // wear TARGET
  'wear': function (user, cmdArray) {
    if (!cmdArray[1]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'wear TARGET');
      return;
    }
    
    // TARGET must be a number.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      socketHandler(user, 'warning', 'Target must be a number, such as \'0.0\'!');
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
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'remove TARGET');
      return;
    }
    
    // TARGET must be a number.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      socketHandler(user, 'warning', 'Target must be a number, such as \'0.0\'!');
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
  
  // hold TARGET (HAND)
  'hold': function (user, cmdArray) {
    if (!cmdArray[1]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'hold TARGET (HAND)');
      return;
    }
    
    // TARGET must be a number.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      socketHandler(user, 'warning', '<i>Target must be a number, such as \'0.0\'!</i>');
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
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'drop TARGET');
      return;
    }
    
    // TARGET must be a number.
    var parsedTarget = parseTarget(cmdArray[1]);
    if (!parsedTarget) {
      socketHandler(user, 'warning', 'Target must be a number, such as \'0.0\'!');
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
  
  // offer TARGET ITEM (ITEM) ...
  'offer': function (user, cmdArray, cmdStr) {
    if (!cmdArray[1] || !cmdArray[2]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 
              'offer TARGET/ANYONE ITEM(,AMOUNT) (ITEM)(,AMOUNT) ...');
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
        socketHandler(user, 'warning', 'Items must be formatted as ID.INSTANCE, such as \'0.0\'.');
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
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'cancel OFFER');
      return;
    }
    
    var offer = parseInt(cmdArray[1]);
    
    // OFFER must be an integer number.
    if (isNaN(offer)) {
      socketHandler(user, 'warning', 'Offer must be a number!');
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
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'accept TARGET (OFFER)');
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
    // EMPTY
  }
  /*  EMPTY
   *  
   */
};

commands.user = {
  // chat MESSAGE
  'chat': function (user, cmdArray, cmdStr) {
    var msg = cmdStr.trim();      // Remove surrounding spaces.
    
    if (!msg) {
      socketHandler(user, 'warning', '<i>Syntax: ' + cmdChar + 'chat MESSAGE</i>');
      return;
    }
    
    // Limit chat messages to 200 characters.
    if (msg.length > 200) {
      socketHandler(user, 'warning', 'You cannot chat a message more than two-hundred characters long.');
      return;
    }
    
    // Limit chat messages to 3 in every 10 seconds.
    if (!user.chatLimit) {
      user.chatLimit = {
        'count': 1
      };
      // Start cooldown timer.
      user.chatLimit.timer = setTimeout(function () {
        delete user.chatLimit;
      }, 10000)
    } else {
      user.chatLimit.count += 1;
      
      if (user.chatLimit.count > 3) {
        socketHandler(user, 'warning', 'You cannot chat more than three messages, ' + 
                                                      'in every ten second period.');
        return;
      }
    }
    
    // Escape <>&" for HTML.
    msg = escapeHTML(msg);
    
    // Send to all others.
    socketHandler(user, 'message', fullNameID(user) + ': ' + msg, 'broadcast');
    
    // Show me.
    socketHandler(user, 'message', '<b>You</b>: ' + msg);
  },
  /*  Speak to everyone in the world/server.
   */
  
  // say MESSAGE
  'say': function (user, cmdArray, cmdStr) {
    var msg = cmdStr.trim();
    
    if (!msg) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'say MESSAGE');
      return;
    }
    
    // Limit chat messages to 200 characters.
    if (msg.length > 100) {
      socketHandler(user, 'warning', 'You cannot say a message more than one-hundred characters long.');
      return;
    }
    
    // Limit say messages to 5 in every 10 seconds.
    if (!user.sayLimit) {
      user.sayLimit = {
        'count': 1
      };
      // Start cooldown timer.
      user.sayLimit.timer = setTimeout(function () {
        delete user.sayLimit;
      }, 10000)
    } else {
      user.sayLimit.count += 1;
      
      if (user.sayLimit.count > 5) {
        socketHandler(user, 'warning', 'You cannot say more than five messages, ' + 
                                                    'in every ten second period.');
        return;
      }
    }
    
    // Escape <>&" for HTML.
    msg = escapeHTML(msg);
    
    // Speak to the room, only.
    for (var i=0; i < world.watch[strPos(user.player.room)].length; i++) {
      var curPlayer = world.watch[strPos(user.player.room)][i];
      
      if (curPlayer.account.username != user.account.username) {
        // Show my message to others.
        socketHandler(curPlayer, 'say', fullNameID(user) + ' says: ' + msg);
      } else {
        // Show me my message.
        socketHandler(user, 'say', format.bold('You say: ') + msg);
      }
    }
  },
  /*  Speak to the room.
  */
  
  // tell USERNAME MESSAGE
  'tell': function (user, cmdArray, cmdStr) {
    // Remove USERNAME part and surrounding spaces,
    // or false, if no space after USERNAME.
    var msg = (cmdStr.indexOf(" ") >= 0 ? cmdStr.substring(cmdStr.indexOf(" ") + 1).trim() : false);
    
    // Either check for having two arguments, or an argument and a msg.
    if (!cmdArray[1] || !msg) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'tell USERNAME MESSAGE');
      return;
    }
    
    // Cannot tell myself.
    if (cmdArray[1] == user.account.username) {
      socketHandler(user, 'warning', 'You cannot tell yourself anything!');
      return;
    }
    
    var username = caseName(cmdArray[1]); // Make it case-compatibale for usernames, for example 'Bob'.
    
    // Escape <>&" for HTML.
    msg = escapeHTML(msg);
    
    // Find player by username in world.users.
    var targetUser = world.users[username];
    if (targetUser) {
      // Tell targret player.
      socketHandler(targetUser, 'tell', fullNameID(user) + ' tells you: ' + msg);
      // Show me the message.
      socketHandler(user, 'tell', format.bold('You tell ' + fullNameID(targetUser) + ': ') + msg);
    } else {
      // Not found.
      socketHandler(user, 'warning', 'Username not found!');
    }
  },
  /*  Speak to another player, anywhere in the world.
  */
  
  // move DIRECTION
  'move': function (user, cmdArray) {
    if (!cmdArray[1] || cmdArray[2]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'move DIRECTION');
      return;
    }
    
    // Convert direction to coordinates.
    var curPos = user.player.room;
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
      socket.emit('warning', '<i>Exit not found!</i>');
      return;
    } */
    
    // Check that the exit is open.
    // N/A.
    
    // Move.
    if (newPos) {
      user.player.room = newPos;
      socketHandler(user, 'info', 'Moving to position ' + JSON.stringify(newPos) + '.');
      loadRoom(user);
      return;
    }
    
    socketHandler(user, 'warning', 'Exit not found!');
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
      
      socketHandler(user, 'info', 'The emotes available to you are:' + format.newline + emotes + '.');
      return;
    }
    
    // Find emote.
    var curEmote = world.config.emotes[cmdArray[1]];
    if (!curEmote) {
      socketHandler(user, 'warning', 'Emote ' + cmdArray[1].toLowerCase() + ' not found!');
      return;
    }
    
    // Options: curEmote.room.me/others           (at no one)
    //          curEmote.self.me/others           (at myself)
    //          curEmote.player.me/player/others  (at another player)
    //          curEmote.target.me/others         (at a target)
    
    // Emote to the room at-large.
    if (!cmdArray[2]) {
      // Show me the emote.
      socketHandler(user, 'emote', curEmote.room.me.replace('USER', user.player.name));
      
      // Show other players in the room.
      for (var i=0; i < world.watch[strPos(user.player.room)].length; i++) {
        var curUser = world.watch[strPos(user.player.room)][i];
        
        // Send with each user socket, except myself.
        if (curUser.account.username != user.account.username) {
          socketHandler(curUser, 'emote', curEmote.room.others.replace('USER', user.player.name));
        }
      }
      
      return;
    }
    
    // Emote at a target or user.
    // In the special case of emoting to myself.
    if (caseName(cmdArray[2]) == user.account.username) {
      socketHandler(user, 'emote', curEmote.self.me.replace('USER', user.player.name));
            
      // Show other players in the room.
      for (var i=0; i < world.watch[strPos(user.player.room)].length; i++) {
        var curUser = world.watch[strPos(user.player.room)][i];
        
        // Send with each user socket, except myself.
        if (curUser.account.username != user.account.username) {
          socketHandler(curUser, 'emote', curEmote.self.others.replace('USER', user.player.name));
        }
      }
      
      return;
    }
    
    // Find the target or user in the room.
    var emoteTarget = false;
    // Try to find a user.
    for (var i=0; i < world.watch[strPos(user.player.room)].length; i++) {
      var curUser = world.watch[strPos(user.player.room)][i];
      
      if (curUser.account.username == caseName(cmdArray[2])) {
        emoteTarget = curUser.socket; // Refer to the socket.
        break;
      }
    }
    // If not found user, then try to find a target.
    if (!emoteTarget) {
      var arrTargets = world.maps[user.player.map].rooms[strPos(user.player.room)].targets;
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
      socketHandler(user, 'warning', '<i>Could not find ' + cmdArray[2] + ' here!</i>');
      return;
    }
    
    // Player emote or target emote.
    if (!emoteTarget.instance) {
      // Show me the emote.
      socketHandler(user, 'emote', curEmote.player.me.replace('USER2', caseName(cmdArray[2])));
      // Show the other player the emote.
      socketHandler(emoteTarget, 'emote', curEmote.player.player.replace('USER1', user.player.name));
      // Show others the emote.
      for (var i=0; i < world.watch[strPos(user.player.room)].length; i++) {
        var curUser = world.watch[strPos(user.player.room)][i];
        
        // Send with each user socket, except myself and emoteTarget player.
        if (curUser.account.username != user.account.username &&
            curUser.account.username != caseName(cmdArray[2])) {
          socketHandler(curUser, 'emote', curEmote.player.others.replace('USER1', user.player.name)
                                                          .replace('USER2', caseName(cmdArray[2])));
        }
      }
    } else {
      // Show me the emote.
      socketHandler(user, 'emote', curEmote.target.me.replace('TARGET', emoteTarget.name));
      
      // Show other players in the room.
      for (var i=0; i < world.watch[strPos(user.player.room)].length; i++) {
        var curUser = world.watch[strPos(user.player.room)][i];
        
        // Send with each user socket, except myself.
        if (curUser.account.username != user.account.username) {
          socketHandler(curUser, 'emote', curEmote.target.others.replace('USER', user.player.name)
                                                            .replace('TARGET', emoteTarget.name));
        }
      }
    }
  },
  /*  Act an emotion or gesture generally or towards a target or player.
  */
  
  // examine (PLAYER)
  'examine': function (user, cmdArray) {
    // By default examine myself.
    if (!cmdArray[1] || caseName(cmdArray[1]) == user.account.username) {
      socketHandler(user, 'event', 'You examine yourself...' + format.newline + 
                                format.object(JSON.stringify(user.player, null, 2)));
                                // .replace(/[\[\]{}]/g, '')));
      return;
    }
    
    // Capitalize first letter and lower-case the rest.
    var fixedName = caseName(cmdArray[1]);
    
    // Locate the username in current room.
    for (var i=0; i < world.watch[strPos(user.player.room)].length; i++) {
      var curPlayer = world.watch[strPos(user.player.room)][i];
      
      if (curPlayer.account.name == fixedName) {
        socketHandler(user, 'event', 'Examining ' + fullNameID(curPlayer) + '...' + format.newline + 
                                      format.object(JSON.stringify(curPlayer.player, null, 2)));
                                      // .replace(/[\[\]{}]/g, '')));
        return;
      }
    }
    
    // Otherwise, player was not found.
    socketHandler(user, 'warning', 'Player ' + format.player(cmdArray[1]) + ' was not found in this room.');
  },
  /*  Examine the properties of players, or myself by default.
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
      
      var commands = ( curRoom.commands.length == 0 ? 'None.' : curRoom.commands.join(', ') + '.' );
      var exits = ( curRoom.exits.length == 0 ? 'None.' : curRoom.exits.join(', ') + '.' );
      
      // Display room data.
      socketHandler(user, 'event', format.bold('Title: ' + title) + format.newline + 
        'Map: '         + curRoom.map + format.newline + 
        'Players: '     + players     + format.newline + 
        'Targets: '     + targets     + format.newline + 
        'Description: ' + description + format.newline + 
        'Commands: '    + commands    + format.newline + 
        'Exits: '       + exits       + format.newline);
            
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
        /*
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
              propertyData = '<pre style="font-size: 80%; display: inline;">' +
                              JSON.stringify(curProperty, null, 2) + '</pre>';
              break;
            
            default:
              propertyData = curProperty;
          }
          
          targetText += '<b>' + propertyName + ':</b> ' +  propertyData + '<br />';
        }*/
        
        var commands = ( curTarget.commands.length == 0 ? 'None.' : curTarget.commands.join(', ') + '.' );
        
        // Display target data.
        socketHandler(user, 'event', format.bold(fullNameID(curTarget)) + format.newline + 
        'Description: '   + curTarget.description               + format.newline +
        'Position: '      + JSON.stringify(curTarget.position)  + format.newline +
        'Commands: '      + commands                            + format.newline +
        'Size: '          + curTarget.size                      + format.newline + 
        'Trade: '         + JSON.stringify(curTarget.trade)     + format.newline);
        
        // user.socket.emit('event', targetText + '<br />');
        return;
      }
    }
    
    // Otherwise, target not found.
    socketHandler(user, 'warning', 'Target #' + cmdArray[1] + ' not found.');
  },
  /*  Displays a target data. Shows the current room data,
   *  if sent without arguments.
  */

  // rename NAME
  'rename': function (user, cmdArray) {
    // Make sure there is actually a name to change into.
    if (!cmdArray[1]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'rename NAME');
      return;
    }
    
    // Exceptions to accepted names.
    var testName = cmdArray[1].toLowerCase().trim();
    var exceptions = ['you', 'me', 'it', 'we', 'us', 'he', 'she', 'them', 'they', 'those', 'these'];
    if (exceptions.indexOf(testName) >= 0) {
      socketHandler(user, 'warning', format.bold(caseName(cmdArray[1])) + ' cannot be used as a name!</i>');
      return;
    }

    // Return false to continue here.
    var tryParse = parseUsername(cmdArray[1]);
    if (tryParse) {
      socketHandler(user, 'warning', tryParse);   // Error.
      return;
    }

    // Returns a name with first letter uppercase and the rest lowercase.
    var fixedName = caseName(cmdArray[1]);
    
    // Save old name to alert everyone of this change.
    var oldName = user.player.name;
    
    // Logged-in users only change their player.name & user.name.
    if (user.account.registered) {
      user.player.name = fixedName;
      user.name = fullName(user); // pre + name + post.
      
      var newUser = {};
      newUser.player = {};
      
      newUser.player.name = fixedName;    // Assign new player name.
      
      updateUser(user, newUser); // Update!
      
      socketHandler(user, 'info', 'You have changed your name to ' + format.bold(user.player.name) + '.');
      // And alert everybody else about this...
      socketHandler(user, 'info', format.bold(oldName) + ' is now known as ' + 
                            format.bold(user.player.name) + '.', 'broadcast');
            
      return;
    }
    
    // Check if username is not one of the available randomName() options.
    if (randomName(fixedName)) {
      socketHandler(user, 'warning', format.italic(fixedName) + ' cannot be used as a username!');
      return;
    }
    
    // Check if username is already registered - for unregistered users.
    usersdb.findOne({ 'account.username': fixedName }, function (e, acct) {
      if (acct) {
        socketHandler(user, 'warning', 'Username ' + format.italic(fixedName) + ' is already registered!');
        return;
      }
      
      // Unregistered users also change their account.username.
      var newUser = {};
      newUser.account = {}; newUser.player = {};
      
      newUser.account.username = fixedName;               // Assign new name.
      newUser.player.name = newUser.account.username;     // ...
      
      // Copy player position.
      newUser.player.map = user.player.map;
      newUser.player.room = user.player.room;
      
      newUser.account.access = user.account.access;       // Maintain access level.
      
      updateUser(user, newUser); // Update!
      
      socketHandler(user, 'info', 'You have changed your name to ' + format.player(user.player.name) + '.');
      // And alert everybody else about this...
      socketHandler(user, 'info', format.bold(oldName) + ' is now known as ' + 
                            format.bold(user.player.name) + '.', 'broadcast');
    });
  },
  /*  Rename into a non-registered username, changing player name, as well,
   *  or only renaming the player name of a registered user.
  */

  // login USERNAME PASSWORD
  'login': function (user, cmdArray) {
    // Make sure there is both a username and a password.
    if (!cmdArray[1] || !cmdArray[2]) {
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'login USERNAME PASSWORD');
      return;
    }

    // Returns a username with first letter uppercase and the rest lowercase.
    var fixedUsername = caseName(cmdArray[1]);
    
    // I am already logged into this username.
    if (world.users[fixedUsername] == user) {
      socketHandler(user, 'warning', 'You are already logged in with that username.');
      return;
    }
    
    // Username is already being used,
    // unless I am the one using it (register -> login).
    if (world.users[fixedUsername] && user.account.username != fixedUsername) {
      socketHandler(user, 'warning', 'That username is already being used, right now.');
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
        socketHandler(user, 'warning', 'Username ' + fixedUsername + ' is not registered, yet.');
        return;
      }

      // Wrong password check.
      if (acct.account.password != cmdArray[2]) {
        socketHandler(user, 'warning', 'Wrong password!');
        return;
      }
      
      // Logout, first, if already logged-in.
      if (user.account.registered) commands.player.logout(user);
      
      // Login
      updateUser(user, acct); // Update!
      
      // Update 'lastonline'.
      user.account.lastonline = new Date();
      
      // Update client about available commands, by access level.
      commands.user.help(user, ['help', 'getAvailableCommandsOnly']);
      
      socketHandler(user, 'info', 'You are now logged in as ' + format.player(user.account.username) + '.');
      // And alert everybody else about this...
      socketHandler(user, 'info', format.bold(oldName) + ' is now known as ' + 
                            format.bold(user.player.name) + '.', 'broadcast');
            
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
      socketHandler(user, 'warning', 'Syntax: ' + cmdChar + 'register PASSWORD EMAIL');
      return;
    }
    
    // A logged-in user can't be registered, obviously.
    if (user.account.registered) {
      socketHandler(user, 'warning', 'The username ' + user.account.username +
                                                    ' is already registered.');
      return;
    }

    // Look for username in the DB. The rest is nested for proper order of events.
    usersdb.findOne({ 'account.username': user.account.username }, function (err, acct) {
      if (err) {
        console.log(err);
      }
      
      // Check if user is already registered.
      if (acct) {
        socketHandler(user, 'warning', 'The username ' + user.account.username + ' is already registered.');
        return;
      }

      // Register new username.
      usersdb.insert(constructor.player(user.account.username, cmdArray[1], cmdArray[2], user.player.name, 
                                        user.player.map, user.player.room), function (err) {
        if (err) {
          console.log(err);
        }
        
        // Send message.
        socketHandler(user, 'info', 'You have successfully registered as ' + 
                          format.bold(user.account.username) + '.');
        
        // Send email.
        nodemailer.mail({
          from: "Node World <phuein@gmail.com>", // sender address
          to: cmdArray[2], // list of receivers
          subject: "Welcome to Node World, " + user.account.username + "!", // Subject line
          // text: "Hello world ✔", // plaintext body
          html: "<b>✔ Registration is complete!</b><br /><br/>Your password for username <i>" + 
                  user.account.username + "</i> is: " + cmdArray[1] // html body
        });
        
        commands.user.login(user, ['login', user.account.username, cmdArray[1]]);
      });
    });
  },
  /*  And login on success.
  */
  
  // help (getAvailableCommandsOnly)
  'help': function (user, cmdArray) {
    var getAvailableCommandsOnly = false;
    if (cmdArray[1] == 'getAvailableCommandsOnly') getAvailableCommandsOnly = true;
    
    var availableCommands = [];
    
    var commandsDisplay = '';
    
    // Show commands according to access level.
    switch (user.account.access) {
      case 'god':
        for (var access in constructor.descriptions) {
          var curAccess = constructor.descriptions[access];
          
          for (var cmd in curAccess) {
            if (getAvailableCommandsOnly) {
              var gotSpace = cmd.indexOf(' ');
              // Return cmdChar + command.
              availableCommands.push( cmdChar + cmd.slice(0, (gotSpace >= 0 ? gotSpace : cmd.length)) );
              continue;
            }
            
            commandsDisplay += cmdChar + cmd + format.newline;
            
            var desc = curAccess[cmd];    // The value of the property is the description.
            
            commandsDisplay += desc + format.newline + format.newline;
          }
        }
        break;
      
      case 'builder':
        for (var access in constructor.descriptions) {
          // Skip god commands.
          if (access == 'god') {
            continue;
          }
          
          var curAccess = constructor.descriptions[access];
          
          for (var cmd in curAccess) {
            if (getAvailableCommandsOnly) {
              var gotSpace = cmd.indexOf(' ');
              // Return cmdChar + command.
              availableCommands.push( cmdChar + cmd.slice(0, (gotSpace >= 0 ? gotSpace : cmd.length)) );
              continue;
            }
            
            commandsDisplay += cmdChar + cmd + format.newline;
            
            var desc = curAccess[cmd];    // The value of the property is the description.
            
            commandsDisplay += desc + format.newline + format.newline;
          }
        }
        break;
      
      case 'master':
        for (var access in constructor.descriptions) {
          // Skip god commands.
          if (access == 'god' || access == 'builder') {
            continue;
          }
          
          var curAccess = constructor.descriptions[access];
          
          for (var cmd in curAccess) {
            if (getAvailableCommandsOnly) {
              var gotSpace = cmd.indexOf(' ');
              // Return cmdChar + command.
              availableCommands.push( cmdChar + cmd.slice(0, (gotSpace >= 0 ? gotSpace : cmd.length)) );
              continue;
            }
            
            commandsDisplay += cmdChar + cmd + format.newline;
            
            var desc = curAccess[cmd];    // The value of the property is the description.
            
            commandsDisplay += desc + format.newline + format.newline;
          }
        }
        break;
      
      case 'player':
        for (var access in constructor.descriptions) {
          // Skip god commands.
          if (access == 'god' || access == 'builder' || access == 'master') {
            continue;
          }
          
          var curAccess = constructor.descriptions[access];
          
          for (var cmd in curAccess) {
            if (getAvailableCommandsOnly) {
              var gotSpace = cmd.indexOf(' ');
              // Return cmdChar + command.
              availableCommands.push( cmdChar + cmd.slice(0, (gotSpace >= 0 ? gotSpace : cmd.length)) );
              continue;
            }
            
            commandsDisplay += cmdChar + cmd + format.newline;
            
            var desc = curAccess[cmd];    // The value of the property is the description.
            
            commandsDisplay += desc + format.newline + format.newline;
          }
        }
        break;
      
      case 'user':
        var curAccess = constructor.descriptions['user'];
        
        for (var cmd in curAccess) {
          if (getAvailableCommandsOnly) {
              var gotSpace = cmd.indexOf(' ');
              // Return cmdChar + command.
              availableCommands.push( cmdChar + cmd.slice(0, (gotSpace >= 0 ? gotSpace : cmd.length)) );
              continue;
            }
          
          commandsDisplay += cmdChar + cmd + format.newline;
          
          var desc = curAccess[cmd];    // The value of the property is the description.
          
          commandsDisplay += desc + format.newline + format.newline;
        }
        break;
    }
    
    // Only receive an array of the available commands,
    // so that client can identify them, for styling and onclick.
    if (getAvailableCommandsOnly) {
      socketHandler(user, 'availableCommands', availableCommands);
      return;
    }
    
    socketHandler(user, 'info', format.underline('Available Commands:') + 
                        format.newline + format.newline + commandsDisplay);
  }
  /*  Display command usage and list all available commands,
   *  by account access level. Optionally, only return an array of available commands.
   */
};

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
  
  // Avoid buggy calls (access not set), by defaulting to 'user' access.
  if (!user.account.access) {
    user.account.access = 'user';
    console.log('ERROR: handleCommands() request with undefined user.account.access!');
  }
  
  // Make sure the command exists, according to user access level, and is not 'descriptions'.
  var cmd = commandExists(cmdArray[0], user.account.access);
  
  if (!cmd || cmdArray[0] == 'descriptions') {
    user.socket.emit('warning', '<i>Command not found!</i>');
    return;
  }
  
  cmd(user, cmdArray, cmdStr);
}

// Handles socket behavior, for each command.
// 'type'     - The socket message type.
// 'message'  - The actual socket message.
// 'action'   - An action for the socket to do. Default is 'emit'.
function socketHandler(user, type, message, action) {
  if (!action) var action = 'emit';
  
  // Send message back to the user.
  if (action == 'emit') {
    user.socket.emit(type, message);
    return;
  }
  
  // Send message to everyone but the user.
  if (action == 'broadcast') {
    user.socket.broadcast.emit(type, message);
    return;
  }
  
  // Send message to everyone but the user.
  if (action == 'all') {
    io.sockets.emit(type, message);
    return;
  }
  
  // Otherwise, assume it's a method.
  if (user.socket[action]) {
    user.socket[action]();
    return;
  }
  
  console.log(Timestamp() + 'socketHandler() got an unknown action: ' + action)
}

//*** EXPORTS ***//
  exports.handleCommands  =   handleCommands;
  
  exports.loadRoom        =   loadRoom;
  exports.saveWorld       =   saveWorld;
  exports.saveUser        =   saveUser;
  exports.configureWorld  =   configureWorld;
  
  exports.fullNameID      =   fullNameID;
  exports.strPos          =   strPos;
  exports.randomName      =   randomName;
// *** //