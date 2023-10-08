
$(document).ready(function () {
    var currentIndex = 0;
    var entries = [];

    function updateTicker() {
        // Fetch the RSS feed titles
        $.get("/getFeed", function (data) {
            try {
                entries = data.entries; // Assuming the data contains entries with date and title
                // Reset currentIndex and start showing titles after fetching the RSS feed
                currentIndex = 0;
                showTitle();
            } catch (error) {
                console.error("Error:", error);
            }
        });
    }

    function showTitle() {
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

        // Set a timeout to show the next title after 10 seconds
        setTimeout(showTitle, 10000);
        console.log("Current Title:", title);
    }

    // Initial RSS fetch and ticker start
    updateTicker();
});
