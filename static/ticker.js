$(document).ready(function () {
    var currentIndex = 0;
    var entries = [];
    var timeoutId;

    function updateTicker() {
        // Fetch the RSS feed titles
        $.get("/getFeed", function (data) {
            // Check if data and data.entries exist and that data.entries is an array
            if (data && data.entries && Array.isArray(data.entries)) {
                entries = data.entries; // Use the data which contains entries with date and title
                currentIndex = 0;      // Reset currentIndex
                showTitle();            // Start showing titles after fetching the RSS feed
            } else {
                console.error("Received unexpected data:", data);
            }
        })
        .fail(function(jqXHR, textStatus, error) {
            console.error("Request failed: " + textStatus, error);
        });
    }

    function showTitle() {
        // Check if currentIndex exceeds or equals the length of entries
        if (currentIndex >= entries.length) {
            updateTicker();  // Re-fetch the RSS feed
            return;
        }

        var entry = entries[currentIndex];
        var date = entry.date;
        var title = entry.title;

        // Clear the ticker and set the new date and title
        var ticker = $("#ticker");
        ticker.empty();
        ticker.append(date).append(" - ").append(title);

        // Increment the currentIndex by one
        currentIndex++;

        // Clear any existing timeout and set a new timeout to show the next title after 10 seconds
        clearTimeout(timeoutId);
        timeoutId = setTimeout(showTitle, 10000);
        console.log("Current Title:", title);
    }

    // Initial RSS fetch and ticker start
    updateTicker();
});
