document.addEventListener('DOMContentLoaded', () => {
  const statusIndicator = document.getElementById('status-indicator');
  const myIdDisplay = document.getElementById('my-id-display');
  const myNameInput = document.getElementById('my-name-input');
  const contactsSelect = document.getElementById('private-contacts');
  const targetInput = document.getElementById('private-target');
  
  let myDisplayName = "Anonymous";
  let myContacts = [];

  // Tabs Logic
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
    });
  });

  // Load User Data
  chrome.storage.local.get(['displayName', 'contacts'], (res) => {
    if (res.displayName) {
      myDisplayName = res.displayName;
      myNameInput.value = myDisplayName;
    }
    if (res.contacts) {
      myContacts = res.contacts;
      renderContacts();
    }
  });

  function renderContacts() {
    contactsSelect.innerHTML = '<option value="">-- Saved Contacts --</option>';
    myContacts.forEach(contact => {
      const opt = document.createElement('option');
      if (typeof contact === 'string') {
        opt.value = contact;
        opt.textContent = contact;
      } else {
        opt.value = contact.id;
        opt.textContent = `${contact.name} (${contact.id})`;
      }
      contactsSelect.appendChild(opt);
    });
  }

  // Check initial connection status and get ID
  chrome.runtime.sendMessage({ type: 'CHECK_STATUS' }, (response) => {
    if (response) {
      if (response.connected) {
        statusIndicator.classList.replace('disconnected', 'connected');
      }
      if (response.userId) {
        myIdDisplay.textContent = response.userId;
      }
    }
  });

  // Listen for status updates from background
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === 'STATUS_UPDATE') {
      if (message.connected) {
        statusIndicator.classList.replace('disconnected', 'connected');
      } else {
        statusIndicator.classList.replace('connected', 'disconnected');
      }
    } else if (message.type === 'CONTACTS_UPDATED') {
      chrome.storage.local.get(['contacts'], (res) => {
        if (res.contacts) {
          myContacts = res.contacts;
          renderContacts();
        }
      });
    }
  });

  // Save Name
  document.getElementById('save-name-btn').addEventListener('click', () => {
    const newName = myNameInput.value.trim();
    if (newName) {
      myDisplayName = newName;
      chrome.storage.local.set({ displayName: myDisplayName }, () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs.length > 0) {
            chrome.tabs.sendMessage(tabs[0].id, {
              type: 'INCOMING_MSG',
              channel: 'system',
              senderName: 'WaifuWire',
              text: `Display Name saved as: ${newName}`
            });
          }
        });
      });
    }
  });

  // Save Contact
  document.getElementById('add-contact-btn').addEventListener('click', () => {
    const newContact = targetInput.value.trim();
    if (newContact) {
      chrome.runtime.sendMessage({ type: 'ADD_CONTACT', targetId: newContact });
    }
  });

  // Select Contact
  contactsSelect.addEventListener('change', (e) => {
    if (e.target.value) {
      targetInput.value = e.target.value;
    }
  });

  // Group Send
  document.getElementById('group-send-btn').addEventListener('click', () => {
    const input = document.getElementById('group-input');
    const text = input.value.trim();
    if (!text) return;

    chrome.runtime.sendMessage({
      type: 'SEND_GROUP_MSG',
      text: text,
      senderName: myDisplayName
    }, (response) => {
      if (response && response.success) {
        input.value = '';
        window.close();
      } else {
        alert('Failed to send. Is the server running?');
      }
    });
  });

  // Private Send
  document.getElementById('private-send-btn').addEventListener('click', () => {
    const targetId = targetInput.value.trim();
    const input = document.getElementById('private-input');
    const text = input.value.trim();
    
    if (!text || !targetId) return;

    chrome.runtime.sendMessage({
      type: 'SEND_DIRECT_MSG_POPUP',
      targetId: targetId,
      text: text,
      senderName: myDisplayName
    }, (response) => {
      if (response && response.success) {
        input.value = '';
        window.close();
      } else {
        alert('Failed to send private message.');
      }
    });
  });

  // Test Popup Button
  document.getElementById('test-popup-btn').addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.tabs.sendMessage(tabs[0].id, {
          type: 'INCOMING_MSG',
          channel: 'system',
          senderName: myDisplayName,
          text: 'This is what a message looks like!'
        });
      }
    });
  });
});
