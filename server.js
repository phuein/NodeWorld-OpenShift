/*  
 *  Game Test 0.1
 *  
 *  by Assaf Koss, 2013.
 *  
 *  This is an interactive virtual world game-server
 *  that saves to database, but queries it as little
 *  as possible.
 *  
 *  All the code is intended to be readable and simple,
 *  even at the expense of functionality and efficiency.
 *  
 *  All world objects' properties and functionality can be
 *  changed or toggled from the client-side. Each functionality
 *  category resides inside its' own module.
 *
 *  Naming conventions should be short and reflect purpose.
 *  Function should be limited to a hundred lines.
 *  Comments should describe the logic used in each event.
 *  
 *  Best viewed in Sublime Text 3, with "tab_size": 2
 *  and "translate_tabs_to_spaces": true.
 *  
 */

//*** MODULE DEPENDENCIES ***//
  var domain = require('domain');
  
  var express = require('express');
  var routes = require('./routes');
  var http = require('http');
  
  var app = express();
  
  var connect = require('connect');
  
  var server = http.createServer(app);
  io = require('socket.io').listen(server, {
    // Socket Server Options.
    'log level': 2
  });
  
  // World Functionality Modules.
  command = require('./commands.js');
// *** //

//*** SERVER VARIABLES ***//
  var ip = process.env.IP || '0.0.0.0';
  var port = process.env.PORT || 3000;
  
  // var keyName = 'GameTest'; // Cookie name. Defaults to 'connect.sid'.
  // var secret = '6edthsej75en43g35u563t345'; // Cookie pass.

  //////		The command character is the one character that messages are parsed for.		//////
  //////						It is ignored if the following character is the same!								//////
  //////					 If sent by itself, it will reply with the help command.							//////
  cmdChar = ',';
  
  nl = '\n'; // New line.
  
  serverClosed = false;

  // var cookieParser = express.cookieParser(secret);
  // var cookie = require('cookie');
  // var sessionStore = new connect.middleware.session.MemoryStore();
// *** //

//*** APP SET/ENGINE/MIDDLEWARE/GET ***//
  app.set('views', 'views');
  app.engine('html', require('ejs').renderFile);
  app.set('view engine', 'html');
  app.use(express.favicon());
  app.use(express.logger('dev'));
  app.use(express.json());
  app.use(express.urlencoded());
  app.use(express.methodOverride());
  // app.use(cookieParser);
  // app.use(express.session({ store: sessionStore, signed: true, 
  //                          cookie: { httpOnly: true }, secret: secret, key: keyName }));
  app.use(app.router);
  app.use('/public', express.static('public'));

  app.get('/', routes.index);
// *** //

//*** WORLD OBJECT ***//
  // The world object holds all necessary server-side (off DB memory) data.
  world = {};

  // Set (or empty) the world object properties;
  setWorld = function () {
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
    // but not yet saved into the DB.
    world.changed   = {};
    // Including:
    world.changed.users   = [];
    world.changed.targets = [];
    world.changed.rooms   = [];
    world.changed.maps    = [];
    world.changed.config  = false;    // Toggles saving the entire config object.
    
    // Follow which players are in which rooms and maps.
    world.watch     = {};
  }

  setWorld(); // Call the function.
// *** //

//*** DATABASE OPEN CONNECTION & SOCKET LISTEN ***//
  var MongoClient = require('mongodb').MongoClient
    , Server = require('mongodb').Server;

  db = {};
  usersdb = {};
  targetsdb = {};
  mapsdb = {};
  worlddb = {};

  var mongoClient = new MongoClient(new Server('localhost', 27017));
  mongoClient.open(function (err, mongoClient) {
    if (err) {
      console.log(err);
    }
    
    db = mongoClient.db("gametest");
    
    // Collections:
    usersdb     =   db.collection('users'),       // Registered players.
    targetsdb   =   db.collection('targets'),     // Objects, NPCs, MOBs, Animals, Items, and the rest.
    mapsdb      =   db.collection('maps');        // Maps in Text clients, and Zones in 2D & 3D clients.
                                                  // Including Rooms in Text clients, and Areas in 2D & 3D clients.
    worlddb     =   db.collection('world');       // World settings and configurations.
    
    // Ensure Indexes! Indexing on '_id' is both automatic and 'unique', already.
    usersdb.ensureIndex({ 'account.username': 1 }, 
                        { 'background': true, 'unique': true }, function (err) {
                          if (err) {
                            console.log(err);
                          }
                        }); // Usernames are unique!

    // Load world configurations from DB or create them.
    worlddb.findOne({}, function (err, config) {
      if (err) {
        console.log(err);
        return;
      }
      
      if (!config) {
        console.log('No world config, yet. Loading default configurations...');
        command.configureWorld();
        return;
      }
      
      world.config = config; // Apply into world object.
      console.log('World configuration loaded from database.');
    });
    
    // Listen.
    server.listen(port, ip, function () {
      console.log('Express & WebSocket server listening on port ' + port + ' for IP ' + ip + '.');
    });

    // mongoClient.close(); // No need to close connection manually,
                            // since only the server connects once, at any time.
  });
// *** //

// Return a timestamp of '<hh:mm:ss> '.
Timestamp = function () {
  var now = new Date();
  var hours = now.getHours();
  var minutes = now.getMinutes();
  var seconds = now.getSeconds();
  
  // Make sure each is 2 digits, always.
  hours = ( hours < 10 ? '0' + hours : hours );
  minutes = ( minutes < 10 ? '0' + minutes : minutes );
  seconds = ( seconds < 10 ? '0' + seconds : seconds );
  
  var timestamp = '<' + hours + ':' + minutes + ':' + seconds + '> ';
  
  return timestamp;
}

// When a client requests a connection with the Socket server. //
io.sockets.on('connection', function (socket) {
  // Server is closed.
  if (serverClosed) {
    // Kick socket.
    socket.emit('message', '<b>Server is closed!</b>');
    socket.disconnect();
    console.log('Connection attempt: Server closed!');
  }
  
	// The user object that locally (per socket session) saves the logged-in user data from the DB.
	var user = {
		account: {},
		player: { name: "Anonymous" + Math.floor((Math.random()*10000)+1) }
	};
  user.account.username = user.player.name; // Default random name.
  user.account.access = 'user'; // Default access level, for unregistered users.
  
	// Use local object room to refer to the current loaded room.
	user.room;

  // Default to 0,0,0 as first room.
  if (!user.player.position) {
    user.player.position = { 'x': 0, 'y': 0, 'z': 0 };
  }
  
  // Default to 0 as first map.
  if (!user.player.map) {
    user.player.map = 0;
  }
  
  // Let the user object access its' own socket,
  // so there's no need to keep referncing sockets.
  user.socket = socket;
  
  // Becomes pre + name + post for registered players!
  user.name = user.player.name;

  // Track all users in world.users object for general access and listing.
  world.users[user.account.username] = user;
  
  // Inform everybody about the new user.
  user.socket.broadcast.emit('message', user.player.name +  ' has joined.');
  // Welcome the new user.
  user.socket.emit('message', '<b>Welcome to Test Game, ' + user.player.name + '!</b><br />' + 
                          'Please, use <b>' + cmdChar + 'help</b> to list all available commands.');

  // Handle room and map loading, or creation, accordingly. Does a 'look', as well.
  command.loadRoom(user);

	// When a client socket emits/sends any message.
  socket.on('message', function (message) {
  	// Check for command character.
  	if (message.charAt(0) == cmdChar && message.charAt(1) != cmdChar) {
      // Every command message is handled on a new domain.
      var curDomain = new domain.create();

      // Catch error.
      curDomain.on('error', function (err) {
        console.log(Timestamp() + err.stack + nl);
        user.socket.emit('message', '<i>Command failed!</i><br /><pre>' + err + '</pre><br />');
      });

      // Run the command.
      curDomain.run(function () {
        process.nextTick(function () {
          command.handleCommands(message, user);
        });
      });
      
  		return;
  	}
    
  	// Default to chat message.
    // Show to all others.
  	socket.broadcast.emit('message', user.player.name + 
                        ( user.player.name != user.account.username ? '(' + user.account.username + ')' : '' ) + 
                        ': ' + message); // Prefix with player name.
    // Show me.
    socket.emit('message', 'You: ' + message);
  });
  
  // When a client socket disconnects.
  socket.on('disconnect', function () {
    var strCoord = command.strPos(user.player.position);
    
    // Remove myself from the room's and map's watchers.
    world.watch[strCoord].splice(world.watch[strCoord].indexOf(user), 1);
    world.watch[user.player.map].splice(world.watch[user.player.map].indexOf(user), 1);
    
    // Update 'lastonline' if it's a registered user.
    if (user.account.lastonline) {
      user.account.lastonline = new Date();
    }
    
    // Immediate save to DB for registered users.
    if (user.account.registered) {
      command.saveUser(user);
    }
    
    // Inform all.
    io.sockets.emit('message', command.fullNameID(user) + ' has left.');
    
    delete world.users[user.account.username]; // Clean up the user reference from world object.
  });
});

// Requests a check to save world changes to the DB, by intervals.
worldSaver = setInterval(command.saveWorld, 1000 * 10); // Milliseconds, so 1000 * 60 = 60 seconds.