document.addEventListener("DOMContentLoaded", function () {
    const playlistContainer = document.getElementById("playlist");
    const showMoreButton = document.getElementById("showMore");
    let nextPageToken = null;

    async function fetchVideos() {
        try {
            const response = await fetch(`/private-videos?pageToken=${nextPageToken || ''}`);

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.videos || !Array.isArray(data.videos)) {
                throw new Error("Invalid data format: Missing or incorrect videos array");
            }

            data.videos.forEach(video => {
                const videoElement = document.createElement("div");
                videoElement.classList.add("video-item");
                videoElement.style.cursor = "pointer";  // Ensure it's clickable

                videoElement.innerHTML = `
                    <img src="${video.thumbnail}" alt="${video.title}" class="thumbnail" />
                    <p class="video-title">${video.title}</p>
                `;

                // Open video in a new tab when clicked
                videoElement.addEventListener("click", () => {
                    playVideoInNewTab(video.id);
                });

                playlistContainer.appendChild(videoElement);
            });

            // Update nextPageToken and show/hide "Show More" button
            nextPageToken = data.nextPageToken || null;
            if (showMoreButton) {
                showMoreButton.style.display = nextPageToken ? "block" : "none";
            }
        } catch (error) {
            console.error("Error fetching videos:", error.message);
        }
    }

    // Open video in a new tab
    function playVideoInNewTab(videoId) {
        window.open(`videoPlayer.html?videoId=${videoId}`, "_blank");
    }

    // Attach event listener once (removed duplicate)
    if (showMoreButton) {
        showMoreButton.addEventListener("click", fetchVideos);
    }

    // Initial fetch of videos
    fetchVideos();
});
