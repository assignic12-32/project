


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
    
            if (!data.videos) {
                throw new Error("Invalid data format: Missing videos array");
            }
    
            data.videos.forEach(video => {
                const videoElement = document.createElement("div");
                videoElement.classList.add("video-item");
    
                videoElement.innerHTML = `
                    <img src="${video.thumbnail}" alt="${video.title}" class="thumbnail" />
                    <p class="video-title">${video.title}</p>
                `;
    
                videoElement.addEventListener("click", () => {
                    document.getElementById("videoPlayer").src = `https://www.youtube.com/embed/${video.id}`;
                    document.getElementById("videoTitle").textContent = video.title;
                    document.getElementById("videoDescription").textContent = video.description;
                });
    
                playlistContainer.appendChild(videoElement);
            });
    
            nextPageToken = data.nextPageToken;
            if (showMoreButton) {
                showMoreButton.style.display = nextPageToken ? "block" : "none";
            }
        } catch (error) {
            console.error("Error fetching videos:", error.message);
        }
    }
    
    
    if (showMoreButton) {
        showMoreButton.addEventListener("click", fetchVideos);
    }
    
    fetchVideos(); // Initial fetch
});
