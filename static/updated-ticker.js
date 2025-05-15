// Rotter News Ticker - Updated Implementation
// Define a namespace for global functions
window.RotterNews = {};

$(document).ready(function () {
    // Initialize
    const refreshButton = $("#refreshFeed");
    const headerTicker = $("#header-ticker");
    const connectionStatus = $("#connection-status");
    
    // State variables
    let cachedEntries = JSON.parse(localStorage.getItem("rotterNews") || "[]");
    let isOffline = false;
    let tickerItems = [];
    let tickerIndex = 0;
    let tickerAnimation;
    let lastSeenTimestamp = parseInt(localStorage.getItem("lastSeenTimestamp") || "0", 10);
    
    // Configuration options
    const CONFIG = {
        maxHeadlineAge: 2 * 60 * 60 * 1000, // 2 hours in milliseconds
        autoReloadInterval: 10000 // 10 seconds in milliseconds
    };
    
    // Initialize the app
    showLoading();
    startConnectionMonitor();
    initTickerAnimation();
    fetchNewsFeed();

    // Event listener for refresh button
    refreshButton.on("click", function() {
        // Visual feedback that refresh is happening
        const icon = $(this).find("i");
        icon.addClass("fa-spin");
        $(this).prop("disabled", true);
        
        showLoading();
        fetchNewsFeed().always(function() {
            // Reset button state after 1s
            setTimeout(function() {
                icon.removeClass("fa-spin");
                refreshButton.prop("disabled", false);
            }, 1000);
            
            // Reset ticker index to 0 to start from newest headline
            tickerIndex = 0;
            
            // Restart the ticker animation to show the newest headline
            if (tickerAnimation) {
                clearTimeout(tickerAnimation);
                animateTicker();
            }
        });
    });
    
    // Initialize the ticker animation
    function initTickerAnimation() {
        if (cachedEntries.length > 0) {
            updateTickerItems(cachedEntries);
        }
        
        // Start the ticker animation
        animateTicker();
    }
    
    // Animate the ticker as a fullscreen news display - showing one message at a time for 5 seconds
    function animateTicker() {
        if (tickerItems.length === 0) {
            // No items to show
            headerTicker.html("<span class='ticker-item'>אין חדשות להצגה</span>");
            return;
        }
        
        // Show current ticker item
        const currentItem = tickerItems[tickerIndex];
        const isNew = currentItem.isNew ? " new-message" : "";
        
        // Clear any existing animations
        if (headerTicker.is(":animated")) {
            headerTicker.stop(true);
        }
        
        // Reset position
        headerTicker.css({
            opacity: 0,
            transform: "translateY(10px)" 
        });
        
        // Make sure we have valid values
        const timeStr = currentItem.time || "";
        const titleStr = currentItem.title || "אין כותרת";
        
        // Add new indicator icon if it's a new headline
        const newIndicator = currentItem.isNew ? '<span class="new-indicator"><i class="fas fa-star"></i></span>' : "";
        
        // Add link to original source if available
        const linkHtml = currentItem.link ? 
            `<div class="ticker-link"><a href="${currentItem.link}" target="_blank" rel="noopener noreferrer">צפה במקור <i class="fas fa-external-link-alt"></i></a></div>` : "";
            
        headerTicker.html(`
            <span class="ticker-item${isNew}">
                <div class="ticker-time">${timeStr} ${newIndicator}</div>
                <div class="ticker-title">${titleStr}</div>
                ${linkHtml}
            </span>
        `);
        
        // If it was a new item, mark it as seen
        if (currentItem.isNew) {
            tickerItems[tickerIndex].isNew = false;
        }
        
        // Fade in the message with slight upward movement
        headerTicker.animate({
            opacity: 1,
            transform: "translateY(0)"
        }, 600, "swing", function() {
            // Wait for 5 seconds before moving to the next message (longer display for fullscreen view)
            clearTimeout(tickerAnimation);
            tickerAnimation = setTimeout(function() {
                // Fade out with slight downward movement
                headerTicker.animate({
                    opacity: 0,
                    transform: "translateY(-10px)"
                }, 600, "swing", function() {
                    // Move to next item
                    tickerIndex = (tickerIndex + 1) % tickerItems.length;
                    
                    // Check if we've seen all items and should restart from beginning
                    let allSeen = true;
                    for (let i = 0; i < tickerItems.length; i++) {
                        if (tickerItems[i].isNew) {
                            allSeen = false;
                            break;
                        }
                    }
                    
                    // If all have been seen and we're at the end, restart from the beginning
                    if (allSeen && tickerIndex === 0) {
                        console.log("All headlines seen, restarting from beginning");
                        // Reset isNew flags for all items to keep cycling through
                        for (let i = 0; i < tickerItems.length; i++) {
                            tickerItems[i].isNew = false;
                        }
                    }
                    
                    // Schedule the next animation
                    clearTimeout(tickerAnimation);
                    tickerAnimation = setTimeout(animateTicker, 200);
                });
            }, 5000); // Display for 5 seconds
        });
    }
    
    // Monitor connection to backend
    function startConnectionMonitor() {
        // Initial check
        checkConnection();
        
        // Periodic checks
        setInterval(checkConnection, 30000); // Check every 30 seconds
        
        // Function to check connection status
        function checkConnection() {
            fetch("/getFeed", { 
                method: "HEAD",
                cache: "no-store",
                timeout: 5000
            })
            .then(response => {
                if (response.ok && isOffline) {
                    // We're back online
                    console.log("Connection restored");
                    isOffline = false;
                    connectionStatus.addClass("hidden");
                    $("body").removeClass("offline-mode");
                    fetchNewsFeed();
                    
                    // Show a notification that we're back online
                    const notification = $('<div class="new-entry-notification" style="background-color: #4CAF50;"></div>')
                        .text("חיבור לשרת הוחזר")
                        .appendTo("body");
                        
                    setTimeout(() => {
                        notification.addClass("show");
                        setTimeout(() => {
                            notification.removeClass("show");
                            setTimeout(() => notification.remove(), 500);
                        }, 3000);
                    }, 100);
                }
            })
            .catch(error => {
                if (!isOffline) {
                    // We just went offline
                    console.log("Connection lost:", error);
                    isOffline = true;
                    connectionStatus.removeClass("hidden");
                    $("body").addClass("offline-mode");
                    
                    // Show offline notification
                    const notification = $('<div class="new-entry-notification" style="background-color: #F44336;"></div>')
                        .text("אין חיבור לשרת - מציג חדשות מזיכרון מקומי")
                        .appendTo("body");
                        
                    setTimeout(() => {
                        notification.addClass("show");
                        setTimeout(() => {
                            notification.removeClass("show");
                            setTimeout(() => notification.remove(), 500);
                        }, 3000);
                    }, 100);
                }
            });
        }
    }
    
    // Function to show loading state
    function showLoading() {
        // In fullscreen header mode, we display loading differently
        // Show loading message directly in the ticker and a notification
        headerTicker.html("<span class='ticker-item'><div class='ticker-title loading-message'>טוען חדשות...</div></span>");
        
        // Also show a notification
        const loadingNotification = $('<div class="new-entry-notification" style="background-color: var(--accent-color);"></div>')
            .text("טוען חדשות...")
            .appendTo("body");
            
        setTimeout(() => {
            loadingNotification.addClass("show");
            setTimeout(() => {
                loadingNotification.removeClass("show");
                setTimeout(() => loadingNotification.remove(), 500);
            }, 3000);
        }, 100);
    }
    
    // Fetch news feed from API - Exposed globally for the mini refresh button
    function fetchNewsFeed() {
        return $.ajax({
            url: "/getFeed",
            type: "GET",
            dataType: "json",
            timeout: 10000, // 10 second timeout
            success: function(data) {
                if (data && data.entries && Array.isArray(data.entries)) {
                    console.log("Feed fetched successfully:", data.entries.length, "entries");
                    
                    // Debug output
                    console.log("Sample entry:", data.entries[0]);
                    
                    // Save to cache
                    localStorage.setItem("rotterNews", JSON.stringify(data.entries));
                    cachedEntries = data.entries;
                    
                    // Process entries for ticker and check for new items
                    processNewEntries(data.entries);
                    
                    // Connection is good
                    isOffline = false;
                    connectionStatus.addClass("hidden");
                } else {
                    showError("לא נמצאו פריטי חדשות");
                }
            },
            error: function(xhr, status, error) {
                console.error("Error fetching feed:", error);
                
                // Mark as offline
                isOffline = true;
                connectionStatus.removeClass("hidden");
                
                // If we have cached entries, continue showing them
                if (cachedEntries.length > 0) {
                    // Process cached entries for ticker
                    updateTickerItems(cachedEntries);
                } else {
                    showError(status === "timeout" ? 
                        "זמן טעינת החדשות חרג מהמותר. נא לנסות שוב מאוחר יותר." : 
                        "לא הצלחנו לטעון את החדשות. נא לרענן את העמוד.");
                }
            }
        });
    }
    
    // Process new entries and check for new items
    function processNewEntries(entries) {
        // Update last seen timestamp
        const maxTimestamp = Math.max(...entries.map(entry => entry.timestamp || 0));
        const prevLastSeen = lastSeenTimestamp;
        const currentTime = new Date().getTime();
        
        console.log("Processing entries:", entries.length, "Current time:", new Date(currentTime).toLocaleString());
        
        // Filter out entries older than the configured max age
        const recentEntries = entries.filter(entry => {
            const entryTimestamp = entry.timestamp || 0;
            // Unix timestamps are in seconds, JS timestamps are in milliseconds
            const entryTime = entryTimestamp * 1000;
            const age = currentTime - entryTime;
            console.log("Entry time:", new Date(entryTime).toLocaleString(), "Age:", age/1000/60, "minutes");
            return age <= CONFIG.maxHeadlineAge;
        });
        
        console.log("Recent entries after filtering:", recentEntries.length);
        
        // If all entries are filtered out due to age, use all entries instead
        const processedEntries = recentEntries.length > 0 ? recentEntries : entries;
        
        // Check for new items
        const hasNewItems = processedEntries.some(entry => (entry.timestamp || 0) > prevLastSeen);
        
        // If we have new items, show a notification
        if (hasNewItems) {
            const newCount = processedEntries.filter(entry => (entry.timestamp || 0) > prevLastSeen).length;
            showNewItemNotification(newCount);
        }
        
        // Update ticker items with prioritized new entries
        updateTickerItems(processedEntries, prevLastSeen);
        
        // Save the new timestamp
        lastSeenTimestamp = Math.max(maxTimestamp, lastSeenTimestamp);
        localStorage.setItem("lastSeenTimestamp", lastSeenTimestamp.toString());
    }
    
    // Show notification for new items
    function showNewItemNotification(count) {
        const notification = $('<div class="new-entry-notification" style="background-color: #FF3D00;"></div>')
            .text(`${count} חדשות חדשות!`)
            .appendTo("body");
            
        setTimeout(() => {
            notification.addClass("show");
            setTimeout(() => {
                notification.removeClass("show");
                setTimeout(() => notification.remove(), 500);
            }, 3000);
        }, 100);
    }
    
    // Update ticker items with prioritized new entries
    function updateTickerItems(entries, prevTimestamp = lastSeenTimestamp) {
        // Separate new and regular entries
        const regularItems = [];
        const newItems = [];
        
        console.log("Updating ticker items with entries:", entries.length);
        
        // Convert entries to ticker format and separate them
        entries.forEach(entry => {
            const isNew = (entry.timestamp || 0) > prevTimestamp;
            const tickerItem = {
                title: entry.title,
                time: entry.date,
                isNew: isNew,
                link: entry.link || "",
                timestamp: entry.timestamp || 0
            };
            
            if (isNew) {
                newItems.push(tickerItem);
            } else {
                regularItems.push(tickerItem);
            }
        });
        
        console.log("New items:", newItems.length, "Regular items:", regularItems.length);
        
        // Prioritize new entries by putting them at the beginning
        tickerItems = [...newItems, ...regularItems];
        
        // If there are new entries, reset the ticker index to start showing them immediately
        if (newItems.length > 0) {
            tickerIndex = 0;
            
            // If animation is already running, restart it to show the new items
            if (tickerAnimation) {
                clearTimeout(tickerAnimation);
                animateTicker();
            }
        }
        
        // If the ticker isn't running yet, start it
        if (tickerItems.length > 0 && !tickerAnimation) {
            tickerIndex = 0;
            animateTicker();
        }
    }
    
    // Show error message
    function showError(message) {
        // In fullscreen mode, show errors as notifications
        const errorNotification = $('<div class="new-entry-notification" style="background-color: #F44336;"></div>')
            .text(message)
            .appendTo("body");
            
        setTimeout(() => {
            errorNotification.addClass("show");
            setTimeout(() => {
                errorNotification.removeClass("show");
                setTimeout(() => errorNotification.remove(), 500);
            }, 4000);
        }, 100);
    }

    // Handle visibility change to pause/resume ticker when tab is not visible
    document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
            // Page is hidden, pause the ticker animation
            if (headerTicker.is(":animated")) {
                headerTicker.stop();
            }
            clearTimeout(tickerAnimation);
        } else {
            // Page is visible again, restart the ticker
            animateTicker();
        }
    });

    // Auto-refresh feed every 3 minutes (180000 ms) when page is visible
    setInterval(function() {
        if (!document.hidden && !isOffline) {
            fetchNewsFeed();
        }
    }, 180000);
    
    // Auto-reload headlines in the background every 10 seconds
    setInterval(function() {
        if (!document.hidden && !isOffline) {
            // Silent background refresh - don't show loading indicators
            $.ajax({
                url: "/getFeed",
                type: "GET",
                dataType: "json",
                timeout: 5000, // 5 second timeout for background check
                success: function(data) {
                    if (data && data.entries && Array.isArray(data.entries)) {
                        // Check if we have any new headlines
                        const latestTimestamp = Math.max(...data.entries.map(entry => entry.timestamp || 0));
                        if (latestTimestamp > lastSeenTimestamp) {
                            // Process the new entries to update the ticker
                            processNewEntries(data.entries);
                        }
                    }
                },
                error: function() {
                    // Silently fail on background check errors
                    console.log("Background refresh failed");
                }
            });
        }
    }, CONFIG.autoReloadInterval);
    
    // Handle page reload
    window.addEventListener("beforeunload", function() {
        // Save last seen timestamp to localStorage
        localStorage.setItem("lastSeenTimestamp", lastSeenTimestamp.toString());
    });
    
    // Expose functions for external use (like mini refresh button)
    window.fetchNewsFeed = fetchNewsFeed;
    
    // Function to reset the ticker index to show newest headlines first
    function resetTickerIndex() {
        tickerIndex = 0;
        if (tickerAnimation) {
            clearTimeout(tickerAnimation);
            animateTicker();
        }
    }
    
    // Expose the resetTickerIndex function
    window.RotterNews.resetTickerIndex = resetTickerIndex;
});
