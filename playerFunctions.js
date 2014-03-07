/*
 *  Player command functions.
 */

// Randomly select a hand that is empty, or return false.
function availableHand(user) {
  for (var handName in user.player.worn.hands) {
    var curHand = user.player.worn.hands[handName];
    
    // Choose whichever hand is empty, randomly.
    if (JSON.stringify(curHand) == '{}') {
      return handName;
    }
  }
  
  return false;
}

// Attempt to hold a target in the room in chosen hand, or any available hand.
function holdTarget(user, target, hand) {
  var stringifiedTarget = strTarget(target);
  
  // Target must have a valid 'worn' property.
  var wearable = verifyWearable(target);
  if (!wearable) {
    socketHandler(user, 'warning', fullName(target) + ' cannot be held!');
    return;
  }
  
  // Player must have hands!
  if (isEmpty(user.player.worn.hands)) {
    socketHandler(user, 'warning', 'You have no hands to hold with!');
    return;
  }
  
  // Check if the target exists in the room.
  var exists = false;
  var ind;
  
  for (var i=0; i < user.room.targets.length; i++) {
    var curTarget = user.room.targets[i];
    if (strTarget(curTarget) == stringifiedTarget) {
      exists = true;
      ind = i; // Remember target's index in room.
      break;
    }
  }
  if (!exists) {
    socketHandler(user, 'warning', 'Cannot find ' + stringifiedTarget + ' here!');
    return;
  }
  
  // Requested hand must exist. Otherwise, use any empty hand.
  if (!hand) var hand = '';
  if (!user.player.worn.hands[hand]) {
    hand = availableHand(user);
  }
  // At this point some hand must be already selected.
  if (!hand) {
    socketHandler(user, 'warning', 'None of your hands are available!');
    return;
  }
  
  // Remove from room targets.
  user.room.targets.splice(ind, 1);
  
  // Hold it.
  user.player.worn.hands[hand] = target;
  
  // Add to changed list for DB update.
  targetMoved(user);
  
  socketHandler(user, 'info', 'You hold ' + fullName(target) + ' in your ' + hand + ' hand.');
}

// Attempt to drop a target from my hands.
function dropTarget(user, target) {
  var stringifiedTarget = strTarget(target);
  
  // Player must have hands!
  if (isEmpty(user.player.worn.hands)) {
    socketHandler(user, 'warning', 'You have no hands to drop anything from!');
    return;
  }
  
  var hand = false;
  for (var handName in user.player.worn.hands) {
    var curHand = user.player.worn.hands[handName];
    
    if (strTarget(curHand) == stringifiedTarget) {
      hand = handName;
    }
  }
  
  if (hand) {
    // Remove it.
    user.player.worn.hands[hand] = {};
    
    // Add to room.
    user.room.targets.push(target);
    
    // Add to changed list for DB update.
    targetMoved(user);
    
    socketHandler(user, 'info', 'You remove ' + fullName(target) + ' from your ' + hand + ' hand.');
  }
}

// Assert that a target can be worn by me.
// Returns false if no problem, otherwise returns a message for socket.
function assertWear(user, target) {
  // Check wearable.
  if (target.worn == '') {
    return '<i>You cannot wear that.</i>';
  }
  
  // Hands special case, check if both hands are occupied.
  if (target.worn == 'hands') {
    if (!user.player.worn.hands) {
      return '<i>You have no hands.</i>'
    }
    
    if (JSON.stringify(user.player.worn.hands.left) != '{}' &&
        JSON.stringify(user.player.worn.hands.right) != '{}') {
      return '<i>Both of your hands are already occupied.</i>';
    }
    
    // Wearable on hands!
    return false;
  }
  
  // Make sure location exists on me.
  if (!user.player.worn[target.worn]) {
    return '<i>You have no ' + target.worn + '.</i>';
  }
  
  // Make sure location is not occupied on me.
  if (JSON.stringify(user.player.worn[target.worn]) != '{}') {
    var verb = ( target.worn.charAt(target.worn.length-1) == 's' ? 'are' : 'is' );
    return '<i>Your ' + target.worn + ' ' + verb + ' already occupied.</i>';
  } 
  
  // Wearable!
  return false;
}

// Try to wear a target from my hands or in the room.
function wearTarget(user, target) {
  var stringifiedTarget = strTarget(target);
  
  // Make sure I can wear it.
  var cantWear = assertWear(user, target);
  if (cantWear) {
    socketHandler(user, 'warning', result);
    return;
  }
  
  // Wear a held target.
  var hand = false;
  for (var handName in user.player.worn.hands) {
    var curHand = user.player.worn.hands[handName];
    
    if (strTarget(curHand) == stringifiedTarget) {
      hand = handName;
      break;
    }
  }
  
  if (hand) {
    // Ignore it, if it is meant for the hands.
    if (target.worn == 'hands') {
      socketHandler(user, 'warning', 'You are already holding ' + fullName(target) + '.');
      return;
    }
    
    // Remove from hand.
    user.player.worn.hands[hand] = {};
    
    // Wear it.
    user.player.worn[target.worn] = target;
    
    // Add to changed list for DB update.
    targetMoved(user);
    
    socketHandler(user, 'info', 'You wear ' + fullName(target) + ' over your ' + target.worn + '.');
    return;
  }
  
  // Otherwise, wear a target from the room.
  var targets = user.room.targets;
  for (var i=0; i < targets.length; i++) {
    var curTarget = targets[i];
    
    if (strTarget(curTarget) == stringifiedTarget) {
      // Hold it, if it is meant for the hands.
      if (target.worn == 'hands') {
        holdTarget(user, target);
        return;
      }
      
      // Remove from room targets.
      user.room.targets.splice(i, 1);
      
      // Wear it.
      user.player.worn[target.worn] = target;
      
      // Add to changed list for DB update.
      targetMoved(user);
      
      socketHandler(user, 'info', 'You wear ' + fullName(target) + ' over your ' + target.worn + '.');
      return;
    }
  }
}

// Try to remove a worn target from me, to my hands,
// or drop it to the room.
function removeTarget(user, target) {
  var stringifiedTarget = strTarget(target);
  
  for (var location in user.player.worn) {
    var curItem = user.player.worn[location];
    
    // Special case for 'hands'.
    if (location == 'hands') {
      var hand = false;
      for (var handName in user.player.worn.hands) {
        var curHand = user.player.worn.hands[handName];
        
        if (strTarget(curHand) == stringifiedTarget) {
          dropTarget(user, curHand);
          return;
        }
      }
       
      continue;
    }
    
    // Other locations.
    if (strTarget(curItem) == stringifiedTarget) {
      // Remove it.
      user.player.worn[location] = {};
      
      // Try to add to hands.
      var hand = availableHand(user);
      if (hand) {
        // Hold it.
        user.player.worn.hands[hand] = target;
        
        // Add to changed list for DB update.
        targetMoved(user);
        
        socketHandler(user, 'info', 'You remove ' + fullName(target) + ' to your ' + hand + ' hand.');
        return;
      }
      
      // Otherwise, add to room.
      user.room.targets.push(target);
      
      // Add to changed list for DB update.
      targetMoved(user);
      
      socketHandler(user, 'info', 'You drop ' + fullName(target) + '.');
    }
  }
  
  // Otherwise, item not found on me.
  socketHandler(user, 'warning', 'Could not find [' + stringifiedTarget + '] on you.');
}

// Locate an item on a user by ID.INSTANCE, and return an array with the location name, 
// and a reference to it: [location, item], or false if not found.
function locateItem(user, itemStr) {
  var result = []; // The returned array.
  
  for (var location in user.player.worn) {
    var curItem = user.player.worn[location];
    
    // Hands special case.
    if (location == 'hands') {
      for (var hand in curItem) {
        curItem = curItem[hand];
        
        if (strTarget(curItem) == itemStr) {
          result[0] = location + '.' + hand;
          result[1] = curItem;
          break;
        }
      }
      
      if (item) {
        break;
      }
    }
    
    // Any other location.
    if (strTarget(curItem) == itemStr) {
      result[0] = location;
      result[1] = curItem;
      break;
    }
  }
  
  // Not found.
  if (result.length == 0) {
    return false;
  }
  
  return result;
}

// Locate an item on a user by ID.INSTANCE, and return an array with the hand that holds it,
// and a reference to it: [hand, item], or false if not found.
function locateItemHeld(user, itemStr) {
  var result = []; // The returned array.
  
  for (var location in user.player.worn.hands) {
    var curItem = user.player.worn.hands[location];
    
    if (strTarget(curItem) == itemStr) {
      result[0] = location;
      result[1] = curItem;
      break;
    }
  }
  
  // Not found.
  if (result.length == 0) {
    return false;
  }
  
  return result;
}

// Remove an item from user's hands by ID.INSTANCE,
// and return the object reference, or false if not found.
function removeItemHeld(user, itemStr) {
  var item; // The actual object of the item given.
  
  for (var location in user.player.worn.hands) {
    var curItem = user.player.worn.hands[location];
    
    if (strTarget(curItem) == itemStr) {
      item = curItem;
      user.player.worn.hands[location] = {}; // Remove item from user.
      break;
    }
  }
  
  // Not found.
  if (!item) {
    return false;
  }
  
  return item;
}

// Locate an item on a user by a partial name string (any matching part of the fullName),
// optionally skip results, and return a reference to it, or false if not found.
function locateItemByName(user, itemStr, skip) {
  var item; // The actual object of the item given.
  
  for (var location in user.player.worn) {
    var curItem = user.player.worn[location];
    
    // Hands special case.
    if (location == 'hands') {
      for (var hand in curItem) {
        curItem = curItem[hand];
        
        if (fullName(curItem).toLowerCase().indexOf(itemStr.toLowerCase()) >= 0) {
          // Skip if requested.
          if (skip && skip > 0) {
            skip--;
            continue;
          }
          
          item = curItem;
          break;
        }
      }
      
      if (item) {
        break;
      }
    }
    
    // Any other location.
    if (fullName(curItem).toLowerCase().indexOf(itemStr.toLowerCase()) >= 0) {
      // Skip if requested.
      if (skip && skip > 0) {
        skip--;
        continue;
      }
      
      item = curItem;
      break;
    }
  }
  
  // Not found.
  if (!item) {
    return false;
  }
  
  return item;
}

// Remove an item from user by ID.INSTANCE,
// and return the object reference, or false if not found.
function removeItem(user, itemStr) {
  var item; // The actual object of the item given.
  
  for (var location in user.player.worn) {
    var curItem = user.player.worn[location];
    
    // Hands special case.
    if (location == 'hands') {
      for (var hand in curItem) {
        curItem = curItem[hand];
        
        if (strTarget(curItem) == itemStr) {
          // Skip if requested.
          if (skip && skip > 0) {
            skip--;
            continue;
          }
          
          item = curItem;
          user.player.worn[location] = {}; // Removed item from user.
          break;
        }
      }
      
      if (item) {
        break;
      }
    }
    
    // Any other location.
    if (strTarget(curItem) == itemStr) {
      // Skip if requested.
      if (skip && skip > 0) {
        skip--;
        continue;
      }
      
      item = curItem;
      user.player.worn[location] = {}; // Removed item from user.
      break;
    }
  }
  
  // Not found.
  if (!item) {
    return false;
  }
  
  return item;
}

// Offer to give a target or player items from my hands.
function offerItems(user, target, items) {
  var name = caseName(target);                     // If username or target name.
  var parsedTarget = parseTarget(target);          // If target.
  
  var itemsDetails = [];      // Listing each item by [fullName, ID.INSTANCE]
  
  var removedItems = []; // Backup removed items, to restore on failure.
  
  // Remove items from me and store in dummy,
  // or fail to remove one, and restore those removed so far.
  for (var i=0; i < items.length; i++) {
    var curItem = items[i];
    
    var itemObj = removeItemHeld(user, curItem); // Return the item, or false.
    
    if (!itemObj) {
      socketHandler(user, 'warning', 'You do not have item [' + curItem + '] on you.');
      
      // Restore removed items into hands, by availability.
      for (var j=0; j < removedItems.length; j++) {
        var curItem = removedItems[i];
        var curHand = availableHand(user); // Select an empty hand.
        
        // No available hand, so drop item.
        if (!curHand) {
          user.room.targets.push(curItem); // Add to room.
          world.changed.rooms.push(user.room); // Request DB update.
          
          socketHandler(user, 'info', 'You drop ' + fullNameID(curItem) + '.');
          continue;
        }
        
        // Hold it.
        user.worn.hands[curHand] = curItem;
      }
      
      return;
    }
    
    // Add to backup array.
    removedItems.push(itemObj);
    
    // Add to final array.
    itemsDetails.push(fullName(itemObj), strTarget(itemObj));
  }
  
  // Either username or target.
  if (!parsedTarget) {
    target = name;
    
    // Find the other player, in the room.
    for (var i=0; i < world.watch[strPos(user.player.position)].length; i++) {
      var curUser = world.watch[strPos(user.player.position)][i];
      
      if (curUser.account.username == target) {
        var offerObj = {
          'target': curUser.account.username,
          'items': removedItems
        };
        
        // Save offer to user.events.
        user.player.offers.push(offerObj);
        
        // More than one item offered.
        var msg = 'the following items:<br />' + itemsDetails.join(format.newline);
        // Notify target about the offer.
        socketHandler(curUser, 'info', format.bold(fullNameID(user.player)) + ' offers to give you ' + 
                                                      (itemsDetails.length == 1 ? itemsDetails[0] : msg));
                
        socketHandler(user, 'info', 'You make an offer to ' + target + '.');
        return;
      }
    }
    
    // Player not found in the room.
    socketHandler(user, 'warning', 'Player ' + target + ' could not be found here!');
  } else {
    target = parsedTarget;
    
    // Find the target, in the room.
    // EMPTY //
  }
}

// Cancel an existing offer.
function cancelOffer(user, offer) {
  // Offer index does not exist.
  if (user.player.offers[offer] == undefined) {
    socketHandler(user, 'warning', 'Offer on index #' + offer + ' was not found!');
    return;
  }
  
  // Return withheld offer items back to hands, or drop them.
  for (var i=0; i < user.player.offers[offer].items.length; i++) {
    var curItem = user.player.offers[offer].items[i];
    var curHand = availableHand(user);
    
    // Drop it.
    if (!curHand) {
      user.room.targets.push(curItem); // Add to room.
      world.changed.rooms.push(user.room); // Request DB update.
      
      socketHandler(user, 'info', 'You drop ' + fullNameID(curItem) + '.');
      continue;
    }
    
    // Hold it.
    user.worn.hands[curHand] = curItem;
  }
  
  // Remove offer.
  var removedItem = user.player.offers.splice(offer, 1);
  
  // Notify other user about the cancellation.
  if (removedItem.target.socket != undefined) {
    socketHandler(removedItem.target, 'info', format.italic(fullNameID(user)) + 
                                        ' has cancelled offer #' + offer + '.');
  }
  
  socketHandler(user, 'info', 'Offer #' + offer + ' has been cancelled.');
}

// Accept an offer of items from a target or player, 
// receiving the items to my hands, or to the floor, when full.
function acceptItems(user, target, offer) {
  // Must have an offer variable.
  if (!offer) var offer = false;
  
  // Find the target user in the same room.
  var curRoom = world.watch[strPos(user.player.position)]; // An array of user objects.
  for (var i=0; i < curRoom.length; i++) {
    var curUser = curRoom[i];
    
    if (target.toLowerCase() == curUser.account.username.toLowerCase()) {
      acceptFromUser(user, curUser, offer);
      return;
    }
  }
  
  // If not a user, then maybe a target.
  var parsedTarget = parseTarget(target);
  
  if (isNaN(parsedTarget)) {
    socketHandler(user, 'warning', 'Target was not found here!');
    return;
  }
  
  // Find the target in the room.
  for (var i=0; i < curRoom.targets.length; i++) {
    var curTarget = curRoom.targets[i];
    
    if (parsedTarget == strTarget(curTarget)) {
      acceptFromTarget(user, curTarget, offer);
      return;
    }
  }
  
  socketHandler(user, 'warning', 'Target was not found here!');
}

// Accept a specific offer, or the first (lowest index) available offer of items from another user.
// And try to hold them in my hands, or drop those I can't.
function acceptFromUser(user, other, offer) {
  var offerObj = false;
  
  // Specific offer requested.
  if (offer) {
    offerObj = other.player.offers[offer];
  }
  
  // If no offer requested, then find lowest index available.
  if (!offer) {
    for (var i=0; i < other.player.offers.length; i++) {
      var curOffer = other.player.offers[i];
      
      // Case-insensitive matching of offer.target.
      if (curOffer.target.toLowerCase() == user.account.username.toLowerCase() ||
          curOffer.target.toLowerCase() == 'anyone') {
        offerObj = curOffer;
        break;
      }
    }
  }
  
  // Could not find the offer.
  if (!offerObj) {
    socketHandler(user, 'warning', 'Offer on index #' + offer + ' was not found!');
    return;
  }
  
  // Get offered items from other user's offer.
  for (var i=0; i < other.player.offers[offer].items.length; i++) {
    var curItem = other.player.offers[offer].items[i];
    var curHand = availableHand(user);
    
    // No available hand, so drop item.
    if (!curHand) {
      user.room.targets.push(curItem); // Add to room.
      world.changed.rooms.push(user.room); // Request DB update.
      
      socketHandler(user, 'info', 'You drop ' + fullNameID(curItem) + '.');
      continue;
    }
    
    // Hold it.
    user.worn.hands[curHand] = curItem;
  }
  
  // Inform of success.
  socketHandler(other, 'info', fullNameID(user) + ' has accepted your offer #' + offer + '.');
  
  socketHandler(user, 'info', 'You have successfully accepted the offer.');
}

// Accept a specific offer, or the first (lowest index) available offer of items from a target.
function acceptFromTarget(user, target, offer) {
  // Offer index does not exist.
  if (offer && target.offers[offer] == undefined) {
    socketHandler(user, 'warning', 'Offer on index #' + offer + ' was not found!');
    return;
  }
  
  // EMPTY //
}

//*** EXPORTS ***//
  exports.availableHand     =   availableHand;
  exports.holdTarget        =   holdTarget;
  exports.dropTarget        =   dropTarget;
  exports.wearTarget        =   wearTarget;
  exports.removeTarget      =   removeTarget;
  exports.locateItem        =   locateItem;
  exports.removeItem        =   removeItem;
  exports.offerItems        =   offerItems;
  exports.cancelOffer       =   cancelOffer;
  exports.acceptItems       =   acceptItems;
// *** //