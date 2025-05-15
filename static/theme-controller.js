// Theme and UI enhancements for Rotter News
$(document).ready(function() {
    // Theme toggle button
    const themeToggle = $('#theme-toggle');
    const miniRefresh = $('#mini-refresh');
    const htmlElement = $('html');
    
    // Check for saved theme preference in cookie or use default
    const currentTheme = Cookies.get('theme') || 'dark';
    
    // Initial setup
    updateTheme(currentTheme);
    
    // Theme toggle functionality
    themeToggle.on('click', function() {
        // Get current theme
        const currentTheme = htmlElement.attr('data-theme') || 'dark';
        // Toggle theme
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        // Visual feedback for button press
        $(this).addClass('button-pressed');
        setTimeout(() => {
            $(this).removeClass('button-pressed');
        }, 300);
        
        // Update theme
        updateTheme(newTheme);
        
        // Save preference in cookie (expires in 365 days)
        Cookies.set('theme', newTheme, { expires: 365, sameSite: 'strict' });
    });
      // Small refresh button functionality
    miniRefresh.on('click', function() {
        // Visual feedback for button press
        $(this).addClass('button-pressed');
        setTimeout(() => {
            $(this).removeClass('button-pressed');
        }, 300);
        
        // Show loading animation in the button
        const icon = $(this).find('i');
        icon.addClass('fa-spin');
        $(this).prop('disabled', true);
        
        // Trigger the refresh functionality
        fetchNewsFeed().always(function() {
            // Reset button state after 1s
            setTimeout(function() {
                icon.removeClass('fa-spin');
                miniRefresh.prop('disabled', false);
            }, 1000);
            
            // Reset ticker index to show newest headline first if main ticker script is available
            if (window.RotterNews && typeof window.RotterNews.resetTickerIndex === 'function') {
                window.RotterNews.resetTickerIndex();
            }
        });
    });
    
    // Function to update theme
    function updateTheme(theme) {
        // Update HTML attribute
        htmlElement.attr('data-theme', theme);
        
        // Update icon based on theme
        if (theme === 'dark') {
            themeToggle.html('<i class="fas fa-moon"></i>');
        } else {
            themeToggle.html('<i class="fas fa-sun"></i>');
        }
    }
    
    // Reference to the fetchNewsFeed function from the main script
    function fetchNewsFeed() {
        // Forward to the main script's function
        return window.fetchNewsFeed ? window.fetchNewsFeed() : $.Deferred().resolve();
    }
});
