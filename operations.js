/*  
*  Operations do minor calculations,
*  have safeguards against unexpected arguments,
*  and always return an expected result.
*/

// Capitalize first letter of a string, and return the resulting string.
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
    
    // Otherwise, just reference the value.
    copiedObj[propertyName] = curProperty;
  }
  } else if (toType(originalObj) == '[object Array]') {
    copiedObj = [];
    
    for (var i = 0; i < originalObj.length; i++) {
      var curProperty = originalObj[i];
      
      // Recursively copy Object and Array properties.
      if (toType(curProperty) == '[object Object]' || toType(curProperty) == '[object Array]') {
        copiedObj[propertyName] = copyObj(curProperty);
        continue;
      }
    
      // Otherwise, just reference the value.
      copiedObj[propertyName] = curProperty;
    }
  } else {
    copiedObj = curProperty;
  }
  
  return copiedObj;
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
      username = ' [' + target.account.username + ']';
    }
    
    result = result + username;
  } else {
    result = result + ' [' + strTarget(target) + ']';
  }
  
  return result;
}

// Check that username is under the character limit,
// and is only composed of a-z & A-Z letters.
// Returns a message string on error, or false if no problem.
function parseUsername(username) {
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
  delete world.users[user.account.username]; // Clean up world.users.
  
  if (newUser['_id']) {
    // Full user. Only the top properties are replaced,
    // to keep the same reference for variable user.
    user.account = newUser.account;
    user.player = newUser.player;
    user['_id'] = newUser['_id'];
  } else {
    // Only name.
    user.account.username = newUser.account.username;
    user.player.name = newUser.player.name;
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
        
        var curCategory = commands[category].descriptions;
        
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
        
        var curCategory = commands[category].descriptions;
        
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
        
        var curCategory = commands[category].descriptions;
        
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
      // Same as 'god', when no access argument.
      for (var category in commands) {
        var curCategory = commands[category];
        
        if (curCategory[cmd]) {
          return curCategory[cmd];
        }
      }
  }
  
  // Otherwise, command not found.
  return false;
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
// *** //