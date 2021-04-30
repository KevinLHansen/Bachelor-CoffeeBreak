var canvas = document.querySelector("canvas");
var canvasBounding = canvas.getBoundingClientRect();
var context = canvas.getContext("2d");

var offsetX = canvasBounding.left;
var offsetY = canvasBounding.top;

// Dragging
var dragging = false;
var startX;
var startY;

// Avatars
var avatars = [];

// Render-loop
function updateCanvasArea() {
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    // Draw rects in list
    avatars.forEach((avatar) => {
        context.fillStyle = avatar.fill;
        rect(avatar.x, avatar.y, avatar.width, avatar.height);
    });

    requestAnimationFrame(updateCanvasArea);
}

// Mouse events
canvas.onmousedown = (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Get mouse position
    var mouseX = parseInt(event.clientX - offsetX);
    var mouseY = parseInt(event.clientY - offsetY);

    // Find mouse-avatar overlap
    avatars.forEach((avatar) => {
        if (mouseX > avatar.x && mouseX < avatar.x + avatar.width && mouseY > avatar.y && mouseY < avatar.y + avatar.height) {
            dragging = true;
            avatar.isDragging = true;
        }
    });
    // Save start of drag mouse position
    startX = mouseX;
    startY = mouseY;
}

canvas.onmouseup = (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Reset all dragging-related variables
    dragging = false;
    avatars.forEach((avatar) => {
        avatar.isDragging = false;
    });

    // Notify server of canvas change
    send({
        type: "canvasUpdate",
        avatars: avatars
    });
}

canvas.onmousemove = (event) => {
    if (dragging) {
        event.preventDefault();
        event.stopPropagation();

        // Get mouse position
        var mouseX = parseInt(event.clientX - offsetX);
        var mouseY = parseInt(event.clientY - offsetY);

        // Calculate distance moved since last mousemove event
        var deltaX = mouseX - startX;
        var deltaY = mouseY - startY;

        // Move avatars marked as dragging (isDraggin = true)
        avatars.forEach((avatar) => {
            if (avatar.isDragging) {
                avatar.x += deltaX;
                avatar.y += deltaY;
            }
        });

        // Update start variables for next mousemove event
        startX = mouseX;
        startY = mouseY;
    }
}

function rect(x, y, width, height) {
    context.beginPath();
    context.rect(x, y, width, height);
    context.closePath();
    context.fill();
}

// Trigger render-loop
requestAnimationFrame(updateCanvasArea);