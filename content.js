let timeoutId = null;

// Anime Popup Logic
function showWaifuPopup(text, title) {
  let container = document.getElementById('waifuwire-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'waifuwire-container';
    container.className = 'waifuwire-container';
    
    const bubbleContainer = document.createElement('div');
    bubbleContainer.className = 'waifuwire-bubble-container';
    
    const bubbleTitle = document.createElement('div');
    bubbleTitle.id = 'waifuwire-bubble-title';
    bubbleTitle.className = 'waifuwire-bubble-title';
    
    const bubble = document.createElement('div');
    bubble.id = 'waifuwire-bubble';
    bubble.className = 'waifuwire-bubble';
    
    bubbleContainer.appendChild(bubbleTitle);
    bubbleContainer.appendChild(bubble);
    
    const img = document.createElement('img');
    img.id = 'waifuwire-character-img';
    img.className = 'waifuwire-character';
    img.alt = 'Anime Character';
    
    container.appendChild(bubbleContainer);
    container.appendChild(img);
    document.body.appendChild(container);
  }
  
  const randomImageId = Math.floor(Math.random() * 8) + 1;
  const imgElement = document.getElementById('waifuwire-character-img');
  imgElement.src = chrome.runtime.getURL(`images/${randomImageId}.png`);
  
  document.getElementById('waifuwire-bubble-title').textContent = title;
  document.getElementById('waifuwire-bubble').textContent = text;
  
  setTimeout(() => { container.classList.add('show'); }, 10);
  
  if (timeoutId) clearTimeout(timeoutId);
  timeoutId = setTimeout(() => { container.classList.remove('show'); }, 7000);
}

// Background Listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'INCOMING_MSG') {
    // Show popup immediately, but NOT if we are the sender
    if (!message.isMe) {
      const nameToDisplay = message.senderName && message.senderName !== "Anonymous" ? message.senderName : message.senderId;
      let prefix = 'DM';
      if (message.channel === 'group') prefix = 'Group';
      else if (message.channel === 'system') prefix = 'System';
      const title = `${prefix}: ${nameToDisplay}`;
      showWaifuPopup(message.text, title);
    }
  }
});

// Hover Sidebar Logic
let iframeSidebar = null;
let isIframeOpen = false;

function initIframeSidebar() {
  if (document.getElementById('ww-iframe-sidebar')) return;
  
  iframeSidebar = document.createElement('iframe');
  iframeSidebar.id = 'ww-iframe-sidebar';
  iframeSidebar.src = chrome.runtime.getURL('popup.html');
  iframeSidebar.className = 'waifuwire-iframe-sidebar';
  document.body.appendChild(iframeSidebar);
  
  document.addEventListener('mousemove', (e) => {
    if (!isIframeOpen && window.innerWidth - e.clientX <= 10) {
      isIframeOpen = true;
      iframeSidebar.classList.add('open');
    } else if (isIframeOpen && window.innerWidth - e.clientX > 350) {
      isIframeOpen = false;
      iframeSidebar.classList.remove('open');
    }
  });
}

initIframeSidebar();
