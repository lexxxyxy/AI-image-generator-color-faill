// Set the number of tags to display per page
const tagsPerPage = 20;

// Event listener for the upload button
document.getElementById("uploadButton").addEventListener("click", async () => {
  // Elements and file handling
  const fileInput = document.getElementById("imageInput");
  const file = fileInput.files[0];
  const imagePreview = document.getElementById("imagePreview");
  const uploadModal = document.getElementById("uploadModal");
  const uploadProgress = document.getElementById("uploadProgress");

  // If no file is selected, show a toast message
  if (!file) return showToast("Please select an image file first.");

  // Preview the selected image
  const reader = new FileReader();
  reader.onload = (e) => (imagePreview.src = e.target.result);
  reader.readAsDataURL(file);

  // Imagga API credentials
  const apiKey = "acc_e0154362b874dc6";
  const apiSecret = "0bc8b4ee06031ae80b0b53ce1f4fd6f1";
  const authHeader = "Basic " + btoa(`${apiKey}:${apiSecret}`);

  // Prepare data for upload
  const formData = new FormData();
  formData.append("image", file);

  try {
    uploadModal.style.display = "block";
    uploadProgress.style.width = "0%";

    const uploadResponse = await fetch("https://api.imagga.com/v2/uploads", {
      method: "POST",
      headers: { Authorization: authHeader },
      body: formData,
    });

    if (!uploadResponse.ok) throw new Error("Upload failed.");

    const contentLength = +uploadResponse.headers.get("Content-Length");
    const reader = uploadResponse.body.getReader();
    let receivedLength = 0;
    let chunks = [];

    const responseJson = await uploadResponse.json();
    console.log("Upload Response JSON:", responseJson);

    const responseArray = new Uint8Array(receivedLength);
    let position = 0;
    for (const chunk of chunks) {
      responseArray.set(chunk, position);
      position += chunk.length;
    }

    const text = new TextDecoder("utf-8").decode(responseArray);
    const {
      result: { upload_id },
    } = JSON.parse(text);
    const [colorResult, tagsResult] = await Promise.all([
      fetch(`https://api.imagga.com/v2/colors?image_upload_id=${upload_id}`, {
        headers: { Authorization: authHeader },
      }).then((res) => res.json()),
      fetch(`https://api.imagga.com/v2/tags?image_upload_id=${upload_id}`, {
        headers: { Authorization: authHeader },
      }).then((res) => res.json()),
    ]);

    displayColors(colorResult.result.colors);
    displayTags(tagsResult.result.tags);
  } catch (error) {
    console.error("Error:", error);
    showToast("An error occurred while processing the image!");
  } finally {
    uploadModal.style.display = "none";
  }
});

const displayColors = (colors) => {
  const colorsContainer = document.querySelector(".colors-container");
  colorsContainer.innerHTML = "";

  if (
    ![
      colors.background_colors,
      colors.foreground_colors,
      colors.image_colors,
    ].some((arr) => arr.length)
  ) {
    colorsContainer.innerHTML = '<p class="error">Nothing to show...</p>';
    return;
  }
  const generateColorSection = (title, colorData) => {
    return `

            <h3>${title}</h3>
            <div class="results">
                ${colorData
                  .map(
                    ({ html_code, closest_palette_color, percent }) => `
                    <div class="result-item" data-color="${html_code}">
                        <div>
                            <div class="color-box" style="background-color: ${html_code}" title="Color code: ${html_code}"></div>
                            <p>${html_code}<span> - ${closest_palette_color}</span></p>
                        </div>
                        <div class="progress-bar">
                            <span>${percent.toFixed(2)}%</span>
                            <div class="progress" style="width: ${percent}%"></div>
                        </div>
                    </div> 
                `
                  )
                  .join("")}
            </div>
        `;
  };

  colorsContainer.innerHTML += generateColorSection(
    "Background Colors",
    colors.background_colors
  );
  colorsContainer.innerHTML += generateColorSection(
    "Foreground Colors",
    colors.foreground_colors
  );
  colorsContainer.innerHTML += generateColorSection(
    "Image Colors",
    colors.image_colors
  );

  document
    .querySelectorAll(".colors-container .result-item")
    .forEach((item) => {
      item.addEventListener("click", () => {
        const colorCode = item.getAttribute("data-color");
        navigator.clipboard
          .writeText(colorCode)
          .then(() => showToast(`Copied: ${colorCode}`))
          .catch(() => showToast("Failed to copy color code!"));
      });
    });
};

let allTags = [];
let displayedTags = 0;

const displayTags = (tags) => {
  const tagsContainer = document.querySelector(".tags-container");
  const resultList = tagsContainer.querySelector(".results");
  const error = tagsContainer.querySelector(".error");
  const seeMoreButton = document.getElementById("seeMoreButton");
  const exportTagsButton = document.getElementById("exportTagsButton");

  if (resultList) {
    resultList.innerHTML = "";
  } else {
    const resultListContainer = document.createElement("div");
    resultListContainer.className = "results";
    tagsContainer.insertBefore(resultListContainer, seeMoreButton);
  }

  allTags = tags;
  displayedTags = 0;

  const showMoreTags = () => {
    const tagsToShow = allTags.slice(
      displayedTags,
      displayedTags + tagsPerPage
    );
    displayedTags += tagsToShow.length;

    const tagsHTML = tagsToShow
      .map(
        ({ tag: { en } }) => `
        
            <div class="result-item">
                <p>${en}</p>
            </div>
        `
      )
      .join("");

    if (resultList) {
      resultList.innerHTML += tagsHTML;
    }
    error.style.display = displayedTags > 0 ? "none" : "block";
    seeMoreButton.style.display =
      displayedTags < allTags.length ? "block" : "none";
    exportTagsButton.style.display = displayedTags > 0 ? "block" : "none";
  };

  showMoreTags();

  seeMoreButton.addEventListener("click", showMoreTags);
  exportTagsButton.addEventListener("click", exportTagsToFile);
};

const exportTagsToFile = () => {
  if (allTags.length === 0) {
    showToast("No tags available to export!");
    return;
  }

  const tagsText = allTags.map(({ tag: { en } }) => en).join("\n");
  const blob = new Blob([tagsText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Tags.txt";
  a.click();
  URL.revokeObjectURL(url);
};

const showToast = (message) => {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add("show"), 100);
  setTimeout(() => {
    toast.classList.remove("show");
    setTimeout(() => document.body.removeChild(toast), 500);
  }, 3000);
};
