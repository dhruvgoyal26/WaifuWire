let socket = null;
let isConnected = false;
let myUserId = null;
const SERVER_URL = 'wss://waifuwire-server.onrender.com';

// Generate a random 6-character alphanumeric ID
function generateUserId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = 'WF-';
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Initialization
async function initialize() {
  const result = await chrome.storage.local.get(['userId']);
  if (result.userId) {
    myUserId = result.userId;
  } else {
    myUserId = generateUserId();
    await chrome.storage.local.set({ userId: myUserId });
  }
  connectWebSocket();
}

// WebSocket Setup
function connectWebSocket() {
  console.log('Attempting to connect to WebSocket server...');
  socket = new WebSocket(SERVER_URL);

  socket.onopen = () => {
    console.log('Connected to WebSocket server');
    isConnected = true;
    
    // Register with the server
    socket.send(JSON.stringify({
      type: 'REGISTER',
      userId: myUserId
    }));
    
    broadcastStatus();
  };

  socket.onmessage = async (event) => {
    try {
      const data = JSON.parse(event.data);
      
      if (data.type === 'PING') {
        socket.send(JSON.stringify({ type: 'PONG' }));
        return;
      }
      
      if (data.type === 'INCOMING_GROUP_MSG') {
        broadcastToTabs({
          type: 'INCOMING_MSG',
          channel: 'group',
          senderId: data.payload.senderId,
          senderName: data.payload.senderName,
          text: data.payload.text,
          isMe: data.payload.senderId === myUserId
        });
      }
      
      else if (data.type === 'USER_OFFLINE') {
        const payload = data.payload;
        // Don't show popup if we were just trying to fetch their profile
        if (payload.action === 'GET_PROFILE' || payload.action === 'PROFILE_RESPONSE') {
          return;
        }
        
        broadcastToTabs({
          type: 'INCOMING_MSG',
          channel: 'system',
          senderName: 'WaifuWire',
          text: `User ${payload.targetId} is currently offline and did not receive your message.`,
          isMe: false
        });
      }
      
      else if (data.type === 'INCOMING_DIRECT_MSG') {
        const payload = data.payload;
        
        if (payload.action === 'GET_PROFILE') {
           chrome.storage.local.get(['displayName'], (res) => {
             const name = res.displayName || "Anonymous";
             socket.send(JSON.stringify({
               type: 'DIRECT_MSG',
               targetId: payload.requesterId,
               payload: {
                 action: 'PROFILE_RESPONSE',
                 id: myUserId,
                 name: name
               }
             }));
           });
           return;
        }
        
        if (payload.action === 'PROFILE_RESPONSE') {
           chrome.storage.local.get(['contacts'], (res) => {
             let contacts = res.contacts || [];
             contacts = contacts.filter(c => (typeof c === 'string' ? c !== payload.id : c.id !== payload.id));
             contacts.push({ id: payload.id, name: payload.name });
             chrome.storage.local.set({ contacts: contacts }, () => {
                broadcastToTabs({ type: 'CONTACTS_UPDATED' });
             });
           });
           return;
        }

        const { senderId, senderName, text } = payload;
        
        // Auto-update contact when receiving a message
        chrome.storage.local.get(['contacts'], (res) => {
          let contacts = res.contacts || [];
          contacts = contacts.filter(c => (typeof c === 'string' ? c !== senderId : c.id !== senderId));
          contacts.push({ id: senderId, name: senderName || "Anonymous" });
          chrome.storage.local.set({ contacts: contacts }, () => {
             broadcastToTabs({ type: 'CONTACTS_UPDATED' });
          });
        });
        
        broadcastToTabs({
          type: 'INCOMING_MSG',
          channel: 'dm',
          senderId: senderId,
          senderName: senderName,
          text: text,
          isMe: senderId === myUserId
        });
      }
    } catch (err) {
      console.error('Error parsing message:', err);
    }
  };

  socket.onclose = () => {
    console.log('Disconnected from WebSocket server');
    isConnected = false;
    broadcastStatus();
    setTimeout(connectWebSocket, 5000);
  };

  socket.onerror = (error) => {
    console.error('WebSocket Error:', error);
  };
}

// Send a message to all open tabs so the UI updates everywhere
function broadcastToTabs(msg) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    });
  });
}

function broadcastStatus() {
  broadcastToTabs({
    type: 'STATUS_UPDATE',
    connected: isConnected
  });
}

initialize();

// Listen for messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_STATUS') {
    sendResponse({ connected: isConnected, userId: myUserId });
    return true;
  }
  
  if (message.type === 'SEND_GROUP_MSG') {
    if (isConnected && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'GROUP_MSG',
        payload: {
          senderId: myUserId,
          senderName: message.senderName,
          text: message.text
        }
      }));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }
  
  if (message.type === 'SEND_DIRECT_MSG_POPUP') {
    if (isConnected && socket.readyState === WebSocket.OPEN) {
      const { targetId, text, senderName } = message;
      
      socket.send(JSON.stringify({
        type: 'DIRECT_MSG',
        targetId: targetId,
        payload: {
          senderId: myUserId,
          senderName: senderName,
          text: text
        }
      }));
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true; 
  }
  
  if (message.type === 'ADD_CONTACT') {
    const targetId = message.targetId;
    
    // Save as unknown first
    chrome.storage.local.get(['contacts'], (res) => {
      let contacts = res.contacts || [];
      contacts = contacts.filter(c => (typeof c === 'string' ? c !== targetId : c.id !== targetId));
      contacts.push({ id: targetId, name: 'Unknown User' });
      chrome.storage.local.set({ contacts: contacts }, () => {
        broadcastToTabs({ type: 'CONTACTS_UPDATED' });
      });
    });

    if (isConnected && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'DIRECT_MSG',
        targetId: targetId,
        payload: {
          action: 'GET_PROFILE',
          requesterId: myUserId
        }
      }));
    }
    return true;
  }
});
