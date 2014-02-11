/*  
 *  Node World 0.1
 *  
 *  by Assaf Koss, 2014.
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
 *  References for anything MongoDB in NodeJS.
 *  http://mongodb.github.io/node-mongodb-native/api-generated/collection.html
 *  
 *  Most comfortable for quick testing of NodeJS functionality.
 *  http://www.node-console.com/script/code
 */

//*** SERVER VARIABLES ***//
  var ip = process.env.OPENSHIFT_DIY_IP || '127.0.0.1';
  var port = process.env.OPENSHIFT_DIY_PORT || 8080;
  
  // var keyName = 'GameTest'; // Cookie name. Defaults to 'connect.sid'.
  // var secret = '6edthsej75en43g35u563t345'; // Cookie pass.

  //////    The command character is the one character that messages are parsed for.    //////
  //////            It is ignored if the following character is the same!               //////
  //////           If sent by itself, it will reply with the help command.              //////
  cmdChar = ',';
  
  nl = '\n'; // New line.
  
  serverClosed = false;

  // var cookieParser = express.cookieParser(secret);
  // var cookie = require('cookie');
  // var sessionStore = new connect.middleware.session.MemoryStore();
// *** //

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
    // 'close timeout' :   60,               // Seconds to re-open the connection, after client disconnect.
    'log level'     :   1,                   // Recommended 1 for production.
    'transports'    :   ['xhr-polling']
  });
  
  // Recomended settings for production.
  io.enable('browser client minification');  // send minified client
  io.enable('browser client etag');          // apply etag caching logic based on version number
  io.enable('browser client gzip');          // gzip the file
  
  /* Enable all transports.
  io.set('transports', [
    'websocket',
    'flashsocket',
    'htmlfile',
    'xhr-polling',
    'jsonp-polling'
  ]);
  */
  
  // World Functionality Modules.
  command = require('./commands.js');
  
  // Constructors & Messages.
  constructor = require('./constructors.js');
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
  
  // Default index page.
  app.get('/', routes.index);
  
  //*** ERROR PAGES ***//
    // Respond with this, when any error occures.
    app.use(function(err, req, res, next){
      // we may use properties of the error object
      // here and next(err) appropriately, or if
      // we possibly recovered from the error, simply next().
      res.status(err.status || 500);
      // res.render('500', { error: err });
      res.send(err.status + nl + err + nl + err.stack);
      console.log(err);
    });
    
    // 404 is not actually an error, but a last choice use(), after nothing else matched.
    app.use(function(req, res, next){
      res.status(404);
      
      // respond with html page
      if (req.accepts('html')) {
        //res.render('404', { url: req.url });
        res.send('<b>404 Page Not Found!</b>');
        return;
      }

      // default to plain-text. send()
      res.type('txt').send('404 Page Not Found!');
    });
    
    // Trigger errors for testing: //
    app.get('/404', function(req, res, next){
      next();
    });

    app.get('/403', function(req, res, next){
      var err = new Error('403 Not Allowed!');
      err.status = 403;
      next(err);
    });

    app.get('/500', function(req, res, next){
      next(new Error('500 Server Error!'));
    });
  // *** //
// *** //

//*** WORLD OBJECT ***//
  // The world object holds all necessary server-side (off DB memory) data.
  world = {};

  // Set (or empty) the world object properties;
  setWorld = constructor.world;

  setWorld(); // Call the function, for the first time.
// *** //

//*** DATABASE OPEN CONNECTION & SOCKET LISTEN ***//
  var MongoClient = require('mongodb').MongoClient;

  db = {};
  usersdb = {};
  targetsdb = {};
  mapsdb = {};
  worlddb = {};
  
  var dbAddress = 'mongodb://127.0.0.1:27017/nodeworld';  // db name is 'dyi' for production.
  
  // if OPENSHIFT env variables are present, use the available connection info:
  if (process.env.OPENSHIFT_MONGODB_DB_PASSWORD) {
    dbAddress = 'mongodb://' + process.env.OPENSHIFT_MONGODB_DB_USERNAME + ":" +
    process.env.OPENSHIFT_MONGODB_DB_PASSWORD + "@" +
    process.env.OPENSHIFT_MONGODB_DB_HOST + ':' +
    process.env.OPENSHIFT_MONGODB_DB_PORT + '/' +
    process.env.OPENSHIFT_APP_NAME;
  }

  MongoClient.connect(dbAddress, function(err, db) {
    if (err) {
      console.log(err);
    }
    
    // Collections:
    usersdb     =   db.collection('users'),     // Registered players.
    targetsdb   =   db.collection('targets'),   // Objects, NPCs, MOBs, Animals, Items, and the rest.
    mapsdb      =   db.collection('maps');      // Maps in Text clients, and Zones in 2D & 3D clients.
                                                // Including Rooms (Text client) and Areas (2D & 3D clients).
    worlddb     =   db.collection('world');     // World settings and configurations.
    
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
    socket.emit('info', '<b>Server is closed!</b>');
    socket.disconnect();
    console.log('Connection attempt: Server closed!');
  }
  
	// The user object that locally (per socket session) saves the logged-in user data from the DB.
	var user = constructor.user(command.randomName(), socket);    // Get a random name.

  // Track all users in world.users object for general access and listing.
  world.users[user.account.username] = user;
  
  // Welcome the new user.
  user.socket.emit('info', constructor.welcomeMessage(user.player.name));
  
  // Inform everybody about the new user.
  user.socket.broadcast.emit('info', user.player.name +  ' has joined.');
  
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
        user.socket.emit('error', '<i>Command failed!</i><br /><pre>' + err + '</pre><br />');
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
    command.handleCommands(',chat ' + message, user);
  });
  
  // When a client socket disconnects.
  socket.on('disconnect', function () {
    var strCoord = command.strPos(user.player.room);
    
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
    io.sockets.emit('info', command.fullNameID(user) + ' has left.');
    
    delete world.users[user.account.username]; // Clean up the user reference from world object.
  });
});

// Requests a check to save world changes to the DB, by intervals.
worldSaver = setInterval(command.saveWorld, 1000 * 10); // Milliseconds, so 1000 * 60 = 60 seconds.