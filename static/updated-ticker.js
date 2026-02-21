// Rotter News Ticker - Updated Implementation
// Define a namespace for global functions
window.RotterNews = {};

$(document).ready(function () {
    // Initialize
    const refreshButton = $("#refreshFeed");
    const headerTicker = $("#header-ticker");
    const connectionStatus = $("#connection-status");
    const tickerCounter = $("#ticker-counter");
    const btnExpand = $("#btn-expand");
    const tickerBody = $("#ticker-body");
    const tickerWrapper = $("#ticker-wrapper");
    const hoursSelect = $("#hours-select");

    // State variables
    let cachedEntries = JSON.parse(localStorage.getItem("rotterNews") || "[]");
    let isOffline = false;
    let tickerItems = [];
    let tickerIndex = 0;
    let tickerAnimation;
    let lastSeenTimestamp = parseInt(localStorage.getItem("lastSeenTimestamp") || "0", 10);
    let isExpanded = false;
    // bodyCache: url → fetched text (empty string means fetched but empty)
    let bodyCache = {};

    // Hours-back preference (default 4, matches Android)
    let hoursBack = parseInt(localStorage.getItem("hoursBack") || "4", 10);
    if (![1, 2, 4, 8, 16].includes(hoursBack)) hoursBack = 4;

    // Configuration
    const DISPLAY_MS = 5000; // normal display time per card
    const FADE_MS    = 300;  // fade transition duration

    // ── Hours selector ──────────────────────────────────────────────────────
    hoursSelect.val(hoursBack.toString());
    let hoursReady = false; // skip the initial programmatic set
    hoursSelect.on("change", function () {
        if (!hoursReady) { hoursReady = true; return; }
        const selected = parseInt($(this).val(), 10);
        if (selected !== hoursBack) {
            hoursBack = selected;
            localStorage.setItem("hoursBack", hoursBack.toString());
            showLoading();
            fetchNewsFeed();
        }
    });
    // Mark ready after first programmatic set
    setTimeout(() => { hoursReady = true; }, 0);

    // ── Expand button ────────────────────────────────────────────────────────
    btnExpand.on("click", function (e) {
        e.stopPropagation();
        isExpanded = !isExpanded;
        btnExpand.find("i").css("transform", isExpanded ? "rotate(180deg)" : "rotate(0deg)");
        // Give user a fresh countdown after interacting with the card
        cancelTick();
        scheduleNextTick();

        if (isExpanded && tickerItems.length > 0) {
            const cur = tickerItems[tickerIndex];
            if (cur.link) {
                fetchAndShowBody(cur);
            } else {
                tickerBody.text("אין קישור למאמר").removeClass("hidden");
            }
        } else {
            tickerBody.addClass("hidden").text("");
        }
    });

    // ── Left/right tap zones on the ticker card ──────────────────────────────
    tickerWrapper.on("click", function (e) {
        // Ignore clicks on the expand button or body area
        if ($(e.target).closest("#btn-expand, #ticker-body, .ticker-link a").length) return;
        if (tickerItems.length === 0) return;

        const wrapperLeft = tickerWrapper.offset().left;
        const wrapperWidth = tickerWrapper.outerWidth();
        const clickX = e.clientX - wrapperLeft;

        cancelTick();
        if (clickX < wrapperWidth / 2) {
            // Left half → previous
            tickerIndex = (tickerIndex - 1 + tickerItems.length) % tickerItems.length;
            showEntry("prev");
        } else {
            // Right half → next
            tickerIndex = (tickerIndex + 1) % tickerItems.length;
            showEntry("next");
        }
    });

    // ── Swipe support ────────────────────────────────────────────────────────
    let touchStartX = 0;
    tickerWrapper[0].addEventListener("touchstart", e => {
        touchStartX = e.changedTouches[0].clientX;
    }, { passive: true });
    tickerWrapper[0].addEventListener("touchend", e => {
        const dx = e.changedTouches[0].clientX - touchStartX;
        if (Math.abs(dx) < 40) return; // too short — treat as tap
        cancelTick();
        if (dx < 0) {
            tickerIndex = (tickerIndex + 1) % tickerItems.length;
            showEntry("next");
        } else {
            tickerIndex = (tickerIndex - 1 + tickerItems.length) % tickerItems.length;
            showEntry("prev");
        }
    }, { passive: true });

    // Initialize the app
    showLoading();
    startConnectionMonitor();
    initTickerAnimation();
    fetchNewsFeed();

    // Event listener for refresh button
    refreshButton.on("click", function() {
        const icon = $(this).find("i");
        icon.addClass("fa-spin");
        $(this).prop("disabled", true);

        showLoading();
        fetchNewsFeed().always(function() {
            setTimeout(function() {
                icon.removeClass("fa-spin");
                refreshButton.prop("disabled", false);
            }, 1000);
            tickerIndex = 0;
            if (tickerAnimation) {
                cancelTick();
                animateTicker();
            }
        });
    });

    // Initialize the ticker animation
    function initTickerAnimation() {
        if (cachedEntries.length > 0) {
            updateTickerItems(cachedEntries);
        }
        animateTicker();
    }

    // Show one entry — direction: "next" | "prev" | "auto"
    function showEntry(direction) {
        if (tickerItems.length === 0) return;
        // Collapse expand on every card transition
        collapseExpand();

        const item = tickerItems[tickerIndex];
        updateCounter();

        if (direction === "auto") {
            // Fade transition for timer-driven advance
            headerTicker.animate({ opacity: 0 }, FADE_MS, function () {
                renderCard(item);
                headerTicker.animate({ opacity: 1 }, FADE_MS, function () {
                    scheduleNextTick();
                });
            });
        } else {
            // Immediate for manual tap/swipe
            renderCard(item);
            scheduleNextTick();
        }

        if (item.isNew) {
            tickerItems[tickerIndex].isNew = false;
        }
    }

    // Auto-advance loop entry point
    function animateTicker() {
        if (tickerItems.length === 0) {
            headerTicker.html("<span class='ticker-item'>אין חדשות להצגה</span>");
            return;
        }
        showEntry("auto");
    }

    function renderCard(item) {
        if (headerTicker.is(":animated")) headerTicker.stop(true);

        const timeStr = item.time || "";
        const titleStr = item.title || "אין כותרת";
        const newIndicator = item.isNew
            ? '<span class="new-indicator"><i class="fas fa-star"></i></span>' : "";
        const linkHtml = item.link
            ? `<div class="ticker-link"><a href="${item.link}" target="_blank" rel="noopener noreferrer">צפה במקור <i class="fas fa-external-link-alt"></i></a></div>` : "";

        headerTicker.css({ opacity: 0, transform: "translateY(10px)" });
        headerTicker.html(`
            <span class="ticker-item${item.isNew ? " new-message" : ""}">
                <div class="ticker-time">${timeStr} ${newIndicator}</div>
                <div class="ticker-title">${titleStr}</div>
                ${linkHtml}
            </span>
        `);
        headerTicker.animate({ opacity: 1, transform: "translateY(0)" }, 600);
    }

    function collapseExpand() {
        isExpanded = false;
        btnExpand.find("i").css("transform", "rotate(0deg)");
        tickerBody.addClass("hidden").text("");
    }

    function updateCounter() {
        tickerCounter.text(tickerItems.length > 0
            ? `${tickerIndex + 1} / ${tickerItems.length}` : "");
    }

    function scheduleNextTick() {
        cancelTick();
        const delay = isExpanded ? DISPLAY_MS * 2 : DISPLAY_MS;
        tickerAnimation = setTimeout(function () {
            tickerIndex = (tickerIndex + 1) % tickerItems.length;
            animateTicker();
        }, delay);
    }

    function cancelTick() {
        clearTimeout(tickerAnimation);
        tickerAnimation = null;
    }

    // Fetch article body from the server and display it
    function fetchAndShowBody(item) {
        const url = item.link;
        if (!url) return;

        if (url in bodyCache) {
            displayBody(bodyCache[url]);
            return;
        }

        tickerBody.text("טוען תוכן…").removeClass("hidden");

        $.ajax({
            url: "/getArticle",
            data: { url: url },
            type: "GET",
            dataType: "json",
            timeout: 12000,
            success: function (data) {
                const text = (data && data.body) ? data.body : "";
                bodyCache[url] = text;
                // Only update UI if this item is still on screen and still expanded
                if (isExpanded && tickerItems.length > 0
                        && tickerItems[tickerIndex].link === url) {
                    displayBody(text);
                }
            },
            error: function () {
                bodyCache[url] = "";
                if (isExpanded && tickerItems.length > 0
                        && tickerItems[tickerIndex].link === url) {
                    tickerBody.addClass("hidden").text("");
                }
            }
        });
    }

    function displayBody(text) {
        if (text) {
            tickerBody.text(text).removeClass("hidden");
        } else {
            tickerBody.addClass("hidden").text("");
        }
    }

    // Monitor connection to backend
    function startConnectionMonitor() {
        checkConnection();
        setInterval(checkConnection, 30000);

        function checkConnection() {
            fetch("/getFeed", { method: "HEAD", cache: "no-store" })
            .then(response => {
                if (response.ok && isOffline) {
                    isOffline = false;
                    connectionStatus.addClass("hidden");
                    $("body").removeClass("offline-mode");
                    fetchNewsFeed();
                    showNotification("חיבור לשרת הוחזר", "#4CAF50");
                }
            })
            .catch(() => {
                if (!isOffline) {
                    isOffline = true;
                    connectionStatus.removeClass("hidden");
                    $("body").addClass("offline-mode");
                    showNotification("אין חיבור לשרת - מציג חדשות מזיכרון מקומי", "#F44336");
                }
            });
        }
    }

    function showLoading() {
        headerTicker.html("<span class='ticker-item'><div class='ticker-title loading-message'>טוען חדשות...</div></span>");
        showNotification("טוען חדשות...", "var(--accent-color)");
    }

    function showNotification(text, color) {
        const n = $('<div class="new-entry-notification"></div>')
            .text(text)
            .css("background-color", color)
            .appendTo("body");
        setTimeout(() => {
            n.addClass("show");
            setTimeout(() => {
                n.removeClass("show");
                setTimeout(() => n.remove(), 500);
            }, 3000);
        }, 100);
    }

    // Fetch news feed from API
    function fetchNewsFeed() {
        return $.ajax({
            url: "/getFeed",
            data: { hours: hoursBack },
            type: "GET",
            dataType: "json",
            timeout: 10000,
            success: function(data) {
                if (data && data.entries && Array.isArray(data.entries)) {
                    console.log("Feed fetched:", data.entries.length, "entries");
                    localStorage.setItem("rotterNews", JSON.stringify(data.entries));
                    cachedEntries = data.entries;
                    processNewEntries(data.entries);
                    isOffline = false;
                    connectionStatus.addClass("hidden");
                } else {
                    showError("לא נמצאו פריטי חדשות");
                }
            },
            error: function(xhr, status, error) {
                console.error("Error fetching feed:", error);
                isOffline = true;
                connectionStatus.removeClass("hidden");
                if (cachedEntries.length > 0) {
                    updateTickerItems(cachedEntries);
                } else {
                    showError(status === "timeout"
                        ? "זמן טעינת החדשות חרג מהמותר. נא לנסות שוב מאוחר יותר."
                        : "לא הצלחנו לטעון את החדשות. נא לרענן את העמוד.");
                }
            }
        });
    }

    function processNewEntries(entries) {
        const maxTimestamp = Math.max(...entries.map(e => e.timestamp || 0));
        const prevLastSeen = lastSeenTimestamp;
        const currentTime = new Date().getTime();

        const recentEntries = entries.filter(entry => {
            const entryTime = (entry.timestamp || 0) * 1000;
            return (currentTime - entryTime) <= hoursBack * 60 * 60 * 1000;
        });

        const processedEntries = recentEntries.length > 0 ? recentEntries : entries;
        const hasNewItems = processedEntries.some(e => (e.timestamp || 0) > prevLastSeen);

        if (hasNewItems) {
            const newCount = processedEntries.filter(e => (e.timestamp || 0) > prevLastSeen).length;
            showNotification(`${newCount} חדשות חדשות!`, "#FF3D00");
        }

        updateTickerItems(processedEntries, prevLastSeen);
        lastSeenTimestamp = Math.max(maxTimestamp, lastSeenTimestamp);
        localStorage.setItem("lastSeenTimestamp", lastSeenTimestamp.toString());
    }

    function updateTickerItems(entries, prevTimestamp = lastSeenTimestamp) {
        const newItems = [];
        const regularItems = [];

        entries.forEach(entry => {
            const isNew = (entry.timestamp || 0) > prevTimestamp;
            const item = {
                title: entry.title,
                time: entry.date,
                isNew: isNew,
                link: entry.link || "",
                timestamp: entry.timestamp || 0
            };
            (isNew ? newItems : regularItems).push(item);
        });

        tickerItems = [...newItems, ...regularItems];
        updateCounter();

        if (newItems.length > 0) {
            tickerIndex = 0;
            if (tickerAnimation) {
                cancelTick();
                animateTicker();
            }
        }

        if (tickerItems.length > 0 && !tickerAnimation) {
            tickerIndex = 0;
            animateTicker();
        }
    }

    function showError(message) {
        showNotification(message, "#F44336");
    }

    // Pause/resume ticker when tab visibility changes
    document.addEventListener("visibilitychange", function() {
        if (document.hidden) {
            cancelTick();
        } else {
            animateTicker();
        }
    });

    // Auto-refresh feed every 3 minutes
    setInterval(function() {
        if (!document.hidden && !isOffline) {
            fetchNewsFeed();
        }
    }, 180000);

    // Background check every 10 seconds for new headlines
    setInterval(function() {
        if (!document.hidden && !isOffline) {
            $.ajax({
                url: "/getFeed",
                data: { hours: hoursBack },
                type: "GET",
                dataType: "json",
                timeout: 5000,
                success: function(data) {
                    if (data && data.entries && Array.isArray(data.entries)) {
                        const latest = Math.max(...data.entries.map(e => e.timestamp || 0));
                        if (latest > lastSeenTimestamp) {
                            processNewEntries(data.entries);
                        }
                    }
                },
                error: function() {
                    console.log("Background refresh failed");
                }
            });
        }
    }, 10000);

    window.addEventListener("beforeunload", function() {
        localStorage.setItem("lastSeenTimestamp", lastSeenTimestamp.toString());
    });

    // Expose for external use
    window.fetchNewsFeed = fetchNewsFeed;
    window.RotterNews.resetTickerIndex = function () {
        tickerIndex = 0;
        cancelTick();
        animateTicker();
    };
});
