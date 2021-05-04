var canvas = document.querySelector("canvas");
var canvasBounding = canvas.getBoundingClientRect();
var context = canvas.getContext("2d");

var offsetX = canvasBounding.left;
var offsetY = canvasBounding.top;

// Dragging
var isDragging = false;
var hasDragged = false;
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
        // Highlight own avatar
        if (avatar.name === username) {
            rect(avatar.x, avatar.y, avatar.width, avatar.height, avatar.fill, true);
        } else {
            rect(avatar.x, avatar.y, avatar.width, avatar.height, avatar.fill, false);
        }
        text(avatar.name, avatar.x + avatar.width / 2, avatar.y - 5, avatar.fill);
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
        if (isPointInRect(mouseX, mouseY, avatar)) {
            // So user can only drag own avatar
            if (avatar.name === username) {
                isDragging = true;
                avatar.isDragging = true;
            }
        }
    });
    // Save start of drag mouse position
    startX = mouseX;
    startY = mouseY;
}

canvas.onmouseup = (event) => {
    event.preventDefault();
    event.stopPropagation();

    // Reset dragging-related variables
    avatars.forEach((avatar) => {
        avatar.isDragging = false;
    });
    if (isDragging && hasDragged) {
        // Notify server of canvas change
        send({
            type: "canvasUpdate",
            avatars: avatars
        });
    }
    isDragging = false;
    hasDragged = false;

}

canvas.onmousemove = (event) => {
    updateOffset();
    // Get mouse position
    var mouseX = parseInt(event.clientX - offsetX);
    var mouseY = parseInt(event.clientY - offsetY);

    // Dragging
    if (isDragging) {
        event.preventDefault();
        event.stopPropagation();

        hasDragged = true;

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

    // Cursor hover styling
    avatars.forEach((avatar) => {
        if (isPointInRect(mouseX, mouseY, avatar)) {
            if (avatar.name === username) {
                canvas.style.cursor = "pointer";
            }
        } else {
            canvas.style.cursor = "default";
        }
    });
}

function rect(x, y, width, height, fill, stroke) {
    context.fillStyle = fill;
    context.beginPath();
    context.rect(x, y, width, height);
    context.closePath();
    context.fill();
    if (stroke) { context.stroke(); }
}

function text(text, x, y, fill) {
    context.fillStyle = fill;
    context.font = "12px Arial";
    context.textAlign = "center";
    context.fillText(text, x, y);
}

function isPointInRect(x, y, rect) {
    if (x > rect.x && x < rect.x + rect.width && y > rect.y && y < rect.y + rect.height) {
        return true;
    } else {
        return false;
    }
}

// Update offset variables for if the page layout has changed
function updateOffset() {
    canvasBounding = canvas.getBoundingClientRect();
    offsetX = canvasBounding.left;
    offsetY = canvasBounding.top;
}

// Trigger render-loop
requestAnimationFrame(updateCanvasArea);