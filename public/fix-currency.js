// Force consistent currency display across all pages
document.addEventListener('DOMContentLoaded', function() {
    // Fix all currency displays
    function fixCurrencySymbols() {
        // Replace all £ and ₮ with ₹
        document.querySelectorAll('*').forEach(element => {
            if (element.textContent.includes('£') || element.textContent.includes('₮')) {
                element.textContent = element.textContent.replace(/[£₮]/g, '₹');
            }
        });
        
        // Fix specific elements
        const elements = document.querySelectorAll('h3, td, span, div');
        elements.forEach(el => {
            if (el.textContent.includes('£') || el.textContent.includes('₮')) {
                el.textContent = el.textContent.replace(/[£₮]/g, '₹');
            }
        });
    }
    
    // Run initially and every second for dynamic content
    fixCurrencySymbols();
    setInterval(fixCurrencySymbols, 1000);
});