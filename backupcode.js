// offer TARGET ITEM (ITEM)
'offer': function (user, cmdArray) {
  if (!user.player.worn) {
    user.socket.emit('message', '<i>Only registered players can use this command.</i>');
    return;
  }
  
  if (!cmdArray[1] || !cmdArray[2]) {
    user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'give TARGET ITEM (ITEM)</i>');
    return;
  }
  
  var target = caseName(cmdArray[1]);
  var item = parseTarget(cmdArray[2]);
  var price = '';
  if (cmdArray[3]) {
    price = parseTarget(cmdArray[3]);
  }
  
  // Make sure both item and price parsed correctly.
  if (!item || (cmdArray[3] && !price)) {
    user.socket.emit('message', '<i>Items must be formatted as ID.INSTANCE, such as \'0.0\'.</i>');
    return;
  }
  
  // Try parsing if the target is not a user.
  var parsedTarget = parseTarget(target);
  
  // If target is a username (parsed as NaN, which returns false.)
  if (!parsedTarget) {
    offerPlayer(user, target, item, price);
  } else {
    offerTarget(user, target, item, price);
  }
},
/*  Offer to give a player or a target an item, and optionally expect an item in return.
 */

// request ITEM (ITEM)
'request': function (user, cmdArray) {
  if (!user.player.worn) {
    user.socket.emit('message', '<i>Only registered players can use this command.</i>');
    return;
  }
  
  if (!cmdArray[1]) {
    user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'request ITEM (ITEM)</i>');
    return;
  }
  
  var item = parseTarget(cmdArray[1]);
  var price = ''; // Nothing in return.
  if (cmdArray[2]) {
    price = parseTarget(cmdArray[2]);
  }
  
  // Make sure both item and price parsed correctly.
  if (!item || (cmdArray[2] && !price)) {
    user.socket.emit('message', '<i>Items must be formatted as ID.INSTANCE, such as \'0.0\'.</i>');
    return;
  }
  
  // Add to user object.
  user.player.trade.requests.push(item, price);
},
/*  Request an item, and optionally offer an item in return.
 */

// accept TARGET ITEM
'accept': function (user, cmdArray) {
  if (!user.player.worn) {
    user.socket.emit('message', '<i>Only registered players can use this command.</i>');
    return;
  }
  
  if (!cmdArray[1] || !cmdArray[2]) {
    user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'accept TARGET ITEM</i>');
    return;
  }
  
  var username = caseName(cmdArray[1]);
  var item = cmdArray[2];
  
  // Try parsing if the target is not a user.
  var parsedTarget = parseTarget(target);
  
  // If target is a username (parsed as NaN, which returns false.)
  if (!parsedTarget) {
    exchangeItems(user, username, item); // Verifies and makes the exchange.
  } else {
    exchangeItems(user, parsedTarget, item); // Verifies and makes the exchange.
  }
},
/*  Accept an offer or request of an item, according to the price.
 */

// trade (ITEM)(,AMOUNT) (ITEM)(,AMOUNT) (TARGET)
'trade': function (user, cmdArray) {
  if (!user.player.worn) {
    user.socket.emit('message', '<i>Only registered players can use this command.</i>');
    return;
  }
  
  if (!cmdArray[1]) {
    user.socket.emit('message', '<i>Syntax: ' + cmdChar + 'trade ITEM(,AMOUNT) (ITEM)(,AMOUNT) (TARGET)</i>');
    return;
  }
  
  
}
/*  Create or remove a trade request, available for any target/player to accept,
 *  or accept a trade with a wanting target/player - or request a trade
 *  with that target/player.
 *  AMOUNT defaults to 1. ITEM is either case-insensitive fullName() or ID.INSTANCE.
 *  ITEM defaults to '-', which means nothing.
 */
 
 
 
// Verifies the target, item and price, and makes the exchange,
// either between players or targets.
// The user accept the price that the target sets,
// in order to get the item.
// Notice that target, item & price are just strings.
function exchangeItems(user, target, item, price) {
  // Make sure both user and target have at least one hand available.
  var userHand = false;
  
  if (user.player.worn.hands) {
    for (var hand in user.player.worn.hands) {
      var curHand = user.player.worn.hands[hand];
      
      if (JSON.stringify(curHand) == '{}') {
        userHand = hand;
      }
    }
    
   if (!userHand) {
      user.socket.emit('message', '<i>You need a free hand to hold with!</i>');
      return;
    }
  } else {
    user.socket.emit('message', '<i>You have no hands to hold with!</i>');
    return;
  }
  
  // Match either a target object or a player object.
  var targetHand = false;
  var targetLocation;
  if (target.player) {
    targetLocation = target.player.worn.hands;
  } else {
    targetLocation = target.worn.hands;
  }
  
  // Make sure the target has a hand to hold with.
  if (targetLocation) {
    for (var hand in targetLocation) {
      var curHand = targetLocation[hand];
      
      if (JSON.stringify(curHand) == '{}') {
        targetHand = hand;
      }
    }
  } else {
    user.socket.emit('message', '<i>' + target + ' has no hands to hold with!</i>');
    return;
  }
  
  // Check that the target is in the room.
  if (target.player) {
    for (var i=0; i< world.watch[strPos(user.player.position)].length; i++) {
      var curPlayer = world.watch[strPos(user.player.position)][i];
      
      if (curPlayer.account.username == target) {
        // Make sure that I have the price.
        if (price) {
          var priceLocation = locateItem(user, price); // Returns location name, or false.
          
          if (!priceLocation) {
            user.socket.emit('message', '<i>You do not have item [' + price + '].</i>');
            return;
          }
        }
        
        // Make sure that the target has the item.
        var itemLocation = locateItem(curPlayer, item); // Returns location name, or false.
        
        if (!itemLocation) {
          user.socket.emit('message', '<i>' + fullName(curPlayer) + ' does not have item [' + item + '].</i>');
          return;
        }
        
        // Attempt to remove item and price from players.
        var holder = {};
        
        holder.item = removeItem(curPlayer, item, itemLocation);
        if (!holder.item) {
          user.socket.emit('message', '<i>' + fullName(curPlayer) + ' does not have item [' + item + '].</i>');
          return;
        }
        
        holder.price = removeItem(user, price, priceLocation);
        if (!holder.price) {
          addItem(curPlayer, holder.item, itemLocation); // Undo removal from target.
          user.socket.emit('message', '<i>You do not have item [' + price + '].</i>');
          return;
        }
        
        // Add items to players and finish.
        addItem(user, holder.item, userHand);
        addItem(curPlayer, holder.price, targetHand);
        
        // Notify players of success.
        if (price) {
          user.socket.emit('message', '<i>You have received ' + FullNameID(holder.item) + ' from ' + fullNameID(curPlayer) + 
                              ' in exchange for your ' + FullNameID(holder.price) + '.</i>');
          
          curPlayer.socket.emit('message', '<i>' + fullNameID(user) + ' has given you ' + FullNameID(holder.price) + 
                                  ' in exchange for ' + FullNameID(holder.item) + '.</i>')
        } else {
          user.socket.emit('message', '<i>You have received ' + FullNameID(holder.item) + ' from ' + fullNameID(curPlayer) + '.</i>');
          
          curPlayer.socket.emit('message', '<i>You have given ' + FullNameID(holder.item) + ' to ' + fullNameID(user) + '.</i>')
        }
        return;
      }
    }
    
    // Target player not in the room.
    user.socket.emit('message', '<i>Could not find [' + target + '] here!</i>');
  } else {
    
  }
}

// Attempt to remove an item from a player by ID.INSTANCE,
// and optionally by location, returning the item reference, or false.
function removeItem(user, item, location) {
  var itemObject;
  
  // From location.
  if (location) {
    // Generally body.
    if (user.player.worn[location]) {
      itemObject = user.player.worn[location];
      user.player.worn[location] = {};
      return itemObject;
    }
    
    // Or specifically hands.
    if (user.player.worn.hands[location]) {
      itemObject = user.player.worn.hands[location];
      user.player.worn.hands[location] = {};
      return itemObject;
    }
  }
  
  // Otherwise, find it.
  for (var location in user.player.worn) {
    var curItem = user.player.worn[location];
    
    // Hands special case.
    if (location == 'hands') {
      for (var hand in curItem) {
        curItem = curItem[hand];
        
        if (strTarget(curItem) == item) {
          itemObject = curItem;
          user.player.worn.hands[location] = {};
          break;
        }
      }
      
      if (playerItem) {
        break;
      }
    }
    
    if (strTarget(curItem) == item) {
      itemObject = curItem;
      user.player.worn[location] = {};
      break;
    }
  }
  
  if (!itemObject) {
    return false;
  } else {
    return itemObject;
  }
}

// Adds an items to a given location on player,
// either on entire body or in a hand.
function addItem(user, item, location) {
  // Generally body.
  if (user.player.worn[location]) {
    user.player.worn[location] = item;
    return;
  }
  
  // Or specifically hands.
  if (user.player.worn.hands[location]) {
    user.player.worn.hands[location] = item;
    return;
  }
}
