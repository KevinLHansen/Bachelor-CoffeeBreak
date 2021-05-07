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

// Render-loop
function updateCanvasArea() {
    // Clear the canvas
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (room) {
        // Draw "hearing range" indicators
        context.globalAlpha = 0.05;
        room.avatars.forEach((avatar) => {
            if (avatar.name === username) {
                circle(avatar.x, avatar.y, far.threshold, "#f6ff00");
                circle(avatar.x, avatar.y, medium.threshold, "#00fbff");
                circle(avatar.x, avatar.y, close.threshold, "#00ff00");
            }
        });
        context.globalAlpha = 1;

        // Draw avatars
        room.avatars.forEach((avatar) => {
            // Highlight own avatar
            if (avatar.name === username) {
                rect(avatar.x - avatar.width / 2, avatar.y - avatar.height / 2, avatar.width, avatar.height, avatar.fill, true);
            } else {
                rect(avatar.x - avatar.width / 2, avatar.y - avatar.height / 2, avatar.width, avatar.height, avatar.fill, false);
            }
            text(avatar.name, avatar.x, avatar.y - 15, avatar.fill);
        });
    }
    //updateVolumes(); // WORKS but maybe harmful
    requestAnimationFrame(updateCanvasArea);
}

// Mouse events
canvas.onmousedown = (event) => {
    if (room) {
        event.preventDefault();
        event.stopPropagation();

        // Get mouse position
        var mouseX = parseInt(event.clientX - offsetX);
        var mouseY = parseInt(event.clientY - offsetY);

        // Find mouse-avatar overlap
        room.avatars.forEach((avatar) => {
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
}

canvas.onmouseup = (event) => {
    if (room) {
        event.preventDefault();
        event.stopPropagation();

        // Reset dragging-related variables
        room.avatars.forEach((avatar) => {
            avatar.isDragging = false;
        });
        if (isDragging && hasDragged) {
            // Notify server of canvas change
            send({
                type: "canvasUpdate",
                avatars: room.avatars
            });
        }
        isDragging = false;
        hasDragged = false;
    }
}

canvas.onmousemove = (event) => {
    if (room) {
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

            // Move avatars marked as dragging (isDragging = true)
            room.avatars.forEach((avatar) => {
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
        room.avatars.forEach((avatar) => {
            if (avatar.name == username) {
                if (isPointInRect(mouseX, mouseY, avatar)) {
                    canvas.style.cursor = "pointer";
                } else {
                    canvas.style.cursor = "default";
                }
            }
        });
    }
}

function rect(x, y, width, height, fill, stroke) {
    context.fillStyle = fill;
    context.beginPath();
    context.rect(x, y, width, height);
    context.closePath();
    context.fill();
    if (stroke) { context.stroke(); }
}

function circle(x, y, radius, fill) {
    context.fillStyle = fill;
    context.beginPath();
    context.arc(x, y, radius, 0, 2 * Math.PI);
    context.closePath();
    context.fill();
}

function text(text, x, y, fill) {
    context.fillStyle = fill;
    context.font = "12px Arial";
    context.textAlign = "center";
    context.fillText(text, x, y);
}

function isPointInRect(x, y, rect) {
    if (
        x > rect.x - rect.width / 2 &&
        x < rect.x + rect.width / 2 &&
        y > rect.y - rect.height / 2 &&
        y < rect.y + rect.height / 2
    ) {
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