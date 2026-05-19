document.addEventListener('DOMContentLoaded', () => {
  const iframe = document.getElementById('remote-iframe');

  // Handle messages from the remote iframe (Render website)
  window.addEventListener('message', (event) => {
    // Only accept messages from our secure Render URL
    if (event.origin !== 'https://waifuwire-server.onrender.com') return;

    const data = event.data;
    if (data && data.source === 'waifuwire-iframe') {
      
      if (data.type === 'GET_DATA') {
        chrome.storage.local.get(['displayName', 'contacts', 'groups'], (res) => {
          iframe.contentWindow.postMessage({
            source: 'waifuwire-extension',
            message: {
              type: 'DATA_RESPONSE',
              displayName: res.displayName,
              contacts: res.contacts,
              groups: res.groups || []
            }
          }, '*');
        });
      }
      
      else if (data.type === 'SAVE_GROUPS') {
        chrome.storage.local.set({ groups: data.groups }, () => {
          iframe.contentWindow.postMessage({
            source: 'waifuwire-extension',
            message: {
              type: 'DATA_RESPONSE',
              groups: data.groups
            }
          }, '*');
        });
      }
      
      else if (data.type === 'CHECK_STATUS') {
        chrome.runtime.sendMessage({ type: 'CHECK_STATUS' }, (response) => {
          if (response) {
            iframe.contentWindow.postMessage({
              source: 'waifuwire-extension',
              message: {
                type: 'STATUS_RESPONSE',
                connected: response.connected,
                userId: response.userId
              }
            }, '*');
          }
        });
      }
      
      else if (data.type === 'SAVE_NAME') {
        chrome.storage.local.set({ displayName: data.name }, () => {
          // Inform tabs of active message
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs.length > 0) {
              chrome.tabs.sendMessage(tabs[0].id, {
                type: 'INCOMING_MSG',
                channel: 'system',
                senderName: 'WaifuWire',
                text: `Display Name saved as: ${data.name}`
              });
            }
          });
          // Send response back to the iframe
          iframe.contentWindow.postMessage({
            source: 'waifuwire-extension',
            message: {
              type: 'DATA_RESPONSE',
              displayName: data.name
            }
          }, '*');
        });
      }
      
      else if (data.type === 'ADD_CONTACT') {
        chrome.runtime.sendMessage({ type: 'ADD_CONTACT', targetId: data.targetId });
      }
      
      else if (data.type === 'DELETE_CONTACT') {
        chrome.storage.local.get(['contacts'], (res) => {
          let contacts = res.contacts || [];
          contacts = contacts.filter(c => (typeof c === 'string' ? c !== data.targetId : c.id !== data.targetId));
          chrome.storage.local.set({ contacts: contacts }, () => {
            iframe.contentWindow.postMessage({
              source: 'waifuwire-extension',
              message: {
                type: 'DATA_RESPONSE',
                contacts: contacts
              }
            }, '*');
          });
        });
      }
      
      else if (data.type === 'SEND_GROUP_MSG') {
        chrome.runtime.sendMessage({
          type: 'SEND_GROUP_MSG',
          text: data.text,
          senderName: data.senderName,
          groupId: data.groupId,
          groupName: data.groupName,
          members: data.members
        }, (response) => {
          iframe.contentWindow.postMessage({
            source: 'waifuwire-extension',
            message: {
              type: 'SEND_GROUP_MSG_RESPONSE',
              success: response && response.success
            }
          }, '*');
        });
      }
      
      else if (data.type === 'LEAVE_GROUP') {
        chrome.runtime.sendMessage({
          type: 'LEAVE_GROUP',
          groupId: data.groupId,
          members: data.members
        }, (response) => {
          iframe.contentWindow.postMessage({
            source: 'waifuwire-extension',
            message: {
              type: 'LEAVE_GROUP_RESPONSE',
              success: response && response.success
            }
          }, '*');
        });
      }
      
      else if (data.type === 'SEND_DIRECT_MSG') {
        chrome.runtime.sendMessage({
          type: 'SEND_DIRECT_MSG_POPUP',
          targetId: data.targetId,
          text: data.text,
          senderName: data.senderName
        }, (response) => {
          iframe.contentWindow.postMessage({
            source: 'waifuwire-extension',
            message: {
              type: 'SEND_DIRECT_MSG_RESPONSE',
              success: response && response.success
            }
          }, '*');
        });
      }
      
      else if (data.type === 'TEST_POPUP') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'INCOMING_MSG',
              channel: 'system',
              senderName: data.senderName,
              text: 'This is what a message looks like!'
            });
          }
        });
      }
    }
  });

  // Handle messages from the extension background
  chrome.runtime.onMessage.addListener((message) => {
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({
        source: 'waifuwire-extension',
        message: message
      }, '*');
    }
  });
});
