
let lastProcessedTime = 0; // Timestamp of the last processed data
let err = null; // Variable to hold the currently processed data

// Function to simulate incoming data
function sendData(data) {
    const currentTime = Math.floor(Date.now() / 1000); // Current time in seconds

    // Process data only if it's the first data received in this second
    if (currentTime !== lastProcessedTime) {
        lastProcessedTime = currentTime; // Update the last processed time
        err = data; // Set the current data as the one to process
        console.log("Processed data:", err); // Log the processed data
    } else {
        console.log("Skipped data:", data); // Data ignored within the same second
    }
}

// Simulate sending data at unpredictable intervals
setInterval(() => {
    const randomData = Math.floor(Math.random() * 100); // Generate random data
    sendData(randomData); // Simulate sending data
}, Math.random() * 1000); // Simulate data being sent at random intervals (0-1000ms)
