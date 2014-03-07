/* DEFINITIONS */

var socket = null;          // Global socket object - makes connection.

var viewMode = 1;           // Number of outputs in view.

var inputBoxPlaceholder = 'Enter message here...';

var cmdMode = false;        // Automatic adding of cmdChar to user messages.
var cmdModeChar = 190;      // Key-code to toggle cmdMode. Default to '.'
                            // http://www.cambiaresearch.com/articles/15/javascript-char-codes-key-codes
var cmdModePlaceholder = 'Enter command here...';

var cmdChar = '.';          // Marks a user message as a command, for the server.

var title = 'Node World';
var welcomeMessage = '<span class=\"b u\" style=\"font-size: 150%\">Client-Only Commands:</span><br />' + 

        '<span class=\"command\">' + cmdChar + 'color</span> (COLORNAME)<br />' + 
        '<span class=\"command\">' + cmdChar + 'bgcolor</span> (COLORNAME)<br />' + 
        
        '() = Optional. Send without arguments, to restore default values.<br />' + 
        
        'These and your <span class=\"command\">' + 
        cmdChar + 'login</span> are saved in a <b>cookie</b>, ' + 
        'and loaded automatically.<br /><br />' + 
        
        'Please, <span class=\"command\">' + cmdChar + 'rename</span> into a unique alias, ' + 
        'and <span class=\"command\">' + cmdChar + 'register</span> your name,' + 
        ' to get world-building access!<br /><br />' + 
        
        'Use <span class=\"b\">Space</span> or ' + 
        '<span class=\"b\">Enter</span> to focus on the input box, ' + 
        '<span class=\"b\">Escape</span> to lose focus, ' + 
        'and <span class=\"i\">again</span> to clear it.<br /><br />' + 
        
        'The client formats text according to this markup: ' + 
        '*<span class=\"b\">bold</span>* ' + 
        '_<span class=\"i\">italic</span>_ ' + 
        '-<span class=\"s\">linethrough</span>-';

var cookies = {};     // Holds cookies' names and values.

var availableCommands = [];     // Holds all commands available to the user.

var extraMargin = 6;    // Extra pixels, when resizing main elements.

// Direct messages to outputs.
var outputs = {
  'errors':           2,
  'disconnect':       2,
  'message':          1,
  'emote':            1,
  'tell':             1,
  'say':              1,
  'warning':          1,
  'info':             1,
  'events':           3,
  'welcomeMessage':   2,
  'clientCommands':   2
};

// Client-side-only commands, which do not get sent to server.
var clientCommands = {
  'color': function (argArray) {
    // Restore default color, if no argument.
    var color = 'black';
    // Otherwise, set new color.
    if (argArray[0]) color = argArray[0];
    
    $('body').css('color', color);
    $('#inputBox').css('color', color);
    
    saveCookie('textcolor', color);
    
    // Inform user of change.
    var output = {
      'message': 'Text color changed to <b>' + color + '</b>.',
      'color': 'darkgreen'
    };
    
    appendOutput(output, outputs.clientCommands);
  },
  
  'bgcolor': function (argArray) {
    // Restore default color, if no argument.
    var color = 'white';
    // Otherwise, set new color.
    if (argArray[0]) color = argArray[0];
    
    $('body').css('background-color', color);
    $('#inputBox').css('background-color', color);
    
    saveCookie('bgcolor', color);
    
    // Inform user of change.
    var output = {
      'message': 'Background color changed to <b>' + color + '</b>.',
      'color': 'darkgreen'
    };
    
    appendOutput(output, outputs.clientCommands);
  },
  
  'login': function (argArray) {
    // Save the login data into cookie.
    saveCookie('login', argArray.join(' '));
  }
};

var sentCommands = [""]; // First command is an empty line.
var curCommandIndex = 0; // Initialize.

// Timer for when new message arrives, and window not in focus.
alertTimer = null;
var alertRunning = false;

// Start status timer for inputBox placeholder.
var statusTimerSpeed = 500;
statusTimer = setInterval(statusCheck, statusTimerSpeed);
var statusTimerRunning = true;

/* FUNCTIONS */

function statusCheck() {
  if (socket && socket.socket && socket.socket.connected) {
    clearInterval(statusTimer);
    statusTimerRunning = false;
  }
  
  // Reconnecting to server.
  if (socket && socket.socket && socket.socket.reconnecting) {
    $('#inputBox').prop('placeholder', 'Reconnecting to server...');
    return;
  }
  
  // Connecting to server.
  if (socket && socket.socket && socket.socket.connecting) {
    $('#inputBox').prop('placeholder', 'Connecting to server...');
    return;
  }
}

// Timer for when new message arrives, and window not in focus.
function titleAlert(message) {
  if (document.title == title) {
    // Custom message as alert.
    document.title = message;
  } else {
    document.title = title;       // Restore default title.
  }
}

// Toggles the inputBox cmdMode.
function toggleCmdMode() {
  cmdMode = !cmdMode;
  
  var textColor   = $('#inputBox').css('color');
  var bgColor     = $('#inputBox').css('background-color');
  // Switch colors.
  $('#inputBox').css('color', bgColor);
  $('#inputBox').css('background-color', textColor);
  
  var placeholder = $('#inputBox').prop('placeholder');
  
  $('#inputBox').prop('placeholder', 
        (placeholder == inputBoxPlaceholder ? cmdModePlaceholder : inputBoxPlaceholder));
}

// Using Up or Down arrow keys with input textbox to scroll through command history.
function inputEvents(e) {
  // COMMAND HISTORY //
  if (e.which == 38) { // Up Key - Go back in history.
    e.preventDefault(); // Don't let the cursor jump around.

    if (curCommandIndex > 0) {
      $('#inputBox').val(sentCommands[curCommandIndex-1]);
      curCommandIndex -= 1;
    }
  }
  if (e.which == 40) { // Down Key - Go forward in history.
    e.preventDefault(); // Don't let the cursor jump around.

    if (curCommandIndex < sentCommands.length) {
      $('#inputBox').val(sentCommands[curCommandIndex+1] || ""); // Last press clears the textbox.
      curCommandIndex += 1;
    }
  }
  
  // COMMAND MODE TOGGLE //
  if (e.which == cmdModeChar) {
    // Repeating cmdChar becomes a normal message, and not a command.
    if ($('#inputBox').val() === '' && cmdMode === true) {
      $('#inputBox').val('..');
      toggleCmdMode();
      return;
    }
    
    // Only for empty inputBox.
    if ($('#inputBox').val() !== '') return;
    
    e.preventDefault(); // Don't add character to inputBox.
    
    toggleCmdMode();
  }
}

// Logs command history.
function logInput(inputText) {
  sentCommands[sentCommands.length] = inputText; // Memorize commands into array.
  curCommandIndex = sentCommands.length; // Store the latest command index position for history scroll.
}

// Save name=value pair to cookie.
function saveCookie(name, value) {
  // var path = '/';           // Default to same domain and folder.
  
  var expires = new Date();
  // Days, Hours, Minutes, Seconds, Milliseconds. Default is 30 days.
  expires.setTime(expires.getTime() + (30 * 24 * 60 * 60 * 1000));
  
  document.cookie = name      + '='  + value + ';' + 
                 //'path'     + '='  + path  + ';' + 
                   'expires'  + '='  + expires.toUTCString() + ';';
}

// Switch view modes.
// Usage: viewModes[viewMode]() or viewModes['1']()
var viewModes = {
  '1': function () {
    $('#viewChanger').text('Multiple Views');
    
    viewMode = 1;
    
    var time = 1000;
    
    $('#output2').hide(time);
    $('#output3').hide(time);
    $('#output4').hide(time);
    
    $('#output1').animate({
      width: '100%',
      height: '100%'
    }, time);
    
    // Show messages from other views.
    $('.restoredMessage').css('display', 'inline').animate({
      'opacity': 1
    }, time/2, function() {
      // Make sure it ends as it should.
      $(this).css('display', 'inline').css('opacity', 1);
    });
    
    scrollDown($('#output1'), time);
    
    saveCookie('viewMode', viewMode);
  },
  
  '4': function () {
    $('#viewChanger').text('Single View');
    
    viewMode = 4;
    
    var time = 1000;
    
    $('#output1').css('top', '0px');
    $('#output1').css('left', '0px');
    
    $('#output2').css('width', '50%');
    $('#output2').css('height', '50%');
    $('#output2').css('left', '50%');
    $('#output2').css('top', '0px');
    $('#output2').show(time);
    
    $('#output3').css('width', '50%');
    $('#output3').css('height', '50%');
    $('#output3').css('left', '0px');
    $('#output3').css('top', '50%');
    $('#output3').show(time);
    
    $('#output4').css('width', '50%');
    $('#output4').css('height', '50%');
    $('#output4').css('top', '50%');
    $('#output4').css('left', '50%');
    $('#output4').show(time);
    
    $('#output1').animate({
      width: '50%',
      height: '50%'
    }, time / 2);
    
    // Hide messages from other views, in output1.
    $('.restoredMessage').animate({
      'opacity': 0
    }, time/2, function () {
      // Make sure it ends as it should.
      $(this).css('display', 'none').css('opacity', 0);
    });
    
    scrollDown($('#output1'), time);
    scrollDown($('#output2'), time);
    scrollDown($('#output3'), time);
    scrollDown($('#output4'), time);
    
    saveCookie('viewMode', viewMode);
  }
};

// Toggles between available viewing modes.
function toggleView() {
  if (viewMode == 1) {
    viewModes['4']();
  } else {
    // viewMode == 4
    viewModes['1']();
  }
}

// User did something, like clicking on something.
function userEvent(element) {
  if ($(element).hasClass('player')) {
    sendCommand(cmdChar + 'examine ' + $(element).text());
    return;
  }
  
  if ($(element).hasClass('target')) {
    sendCommand(cmdChar + 'look ' + $(element).text());
    return;
  }
  
  if ($(element).hasClass('command')) {
    var cmdText = $(element).text();
    
    // Verify command begins with cmdChar.
    if (cmdText.charAt(0) != cmdChar) cmdText = cmdChar + cmdText;
    
    sendCommand(cmdText);
    return;
    
    /*  JUST DISPLAY, INSTEAD OF SEND.
    // Remember current input text, for scrollback.
    logInput($('#inputBox').val());
    
    // Replace input text with relevant command.
    $('#inputBox').val(cmdText);
    */
  }
}

// Backs-up and clears inputBox, to send a command, and restore previous text.
function sendCommand(command) {
  // Backup and clear inputBox.
  var curInput = $('#inputBox').val();
  $('#inputBox').val('');
  
  // Add to inputBox.
  $('#inputBox').val(command);
  
  // Send.
  $('#inputForm').submit();
  
  // Restore previous inputBox value.
  $('#inputBox').val(curInput);
}

// Find and convert URLs to links, and try to display images.
// Mixes JS with Regex for readability of Regex.
function parseURL(message) {
  // This function has been tested with an image and the following example:
  /* var message = 'Lets see...<br />' + 
    'yo. yo.boo yo.boo.hey yoo/moo yo.me/ yo.me/moo <br /> ' + 
    'http :://::// http://wow https://.. ftp:/hey ftp://hey-hey <br /> ' + 
    'http://42t3.g43.g43 http://... http://g43..g43 <br /> ' + 
    'ha@ ha@ha hey@yo. @.@... la@@.la mailmeat:as@bo.com <br /> ' + 
    'www www.. www. www.www.www.w wrw.www.hey wutwwwlol';
  */
  
  // e.g. word://anything.word
  var prefix = /\w+[:][/][/]\S+[.]\w+/igm;
  // e.g. anything.anything/ or www.anything.anything or anything.com or anything.co.anything
  var shortUrl = /\w+[.]\w+[/]|www[.]\w+[.]\w+|\w+[.]com|\w+[.]co[.]\w+|\w+[.]net|\w+[.]org/igm;
  // e.g. anything@word.word
  var email = /\S+@\w+[.]\w+/igm;
  
  // e.g. anything.jpg
  var image = /\S+[.](jpg|jpeg|bmp|gif|png|apng|svg|ico)/igm;
  
  var strArray = message.split(' ');      // Split into words.
  
  // Check each word.
  for (var i=0; i < strArray.length; i++) {
    var curWord = strArray[i];
    var matchedProtocol = false;
    
    if (curWord.search(image) >= 0) {
      strArray[i] = '<img style=\"min-width: 20px; min-height: 20px; max-width: 100px; ' + 
              'max-height: 100px;\"' + ' src=\"' + curWord + '\" alt=\"' + curWord + '\">';
      
      // Either URL or shortUrl - make image a link to itself.
      if (curWord.search(prefix) >= 0) {
        strArray[i] = '<a href=\"' + curWord + '\" target=\"_blank\">' + strArray[i] + '</a>';
      } else if (curWord.search(shortUrl) >= 0) {
        strArray[i] = '<a href=\"http://' + curWord + '\" target=\"_blank\">' + strArray[i] + '</a>';
      }
      
      continue;
    }
    
    if (curWord.search(prefix) >= 0) {
      strArray[i] = '<a href=\"' + curWord + '\" target=\"_blank\">' + curWord + '</a>';
      continue;
    }
    
    if (curWord.search(shortUrl) >= 0) {
      strArray[i] = '<a href=\"http://' + curWord + '\" target=\"_blank\">' + curWord + '</a>';
      continue;
    }
    
    if (curWord.search(email) >= 0) {
      strArray[i] = '<a href=\"mailto:' + curWord + '\">' + curWord + '</a>';
      continue;
    }
  }
  
  var result = strArray.join(' ');
  
  return result;
}

// Replace words surrounded by client's markup with HTML tags.
// * = bold. _ = italic. - = linethrough.
function parseText(message) {
  var parsedMessage = message;
  
  var strArray = parsedMessage.split(' ');      // Split into words.
  
  // Check each word.
  for (var i=0; i < strArray.length; i++) {
    var curWord = strArray[i];
    
    var firstChar = curWord.charAt(0);
    var secondChar = curWord.charAt(1);
    var beforelastChar = curWord.charAt(curWord.length-1);
    var lastChar = curWord.charAt(curWord.length-2);
    
    // Bold & Italic, very flexible in markup style.
    if ((firstChar == '*'      || firstChar == '_')      &&
        (secondChar == '*'     || secondChar == '_')     &&
        (beforelastChar == '*' || beforelastChar == '_') &&
        (lastChar == '*'       || lastChar == '_')       ) {
      strArray[i] = '<span class=\"b i\">' + curWord.slice(2, -2) + '</span>';
      continue;
    }
    
    // Bold.
    if (curWord.charAt(0) == '*' && curWord.charAt(curWord.length-1) == '*' && 
        curWord.charAt(1) != '*' && curWord.charAt(curWord.length-2) != '*') {
      strArray[i] = '<span class=\"b\">' + curWord.slice(1, -1) + '</span>';
      continue;
    }
    
    // Italic.
    if (curWord.charAt(0) == '_' && curWord.charAt(curWord.length-1) == '_' && 
        curWord.charAt(1) != '_' && curWord.charAt(curWord.length-2) != '_') {
      strArray[i] = '<span class=\"i\">' + curWord.slice(1, -1) + '</span>';
      continue;
    }
    
    // Strikethrough.
    if (curWord.charAt(0) == '-' && curWord.charAt(curWord.length-1) == '-' && 
        curWord.charAt(1) != '-' && curWord.charAt(curWord.length-2) != '-') {
      strArray[i] = '<span class=\"s\">' + curWord.slice(1, -1) + '</span>';
      continue;
    }
  }
  
  parsedMessage = strArray.join(' ');
      
  return parsedMessage;
}

// Underlines objects, and classes them as either 'player' or 'target'.
function parseObjects(message) {
  var player = /\[{1}(\w+)\]{1}/igm;
  var target = /\[{1}(\d+[.]\d+)\]{1}/igm;
  
  var parsedMessage = message.replace(player, 
                      '[<span class=\"player\">$1</span>]');
      parsedMessage = parsedMessage.replace(target, 
                      '[<span class=\"target\">$1</span>]');
  
  return parsedMessage;
}

// Make only available commands clickable.
function parseCommands(message) {
  var messageArray = message.split(' ');
  
  for (var i=0; i < messageArray.length; i++) {
    var curWord = messageArray[i];
    // Word matches an availble command.
    if (availableCommands.indexOf(curWord) >= 0) {
      messageArray[i] = '<span class=\"command\">' + curWord + '</span>';
    }
  }
  
  var parsedMessage = messageArray.join(' ');
  
  return parsedMessage;
}

// Element is jQuery object. Delay is optional, for animation.
function scrollDown(element, delay) {
  // Delay must be numeric.
  if (isNaN(delay)) var delay = null;
  
  if (delay) {
    // Animate.
    element.animate({
      'scrollTop': element[0].scrollHeight
    }, delay);
  } else {
    // Immediate.
    element.scrollTop(element[0].scrollHeight);
  }
}

// Add Timestamp to messages. Parse message.
// Scroll down, if not scrolled-up somewhat (avoid badgering user.)
// Append text to output-number or default to output1.
function appendOutput(output, number) {
  if (!number) var number = 1;
  
  var outputObj = $('#output' + number);
  
  var curDate = new Date();
  // Make sure the format is HH:MM:SS.
  var curTime = ( curDate.getHours() < 10 ? '0' + curDate.getHours() : curDate.getHours() ) + ':' + 
      ( curDate.getMinutes() < 10 ? '0' + curDate.getMinutes() : curDate.getMinutes() );
      //  + ':' + ( curDate.getSeconds() < 10 ? '0' + curDate.getSeconds() : curDate.getSeconds() );
  
  var parsedMessage = '';
  
  if (!output.message) {
    parsedMessage = (typeof output === 'string' ? output : JSON.stringify(output));
  } else {
    // Parse message.
    parsedMessage = parseURL(
                      parseCommands(
                        parseObjects(
                          parseText(output.message) ) ) );
  }
  
  // Equals 0, if fully scrolled down, or bigger otherwise.
  var scrolledDownOutput1 = $('#output1')[0].scrollHeight - 
                            $('#output1').scrollTop() - 
                            $('#output1').height();
  
  // Equals 0, if fully scrolled down, or bigger otherwise.
  var scrolledDown =  outputObj[0].scrollHeight - 
                      outputObj.scrollTop() - 
                      outputObj.height();
  
  // Add the message to output1, as a restoredMessage class.
  // It is displayed, only if output1 is the only shown view.
  if (number != 1) {
    // NOTE: Can't change stylesheet rules, so need this for new elements.
    var hide = 'style=\"display: none;\"';
    
    $('#output1').append('<span class=\"restoredMessage\" ' + (viewMode != 1 ? hide : '') + '>' + 
                    '<b>&lt;' + curTime + '&gt;</b> ' + '<span style=\"' +
                    (output.color  ? 'color: '       + output.color     + ';' : '') +
                    (output.font   ? 'font-family: ' + output.font      + ';' : '') +
                    (output.size   ? 'font-size: '   + output.size      + ';' : '') +
                    '\" class=\"' + 
                      (output.i ? 'i ' : '') + 
                      (output.b ? 'b ' : '') + 
                    '\">' + 
                    parsedMessage + '</span><br /></span>');
    
    // Avoid badgering user, if already scrolled up somewhat.
    if (scrolledDownOutput1 <= 50) scrollDown($('#output1'), 1000);
  }

  // Add the text (parsing HTML) with styling arguments.
  outputObj.append('<b>&lt;' + curTime + '&gt;</b> ' + 
                  '<span style=\"' + 
                  (output.color  ? 'color: '       + output.color     + ';' : '') +
                  (output.font   ? 'font-family: ' + output.font      + ';' : '') +
                  (output.size   ? 'font-size: '   + output.size      + ';' : '') +
                  '\" class=\"' + 
                    (output.i ? 'i ' : '') + 
                    (output.b ? 'b ' : '') + 
                  '\">' + 
                  parsedMessage + '</span><br />');
  
  // Avoid badgering user, if already scrolled up somewhat.
  if (scrolledDown <= 50) scrollDown(outputObj, 1000);
  
  // Activate title alert.
  if (!alertRunning && !document.hasFocus()) {
    alertRunning = true;
    
    // Clean most HTML tags from message.
    var cleanMessage = output.message || output;
    cleanMessage = cleanMessage.replace(/<\w+>/gi, '').replace(/<span.*>(.*)<\/span>/gi, '$1');
    cleanMessage = cleanMessage.slice(0, 40);
    
    // Blink title text & message, if unfocused.
    alertTimer = setInterval(titleAlert, 1000, cleanMessage);
  }
}

/* DOCUMENT READY */

// Setup client event listeners. //
$(document).ready(function() {
  document.title = title;
  
  // Welcome user, and inform of client usage.
  appendOutput('<span style=\"color: green;\">' + welcomeMessage + '</span><br />', outputs.welcomeMessage);
  
  // Send user input to server by Socket.
  $('#inputForm').on('submit', function(e) {
      e.preventDefault(); // Stop regular form submission.
      
      var inputText = $('#inputBox').val().trim();
      
      var inputArray = inputText.split(' '); // Split to words,
      
      var first = inputArray[0];             // First word might be a command.
      
      var argsArray = inputArray.splice(0, 1);   // Remove first (command) word.
      
      var isCommand = false;
      if (first.charAt(0) == cmdChar) {
        isCommand = true;
        first = first.slice(1);   // Remove cmdChar from first word.
      }
      
      if (clientCommands[first]) {
        // Client only command.
        clientCommands[first](argsArray);
        
      } else if (socket && socket.socket && socket.socket.connected) {
        if (cmdMode) {
          // All input is recognized as command.
          if (isCommand) inputText = inputText.slice(1); // Remove accidental cmdChar in cmdMode.
          socket.emit('message', cmdChar + inputText);
        } else if (isCommand) {
          // Send as command message.
          socket.emit('message', inputText);
        } else {
          // Default to chat message.
          socket.emit('message', cmdChar + 'chat ' + inputText);
        }
        
      } else {
        // Inform user of disconnection, by blinking inputBox.
        $('#inputBox').animate({
            'opacity': 0
        }, 300, function () {
            $('#inputBox').animate({
                'opacity': 1
            }, 100);
        });
      }
      
      // Remember input text history, for scrollback.
      logInput(inputText);
      
      $('#inputBox').val(''); // Empty input.
  });
  
  // Cleanup title stuff.
  $(window).focus(function() {
    if (alertRunning) {
      clearInterval(alertTimer);
      alertRunning = false;
      
      document.title = title;
    }
  });
  
  $('#outputs > div').on('DOMMouseScroll mousewheel', function () {
    $(this).stop();
  });
  
  // Attach event to clickable elements.
  // Delegated, so it applies to new elements.
  $('#outputs > div').on('click', '.player, .target, .command', function() {
    userEvent(this);
  });
  
  // Replace any unloaded images, in output, with their alt text.
  $('#outputs > div').on('error', 'img', function() {
    $(this).replaceWith($(this).prop('alt'));
  });
  
  // Show only first output view, by default.
  $('#outputs > div').hide();
  $('#outputs > #output1').show();
  
  // Resize elements.
  $('#outputs').css('height', $('#content').height() - $('#menu').height() - 
                                            $('#input').height() - extraMargin + 'px');
  
  $('#inputBox').css('width', $('#content').width() - $('#sendButton').outerWidth(true) - 
                    ($('#inputBox').outerWidth(true) - $('#inputBox').width()) - extraMargin + 'px');
  
  // Scroll outputs on window resize.
  $(window).resize(function() {
    // Resize elements.
    $('#outputs').css('height', $('#content').height() - $('#menu').height() - 
                                              $('#input').height() - extraMargin + 'px');
    
    $('#inputBox').css('width', $('#content').width() - $('#sendButton').outerWidth(true) - 
                      ($('#inputBox').outerWidth(true) - $('#inputBox').width()) - extraMargin + 'px');
    
    // Scroll down views.
    $('#outputs > div').each(function (index) {
      scrollDown($(this), 200);
    });
  });

  // Set focus to inputBox.
  $(window).focus(function() {
    if (document.activeElement && document.activeElement.id != 'inputBox') {
      $('#inputBox').focus();
    }
  });

  // Space or Enter to focus(), and Escape to blur(), and again to empty inputBox.
  $(document).keydown(function(e) {
    // Space or Enter to focus(), or Escape to empty.
    if (document.activeElement && document.activeElement.id != 'inputBox') {
      if ( e.keyCode == 32 || e.keyCode == 13 ) {
         e.preventDefault();
         $('#inputBox').focus();
         return;
      }
      
      // Or Escape to empty input, when without focus.
      if ( e.keyCode == 27 ) {
         e.preventDefault();
         $('#inputBox').val(''); // Empty input.
         return;
      }
    }
    
    // Escape to blur().
    if (document.activeElement && document.activeElement.id == 'inputBox') {
      if ( e.keyCode == 27 ) {
         e.preventDefault();
         $('#inputBox').blur();
         return;
      }
    }
  });
  
  $('#inputBox').on('keydown', function (e) {
     inputEvents(e);
  });
  
  $('#viewChanger').on('click', toggleView);
  
  // Client-Side Only Cookie Data.
  if (document.cookie) {
    var cookie = document.cookie.split(';'); // NOTE: cookies{} is the global that holds final data.
    
    for (var i=0; i < cookie.length; i++) {
      var curElement = cookie[i];
      
      var curName = curElement.slice(0, curElement.indexOf('=')).trim();
      var curValue = curElement.slice(curElement.indexOf('=')+1);
      
      cookies[curName] = curValue;
    }
    
    // Text color.
    var color = (cookies.color !== undefined ? cookies.color : '');
    if (color !== '') {
      $('body').css('color', color);
    }
    
    // Background color.
    var bgColor = (cookies.bgcolor !== undefined ? cookies.bgcolor : '');
    if (bgColor !== '') {
      $('body').css('background-color', bgColor);
    }
    
    // Number of views.
    var viewModeCookie = (cookies.viewMode !== undefined ? cookies.viewMode : '');
    if (viewModeCookie !== '') {
      // Toggle, only if different. NOTE: Works only while 2 options available.
      if (viewModeCookie != viewMode) viewModes[viewModeCookie]();
    }
  }
  
  // Start socket connection and handling.
  loadSocket();
});

// Setup & connect to server, and setup event listeners. //
function loadSocket() {
  // Connect to socket server.
  socket = io.connect('http://diy-phuein.rhcloud.com/', {
    'sync disconnect on unload' : true,           // Send 'disconnect' to server when browser 'beforeunload'.
    'auto connect'              : true,           // Automatically establish connection on 'io.connect()'.
    'reconnect'                 : true,
    'reconnection limit'        : 30000,          // Maximum ms to wait between reconnection attempts.
    'reconnection delay'        : 5000,           // Multiplier to add for reconnection attempts.
    'max reconnection attempts' : 30,             // After this emit 'reconnect_failed' event.
    'connect timeout'           : 10000           // Wait this long in ms to abord connection attempt.
  });
  
  // Socket connected.
  socket.on('connect', function () {
    var placeholder = $('#inputBox').prop('placeholder');
    $('#inputBox').prop('placeholder', 
          (placeholder == inputBoxPlaceholder ? cmdModePlaceholder : inputBoxPlaceholder));
    
    $('#inputBox').focus();
    
    // Attempt to send login command from saved cookie.
    if (cookies.login) {
      var loginData = cookies.login;
      socket.emit('message', cmdChar + 'login ' + loginData);
    }
    
    // Request an array of available commands by user access level.
    socket.emit('message', cmdChar + 'help getAvailableCommandsOnly');
    
    // And statusTimer is stopped at statusCheck().
  });
  
  // Socket Events //
  socket.on('error', function (err) {
    console.log(err);
    
    var output = {
      'message': '<b><u>Socket Error:</u></b><br />' + err + '<br />',
      'color': 'rgb(120, 0, 0)'
    };
    
    appendOutput(output, outputs.errors);
  });
  
  socket.on('disconnect', function () {
    appendOutput('<span class=\"b i\">Lost connection to server!</span>', outputs.disconnect);
    
    if (socket && socket.socket && !socket.socket.reconnecting) {
      $('#inputBox').prop('placeholder', "Not connected to server...");
      $('#inputBox').blur();
    }
    
    if (!statusTimerRunning) {
      statusTimer = setInterval(statusCheck, statusTimerSpeed);
      statusTimerRunning = true;
    }
  });
  
  /* Formatting: Only 'message' is required - the rest is optional.
    {
     'message'  : message, 
     'color'    : colorName,
     'font'     : fontName, 
     'size'     : size, 
     'i'        : boolean,      // Italic
     'b'        : boolean       // Bold
    }
   */
  
  // Chat messages, that everyone can see.
  socket.on('message', function (message) {
    var output = {
      'message': message
    };
    
    appendOutput(output, outputs.message);
  });
  
  // Chat emotes, that everyone can see.
  socket.on('emote', function (message) {
    var output = {
      'message': message,
      'color': 'rgb(0, 130, 130)'
    };
    
    appendOutput(output, outputs.emote);
  });
  
  // Chat messages, that only me and the target can see.
  socket.on('tell', function (message) {
    var output = {
      'message': message,
      'color': 'rgb(0, 120, 120)'
    };
    
    appendOutput(output, outputs.tell);
  });
  
  // Chat messages, that only me and those near me can see.
  socket.on('say', function (message) {
    var output = {
      'message': message,
      'color': 'rgb(0, 60, 60)'
    };
    
    appendOutput(output, outputs.say);
  });
  
  // Warnings for troubleshooting, such as command syntax.
  socket.on('warning', function (message) {
    parsedMessage = parseObjects(message);      // Mark objects.
    
    var output = {
      'message': parsedMessage,
      'color': 'rgb(80, 0, 0)'
    };
    
    appendOutput(output, outputs.warning);
  });
  
  // Notifications about events, such as a player name change.
  socket.on('info', function (message) {
    var output = {
      'message': message,
      'color': 'rgb(0, 60, 0)'
    };
    
    appendOutput(output, outputs.info);
  });
  
  // The server's command character. Used to identify messages as commands.
  socket.on('cmdChar', function (message) {
    cmdChar = message;
  });
  
  // The commands that are currently available to the user, by access level.
  socket.on('availableCommands', function (message) {
    availableCommands = message;    // An array is expected.
  });
  
  // Information about player events, such as look and examine commands.
  socket.on('event', function (message) {
    var output = {
      'message': message
    };
    
    appendOutput(output, outputs.events);
  });
}