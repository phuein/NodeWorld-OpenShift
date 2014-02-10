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
  
  'blah':
    '',
  
  'bree':
    '',
  
  'gersw':
    '',
// *** //

//*** SERVER OBJECTS ***//
  'htr':
    '',
  
  'hset':
    '',
  
  'ntrnty':
    '',
// *** //

//*** WORLD OBJECTS ***//
  'nydtdrn':
    '',
  
  'ntdrbb':
    '',
  
  'ymtyjn':
    ''                // Last item must not end with a comma!
// *** //
};

module.exports = constructors;    // WARNING: Global variable from server.js is named 'constructor'!