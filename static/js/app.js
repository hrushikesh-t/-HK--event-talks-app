// STATE MANAGEMENT
let allUpdates = [];
let activeFilter = 'all';
let searchQuery = '';
let selectedUpdate = null;

// SELECTORS
const timelineFeed = document.getElementById('timeline-feed');
const refreshBtn = document.getElementById('refresh-btn');
const searchInput = document.getElementById('search-input');
const filterPills = document.getElementById('filter-pills');
const statusBadge = document.getElementById('status-badge');
const statusText = document.getElementById('status-text');

// Modal Selectors
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const charCount = document.getElementById('char-count');
const sendTweetBtn = document.getElementById('send-tweet-btn');
const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
const closeModalBtn = document.getElementById('close-modal-btn');
const progressCircle = document.getElementById('progress-ring-circle');
const previewType = document.getElementById('preview-type');
const previewText = document.getElementById('preview-text');

// Progress Circle configuration
const radius = progressCircle.r.baseVal.value;
const circumference = radius * 2 * Math.PI;
progressCircle.style.strokeDasharray = `${circumference} ${circumference}`;
progressCircle.style.strokeDashoffset = circumference;

// TOAST NOTIFICATIONS
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    // Choose icon based on type
    let iconSvg = '';
    if (type === 'success') {
        iconSvg = `<svg class="toast-icon success" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" stroke-linecap="round" stroke-linejoin="round"/><polyline points="22 4 12 14.01 9 11.01" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
    } else if (type === 'error') {
        iconSvg = `<svg class="toast-icon error" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>`;
    } else {
        iconSvg = `<svg class="toast-icon info" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;
    }
    
    toast.innerHTML = `
        ${iconSvg}
        <span>${message}</span>
    `;
    
    container.appendChild(toast);
    
    // Auto dismiss after 3 seconds
    setTimeout(() => {
        toast.style.animation = 'toast-in 0.3s ease reverse';
        setTimeout(() => {
            if (toast.parentNode) {
                container.removeChild(toast);
            }
        }, 300);
    }, 3000);
}

// TWITTER CHARACTER COUNTING UTILITIES
// Twitter treats any URL as exactly 23 characters.
function getTweetLength(text) {
    const urlRegex = /https?:\/\/[^\s]+/g;
    let len = text.length;
    
    // Find all URLs in text
    const urls = text.match(urlRegex) || [];
    urls.forEach(url => {
        len = len - url.length + 23;
    });
    
    return len;
}

function updateProgressCircle(length) {
    const maxLength = 280;
    const percentage = Math.min(length / maxLength, 1);
    const offset = circumference - (percentage * circumference);
    
    progressCircle.style.strokeDashoffset = offset;
    
    // Color transitions based on character usage
    if (length > maxLength) {
        progressCircle.style.stroke = '#ef4444'; // Red
        charCount.className = 'danger';
    } else if (maxLength - length <= 20) {
        progressCircle.style.stroke = '#f59e0b'; // Amber
        charCount.className = 'warning';
    } else {
        progressCircle.style.stroke = '#1d9bf0'; // Default Twitter blue
        charCount.className = '';
    }
    
    charCount.textContent = maxLength - length;
    
    // Disable tweet button if empty or too long
    sendTweetBtn.disabled = length <= 0 || length > maxLength;
}

// FETCH DATA FROM FLASK API
async function fetchReleaseNotes(forceRefresh = false) {
    // Show spinner and skeleton loader
    refreshBtn.classList.add('spinning');
    statusBadge.className = 'status-badge loading';
    statusText.textContent = 'Updating...';
    
    // Render skeleton loader
    timelineFeed.innerHTML = `
        <div class="skeleton-wrapper">
            <div class="skeleton-date"></div>
            <div class="skeleton-card"></div>
            <div class="skeleton-card"></div>
        </div>
    `;
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=true' : ''}`;
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Server returned HTTP ${response.status}`);
        }
        
        const data = await response.json();
        allUpdates = data.updates || [];
        
        // Update statuses
        statusBadge.className = 'status-badge';
        const fetchTime = new Date(data.last_fetched || new Date());
        statusText.textContent = `Updated: ${fetchTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
        
        // Dynamically build filter UI
        setupFilters();
        
        // Render timeline
        renderFeed();
        
        if (forceRefresh) {
            showToast('Feed refreshed successfully!', 'success');
        }
    } catch (error) {
        console.error('Error fetching release notes:', error);
        statusBadge.className = 'status-badge error';
        statusText.textContent = 'Connection Error';
        
        timelineFeed.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                <h3>Failed to load release notes</h3>
                <p>Could not retrieve data from the server. Please check your connection or click Refresh to try again.</p>
                <button id="retry-btn" class="btn btn-secondary">Retry Connection</button>
            </div>
        `;
        
        document.getElementById('retry-btn')?.addEventListener('click', () => fetchReleaseNotes(true));
        showToast('Failed to refresh feed.', 'error');
    } finally {
        refreshBtn.classList.remove('spinning');
    }
}

// FILTER SETUP
function setupFilters() {
    // Collect all unique update types present in the feed
    const types = new Set();
    allUpdates.forEach(update => {
        if (update.type) {
            types.add(update.type.trim());
        }
    });
    
    // Clear and build the filters
    filterPills.innerHTML = `<button class="filter-pill ${activeFilter === 'all' ? 'active' : ''}" data-type="all">All</button>`;
    
    // Sort and append type pills
    Array.from(types).sort().forEach(type => {
        const pill = document.createElement('button');
        pill.className = `filter-pill ${activeFilter === type ? 'active' : ''}`;
        pill.dataset.type = type;
        pill.textContent = type;
        filterPills.appendChild(pill);
    });
    
    // Re-attach listeners
    const pills = filterPills.querySelectorAll('.filter-pill');
    pills.forEach(pill => {
        pill.addEventListener('click', () => {
            pills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            activeFilter = pill.dataset.type;
            renderFeed();
        });
    });
}

// RENDER FEEDTIMELINE
function renderFeed() {
    // Filter updates
    const query = searchQuery.toLowerCase().trim();
    const filtered = allUpdates.filter(update => {
        const matchesFilter = (activeFilter === 'all' || update.type === activeFilter);
        const matchesSearch = !query || 
            update.text_content.toLowerCase().includes(query) || 
            update.type.toLowerCase().includes(query) || 
            update.date.toLowerCase().includes(query);
        return matchesFilter && matchesSearch;
    });
    
    // Clear current feed
    timelineFeed.innerHTML = '';
    
    if (filtered.length === 0) {
        timelineFeed.innerHTML = `
            <div class="empty-state">
                <svg class="empty-icon" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/></svg>
                <h3>No release notes match your query</h3>
                <p>Try clearing your search text or choosing a different category filter.</p>
            </div>
        `;
        return;
    }
    
    // Group updates by date
    const groups = {};
    filtered.forEach(update => {
        if (!groups[update.date]) {
            groups[update.date] = [];
        }
        groups[update.date].push(update);
    });
    
    // Render groups in order (feed usually sorted desc, so we iterate in insertion order)
    Object.keys(groups).forEach(date => {
        const groupEl = document.createElement('div');
        groupEl.className = 'timeline-group';
        
        // Date indicator
        const dateNode = document.createElement('div');
        dateNode.className = 'timeline-date-node';
        dateNode.innerHTML = `
            <div class="timeline-dot"></div>
            <div class="timeline-date-label">${date}</div>
        `;
        groupEl.appendChild(dateNode);
        
        // Cards container
        const cardsContainer = document.createElement('div');
        cardsContainer.className = 'timeline-cards';
        
        groups[date].forEach(update => {
            const card = document.createElement('article');
            card.className = 'update-card';
            card.dataset.id = update.id;
            
            const badgeClass = update.type.toLowerCase().replace(/\s+/g, '-');
            
            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${badgeClass}">${update.type}</span>
                    <span class="card-meta">${date}</span>
                </div>
                <div class="card-body">
                    ${update.content_html}
                </div>
                <div class="card-actions">
                    <button class="btn-icon btn-copy" title="Copy update text" aria-label="Copy update details">
                        <svg class="icon-copy" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    </button>
                    <button class="btn btn-secondary btn-tweet-action" aria-label="Share update on X">
                        <svg class="icon-x" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        <span>Tweet</span>
                    </button>
                </div>
            `;
            
            // Event listener: Copy Text
            card.querySelector('.btn-copy').addEventListener('click', (e) => {
                const copyBtn = e.currentTarget;
                const textToCopy = `Google Cloud BigQuery [${update.type}] (${update.date}): ${update.text_content} - Read more: ${update.link}`;
                
                navigator.clipboard.writeText(textToCopy)
                    .then(() => {
                        copyBtn.classList.add('active-copy');
                        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color:#10b981;"><polyline points="20 6 9 17 4 12"/></svg>`;
                        showToast('Copied to clipboard!', 'success');
                        
                        setTimeout(() => {
                            copyBtn.classList.remove('active-copy');
                            copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
                        }, 2000);
                    })
                    .catch(() => {
                        showToast('Failed to copy text.', 'error');
                    });
            });
            
            // Event listener: Open Tweet Modal
            card.querySelector('.btn-tweet-action').addEventListener('click', () => {
                openTweetModal(update);
            });
            
            cardsContainer.appendChild(card);
        });
        
        groupEl.appendChild(cardsContainer);
        timelineFeed.appendChild(groupEl);
    });
}

// TWITTER DIALOG / MODAL ACTIONS
function openTweetModal(update) {
    selectedUpdate = update;
    
    // Set previews in modal layout
    previewType.textContent = update.type.toUpperCase();
    previewType.className = `preview-type badge ${update.type.toLowerCase().replace(/\s+/g, '-')}`;
    previewText.textContent = update.text_content;
    
    // Craft initial Twitter draft
    // Max characters = 280.
    // Standard template structure: "GCP BigQuery [Type] (Date): \"Content\" " + Link + " #BigQuery #GCP"
    // Link counts as 23 characters. Hashtags are 18 characters including spaces.
    // We calculate standard overhead characters:
    const prefix = `GCP BigQuery [${update.type}] (${update.date}): "`;
    const suffix = `" ${update.link} #BigQuery #GCP`;
    
    const urlLengthForTwitter = 23;
    const hashtags = " #BigQuery #GCP";
    const prefixLen = prefix.length;
    const suffixOverhead = 2 + urlLengthForTwitter + hashtags.length; // 2 for quotes & space
    
    const allowedTextLen = 280 - prefixLen - suffixOverhead;
    
    let draftText = update.text_content;
    if (draftText.length > allowedTextLen) {
        draftText = draftText.slice(0, allowedTextLen - 3) + '...';
    }
    
    const fullDraft = `${prefix}${draftText}${suffix}`;
    
    // Fill textarea
    tweetTextarea.value = fullDraft;
    
    // Update count UI
    const currentLength = getTweetLength(fullDraft);
    updateProgressCircle(currentLength);
    
    // Show Modal
    tweetModal.classList.add('active');
    tweetModal.setAttribute('aria-hidden', 'false');
    tweetTextarea.focus();
}

function closeTweetModal() {
    tweetModal.classList.remove('active');
    tweetModal.setAttribute('aria-hidden', 'true');
    selectedUpdate = null;
}

function sendTweet() {
    const text = tweetTextarea.value;
    const xUrl = `https://x.com/intent/tweet?text=${encodeURIComponent(text)}`;
    
    window.open(xUrl, '_blank', 'noopener,noreferrer');
    
    closeTweetModal();
    showToast('Redirected to X (Twitter)!', 'success');
}

// LIVE EVENTS
refreshBtn.addEventListener('click', () => fetchReleaseNotes(true));

searchInput.addEventListener('input', (e) => {
    searchQuery = e.target.value;
    renderFeed();
});

// Modal Events
closeModalBtn.addEventListener('click', closeTweetModal);
cancelTweetBtn.addEventListener('click', closeTweetModal);
sendTweetBtn.addEventListener('click', sendTweet);

// Close modal when clicking backdrop
tweetModal.addEventListener('click', (e) => {
    if (e.target === tweetModal) {
        closeTweetModal();
    }
});

// ESC key listener for modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && tweetModal.classList.contains('active')) {
        closeTweetModal();
    }
});

// Live character editing listener
tweetTextarea.addEventListener('input', () => {
    const text = tweetTextarea.value;
    const currentLength = getTweetLength(text);
    updateProgressCircle(currentLength);
});

// INITIAL PAGE LOAD
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes(false);
});
