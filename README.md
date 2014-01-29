*I do apologize for using the name Server, but I did not feel like changing my MongoDB setup.

////////////////////////////////////////////

NPC = Non-Player Character (A bot.)
MOB = Monster (Usually combat NPC.)

Text Client = MUD

TARGET    - An world creation. An object, like a chair, or a living object, like a cow.
WORLD     - The actual server-side world Object(), that holds relevant world data in ready-access mode.
DB        - The MongoDB that holds all the world data, as storage, for access by the WORLD.

USER      - Lowest access client. Unregistered in the world, and has no saved data.
PLAYER    - A registered USER. Saved data.
MASTER    - A PLAYER with access to modify certain world aspects, such as TARGET details.
BUILDER   - A MASTER with access to create and destroy world TARGETS.
GOD       - A developer with full access rights, with abilities that are game-unrelated, such as reloading code modules.

////////////////////////////////////////////

This Node World framework is a virtual game world server that takes upon itself two important tasks:

1.  The server can provide access to clients of all types: Text, 2D, & 3D. It handles the logic between them,
    so that each is represented properly, in front of the others.

2.  The server is modular in its' structure, so that modifying the world, becomes a modular action. For example,
    an admin can add TARGETS (objects, NPCs, MOBs) to the world, but can also modify them live,
    and even toggle their AI functionality, without touching code.

Its' general purpose is to redefine the framework of our virtual game worlds, so that we don't get grindy,
repetetive, story-less, intricate-less, non-modifiable game worlds. Previous games have grown from single-player
games, which were very limited. Modern games must redefine their structure, in order to accomodate
the needs of a virtual game world full of live (meat) players.

And because numerically ordered phrases speak better than thousands of lines of code,
here are more examples of the purpose of this project.

I.    While PLAYER functionality is simplistic (same logic as meat world),
      the modular AI lets users interact with other users, through NPC's.
      For example, a PLAYER can send another PLAYER on a quest, and guaranteeing the reward,
      by using an NPC as an intermediary.

II.   The server comes with a default text client, and hopefully a default 2D client, as well,
      as part of the demonstration. The text client takes from modern MUDs, only being modular
      and presented as a web-page, using Express. This makes it extremely flexible and powerful.
      NOTE: Clients only send socket 'messages', and receive finalized data. All verifications and
      logic are kept within the server.

III.  The WORLD uses efficiency logic, to balance out DB requests, so that they are never too many,
      but also never too big, and to balance memory usage. For example, the WORLD is split into MAPS,
      which are split into ROOMS, and MAPS (with their ROOMS) only get requested, when any USER needs them.

IV.   The NodeJS code is split in such a way that allows a full perspective on the entire project,
      together with a reloading of the code, live, from the client, using GOD permissions and the
      command 'reloadcommands'. This is a developer only command. Another one is 'resetworld',
      which kicks all clients, empties the WORLD, empties the DB, and reloads the WORLD.

V.    While the server is meant to be flexible, it is not meant to be "wild." It is aimed for automacy
      and functionality; not for "everything is possible." The requirements are specific, and
      each is defined as its' own 'system.' Each such system is loaded as a module. For example,
      the combat system is (will be) a separate module.

VI.   For the sake of developers, for now all command requests by clients - which enter the command
      JS functions, are encapsulated in a domain, with its' own exception catcher. This works together
      with the 'reloadcommands' command.

