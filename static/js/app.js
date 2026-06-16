// Global State
let releaseNotes = [];
let selectedNoteIds = new Set();
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const loadingState = document.getElementById('loading-state');
const emptyState = document.getElementById('empty-state');
const feedTimeline = document.getElementById('feed-timeline');
const searchInput = document.getElementById('search-input');
const typeFiltersContainer = document.getElementById('type-filters');
const refreshBtn = document.getElementById('refresh-btn');
const refreshIcon = document.getElementById('refresh-icon');
const lastSyncTime = document.getElementById('last-sync-time');

// Selection Actions
const selectedCount = document.getElementById('selected-count');
const tweetSelectedBtn = document.getElementById('tweet-selected-btn');
const exportCsvBtn = document.getElementById('export-csv-btn');
const clearSelectedBtn = document.getElementById('clear-selected-btn');

// Modal Elements
const tweetModal = document.getElementById('tweet-modal');
const tweetTextarea = document.getElementById('tweet-textarea');
const closeModalBtn = document.getElementById('close-modal-btn');
const cancelTweetBtn = document.getElementById('cancel-tweet-btn');
const postTweetBtn = document.getElementById('post-tweet-btn');
const charCountText = document.getElementById('char-count-text');
const charWarning = document.getElementById('char-warning');
const progressRing = document.getElementById('progress-ring');

// Toast Elements
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toast-message');

/* --- Initialize Dashboard --- */
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
    initProgressRing();
});

/* --- Event Listeners Setup --- */
function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Search input (with debounce)
    let searchTimeout;
    searchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(() => {
            searchQuery = e.target.value.toLowerCase().trim();
            renderTimeline();
        }, 200);
    });

    // Filter Chips
    typeFiltersContainer.addEventListener('click', (e) => {
        const chip = e.target.closest('.filter-chip');
        if (!chip) return;
        
        // Toggle active class
        document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        
        currentFilter = chip.dataset.type;
        renderTimeline();
    });

    // Selection buttons
    clearSelectedBtn.addEventListener('click', clearSelection);
    tweetSelectedBtn.addEventListener('click', openBatchTweetModal);
    exportCsvBtn.addEventListener('click', exportToCSV);

    // Modal controls
    closeModalBtn.addEventListener('click', closeTweetModal);
    cancelTweetBtn.addEventListener('click', closeTweetModal);
    tweetTextarea.addEventListener('input', updateCharCount);
    postTweetBtn.addEventListener('click', executeTweet);
}

/* --- API Operations --- */
async function fetchReleaseNotes(forceRefresh = false) {
    showLoading(true);
    
    // Animate spinner
    refreshIcon.classList.add('spinning');
    
    try {
        const url = `/api/release-notes${forceRefresh ? '?refresh=1' : ''}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('API request failed');
        
        const result = await response.json();
        
        if (result.status === 'success' || result.status === 'warning') {
            releaseNotes = result.data;
            lastSyncTime.textContent = result.last_updated || 'Just now';
            
            // Clear selection on refresh
            clearSelection();
            
            // Render dashboard
            updateCategoryCounts();
            renderTimeline();
            
            if (forceRefresh) {
                showToast(result.status === 'warning' ? result.message : 'Feed refreshed successfully!', result.status);
            }
        } else {
            showToast(result.message || 'Failed to fetch updates', 'error');
        }
    } catch (error) {
        console.error('Fetch error:', error);
        showToast('Error syncing with release feed. Server might be offline.', 'error');
    } finally {
        showLoading(false);
        refreshIcon.classList.remove('spinning');
    }
}

/* --- State Renderers --- */
function showLoading(isLoading) {
    if (isLoading) {
        loadingState.classList.remove('hidden');
        feedTimeline.classList.add('hidden');
        emptyState.classList.add('hidden');
    } else {
        loadingState.classList.add('hidden');
        feedTimeline.classList.remove('hidden');
    }
}

function updateCategoryCounts() {
    const counts = {
        all: releaseNotes.length,
        Feature: 0,
        Issue: 0,
        Changed: 0,
        Deprecated: 0
    };

    releaseNotes.forEach(note => {
        if (counts[note.type] !== undefined) {
            counts[note.type]++;
        }
    });

    document.getElementById('count-all').textContent = counts.all;
    document.getElementById('count-feature').textContent = counts.Feature;
    document.getElementById('count-issue').textContent = counts.Issue;
    document.getElementById('count-changed').textContent = counts.Changed;
    document.getElementById('count-deprecated').textContent = counts.Deprecated;
}

function renderTimeline() {
    // Clear feed
    feedTimeline.innerHTML = '';
    
    // Filter notes
    const filteredNotes = releaseNotes.filter(note => {
        const matchesFilter = currentFilter === 'all' || note.type === currentFilter;
        const matchesSearch = !searchQuery || 
            note.plain_text.toLowerCase().includes(searchQuery) ||
            note.date.toLowerCase().includes(searchQuery) ||
            note.type.toLowerCase().includes(searchQuery);
        return matchesFilter && matchesSearch;
    });

    if (filteredNotes.length === 0) {
        emptyState.classList.remove('hidden');
        feedTimeline.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    feedTimeline.classList.remove('hidden');

    // Group by Date
    const grouped = {};
    filteredNotes.forEach(note => {
        if (!grouped[note.date]) {
            grouped[note.date] = [];
        }
        grouped[note.date].push(note);
    });

    // Generate timeline elements
    Object.keys(grouped).forEach(date => {
        const dateNotes = grouped[date];
        
        const dateGroupDiv = document.createElement('div');
        dateGroupDiv.className = 'date-group';
        
        const dateHeaderDiv = document.createElement('div');
        dateHeaderDiv.className = 'date-header';
        dateHeaderDiv.innerHTML = `
            <div class="date-dot"></div>
            <div class="date-title">${date}</div>
        `;
        
        const dateNotesDiv = document.createElement('div');
        dateNotesDiv.className = 'date-notes';
        
        dateNotes.forEach(note => {
            const isSelected = selectedNoteIds.has(note.id);
            const card = document.createElement('div');
            card.className = `note-card type-${note.type.toLowerCase()}-card ${isSelected ? 'selected' : ''}`;
            card.dataset.id = note.id;
            
            // Render card contents
            card.innerHTML = `
                <div class="card-header">
                    <span class="card-badge">
                        <i class="${getIconClassForType(note.type)}"></i> ${note.type}
                    </span>
                    <div class="card-select-control">
                        <div class="custom-checkbox">
                            <i class="fa-solid fa-check"></i>
                        </div>
                    </div>
                </div>
                <div class="card-body">
                    ${note.content}
                </div>
                <div class="card-actions">
                    <button class="card-action-btn copy-link-btn" data-url="${note.link}">
                        <i class="fa-solid fa-link"></i> Copy Link
                    </button>
                    <button class="card-action-btn copy-text-btn" data-id="${note.id}">
                        <i class="fa-solid fa-copy"></i> Copy Text
                    </button>
                    <button class="card-action-btn tweet-btn" data-id="${note.id}">
                        <i class="fa-brands fa-x-twitter"></i> Tweet
                    </button>
                </div>
            `;
            
            // Make whole card clickable for selection, EXCEPT when clicking action buttons
            card.addEventListener('click', (e) => {
                if (e.target.closest('.card-action-btn')) {
                    return; // Ignore selection trigger on action buttons
                }
                toggleNoteSelection(note.id);
            });
            
            // Add copy link button listener
            card.querySelector('.copy-link-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                copyToClipboard(e.currentTarget.dataset.url, 'Link copied to clipboard!');
            });
            
            // Add copy text button listener
            card.querySelector('.copy-text-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const noteId = e.currentTarget.dataset.id;
                const note = releaseNotes.find(n => n.id === noteId);
                if (note) {
                    copyToClipboard(note.plain_text, 'Update text copied to clipboard!');
                }
            });
            
            // Add individual tweet button listener
            card.querySelector('.tweet-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                openSingleTweetModal(e.currentTarget.dataset.id);
            });
            
            dateNotesDiv.appendChild(card);
        });
        
        dateGroupDiv.appendChild(dateHeaderDiv);
        dateGroupDiv.appendChild(dateNotesDiv);
        feedTimeline.appendChild(dateGroupDiv);
    });
}

function getIconClassForType(type) {
    switch(type) {
        case 'Feature': return 'fa-solid fa-star';
        case 'Issue': return 'fa-solid fa-triangle-exclamation';
        case 'Changed': return 'fa-solid fa-pen-to-square';
        case 'Deprecated': return 'fa-solid fa-ban';
        default: return 'fa-solid fa-info-circle';
    }
}

/* --- Selection Management --- */
function toggleNoteSelection(id) {
    if (selectedNoteIds.has(id)) {
        selectedNoteIds.delete(id);
    } else {
        selectedNoteIds.add(id);
    }
    
    // Re-render card style directly to avoid full timeline repaint
    const card = document.querySelector(`.note-card[data-id="${id}"]`);
    if (card) {
        card.classList.toggle('selected');
    }
    
    updateSelectionUI();
}

function clearSelection() {
    selectedNoteIds.clear();
    document.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
    updateSelectionUI();
}

function updateSelectionUI() {
    const count = selectedNoteIds.size;
    selectedCount.textContent = count;
    
    if (count > 0) {
        tweetSelectedBtn.removeAttribute('disabled');
        clearSelectedBtn.removeAttribute('disabled');
        document.getElementById('selection-section').classList.add('active');
    } else {
        tweetSelectedBtn.setAttribute('disabled', 'true');
        clearSelectedBtn.setAttribute('disabled', 'true');
        document.getElementById('selection-section').classList.remove('active');
    }
}

/* --- Tweet Composer Modal & Circular Progress Ring --- */
const CIRCUMFERENCE = 88; // 2 * pi * 14

function initProgressRing() {
    progressRing.style.strokeDasharray = `${CIRCUMFERENCE} ${CIRCUMFERENCE}`;
    progressRing.style.strokeDashoffset = CIRCUMFERENCE;
}

function setProgress(percent) {
    const offset = CIRCUMFERENCE - (percent / 100) * CIRCUMFERENCE;
    progressRing.style.strokeDashoffset = Math.max(0, offset);
}

function updateCharCount() {
    const text = tweetTextarea.value;
    const remaining = 280 - text.length;
    charCountText.textContent = remaining;
    
    // Progress bar math
    const percent = Math.min(100, (text.length / 280) * 100);
    setProgress(percent);
    
    // Ring color indicator
    if (remaining < 0) {
        progressRing.style.stroke = '#f43f5e'; // Red
        charCountText.className = 'char-count over-limit';
        charWarning.classList.remove('hidden');
        postTweetBtn.setAttribute('disabled', 'true');
    } else if (remaining <= 20) {
        progressRing.style.stroke = '#f59e0b'; // Amber warning
        charCountText.className = 'char-count near-limit';
        charWarning.classList.add('hidden');
        postTweetBtn.removeAttribute('disabled');
    } else {
        progressRing.style.stroke = '#1d9bf0'; // Twitter Blue
        charCountText.className = 'char-count';
        charWarning.classList.add('hidden');
        postTweetBtn.removeAttribute('disabled');
    }
    
    // Disable tweet button if text is completely empty
    if (text.trim().length === 0) {
        postTweetBtn.setAttribute('disabled', 'true');
    }
}

function openSingleTweetModal(id) {
    const note = releaseNotes.find(n => n.id === id);
    if (!note) return;
    
    // Draft tweet text
    let draftText = `BigQuery Update (${note.date}):\n\n`;
    
    // Append badge emoji
    let emoji = '📢';
    if (note.type === 'Feature') emoji = '✨';
    else if (note.type === 'Issue') emoji = '⚠️';
    else if (note.type === 'Changed') emoji = '🔄';
    else if (note.type === 'Deprecated') emoji = '🚫';
    
    draftText += `${emoji} [${note.type}] ${note.plain_text}\n\n`;
    draftText += `Details: ${note.link}`;
    
    // Auto truncate text if it is too long (ensuring URL fits)
    if (draftText.length > 280) {
        const fixedLength = `BigQuery Update (${note.date}):\n\n${emoji} [${note.type}] ...\n\nDetails: ${note.link}`.length;
        const availableSpace = 280 - fixedLength;
        const truncatedSummary = note.plain_text.substring(0, availableSpace) + '...';
        
        draftText = `BigQuery Update (${note.date}):\n\n`;
        draftText += `${emoji} [${note.type}] ${truncatedSummary}\n\n`;
        draftText += `Details: ${note.link}`;
    }
    
    tweetTextarea.value = draftText;
    updateCharCount();
    
    // Show modal
    tweetModal.classList.remove('hidden');
    tweetTextarea.focus();
}

function openBatchTweetModal() {
    if (selectedNoteIds.size === 0) return;
    
    // Filter and sort the selected notes
    const selectedNotes = releaseNotes
        .filter(note => selectedNoteIds.has(note.id))
        .sort((a, b) => b.raw_date.localeCompare(a.raw_date));
        
    let draftText = `BigQuery Release Updates summary:\n\n`;
    
    selectedNotes.forEach(note => {
        let emoji = '•';
        if (note.type === 'Feature') emoji = '✨';
        else if (note.type === 'Issue') emoji = '⚠️';
        else if (note.type === 'Changed') emoji = '🔄';
        else if (note.type === 'Deprecated') emoji = '🚫';
        
        // Get short text representation
        let shortText = note.plain_text;
        if (shortText.length > 70) {
            shortText = shortText.substring(0, 67) + '...';
        }
        draftText += `${emoji} ${shortText}\n`;
    });
    
    // Use the link of the newest selected update
    if (selectedNotes.length > 0) {
        draftText += `\nDetails: ${selectedNotes[0].link}`;
    }
    
    tweetTextarea.value = draftText;
    updateCharCount();
    
    tweetModal.classList.remove('hidden');
    tweetTextarea.focus();
}

function closeTweetModal() {
    tweetModal.classList.add('hidden');
}

function executeTweet() {
    const text = tweetTextarea.value;
    if (!text || text.length > 280) return;
    
    // Open X/Twitter intent in new tab
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    
    closeTweetModal();
    showToast('Redirected to Twitter Compose!');
}

/* --- Toast Notification Helper --- */
let toastTimeout;
function showToast(message, type = 'success') {
    clearTimeout(toastTimeout);
    
    toastMessage.textContent = message;
    
    // Color styling based on type
    if (type === 'error') {
        toast.style.backgroundColor = '#f43f5e'; // Red
        toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-xmark toast-icon';
    } else if (type === 'warning') {
        toast.style.backgroundColor = '#f59e0b'; // Yellow
        toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-exclamation toast-icon';
    } else {
        toast.style.backgroundColor = '#10b981'; // Green
        toast.querySelector('.toast-icon').className = 'fa-solid fa-circle-check toast-icon';
    }
    
    toast.classList.remove('hidden');
    
    toastTimeout = setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

/* --- Clipboard Helper --- */
function copyToClipboard(text, successMessage) {
    if (navigator.clipboard) {
        navigator.clipboard.writeText(text).then(() => {
            showToast(successMessage);
        }).catch(err => {
            console.error('Clipboard copy failed:', err);
            fallbackCopy(text, successMessage);
        });
    } else {
        fallbackCopy(text, successMessage);
    }
}

function fallbackCopy(text, successMessage) {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    // Hide visual layout
    textArea.style.position = 'fixed';
    textArea.style.top = '0';
    textArea.style.left = '0';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
        const successful = document.execCommand('copy');
        if (successful) {
            showToast(successMessage);
        } else {
            showToast('Unable to copy', 'error');
        }
    } catch (err) {
        console.error('Fallback copy error:', err);
        showToast('Copy failed', 'error');
    }
    document.body.removeChild(textArea);
}

/* --- CSV Export Helper --- */
function exportToCSV() {
    let notesToExport = [];
    let exportSource = '';
    
    if (selectedNoteIds.size > 0) {
        notesToExport = releaseNotes.filter(note => selectedNoteIds.has(note.id));
        exportSource = 'selected';
    } else {
        notesToExport = releaseNotes.filter(note => {
            const matchesFilter = currentFilter === 'all' || note.type === currentFilter;
            const matchesSearch = !searchQuery || 
                note.plain_text.toLowerCase().includes(searchQuery) ||
                note.date.toLowerCase().includes(searchQuery) ||
                note.type.toLowerCase().includes(searchQuery);
            return matchesFilter && matchesSearch;
        });
        exportSource = 'filtered';
    }
    
    if (notesToExport.length === 0) {
        showToast('No notes available to export', 'error');
        return;
    }
    
    // Build CSV rows
    const rows = [
        ['Date', 'Type', 'Description', 'Link']
    ];
    
    notesToExport.forEach(note => {
        rows.push([note.date, note.type, note.plain_text, note.link]);
    });
    
    // Convert to CSV string with proper escaping
    const csvContent = rows.map(row => 
        row.map(value => {
            const stringValue = String(value);
            const escaped = stringValue.replace(/"/g, '""');
            if (escaped.includes(',') || escaped.includes('"') || escaped.includes('\n') || escaped.includes('\r')) {
                return `"${escaped}"`;
            }
            return escaped;
        }).join(',')
    ).join('\r\n');
    
    // Create blob and download link
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `bigquery_release_notes_${exportSource}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    showToast(`Exported ${notesToExport.length} ${exportSource} updates to CSV!`);
}
