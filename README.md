##### * This project is saved using Sublime Text 3, and has the Project and Workspace files for it.

##### * Use a modern text editor with __Code Folding__, for the sake of readability.

##### * A live version, for developers, is available at: http://game.assafkoss.com

# How To Contribute

I am looking for __developers__ with free time and interest in virtual game-worlds.

I am unable to hire, so anyone who joins will gain equal status. The exception is that I am "first among equals", as the creator of Node World.

I am looking for developers who would take interest in working on specific modules. Read below, to get a general perspective on the project, and decide which parts are most interesting for you.

# The Project

## Dictionary

__NPC__ = Non-Player Character (A bot.)<br />
__MOB__ = Monster (Usually combat NPC.)

__Text Client__ = MUD style.

__TARGET__    - A world creation. An object, like a chair, or a living object, like a cow.<br />
__WORLD__     - The actual server-side world Object(), that holds relevant world data in ready-access mode.<br />
__DB__        - The MongoDB that holds all the world data, as storage, for access by the WORLD.<br />

__USER__      - Lowest access client. Unregistered in the world, and has no saved data.<br />
__PLAYER__    - A registered USER. Saved data.<br />
__MASTER__    - A PLAYER with access to modify certain world aspects, such as TARGET details.<br />
__BUILDER__   - A MASTER with access to create and destroy world TARGETS.<br />
__GOD__       - A developer with full access rights, with abilities that are game-unrelated, such as reloading code modules.

## Node World

Node World is a __virtual game-world framework__, with emphasis on the server-side, with two major goals:

__1.__ It supports & provides seamless integration between client types: Text, 2D, and 3D.

__2.__ It utilizes the modular nature of NodeJS, so that world modifications are made in production - live, and each functionality is mostly, if not entirely, independent of functionalities.

The purpose of these goals is two-fold. On one hand, it aims to give new purpose and meaning to online virtual game-worlds, by being more flexible, and thus more robust and unique. On the other hand, it aims to reduce the currently existing repetitiveness and lack of intricate of modern game-worlds.

Following is a short list of examples, showing how this design can manifest itself.

I.
  NPC AI can be toggled and tweaked, live. This lets players use NPCs for purposes that were previously a function of the UI. For example, instead of having a trade window that guarantees the result, or just the word of another player; now, players can use an NPC to arbitrate, and work as a proxy or representative, actually closing the deal.

II.
  The text client, composed of HTML, CSS, and JS (jQuery), takes example from modern MUD clients. However, its' structure means that it can be modified easily. Also, being nothing more than simple web page, any device with a browser can run it, or a similar slightly modified version, with full compatibility. This is in many ways true also of the 2D and 3D clients.

III.
  The world is both simple and efficient. It is composed of MAPS, which are composed of ROOMS. ROOMS are composed of USERS and TARGETS.
  
  Data is saved, loaded, and sent to users, by order of relevance. ROOMS are a measure of immediate proximity. MAPS are a measure of general proximity, as a 'maximum' value for whom should the data be sent.
  
  The world saves & loads data through the DB, without badgering the DB. Saves use a timer and a queue of changes. The entire queue, together, is saved after a delay, as to minimize calls to the DB. Data is loaded from the DB, on a need-to-know basis. In order to minimize the delay between requests (from users) and responses, some data is loaded in sets, such as entire MAPS.

IV.
  The server.js file is a sort of bare-minimum of code, in order to activate and sustain the server. It is able to reload the code, live, without disconnecting. The code reloaded is mostly the commands, their relevant sub-modules, and constructs, such as objects (templates) and messages (pre-set text). In order to avoid regular crashes, every command is loaded under a new Domain, which handles exceptions. The exception to this is the first loading, including the first require() calls. This does, however, include the actual reload-code command.
  
  The reload-code command, and it's sibling the reset-world commmand, which restarts the server and DB, including data, entirely, without having to manually do so, are guarded under special conditions, naturally.

V.
  The server does not allow "everything and anything". Its' purpose is to be flexible, when it comes to much needed functionality, such as manipulating TARGETS, manipulating AI, and manipulating many of the WORLD properties. Flexible, meaning that such changes do not require coding, nor the reloading of the server. This is possible by using modules, with each module allowing supervised access on the creation and modification of its' functions. For example, a combat module will allow combat in the world, and will even allow defining much of how combat works, but will not allow an entire overhaul of the combat system, without changing the code.

For more information or just to chat, you can contact me at:

phuein@gmail.com

SKYPE: Phuein

FACEBOOK: Assaf Koss

And I am also available on IRC, on #Node.js & #node.games on Freenode.net.