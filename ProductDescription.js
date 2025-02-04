<script>
window.onload = function () {
    console.log("Basic test: Script is running!");
    
    // Add a simple visual confirmation in the DOM
    const testDiv = document.createElement('div');
    testDiv.textContent = "Test message: JavaScript is working!";
    testDiv.style.color = 'green';
    testDiv.style.fontSize = '20px';
    testDiv.style.margin = '20px';
    document.body.appendChild(testDiv);
};
</script>
