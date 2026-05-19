(function() {
  function isPdfPage() {
    if (document.contentType === 'application/pdf') return true;

    const url = window.location.href.toLowerCase();
    if (url.endsWith('.pdf') || url.includes('.pdf?') || url.includes('.pdf#') || url.includes('/pdf/')) return true;

    const path = window.location.pathname.toLowerCase();
    if (path.endsWith('.pdf')) return true;

    if (document.querySelector('embed[type="application/pdf"]') || 
        document.querySelector('object[type="application/pdf"]')) {
      return true;
    }

    if (document.querySelector('embed[name="plugin"]') && 
        document.querySelector('embed[name="plugin"]').getAttribute('type') === 'application/pdf') {
      return true;
    }

    if (document.body) {
      const child = document.body.firstElementChild;
      if (child && (child.tagName === 'EMBED' || child.tagName === 'OBJECT') && 
          child.getAttribute('type') === 'application/pdf') {
        return true;
      }
    }

    return false;
  }

  // Exit immediately if PDF page
  if (isPdfPage()) {
    return;
  }


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
      
      // Wait for body if not loaded yet
      if (document.body) {
        document.body.appendChild(container);
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          document.body.appendChild(container);
        });
      }
    }
    
    const randomImageId = Math.floor(Math.random() * 8) + 1;
    const imgElement = document.getElementById('waifuwire-character-img');
    if (imgElement) {
      imgElement.src = chrome.runtime.getURL(`images/${randomImageId}.png`);
    }
    
    const titleEl = document.getElementById('waifuwire-bubble-title');
    const bubbleEl = document.getElementById('waifuwire-bubble');
    if (titleEl) titleEl.textContent = title;
    if (bubbleEl) bubbleEl.textContent = text;
    
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
        else if (message.channel === 'custom_group') prefix = message.groupName;
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
    if (isPdfPage()) return;
    if (!document.body || document.getElementById('ww-iframe-sidebar')) return;
    
    iframeSidebar = document.createElement('iframe');
    iframeSidebar.id = 'ww-iframe-sidebar';
    iframeSidebar.src = chrome.runtime.getURL('popup.html');
    iframeSidebar.setAttribute('credentialless', '');
    iframeSidebar.className = 'waifuwire-iframe-sidebar';
    document.body.appendChild(iframeSidebar);
    
    document.addEventListener('mousemove', (e) => {
      if (isPdfPage()) return;
      if (!isIframeOpen && window.innerWidth - e.clientX <= 10) {
        isIframeOpen = true;
        iframeSidebar.classList.add('open');
      } else if (isIframeOpen && window.innerWidth - e.clientX > 350) {
        isIframeOpen = false;
        iframeSidebar.classList.remove('open');
      }
    });
  }

  // Initialize once the body is guaranteed to exist
  if (document.body) {
    initIframeSidebar();
  } else {
    window.addEventListener('DOMContentLoaded', initIframeSidebar);
  }
})();
