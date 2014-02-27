/*  
 *  Operations do minor calculations,
 *  have safeguards against unexpected arguments,
 *  and always return an expected result.
 */

// Capitalize first character of a string, and return the resulting string.
function upperFirst(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

// Shorthand for Object.prototype.toString.call()
// Options: [object Array], [object String], [object Object], [object Number],
//          [object Undefined], [object Date], [object Math], [object Null]
function toType(obj) {
  return Object.prototype.toString.call(obj);
}

// Takes a position object, for example: { 'x': 0, 'y': 0, 'z': 0 }
// and convert it into a string of '0x0y0z', which is how rooms are refered to.
function strPos(pos) {
  return pos.x + 'x' + pos.y + 'y' + pos.z + 'z';
}

// Return a real object made from a dotted object notation 
// string 'object.property1.property2', optionally with a value for the last property.
// Returns false if invalid string, such as '.property'.
function objDotted(str, val) {
  var makeObject = {};
  var sortArr = [];
  var dotSplit = str.split('.');
  
  // Must not start empty, such as '.property'.
  if (dotSplit[0] == '') {
    return false;
  }
  
  // Otherwise, make an object.
  if (dotSplit[1]) {
    for (var i=0; i < dotSplit.length; i++) {
      if (i == 0) {
        sortArr[0] = {};
        continue;
      }
      
      // If not last property.
      if (i != dotSplit.length - 1) {
        sortArr[i-1][dotSplit[i]] = {};
        sortArr[i] = sortArr[i-1][dotSplit[i]];
      } else {
        // Last one, then insert value.
        sortArr[i-1][dotSplit[i]] = val;
        makeObject[dotSplit[0]] = sortArr[0];
        return makeObject;
      }
    }
  } else {
    // Nothing after the first dot.
    makeObject[dotSplit[0]] = val;
    return makeObject;
  }
}

// Update existing properties, and create non-existing properties,
// if upsert is requested. Recursively changes the original object,
// returning nothing.
function updateObj(originalObj, newObj, upsert) {
  // Ascertain that upsert is defined.
  if (upsert == undefined) {
    var upsert = false;
  }
  
  for (var propertyName in newObj) {
    var curProperty = newObj[propertyName];
    
    // Update an existing property, or create a new one.
    if (originalObj[property]) {
      // Recursively copy Object and Array properties.
      if (toType(curProperty) != '[object Array]' && toType(curProperty) != '[object Object]') {
        updateObj(originalObj[property], curProperty, upsert);
      }
      
      // Otherwise, just reference the value.
      originalObj[property] = curProperty;
    } else if (upsert){
      // Create new property, only if upsert is requested.
      originalObj[property] = curProperty;
    }
  }
}

// Copies Object & Array types recursively,
// and directly references the value of any other object type.
// NOT USING isChild().
function copyObj(originalObj) {
  var copiedObj;
  
  // Handle each object type case.
  if (toType(originalObj) == '[object Object]') {
    copiedObj = {};
    
    for (var propertyName in originalObj) {
      var curProperty = originalObj[propertyName];
      
      // Recursively copy Object and Array properties.
      if (toType(curProperty) == '[object Object]' || toType(curProperty) == '[object Array]') {
        copiedObj[propertyName] = copyObj(curProperty);
        continue;
      }
      
      // Copy date.
      if (toType(curProperty) == '[object Date]') {
        copiedObj[propertyName] = new Date(curProperty);
        continue;
      }
      
      // Otherwise, just copy the value.
      copiedObj[propertyName] = curProperty;
    }
  } else if (toType(originalObj) == '[object Array]') {
    copiedObj = [];
    
    for (var i = 0; i < originalObj.length; i++) {
      var curProperty = originalObj[i];
      
      // Recursively copy Object and Array properties.
      if (toType(curProperty) == '[object Object]' || toType(curProperty) == '[object Array]') {
        copiedObj[i] = copyObj(curProperty);
        continue;
      }
      
      // Copy date.
      if (toType(curProperty) == '[object Date]') {
        copiedObj[i] = new Date(curProperty);
        continue;
      }
    
      // Otherwise, just copy the value.
      copiedObj[i] = curProperty;
    }
  } else if (toType(originalObj) == '[object Date]') {
    // Copy date.
    copiedObj = new Date(originalObj);
  } else {
    // Otherwise, just copy the value.
    copiedObj = originalObj;
  }
  
  return copiedObj;
}

// Returns true, if one of the parent's children is the target.
// This is useful, for avoiding copyObj() through an infinite loop!
function isChild(target, parent) {
  if (toType(parent) == '[object Object]') {
    for (var name in parent) {
      var curProperty = parent[name];
      
      // Direct child.
      if (curProperty = target) return true;
      
      // Check if target is a child of this property, and so on, recursively.
      if (toType(curProperty) == '[object Object]' || toType(curProperty) == '[object Array]') {
        if (isChild(target, curProperty)) return true;
      }
    }
  } else if (toType(parent) == '[object Array]') {
    for (var i=0; i < parent.length; i++) {
      var curItem = parent[i];
      
      // Direct child.
      if (curItem = target) return true;
      
      // Check if target is a child of this property, and so on, recursively.
      if (toType(curItem) == '[object Object]' || toType(curItem) == '[object Array]') {
        if (isChild(target, curItem)) return true;
      }
    }
  }
  
  return false;     // Not the target.
}

// Locates a property insides an object, receiving a dotted string,
// such as 'property.property.property', and returns an array with
// the reference to its' parent and property name [parentRef, propetyName],
// if it exists, or false, if not found.
function hasProperty(obj, propertyStr) {
  var splitField = propertyStr.split('.');
  console.log(obj[splitField[0]]);
  // Parent is obj, itself.
  if (!splitField[1]) {
    if (obj[splitField[0]] == undefined) return false;
    
    return [obj, splitField[0]];
  }
  
  // Get last field in the string.
  // Use an array to convert dotted string into object representation.
  var objArray = [];
  for (var i=0; i < splitField.length; i++) {
    // First item.
    if (i == 0) {
      // Property not found.
      if (obj[splitField[0]] == undefined) return false;
      
      objArray[0] = obj[splitField[0]];
      continue;
    }
    
    // Last item.
    if (i == splitField.length - 1) {
      objArray[i] = objArray[i-1][splitField[i]];
      
      // Last property doesn't exist.
      if (objArray[i] == undefined) return false;
      
      return [objArray[i-1], splitField[i]];
    }
    
    objArray[i] = objArray[i-1][splitField[i]];
    
    // Property not found.
    if (objArray[i] == undefined) return false;
  }
}

// First character is upper-case, while the rest are lower-case.
// Returns re-cased name.
function caseName(name) {
  var casedName = name.toLowerCase(); // Lowercase the name string.
  casedName = upperFirst(casedName); // Only first character.
  return casedName;
}

// Target names (pre, post, name) and rooms titles must only contain letters,
// optionally with spaces. First letter must be capital. Certains words must
// always be lower-case, except the first word.
// Returns the parsed name on success, or false on failure.
function parseName(name) {
  // Remove whitespaces from start and end.
  name = name.trim();
  // No more than one whitespace, at a time.
  name = name.replace(/\s+/g, ' ');
  
  // Only English alphabet and spaces allowed. Can't be only spaces.
  if (name.search(/[^A-Za-z ]/) >= 0 || name == '') {
    return false;
  }
  
  // The following words must always be in lower-case.
  var lcWords = ['a', 'an', 'the', 'for', 'and', 'nor', 'but', 'or', 'yet', 'so', 
                 'at', 'by', 'on', 'of', 'to', 'as', 'en', 'per', 'vs', 'via', 'de',
                 'du', 'von', 'et', 'le', 'la', 'il', 'der', 'af', 'til', 'dit',
                 'del', 'zu', 'und', 'di', 'av'];
  
  var nameArr = name.split(' ');
  
  for (var i=0; i < nameArr.length; i++) {
    // First and last words must be treated as names.
    if (i == 0 || i == nameArr.length-1) {
      nameArr[i] = upperFirst(nameArr[i]);
      continue;
    }
    
    nameArr[i] = nameArr[i].toLowerCase();
    
    // Check against lcWords array.
    if (lcWords.indexOf(nameArr[i]) >= 0) {
      nameArr[i] = nameArr[i].toLowerCase();
      continue;
    }
    
    // Otherwise, treat as name.
    nameArr[i] = upperFirst(nameArr[i]);
  }
  
  name = nameArr.join(' ');
  
  return name;
}

// Returns the pre + name + post joined strings of a player or target,
// without empty spaces, if any does not exist or is empty.
function fullName(target) {
  // Either a user or a target.
  if (target.player) {
    return (target.player.pre ? target.player.pre + ' ' : '') + target.player.name + 
                                (target.player.post ? ' ' + target.player.post : '');
  } else {
    return (target.pre ? target.pre + ' ' : '') + target.name + 
                                (target.post ? ' ' + target.post : '');
  }
}

// Returns the fullName() + the strTarget() or + '[USERNAME]',
// if the fullName() is different from the username, otherwise only the fullName() returns.
function fullNameID(target) {
  var result = fullName(target);
  
  // Either a user or a target.
  if (target.player) {
    var username = '';
    if (result != target.account.username) {
      username = ' [' + format.player(target.account.username) + ']';
    }
    
    result = result + username;
  } else {
    result = result + ' [' + format.target(strTarget(target)) + ']';
  }
  
  return result;
}

// Check that username is under or over the character limit,
// and is only composed of a-z & A-Z letters.
// Returns a message string on error, or false if no problem.
function parseUsername(username) {
  // Username must be at least two characters long!
  if (username.length < 2) {
    return '<i>Username too short! Please, keep it over one character.</i>';
  }
  
  // Username size limit is 15 characters!
  if (username.length > 15) {
    return '<i>Username too long! Please, keep it under fifteen characters.</i>';
  }

  // Only English alphabet allowed.
  if (username.search(/[^A-Za-z]/) >= 0) {
    return '<i>Username must be one word, composed of English letters, only!</i>';
  }

  return false; // No problem.
}

// Converts a direction string to a position object.
// For example: 'nw' returns { 'x': curPos.x - 1, 'y': curPos.y + 1, 'z': curPos.z }.
// An unavailable option returns false.
function posDir(curPos, dir) {
  // Options: n, s, e, w | nw ,ne , sw, se | u, d
  switch(dir) {
    case 'n':
      newPos = { 'x': curPos.x, 'y': curPos.y + 1, 'z': curPos.z };
      break;
    
    case 's':
      newPos = { 'x': curPos.x, 'y': curPos.y - 1, 'z': curPos.z };
      break;
    
    case 'e':
      newPos = { 'x': curPos.x + 1, 'y': curPos.y, 'z': curPos.z };
      break;
    
    case 'w':
      newPos = { 'x': curPos.x - 1, 'y': curPos.y, 'z': curPos.z };
      break;
    
    case 'nw':
      newPos = { 'x': curPos.x - 1, 'y': curPos.y + 1, 'z': curPos.z };
      break;
    
    case 'ne':
      newPos = { 'x': curPos.x + 1, 'y': curPos.y + 1, 'z': curPos.z };
      break;
    
    case 'sw':
      newPos = { 'x': curPos.x - 1, 'y': curPos.y - 1, 'z': curPos.z };
      break;
    
    case 'se':
      newPos = { 'x': curPos.x + 1, 'y': curPos.y - 1, 'z': curPos.z };
      break;
    
    case 'u':
      newPos = { 'x': curPos.x, 'y': curPos.y, 'z': curPos.z + 1 };
      break;
    
    case 'd':
      newPos = { 'x': curPos.x, 'y': curPos.y, 'z': curPos.z - 1 };
      break;
    
    default:
      return false;
  }
  
  return newPos;
}

// Return the 'ID.INSTANCE' representation of a target.
function strTarget(target) {
  return target['_id'] + '.' + target.instance;
}

// Parses a string that represents a target,
// so that it returns as 'ID.INSTANCE'.
// Returns false if string is Not a Number.
function parseTarget(target) {
  if (isNaN(target)) {
    return false;
  }
  
  var idInst = target.split('.');
  
  // Default empty string (id or instance) to '0'.
  if (idInst[0] == '') {
    idInst[0] = '0';
  }
  if (!idInst[1] || idInst[1] == '') {
    idInst[1] = '0';
  }
  var properTarget = idInst.join('.'); // Turn back into proper string.
  
  return properTarget;
}

// Verifies that a target has the 'worn' property filled,
// and returns true if so, or false if not so.
function verifyWearable(target) {
  if (!target.worn || JSON.stringify(target.worn) == '{}') {
    return false;
  }
  
  // Otherwise.
  return true;
}

// Assert if a location on an object (user, target, room, etc')
// does't exist or is empty. Returns true if empty, or false otherwise.
function locationEmpty(location) {
  if (!location || JSON.stringify(location) == '{}' || JSON.stringify(location) == '[]') {
    return true;
  }
  
  // Otherwise.
  return false;
}

// Update the world.users reference, and the basic user properties:
// account, player, ['_id'], name.
function updateUser(user, newUser) {
  // Replace name for a registered user.
  if (newUser.account == undefined) {
    user.player.name = newUser.player.name;
    user.name = fullName(user); // pre + name + post.
    return;
  }
  
  delete world.users[user.account.username]; // Clean up from world.users.
  
  // Do login, or replace name for an unregistered user.
  if (newUser['_id']) {
    // User variable reference (pointer) is saved, by only replacing properties.
    user.account = newUser.account;
    user.player = newUser.player;
    user['_id'] = newUser['_id'];
  } else {
    user.account = newUser.account;
    user.player = newUser.player;
  }
  
  // Update extra properties.
  user.name = fullName(user); // pre + name + post.
  
  // Update world.users reference.
  world.users[user.account.username] = user;
}

// Returns a reference to an existing command, or false,
// with optional access level, to restrict the search.
function commandExists(cmd, access) {
  // Search according to access level.
  switch (access) {
    case 'god':
      for (var category in commands) {
        var curCategory = commands[category];
        
        if (curCategory[cmd]) {
          return curCategory[cmd];
        }
      }
      break;
    
    case 'builder':
      for (var category in commands) {
        // Skip god commands.
        if (category == 'god') {
          continue;
        }
        
        var curCategory = commands[category];
        
        if (curCategory[cmd]) {
          return curCategory[cmd];
        }
      }
      break;
    
    case 'master':
      for (category in commands) {
        // Skip god and builder commands.
        if (category == 'god' || category == 'builder') {
          continue;
        }
        
        var curCategory = commands[category];
        
        if (curCategory[cmd]) {
          return curCategory[cmd];
        }
      }
      break;
    
    case 'player':
      for (var category in commands) {
        // Skip god, builder, and master commands.
        if (category == 'god' || category == 'builder' || category == 'master') {
          continue;
        }
        
        var curCategory = commands[category];
        
        if (curCategory[cmd]) {
          return curCategory[cmd];
        }
      }
      break;
    
    case 'user':
      var curCategory = commands['user'];
      
      if (curCategory[cmd]) {
        return curCategory[cmd];
      }
      break;
    
    default:
      // Same as 'user', when no access argument.
      var curCategory = commands['user'];
      
      if (curCategory[cmd]) {
        return curCategory[cmd];
      }
  }
  
  // Otherwise, command not found.
  return false;
}

// A random name generator, based on Prefix + middle + suffix.
// Checks if username is already in world.users[], and recursively retries.
// Optionally, check if argument name is one of the options,
// and return true if so, or false if not so (this is for the rename command.)
function randomName(name) {
  // Each word must be 3 characters long, exactly.
  var prefixes  = ['Ale', 'Bin', 'Kor', 'Lam', 'Dar', 'Sof', 'Arn', 'Men', 'Che', 'Tai'];
  
  // Each word must be 3 characters long, exactly.
  var middles   = ['gen', 'shi', 'por', 'pon', 'lam', 'att', 'raa', 'arr', 'gar', 'fen'];
  
  // Each word must be 3 characters long, exactly.
  var suffixes  = ['eus', 'nos', 'gos', 'kor', 'mis', 'mal', 'dar', 'she', 'ous', 'fes'];
  
  // In case of a name check, check against these options.
  if (name) {
    // No match, if not same length.
    if (name.length != 9) {
      return false;
    }
    
    var prefix = name.substr(0, 3);
    
    var middle = name.substr(3, 3);
    
    var suffix = name.substr(6, 3);
    
    if (prefixes.indexOf(prefix) >= 0 && middles.indexOf(middle) >= 0 && 
                                          suffixes.indexOf(suffix) >= 0) {
      return true;  // Found a match!
    }
    
    return false;   // Did not find a match.
  }
  
  // Get a random number between min and max, including them.
  var min = 0;
  var max = 9;
  
  var prefix = prefixes[Math.floor(Math.random() * (max - min + 1)) + min];
  
  var middle = middles[Math.floor(Math.random() * (max - min + 1)) + min];
  
  var suffix = suffixes[Math.floor(Math.random() * (max - min + 1)) + min];
  
  var name = prefix + middle + suffix;
  
  // Must not be already in-use.
  if (world.users[name]) {
    name = randomName(); // Recursively, try again!
  }
  
  return name;
}

// Returns the string with <>&" escaped for HTML.
function escapeHTML(str) {
  return String(str).replace(/</gm, '&lt;')
                    .replace(/>/gm, '&gt;')
                    .replace(/&/gm, '&amp;')
                    .replace(/"/g, '&quot;');
}

//*** EXPORTS ***//
  exports.upperFirst        =   upperFirst;
  exports.toType            =   toType;
  exports.strPos            =   strPos;
  exports.objDotted         =   objDotted;
  exports.updateObj         =   updateObj;
  exports.copyObj           =   copyObj;
  exports.hasProperty       =   hasProperty;
  exports.caseName          =   caseName;
  exports.parseName         =   parseName;
  exports.fullName          =   fullName;
  exports.fullNameID        =   fullNameID;
  exports.parseUsername     =   parseUsername;
  exports.posDir            =   posDir;
  exports.strTarget         =   strTarget;
  exports.parseTarget       =   parseTarget;
  exports.verifyWearable    =   verifyWearable;
  exports.locationEmpty     =   locationEmpty;
  exports.updateUser        =   updateUser;
  exports.commandExists     =   commandExists;
  exports.randomName        =   randomName;
  exports.escapeHTML        =   escapeHTML;
// *** //