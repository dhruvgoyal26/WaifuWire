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

    // Send local groups to server to ensure server is in sync (self-healing)
    chrome.storage.local.get(['groups'], (res) => {
      const localGroups = res.groups || [];
      if (localGroups.length > 0 && socket && socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify({
          type: 'SYNC_GROUPS_TO_SERVER',
          groups: localGroups
        }));
      }
    });
    
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
      
      else if (data.type === 'INCOMING_CUSTOM_GROUP_MSG') {
        const { groupId, groupName, members, payload } = data;
        
        // Auto-save group if we don't have it locally
        chrome.storage.local.get(['groups'], (res) => {
          let groups = res.groups || [];
          const exists = groups.some(g => g.id === groupId);
          if (!exists) {
            groups.push({ id: groupId, name: groupName, members: members });
            chrome.storage.local.set({ groups: groups }, () => {
              broadcastToTabs({ type: 'CONTACTS_UPDATED' });
            });
          } else {
            let updated = false;
            groups = groups.map(g => {
              if (g.id === groupId) {
                g.members = members;
                g.name = groupName;
                updated = true;
              }
              return g;
            });
            if (updated) {
              chrome.storage.local.set({ groups: groups }, () => {
                broadcastToTabs({ type: 'CONTACTS_UPDATED' });
              });
            }
          }
        });

        broadcastToTabs({
          type: 'INCOMING_MSG',
          channel: 'custom_group',
          groupId: groupId,
          groupName: groupName,
          senderId: payload.senderId,
          senderName: payload.senderName,
          text: payload.text,
          isMe: payload.senderId === myUserId
        });
      }
      
      else if (data.type === 'SYNC_GROUPS') {
        const { groups } = data;
        chrome.storage.local.get(['groups'], (res) => {
          let localGroups = res.groups || [];
          let modified = false;

          groups.forEach(serverGrp => {
            const index = localGroups.findIndex(g => g.id === serverGrp.id);
            if (index === -1) {
              localGroups.push(serverGrp);
              modified = true;
            } else {
              const localGrp = localGroups[index];
              const membersChanged = localGrp.members.length !== serverGrp.members.length || 
                                    !localGrp.members.every(m => serverGrp.members.includes(m));
              if (localGrp.name !== serverGrp.name || membersChanged) {
                localGroups[index] = serverGrp;
                modified = true;
              }
            }
          });

          if (modified) {
            chrome.storage.local.set({ groups: localGroups }, () => {
              broadcastToTabs({ type: 'CONTACTS_UPDATED' });
            });
          }
        });
      }
      
      else if (data.type === 'INCOMING_LEAVE_GROUP') {
        const { groupId, leavingUserId } = data;
        chrome.storage.local.get(['groups'], (res) => {
          let groups = res.groups || [];
          groups = groups.map(g => {
            if (g.id === groupId) {
              g.members = g.members.filter(m => m !== leavingUserId);
            }
            return g;
          });
          chrome.storage.local.set({ groups: groups }, () => {
            broadcastToTabs({ type: 'CONTACTS_UPDATED' });
          });
        });

        broadcastToTabs({
          type: 'INCOMING_MSG',
          channel: 'custom_group',
          groupId: groupId,
          groupName: 'System Notice',
          senderId: 'system',
          senderName: 'WaifuWire',
          text: `A member (${leavingUserId}) has left the group.`,
          isMe: false
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

// Send a message to all open tabs and internal extension contexts so the UI updates everywhere
function broadcastToTabs(msg) {
  chrome.tabs.query({}, (tabs) => {
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, msg).catch(() => {});
    });
  });
  chrome.runtime.sendMessage(msg).catch(() => {});
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
  if (message.type === 'SYNC_GROUPS_TO_SERVER') {
    if (isConnected && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'SYNC_GROUPS_TO_SERVER',
        groups: message.groups
      }));
    }
    return true;
  }

  if (message.type === 'CHECK_STATUS') {
    sendResponse({ connected: isConnected, userId: myUserId });
    return true;
  }
  
  if (message.type === 'SEND_GROUP_MSG') {
    if (isConnected && socket.readyState === WebSocket.OPEN) {
      if (message.groupId) {
        socket.send(JSON.stringify({
          type: 'CUSTOM_GROUP_MSG',
          groupId: message.groupId,
          groupName: message.groupName,
          members: message.members,
          payload: {
            senderId: myUserId,
            senderName: message.senderName,
            text: message.text
          }
        }));
      } else {
        socket.send(JSON.stringify({
          type: 'GROUP_MSG',
          payload: {
            senderId: myUserId,
            senderName: message.senderName,
            text: message.text
          }
        }));
      }
      sendResponse({ success: true });
    } else {
      sendResponse({ success: false });
    }
    return true;
  }
  
  if (message.type === 'LEAVE_GROUP') {
    if (isConnected && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({
        type: 'LEAVE_GROUP',
        groupId: message.groupId,
        leavingUserId: myUserId,
        members: message.members
      }));
      
      // Update local storage
      chrome.storage.local.get(['groups'], (res) => {
        let groups = res.groups || [];
        groups = groups.filter(g => g.id !== message.groupId);
        chrome.storage.local.set({ groups: groups }, () => {
          broadcastToTabs({ type: 'CONTACTS_UPDATED' });
        });
      });
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
